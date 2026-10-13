"""V1 tests: weighted-flag interpretation at ``y = 0``.

Two inputs are used: the certified chart fixture (chart ``z = 2``,
``alpha = (3,3,3)``, ``gamma = (1,2,3)``) solved with the Hermitian solver,
and the exact ``symmetric_y0`` fixture.
"""

import numpy as np
import pytest
import sympy as sp

from e6sim.charts import x_gauge_action
from e6sim.fixtures import symmetric_y0_fixture
from e6sim.fixtures.certified_y0_chart import CERTIFIED_Z, certified_fixture
from e6sim.flags import flag_geometry
from e6sim.hermitian_solver import solve_real_moment_map


def _solved(rep, levels):
    res = solve_real_moment_map(rep, levels)
    assert res.success
    return res.solved_rep, levels


def certified_solved():
    rep, levels, margins = certified_fixture()
    return _solved(rep, levels)


def symmetric_solved(alpha=1.3, gamma=0.9):
    rep, levels = symmetric_y0_fixture(alpha, gamma)
    return _solved(rep, levels)


def _both():
    return [certified_solved(), symmetric_solved()]


# --- rank of the x-gauge action at the certified fixture --------------------
def test_x_gauge_action_rank_23():
    M = x_gauge_action(CERTIFIED_Z)
    assert M.shape == (24, 23)
    assert M.rank() == 23


# --- branch equations u^*u = alpha, X^*X = gamma I + u u^* -------------------
def test_branch_equations():
    for rep, levels in _both():
        g = flag_geometry(rep, levels)
        assert g["branch_line_residual"] < 1e-8
        assert g["branch_plane_residual"] < 1e-8


# --- projector identity X X^* = alpha Pi_L + gamma Pi_P ---------------------
def test_projector_identity():
    for rep, levels in _both():
        g = flag_geometry(rep, levels)
        assert g["projector_identity_residual"] < 1e-8
        for i in range(3):
            PL, PP = g["Pi_L"][i], g["Pi_P"][i]
            # Hermitian idempotent projectors, ranks 1 and 2
            assert np.allclose(PL, PL.conj().T, atol=1e-12)
            assert np.allclose(PP, PP.conj().T, atol=1e-12)
            assert np.allclose(PL @ PL, PL, atol=1e-12)
            assert np.allclose(PP @ PP, PP, atol=1e-12)
            assert np.trace(PL) == pytest.approx(1.0, abs=1e-10)
            assert np.trace(PP) == pytest.approx(2.0, abs=1e-10)


# --- Q_i decomposition via the projector deviations -------------------------
def test_Q_projector_decomposition():
    for rep, levels in _both():
        g = flag_geometry(rep, levels)
        assert g["Q_projector_residual"] < 1e-8


# --- ordered spectrum and eigenspace identification -------------------------
def test_eigenvalue_formula_and_eigenspaces():
    for rep, levels in _both():
        g = flag_geometry(rep, levels)
        assert g["eigenvalue_residual"] < 1e-9
        assert g["line_eigenspace_residual"] < 1e-7
        assert g["plane_eigenspace_residual"] < 1e-7
        for i in range(3):
            w = g["eigenvalues"][i]
            # descending ordering
            assert w[0] > w[1] > w[2]
            V = g["eigenvectors"][i]
            PL, PP = g["Pi_L"][i], g["Pi_P"][i]
            # first eigenvector lies in L_i
            v0 = V[:, 0].reshape(3, 1)
            assert np.linalg.norm(PL @ v0 - v0) < 1e-7
            # first two eigenvectors span P_i
            assert np.linalg.norm((np.eye(3) - PP) @ V[:, :2]) < 1e-7


# --- squared norm -----------------------------------------------------------
def test_squared_norm():
    for rep, levels in _both():
        g = flag_geometry(rep, levels)
        assert g["norm_sq_residual"] < 1e-8
        for i in range(3):
            a, gm = levels[i, 0], levels[i, 1]
            assert g["norm_sq"][i] == pytest.approx(
                (2.0 / 3.0) * (a ** 2 + a * gm + gm ** 2), rel=1e-9)


# --- pairwise trace identity ------------------------------------------------
def test_pairwise_identity():
    for rep, levels in _both():
        g = flag_geometry(rep, levels)
        assert np.allclose(g["pairwise"], g["pairwise_expected"], atol=1e-8)


# --- 8-vector dot equals matrix trace pairing -------------------------------
def test_pack_dot_equals_trace_pairing():
    for rep, levels in _both():
        g = flag_geometry(rep, levels)
        assert g["pack_dot_residual"] < 1e-8
        # Q_i as an 8-vector is the level-weighted combination of the deviations.
        for i in range(3):
            a, gm = levels[i, 0], levels[i, 1]
            assert np.allclose(
                g["q"][i], a * g["d_L"][i] + gm * g["d_P"][i], atol=1e-9)


# --- exact symbolic check of the eigenvalue and norm formulas ---------------
def test_sympy_exact_eigenvalue_and_norm():
    a, g = sp.symbols("a g", positive=True)
    I3 = sp.eye(3)
    # adapted orthonormal basis: L = span(e1), P = span(e1, e2)
    Pi_L = sp.diag(1, 0, 0)
    Pi_P = sp.diag(1, 1, 0)
    Q = a * (Pi_L - I3 / 3) + g * (Pi_P - 2 * I3 / 3)
    expected = sp.diag((2 * a + g) / 3, (-a + g) / 3, -(a + 2 * g) / 3)
    assert sp.simplify(Q - expected) == sp.zeros(3, 3)
    # squared Frobenius norm
    norm_sq = sp.expand(sum(Q[i, j] ** 2 for i in range(3) for j in range(3)))
    assert sp.simplify(norm_sq - sp.Rational(2, 3) * (a ** 2 + a * g + g ** 2)) == 0
