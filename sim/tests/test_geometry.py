"""V0 tests: geometry extraction from solved matrices."""

import numpy as np
import pytest

from e6sim.fixtures import symmetric_y0_fixture
from e6sim.geometry import extract_geometry, triangle_side_from_pairwise, vector_dot_matrix_trace
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.transverse import build_transverse_rep


def solved_fixture(alpha=1.3, gamma=0.9):
    rep, levels = symmetric_y0_fixture(alpha, gamma)
    res = solve_real_moment_map(rep, levels)
    assert res.success
    return res.solved_rep, levels


def test_geometry_hermitian_traceless():
    rep, levels = solved_fixture()
    g = extract_geometry(rep, levels)
    for Ti in g["T"]:
        assert np.allclose(Ti, Ti.conj().T, atol=1e-12)
    for Qi in g["Q"]:
        assert np.allclose(Qi, Qi.conj().T, atol=1e-12)
        assert np.trace(Qi) == pytest.approx(0.0, abs=1e-12)


def test_vector_norm_matches_matrix_norm():
    rep, levels = solved_fixture()
    g = extract_geometry(rep, levels)
    for i in range(3):
        assert np.linalg.norm(g["q"][i]) == pytest.approx(
            np.linalg.norm(g["Q"][i], "fro"), rel=1e-12)
        assert np.dot(g["q"][i], g["q"][i]) == pytest.approx(
            g["pairwise"][i, i], rel=1e-12)


def test_vector_dot_equals_trace_pairing():
    rep, levels = solved_fixture()
    g = extract_geometry(rep, levels)
    for i in range(3):
        for j in range(3):
            d, tr = vector_dot_matrix_trace(g["q"][i], g["q"][j], g["Q"][i], g["Q"][j])
            assert d == pytest.approx(tr, rel=1e-12)


def test_branch_trace_identity_on_solved_rep():
    alpha, gamma = 2.0, 0.5
    rep, levels = solved_fixture(alpha, gamma)
    g = extract_geometry(rep, levels)
    for i in range(3):
        assert g["branch_traces"][i] == pytest.approx(
            g["branch_traces_expected"][i], rel=1e-10)
        assert g["branch_traces_expected"][i] == pytest.approx(alpha + 2 * gamma)


def test_closure_matches_residual():
    rep, levels = solved_fixture()
    g = extract_geometry(rep, levels)
    # solved rep: closure error is at the solver's residual level
    assert g["closure_error"] < 1e-9


def test_triangle_identity():
    rep, levels = solved_fixture()
    g = extract_geometry(rep, levels)
    p = g["pairwise"]
    lhs = p[0, 1]
    rhs = triangle_side_from_pairwise(p, 0, 1, 2)
    assert lhs == pytest.approx(rhs, rel=1e-10)


# --- V5: bilinear K_i = X_i Y_i on the transverse (nonzero y) family --------
def test_v5_k_identities_on_transverse_family():
    rep = build_transverse_rep(2, 1.0)
    g = extract_geometry(rep)
    assert g["closure_K_error"] < 1e-10
    for i in range(3):
        assert np.trace(g["K"][i]) == pytest.approx(0.0, abs=1e-10)
        assert np.allclose(g["C"][i], g["C"][i].conj().T, atol=1e-12)
        assert np.allclose(g["F"][i], g["F"][i].conj().T, atol=1e-12)
        assert np.trace(g["C"][i]) == pytest.approx(0.0, abs=1e-10)
        assert np.trace(g["F"][i]) == pytest.approx(0.0, abs=1e-10)
    assert np.linalg.norm(sum(g["C"])) < 1e-10
    assert np.linalg.norm(sum(g["F"])) < 1e-10


def test_v5_k_vanishes_at_y0():
    rep = build_transverse_rep(2, 0.0)
    g = extract_geometry(rep)
    for i in range(3):
        assert np.allclose(g["K"][i], 0.0, atol=1e-14)


def test_v5_phase_rotation():
    psi = 0.7
    rep = build_transverse_rep(2, 1.0)
    rep2 = build_transverse_rep(2, np.exp(1j * psi))
    g1 = extract_geometry(rep)
    g2 = extract_geometry(rep2)
    c, s = np.cos(psi), np.sin(psi)
    for i in range(3):
        # Q_i unchanged by a unit phase on all y at fixed x
        assert np.allclose(g1["Q"][i], g2["Q"][i], atol=1e-12)
        # K_i -> e^{i psi} K_i, so C_i -> cos C - sin F, F_i -> sin C + cos F
        assert np.allclose(g2["K"][i], np.exp(1j * psi) * g1["K"][i], atol=1e-12)
        assert np.allclose(g2["C"][i], c * g1["C"][i] - s * g1["F"][i], atol=1e-12)
        assert np.allclose(g2["F"][i], s * g1["C"][i] + c * g1["F"][i], atol=1e-12)
