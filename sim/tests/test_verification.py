"""Consolidated independent verification suite (head-honcho cross-checks).

These tests deliberately re-derive the key results with self-contained logic
(their own flag/weight enumeration) rather than re-running the modules under
test, so that a green suite is a genuine cross-check of M1/M4/M5 and not a
tautology.  Kept in one file to bound cost.
"""

import numpy as np
import pytest
import sympy as sp

from e6sim.charts import candidate_y0_chart, dxdz, x_gauge_action
from e6sim.fixtures.certified_y0_chart import certified_fixture
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.moment_maps import complex_residual_norm, real_residual_norm
from e6sim.representation import Rep
from e6sim.transverse import transverse_kernel, transverse_pairing, y_system_matrix

ALPHA = [sp.Integer(3)] * 3
GAMMA = [sp.Integer(1), sp.Integer(2), sp.Integer(3)]


# --- self-contained flag / weight machinery ---------------------------------
def _north_flags(z):
    z = sp.sympify(z)
    e = [sp.Matrix([1, 0, 0]), sp.Matrix([0, 1, 0]), sp.Matrix([0, 0, 1])]
    L = e
    P = [sp.Matrix([[1, 0], [0, 1], [0, 1]]),
         sp.Matrix([[0, 1], [1, 0], [0, 1]]),
         sp.Matrix([[0, 1], [0, z], [1, 0]])]
    return L, P


def _pole_flags():
    e = [sp.Matrix([1, 0, 0]), sp.Matrix([0, 1, 0]), sp.Matrix([0, 0, 1])]
    L = e
    P = [sp.Matrix([[1, 0], [0, 1], [0, 1]]),
         sp.Matrix([[0, 1], [1, 0], [0, 1]]),
         sp.Matrix([[0, 0], [0, 1], [1, 0]])]   # A_3 at zeta = 0
    return L, P


def _weight(L, P, W, alpha=ALPHA, gamma=GAMMA):
    def cap(U, V):
        return int(U.rank() + V.rank() - U.row_join(V).rank())
    d = int(W.rank())
    s = sum(alpha[i] * cap(W, L[i]) + gamma[i] * cap(W, P[i]) for i in range(3))
    return sp.simplify(s - sp.Rational(d, 3) * sum(alpha[i] + 2 * gamma[i] for i in range(3)))


def _all_margins(L, P):
    n = [sp.Matrix(sp.Matrix(Pi).T.nullspace()[0]).T for Pi in P]
    cands = {f"L{i+1}": L[i] for i in range(3)}
    for i in range(3):
        for j in range(i + 1, 3):
            b = sp.Matrix([n[i], n[j]]).nullspace()
            if b:
                cands[f"P{i+1}capP{j+1}"] = b[0]
    for i in range(3):
        cands[f"genline_P{i+1}"] = P[i].col(1)
    cands["genline"] = sp.Matrix([1, 3, 5])
    for i in range(3):
        cands[f"P{i+1}"] = P[i]
    for i in range(3):
        for j in range(i + 1, 3):
            cands[f"<L{i+1},L{j+1}>"] = L[i].row_join(L[j])
    extra = {0: sp.Matrix([0, 1, 2]), 1: sp.Matrix([1, 0, 2]), 2: sp.Matrix([1, 1, 1])}
    for i in range(3):
        cands[f"1axisplane_L{i+1}"] = L[i].row_join(extra[i])
    gb = sp.Matrix([[1, 1, 1]]).nullspace()
    cands["genplane"] = gb[0].row_join(gb[1])
    return {k: _weight(L, P, W) for k, W in cands.items()}


# --- M1: independent certificate -------------------------------------------
def test_independent_king_certificate_at_z2():
    m = _all_margins(*_north_flags(2))
    assert all(v < 0 for v in m.values())
    assert max(m.values()) == -1


def test_independent_exceptional_finite_z():
    z = sp.symbols("z")
    n = [sp.Matrix([0, -1, 1]), sp.Matrix([1, 0, -1]), sp.Matrix([-z, 1, 0])]
    axes = [sp.Matrix([1, 0, 0]), sp.Matrix([0, 1, 0]), sp.Matrix([0, 0, 1])]
    conds = set()
    for nv in n:
        for e in axes:
            conds.add(sp.expand((nv.T * e)[0]))
    dirs = [n[0].cross(n[1]), n[0].cross(n[2]), n[1].cross(n[2])]
    for nv in n:
        for dv in dirs:
            conds.add(sp.expand((nv.T * dv)[0]))
    sols = set()
    for c in conds:
        if c == 0:
            continue
        for s in sp.solve(sp.Eq(c, 0), z):
            if s.is_real:
                sols.add(s)
    assert sols == {sp.Integer(0), sp.Integer(1)}


def test_structural_rank_and_tangent():
    Mx = x_gauge_action(sp.Integer(2))
    assert Mx.shape == (24, 23) and Mx.rank() == 23
    assert Mx.row_join(dxdz(sp.Integer(2))).rank() == 24


# --- M4: independent endpoint classification --------------------------------
def test_independent_endpoint_stability():
    assert max(_all_margins(*_north_flags(2)).values()) < 0      # stable
    assert max(_all_margins(*_north_flags(1)).values()) < 0      # z=1 stable
    assert max(_all_margins(*_north_flags(0)).values()) == 1     # z=0 unstable
    assert max(_all_margins(*_pole_flags()).values()) == 1       # pole unstable


# --- M2: solver on the certified fixture -----------------------------------
def test_solver_on_certified_fixture():
    rep, levels, margins = certified_fixture()
    assert all(v < 0 for v in margins.values())
    res = solve_real_moment_map(rep, levels)
    assert res.success
    assert real_residual_norm(res.solved_rep, levels) < 1e-9
    assert complex_residual_norm(res.solved_rep) < 1e-9
    assert abs(complex(np.linalg.det(res.H["center"])) - 1.0) < 1e-9


def test_solver_agrees_modulo_compact_gauge():
    rep, levels, _ = certified_fixture()
    base = solve_real_moment_map(rep, levels)
    rng = np.random.default_rng(0)
    g = rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3)) + 2 * np.eye(3)
    g = g / np.linalg.det(g) ** (1 / 3)
    h = [rng.normal(size=(2, 2)) + 1j * rng.normal(size=(2, 2)) + np.eye(2)
         for _ in range(3)]
    q = [np.array([[1.0 + 0.1j]]) for _ in range(3)]
    other = solve_real_moment_map(rep.gauge(g, h, q), levels)
    assert other.success

    def spectra(r):
        out = []
        for i in range(3):
            M = r.A[i] @ r.A[i].conj().T - r.B[i].conj().T @ r.B[i]
            Q = M - np.trace(M) / 3 * np.eye(3)
            out.append(np.sort(np.linalg.eigvalsh(Q)))
        return np.array(out)

    assert np.allclose(spectra(base.solved_rep), spectra(other.solved_rep), atol=1e-8)


# --- M5: independent kernel / transpose -------------------------------------
def test_transverse_kernel_shape_and_pairing():
    M = y_system_matrix(sp.Integer(2))
    assert M.shape == (23, 24) and M.rank() == 23
    assert len(M.nullspace()) == 1
    assert transverse_pairing(2) == 1
    assert transverse_pairing(3) == 1


def test_transpose_identity_rows_space():
    S = sp.zeros(24, 24)
    for i in range(3):
        off = 8 * i
        S[off, off] = 1
        S[off + 1, off + 1] = 1
        for p in range(3):
            for q in range(2):
                S[off + 2 + p * 2 + q, off + 2 + q * 3 + p] = 1
    Mx = x_gauge_action(sp.Integer(2))
    MxT = Mx.T @ S
    My = y_system_matrix(sp.Integer(2))
    assert My.col_join(MxT).rank() == 23
    assert sp.simplify(MxT * sp.Matrix(transverse_kernel(2))) == sp.zeros(23, 1)
