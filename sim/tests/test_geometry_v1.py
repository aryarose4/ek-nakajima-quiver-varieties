"""Visualizer milestone V1 tests: weighted-flag / spectral identities at ``y = 0``.

Certified fixture: ``fixtures.certified_y0_chart.certified_fixture`` at
``z = 2``, levels ``((3,1),(3,2),(3,3))``.  Every assertion below is a real
identity on the solved or chart-flag data, not a tautology.

Caveat proved by these tests (flagged in the return note): ``gauge_invariants``
is built from the *chart* flags, which are related to the balanced *solved*
flags by the solver's positive (non-unitary) Hermitian gauge.  Orthogonal
projectors do not transform by similarity under a non-unitary map, so the
chart-flag overlaps/pairwise data differ from the solved representative's.
Only the spectral and edge-norm data (functions of ``(alpha_i, gamma_i)``
alone) agree.  ``q_from_flags`` reproduces the solved ``Q_i`` when it is fed the
solved flags.
"""

import json
from pathlib import Path

import numpy as np
import pytest

from e6sim.fixtures.certified_y0_chart import CERTIFIED_LEVELS, certified_fixture
from e6sim.geometry import extract_geometry
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.v1 import (
    gauge_invariants,
    line_projector,
    ordered_spectrum,
    plane_projector,
    projector_overlaps,
    q_from_flags,
    spectrum_expected,
    squared_norm_expected,
)

REL = 1e-9


# --- shared solved fixture -------------------------------------------------
@pytest.fixture(scope="module")
def solved():
    rep, levels, _margins = certified_fixture()
    res = solve_real_moment_map(rep, levels)
    assert res.success
    return res.solved_rep, np.asarray(levels, dtype=float)


@pytest.fixture(scope="module")
def solved_flags(solved):
    rep, levels = solved
    L_proj, P_proj = [], []
    for i in range(3):
        X, u = rep.A[i], rep.a[i]
        L_proj.append(line_projector(X @ u))
        P_proj.append(plane_projector(X))
    return L_proj, P_proj


# --- V1 projector identity on the solved representative --------------------
def test_v1_projector_identity(solved, solved_flags):
    rep, levels = solved
    L_proj, P_proj = solved_flags
    for i in range(3):
        alpha, gamma = levels[i]
        lhs = rep.A[i] @ rep.A[i].conj().T
        rhs = alpha * L_proj[i] + gamma * P_proj[i]
        assert np.allclose(lhs, rhs, rtol=REL, atol=REL)


def test_v1_ordered_spectra(solved):
    rep, levels = solved
    g = extract_geometry(rep, levels)
    for i in range(3):
        assert np.allclose(ordered_spectrum(g["Q"][i]),
                           spectrum_expected(*levels[i]), rtol=REL, atol=REL)


def test_v1_squared_norms(solved):
    rep, levels = solved
    g = extract_geometry(rep, levels)
    for i in range(3):
        n2 = float(np.trace(g["Q"][i] @ g["Q"][i]).real)
        assert n2 == pytest.approx(squared_norm_expected(*levels[i]), rel=REL)


def test_v1_pairwise_trace_formula(solved):
    # Requires closure sum_i Q_i = 0, which holds on the solved representative.
    rep, levels = solved
    g = extract_geometry(rep, levels)
    p = g["pairwise"]
    for i in range(3):
        for j in range(i + 1, 3):
            k = 3 - i - j
            rhs = (p[k, k] - p[i, i] - p[j, j]) / 2.0
            assert p[i, j] == pytest.approx(rhs, rel=REL, abs=REL)
            assert p[i, j] == pytest.approx(p[j, i], rel=REL, abs=REL)


# --- q_from_flags reproduces the solved Q_i (and survives a unitary gauge) --
def test_q_from_flags_matches_solved(solved, solved_flags):
    rep, levels = solved
    L_proj, P_proj = solved_flags
    g = extract_geometry(rep, levels)
    Qf = q_from_flags(L_proj, P_proj, levels)
    for i in range(3):
        assert np.allclose(ordered_spectrum(Qf[i]), spectrum_expected(*levels[i]),
                           rtol=REL, atol=REL)
        assert np.allclose(ordered_spectrum(Qf[i]), ordered_spectrum(g["Q"][i]),
                           rtol=REL, atol=REL)
    pf = np.array([[float(np.trace(Qf[i] @ Qf[j]).real) for j in range(3)]
                   for i in range(3)])
    assert np.allclose(pf, g["pairwise"], rtol=REL, atol=REL)
    ovf = projector_overlaps(L_proj, P_proj)
    ovs = projector_overlaps(
        [line_projector(rep.A[i] @ rep.a[i]) for i in range(3)],
        [plane_projector(rep.A[i]) for i in range(3)],
    )
    for k in ("LL", "LP", "PP"):
        assert np.allclose(ovf[k], ovs[k], rtol=REL, atol=REL)


def test_q_from_flags_invariant_under_central_su3(solved):
    # Q_i transform by simultaneous central conjugation; the flag invariants
    # (spectra, pairwise, overlaps) are unchanged.  This is the exact sense in
    # which q_from_flags reproduces Q_i "up to simultaneous central SU(3)".
    rep, levels = solved
    rng = np.random.default_rng(3)
    m = rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3))
    q_mat, _r = np.linalg.qr(m)
    q_mat = q_mat / np.linalg.det(q_mat) ** (1.0 / 3.0)

    rep2 = rep.gauge(q_mat, [np.eye(2, dtype=complex)] * 3,
                     [np.array([[1.0 + 0j]])] * 3)

    def flags(r):
        return ([line_projector(r.A[i] @ r.a[i]) for i in range(3)],
                [plane_projector(r.A[i]) for i in range(3)])

    L1, P1 = flags(rep)
    L2, P2 = flags(rep2)
    Q1 = q_from_flags(L1, P1, levels)
    Q2 = q_from_flags(L2, P2, levels)

    for i in range(3):
        assert np.allclose(q_mat @ Q1[i] @ q_mat.conj().T, Q2[i], rtol=REL, atol=REL)
        assert np.allclose(ordered_spectrum(Q1[i]), ordered_spectrum(Q2[i]),
                           rtol=REL, atol=REL)
    p1 = np.array([[np.trace(Q1[i] @ Q1[j]).real for j in range(3)] for i in range(3)])
    p2 = np.array([[np.trace(Q2[i] @ Q2[j]).real for j in range(3)] for i in range(3)])
    assert np.allclose(p1, p2, rtol=1e-8, atol=1e-8)
    o1 = projector_overlaps(L1, P1)
    o2 = projector_overlaps(L2, P2)
    for k in ("LL", "LP", "PP"):
        assert np.allclose(o1[k], o2[k], rtol=1e-8, atol=1e-8)


# --- spectral recovery of the flag projectors ------------------------------
def test_spectral_recovery_of_flag_projectors(solved, solved_flags):
    rep, levels = solved
    L_proj, P_proj = solved_flags
    g = extract_geometry(rep, levels)
    for i in range(3):
        Q = g["Q"][i]
        w, V = np.linalg.eigh(Q)  # ascending
        # top eigenvector spans L_i
        v_top = V[:, -1:]
        Pi_L_spectral = v_top @ v_top.conj().T
        assert np.allclose(Pi_L_spectral, L_proj[i], atol=1e-7)
        # top two span P_i
        V2 = V[:, -2:]
        Pi_P_spectral = V2 @ V2.conj().T
        assert np.allclose(Pi_P_spectral, P_proj[i], atol=1e-7)


# --- chart-flag reference bundle: structural identities --------------------
def test_gauge_invariants_spectral_structure():
    gi = gauge_invariants(2.0, CERTIFIED_LEVELS)
    levels = np.asarray(CERTIFIED_LEVELS, dtype=float)
    for i in range(3):
        assert np.allclose(np.array(gi["spectra"][i]),
                           spectrum_expected(*levels[i]), rtol=REL, atol=REL)
        assert gi["edge_norms_sq"][i] == pytest.approx(
            squared_norm_expected(*levels[i]), rel=REL)
        assert gi["branch_traces"][i] == pytest.approx(
            levels[i, 0] + 2.0 * levels[i, 1], rel=REL)
    # projector overlaps are the trace of rank-1 / rank-2 projectors
    for i in range(3):
        assert gi["overlaps"]["LL"][i][i] == pytest.approx(1.0, rel=REL)
        assert gi["overlaps"]["PP"][i][i] == pytest.approx(2.0, rel=REL)


# --- exported JSON reproducibility -----------------------------------------
GRID_Z = [(0.5, 0.0), (1.5, 0.0), (2.0, 0.0), (3.0, 0.0), (2.0, 0.5)]
GRID_LEVELS = [((3, 1), (3, 2), (3, 3)),
               ((2, 1), (2, 1), (2, 1)),
               ((4, 1), (3, 2), (2, 2))]

REFERENCE_PATH = Path(__file__).parent / "fixtures" / "chart_invariants_reference.json"


def _assert_close(a, b, rel=REL):
    if isinstance(a, dict):
        assert set(a) == set(b)
        for k in a:
            _assert_close(a[k], b[k], rel)
    elif isinstance(a, list):
        assert len(a) == len(b)
        for x, y in zip(a, b):
            _assert_close(x, y, rel)
    else:
        assert float(a) == pytest.approx(float(b), rel=rel, abs=rel)


def test_exported_reference_is_reproducible():
    assert REFERENCE_PATH.exists(), "run tools/export_chart_invariants.py first"
    data = json.loads(REFERENCE_PATH.read_text())
    assert data["schema"] == "e6-chart-invariants/1"
    points = data["points"]
    assert len(points) == len(GRID_Z) * len(GRID_LEVELS)

    z, lv = GRID_Z[2], GRID_LEVELS[0]          # (z=2, certified levels)
    idx = 2 * len(GRID_LEVELS) + 0
    recomputed = gauge_invariants(complex(*z), np.asarray(lv, dtype=float))
    _assert_close(recomputed, points[idx])

    z, lv = GRID_Z[4], GRID_LEVELS[2]          # (z=2+0.5j, last levels)
    idx = 4 * len(GRID_LEVELS) + 2
    recomputed = gauge_invariants(complex(*z), np.asarray(lv, dtype=float))
    _assert_close(recomputed, points[idx])
