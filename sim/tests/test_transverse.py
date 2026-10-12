"""Milestone 5 tests: transverse y direction of the certified chart."""

import numpy as np
import pytest
import sympy as sp

from e6sim.charts import candidate_y0_chart, x_gauge_action, dxdz
from e6sim.fixtures.certified_y0_chart import certified_fixture
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.moment_maps import complex_residual_norm, real_residual_norm
from e6sim.transverse import (
    build_transverse_rep,
    transverse_kernel,
    transverse_pairing,
    y_system_matrix,
)


def _pairing_permutation():
    """24x24 permutation identifying y-coords with x-coords under <x,y>."""
    S = sp.zeros(24, 24)
    for i in range(3):
        off = 8 * i
        S[off + 0, off + 0] = 1          # b00 <-> a00
        S[off + 1, off + 1] = 1          # b01 <-> a10
        for p in range(3):
            for q in range(2):
                S[off + 2 + p * 2 + q, off + 2 + q * 3 + p] = 1  # A[p,q] <-> B[q,p]
    return S


def test_y_system_kernel_is_one_dimensional():
    for z in (sp.Integer(2), sp.Integer(3)):
        M = y_system_matrix(z)
        assert M.shape == (23, 24)
        assert M.rank() == 23
        assert len(M.nullspace()) == 1


def test_kernel_pairing_normalized_to_one():
    for z in (2, 3, sp.Rational(5, 2)):
        assert transverse_pairing(z) == 1


def test_transverse_family_is_complex_exact():
    for z in (2, 3):
        for w in (0.0, 0.25, 1.0, 2.5):
            rep = build_transverse_rep(z, w)
            assert complex_residual_norm(rep) < 1e-12


def test_w_zero_recovers_y0_chart():
    rep = build_transverse_rep(2, 0.0)
    for i in range(3):
        assert np.allclose(rep.b[i], 0, atol=1e-14)
        assert np.allclose(rep.B[i], 0, atol=1e-14)


def test_cotangent_transpose_identity():
    # The linearised y-system is the transpose of the x-gauge action under the
    # trace pairing: same row space and the same one-dimensional kernel.
    z = sp.Integer(2)
    Mx = x_gauge_action(z)                       # 24 x 23
    My = y_system_matrix(z)                      # 23 x 24
    MxT = Mx.T @ _pairing_permutation()          # 23 x 24, columns in y-coords
    assert Mx.rank() == 23
    assert My.rank() == 23
    assert My.col_join(MxT).rank() == 23         # identical row space
    Y = sp.Matrix(transverse_kernel(z))
    assert sp.simplify(MxT * Y) == sp.zeros(23, 1)


def test_solver_accepts_transverse_family():
    _, levels, _ = certified_fixture()
    for w in (0.2, 1.0, 2.0):
        rep = build_transverse_rep(2, w)
        res = solve_real_moment_map(rep, levels)
        assert res.success
        assert real_residual_norm(res.solved_rep, levels) < 1e-9
        assert complex_residual_norm(res.solved_rep) < 1e-9
