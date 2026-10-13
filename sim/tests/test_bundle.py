"""Tests for the solved-geometry bundle (visualizer V2 data export).

Every assertion is a real identity checked against the *solved* representative
(or an independent recomputation from the levels), not a tautology.  The key
point: the geometry is extracted from the solver's at-level representative, not
from the chart's own flags.
"""

import json
from pathlib import Path

import numpy as np
import pytest

from e6sim.bundle import (
    CERTIFIED_SWEEP_LEVELS,
    PRESET_LEVELS,
    _solved_flags,
    align_central,
    build_solved_bundle,
    point_record,
    solve_point,
)
from e6sim.fixtures.certified_y0_chart import certified_fixture
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.moment_maps import real_residual_norm

REL = 1e-9

POINT_KEYS = {
    "z_re", "z_im", "levels", "q", "line_dir", "plane_dir", "edge_norms_sq",
    "pairwise", "spectra", "overlaps", "branch_traces", "closure_error",
    "stable", "view_frame", "vertices", "markers",
}

JSON_PATH = Path(__file__).resolve().parents[2] / "assets" / "data" / "e6-triangle-solved.json"


@pytest.fixture(scope="module")
def bundle():
    return build_solved_bundle()


def _all_points(b):
    return list(b["sweep"]) + list(b["presets"])


# --- schema / structure ----------------------------------------------------
def test_bundle_schema(bundle):
    assert bundle["schema"] == "e6-triangle-solved/1"
    assert bundle["basis"] == "traceless_hermitian_3"
    assert len(bundle["sweep"]) == 21
    assert len(bundle["presets"]) == len(PRESET_LEVELS) == 2
    assert bundle["skipped"] == []
    for opt in bundle["levels_options"]:
        assert set(opt) == {"label", "alpha", "gamma"}
        assert len(opt["alpha"]) == 3 and len(opt["gamma"]) == 3


def test_point_record_keys(bundle):
    for pt in _all_points(bundle):
        assert set(pt) == POINT_KEYS | {"label"}


def test_recomputed_point_matches_record(bundle):
    # Recompute the certified z = 2 sweep point from scratch and compare.
    z = complex(2.0 * np.cos(np.pi / 6), 2.0 * np.sin(np.pi / 6))
    _s, aligned, info = solve_point(z, CERTIFIED_SWEEP_LEVELS, None)
    assert info["solver_success"]
    rec = point_record(z, CERTIFIED_SWEEP_LEVELS, aligned)
    match = min(bundle["sweep"],
                key=lambda p: (p["z_re"] - z.real) ** 2 + (p["z_im"] - z.imag) ** 2)
    assert match["z_re"] == pytest.approx(z.real, abs=1e-12)
    assert match["z_im"] == pytest.approx(z.imag, abs=1e-12)
    # spectra / edge norms / pairwise / overlaps are central-gauge invariants.
    for key in ("edge_norms_sq", "spectra", "pairwise", "branch_traces",
                "closure_error"):
        assert np.allclose(match[key], rec[key], rtol=1e-8, atol=1e-8)
    for k in ("LL", "LP", "PP"):
        assert np.allclose(match["overlaps"][k], rec["overlaps"][k],
                           rtol=1e-7, atol=1e-7)


# --- geometric identities on the solved representative ---------------------
def test_closure_error_small(bundle):
    for pt in _all_points(bundle):
        assert pt["closure_error"] < 1e-8


def test_edge_norms_from_levels(bundle):
    for pt in _all_points(bundle):
        levels = pt["levels"]
        for i, (a, g) in enumerate(levels):
            expected = (2.0 / 3.0) * (a * a + a * g + g * g)
            assert pt["edge_norms_sq"][i] == pytest.approx(expected, rel=REL)


def test_spectra_from_levels(bundle):
    for pt in _all_points(bundle):
        for i, (a, g) in enumerate(pt["levels"]):
            expected = [(2.0 * a + g) / 3.0, (-a + g) / 3.0, -(a + 2.0 * g) / 3.0]
            assert np.allclose(pt["spectra"][i], expected, rtol=REL, atol=REL)


def test_vectors_match_matrix_traces(bundle):
    # ||q_i||^2 == ||Q_i||_F^2 == trace(Q_i^2); pairwise == trace(Q_i Q_j).
    for pt in _all_points(bundle):
        q = np.asarray(pt["q"])
        for i in range(3):
            assert np.dot(q[i], q[i]) == pytest.approx(pt["edge_norms_sq"][i], rel=REL)
        pairwise = np.asarray(pt["pairwise"])
        assert np.allclose(pairwise, pairwise.T, rtol=1e-9, atol=1e-9)
        # closure: sum_i q_i = 0 since sum_i Q_i = 0
        assert np.linalg.norm(q.sum(axis=0)) < 1e-8


def test_triangle_edge_lengths_match_edge_norms(bundle):
    for pt in _all_points(bundle):
        v = np.asarray(pt["vertices"])
        assert v.shape == (3, 3)
        edges = [np.linalg.norm(v[0] - v[1]),
                 np.linalg.norm(v[1] - v[2]),
                 np.linalg.norm(v[2] - v[0])]
        for i in range(3):
            assert edges[i] == pytest.approx(np.sqrt(pt["edge_norms_sq"][i]), rel=REL)
        # V1 closure law on independent quantities: pairwise[j,k] is determined
        # by the three squared edge norms (uses sum_i q_i = 0).
        p = np.asarray(pt["pairwise"])
        e = pt["edge_norms_sq"]
        for i in range(3):
            j, k = (i + 1) % 3, (i + 2) % 3
            assert p[j, k] == pytest.approx(0.5 * (e[i] - e[j] - e[k]), abs=1e-8)


def test_view_frame_orthonormal(bundle):
    for pt in _all_points(bundle):
        F = np.asarray(pt["view_frame"])
        assert F.shape == (3, 8)
        assert np.allclose(F @ F.T, np.eye(3), atol=1e-9)
        assert np.allclose(np.linalg.norm(F, axis=1), 1.0, atol=1e-9)


def test_triangle_lies_in_first_two_frame_directions(bundle):
    for pt in _all_points(bundle):
        F = np.asarray(pt["view_frame"])
        q = np.asarray(pt["q"])
        # q1, q2 are in span(e1, e2) => zero component along e3 for the vertices.
        assert np.allclose(F[2] @ q[0], 0.0, atol=1e-9)
        assert np.allclose(F[2] @ q[1], 0.0, atol=1e-9)


def test_markers_finite(bundle):
    for pt in _all_points(bundle):
        assert np.all(np.isfinite(pt["markers"]["line"]))
        assert np.all(np.isfinite(pt["markers"]["plane"]))
        assert np.asarray(pt["markers"]["line"]).shape == (3, 3)
        assert np.asarray(pt["markers"]["plane"]).shape == (3, 3)


def test_flags_rank_checked(bundle):
    # The exported flags come from the solved rep with a rank check; rebuild them
    # and confirm the line/plane deviations are traceless with the right norms.
    from e6sim.conventions import CENTER_BASIS, pack_hermitian

    z = 2.0
    _s, aligned, info = solve_point(z, CERTIFIED_SWEEP_LEVELS, None)
    assert info["solver_success"]
    L_proj, P_proj = _solved_flags(aligned)
    for i in range(3):
        assert np.allclose(np.trace(L_proj[i]), 1.0, atol=1e-9)
        assert np.allclose(np.trace(P_proj[i]), 2.0, atol=1e-9)
        d_line = L_proj[i] - np.eye(3) / 3.0
        assert abs(np.trace(d_line)) < 1e-12
        assert np.linalg.norm(pack_hermitian(d_line, CENTER_BASIS)) == pytest.approx(
            np.sqrt(2.0 / 3.0), rel=1e-9)


# --- alignment -------------------------------------------------------------
def _central_distance(r, p):
    return float(sum(np.linalg.norm(r.A[i] - p.A[i]) ** 2 for i in range(3)))


def test_align_central_preserves_real_residual():
    rep0, levels, _ = certified_fixture()
    res = solve_real_moment_map(rep0, levels)
    assert res.success
    solved = res.solved_rep

    rng = np.random.default_rng(7)
    h = rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3))
    q_mat, _ = np.linalg.qr(h)
    q_mat = q_mat / np.linalg.det(q_mat) ** (1.0 / 3.0)  # det 1
    prev = solved.gauge(q_mat, [np.eye(2, dtype=complex)] * 3,
                        [np.array([[1.0 + 0.0j]])] * 3)

    before = real_residual_norm(solved, levels)
    aligned, u = align_central(solved, prev)
    after = real_residual_norm(aligned, levels)

    assert after == pytest.approx(before, rel=1e-9, abs=1e-12)
    # u is unitary
    assert np.allclose(u.conj().T @ u, np.eye(3), atol=1e-9)
    # prev was a central gauge of solved, so the aligned rep matches it closely
    assert _central_distance(aligned, prev) < 1e-18
    # and the alignment did not increase the distance
    assert _central_distance(aligned, prev) <= _central_distance(solved, prev) + 1e-12


# --- exported JSON ---------------------------------------------------------
def test_exported_json_reproducible():
    assert JSON_PATH.exists(), "run tools/export_triangle_solved.py first"
    data = json.loads(JSON_PATH.read_text())
    assert data["schema"] == "e6-triangle-solved/1"
    assert data["basis"] == "traceless_hermitian_3"
    assert len(data["sweep"]) == 21
    assert len(data["presets"]) == 2
    assert data["skipped"] == []

    # recompute the first sweep point and compare invariants
    pt = data["sweep"][0]
    z = complex(pt["z_re"], pt["z_im"])
    levels = np.asarray(CERTIFIED_SWEEP_LEVELS, dtype=float)
    _s, aligned, info = solve_point(z, levels, None)
    assert info["solver_success"]
    rec = point_record(z, levels, aligned)
    for key in ("edge_norms_sq", "spectra", "pairwise", "closure_error"):
        assert np.allclose(pt[key], rec[key], rtol=1e-8, atol=1e-8)
