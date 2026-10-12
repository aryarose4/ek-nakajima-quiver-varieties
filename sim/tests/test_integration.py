"""Milestones 0-2 integration smoke test on the certified stable fixture."""

import numpy as np
import pytest

from e6sim.continuation import H_to_log_gauge, continue_path, transport_seed
from e6sim.fixtures import symmetric_y0_fixture
from e6sim.fixtures.certified_y0_chart import certified_fixture
from e6sim.geometry import extract_geometry
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.moment_maps import complex_residual_norm, real_residual_norm


def test_solve_certified_stable_fixture():
    rep, levels, margins = certified_fixture()
    # exact complex zero, and the fixture is certified stable
    assert complex_residual_norm(rep) < 1e-12
    assert all(bool(v < 0) for v in margins.values())

    res = solve_real_moment_map(rep, levels)
    assert res.success
    assert real_residual_norm(res.solved_rep, levels) < 1e-9
    assert complex_residual_norm(res.solved_rep) < 1e-9
    assert abs(complex(np.linalg.det(res.H["center"])) - 1.0) < 1e-9
    # y stays zero under the (complex) gauge on a y = 0 chart
    for i in range(3):
        assert np.allclose(res.solved_rep.b[i], 0, atol=1e-12)
        assert np.allclose(res.solved_rep.B[i], 0, atol=1e-12)


def test_geometry_after_solving_certified_fixture():
    rep, levels, _ = certified_fixture()
    res = solve_real_moment_map(rep, levels)
    assert res.success
    g = extract_geometry(res.solved_rep, levels)
    assert g["closure_error"] < 1e-9
    for i in range(3):
        assert g["branch_traces"][i] == pytest.approx(
            g["branch_traces_expected"][i], rel=1e-8)


def test_continuation_through_chart_gauges_on_certified_fixture():
    rep, levels, _ = certified_fixture()
    res = solve_real_moment_map(rep, levels)
    assert res.success

    # a non-unitary chart gauge family fixing the complex-zero orbit
    rng = np.random.default_rng(0)
    G = 0.2 * (rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3)))
    Hm = 0.2 * (rng.normal(size=(2, 2)) + 1j * rng.normal(size=(2, 2)))

    def rep_of(t):
        from scipy.linalg import expm
        k = {"center": expm(t * G),
             "middle": [expm(t * Hm) for _ in range(3)],
             "outer": [np.array([[np.exp(0.1 * t)]]) for _ in range(3)]}
        return rep.gauge(k["center"], k["middle"], k["outer"])

    steps = continue_path(np.linspace(0, 1, 5), rep_of, levels,
                          initial_seed=H_to_log_gauge(res.H))
    for s in steps:
        assert s.accepted, f"point {s.point} failed"
        assert real_residual_norm(s.result.solved_rep, levels) < 1e-8
