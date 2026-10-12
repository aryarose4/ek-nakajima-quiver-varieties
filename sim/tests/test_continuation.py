"""Milestone 3 tests: seed transport and continuation, on the symmetric fixture."""

import numpy as np
import pytest
from scipy.linalg import expm

from e6sim.continuation import (
    H_to_log_gauge,
    continue_path,
    log_gauge_to_H,
    transport_seed,
)
from e6sim.fixtures import symmetric_y0_fixture
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.moment_maps import complex_residual_norm, real_residual_norm


def central_Q(rep):
    out = []
    for i in range(3):
        A, B = rep.A[i], rep.B[i]
        M = A @ A.conj().T - B.conj().T @ B
        out.append(M - np.trace(M) / 3 * np.eye(3))
    return out


def spectra(rep):
    return np.array([np.sort(np.linalg.eigvalsh(Q)) for Q in central_Q(rep)])


def make_gauge(t, rng_seed=0):
    """A smooth family of complex gauges, identity at t = 0."""
    rng = np.random.default_rng(rng_seed)
    B = 0.5 * (rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3)))
    B = (B - B.conj().T) / 2.0  # skew-Hermitian so expm is unitary-controllable
    Hc = 0.3 * (rng.normal(size=(2, 2)) + 1j * rng.normal(size=(2, 2)))
    qs = 1.0 + 0.2 * rng.normal(size=3)
    g = expm(t * B)
    h = [expm(t * Hc) for _ in range(3)]
    q = [np.array([[np.exp(0.2 * t * qs[i])]]) for i in range(3)]
    return {"center": g, "middle": h, "outer": q}


def test_H_log_roundtrip():
    rep, levels = symmetric_y0_fixture(1.2, 0.8)
    res = solve_real_moment_map(rep, levels)
    assert res.success
    lg = H_to_log_gauge(res.H)
    H2 = log_gauge_to_H(lg)
    assert np.allclose(H2["center"], res.H["center"], atol=1e-10)
    for i in range(3):
        assert np.allclose(H2["middle"][i], res.H["middle"][i], atol=1e-10)
        assert np.allclose(H2["outer"][i], res.H["outer"][i], atol=1e-10)


def test_transport_seed_identity():
    rep, levels = symmetric_y0_fixture(1.0, 1.0)
    res = solve_real_moment_map(rep, levels)
    k = {"center": np.eye(3, dtype=complex),
         "middle": [np.eye(2, dtype=complex)] * 3,
         "outer": [np.array([[1.0 + 0j]])] * 3}
    seed = transport_seed(res.H, k)
    lg = H_to_log_gauge(res.H)
    np.testing.assert_allclose(seed["center"], lg["center"], atol=1e-10)
    for i in range(3):
        np.testing.assert_allclose(seed["middle"][i], lg["middle"][i], atol=1e-10)
        np.testing.assert_allclose(seed["outer"][i], lg["outer"][i], atol=1e-10)


def test_transport_seed_across_chart():
    rep, levels = symmetric_y0_fixture(1.3, 0.7)
    res = solve_real_moment_map(rep, levels)
    k = make_gauge(0.7, rng_seed=5)
    rep_k = rep.gauge(k["center"], k["middle"], k["outer"])
    assert complex_residual_norm(rep_k) < 1e-10
    seed = transport_seed(res.H, k)
    res2 = solve_real_moment_map(rep_k, levels, initial_log_gauge=seed)
    assert res2.success
    assert np.allclose(spectra(res.solved_rep), spectra(res2.solved_rep), atol=1e-8)


def test_continue_path_fixed_levels():
    rep0, levels = symmetric_y0_fixture(1.0, 1.0)
    points = np.linspace(0.0, 1.0, 6)

    def rep_of(t):
        k = make_gauge(float(t), rng_seed=3)
        return rep0.gauge(k["center"], k["middle"], k["outer"])

    steps = continue_path(points, rep_of, levels, initial_seed=None)
    assert len(steps) == len(points)
    for s in steps:
        assert s.accepted, f"point {s.point} failed ({s.seed_kind})"
        assert real_residual_norm(s.result.solved_rep, levels) < 1e-8
        assert complex_residual_norm(s.result.solved_rep) < 1e-8
    ref = spectra(steps[0].result.solved_rep)
    for s in steps[1:]:
        assert np.allclose(ref, spectra(s.result.solved_rep), atol=1e-6)


def test_continue_path_recovers_from_oversized_step():
    rep0, levels = symmetric_y0_fixture(0.9, 1.1)

    def rep_of(t):
        k = make_gauge(float(t), rng_seed=7)
        return rep0.gauge(k["center"], k["middle"], k["outer"])

    # A single huge jump from identity to t=1.
    steps = continue_path([0.0, 1.0], rep_of, levels)
    assert steps[-1].accepted
    assert real_residual_norm(steps[-1].result.solved_rep, levels) < 1e-8
    ref = spectra(steps[0].result.solved_rep)
    assert np.allclose(ref, spectra(steps[-1].result.solved_rep), atol=1e-6)


def test_failed_step_is_not_mislabeled():
    rep0, levels = symmetric_y0_fixture(1.3, 0.9)

    def rep_of(t):
        return rep0

    # Sanity: the fixture's own levels succeed.
    assert continue_path([0.0], rep_of, levels)[0].accepted

    # A genuinely inconsistent level target: no gauge can satisfy it, so the
    # step must be recorded as failed and never as an accepted solution.
    bad = np.array(levels, dtype=float)
    bad[0, 1] += 0.5
    steps = continue_path([0.0], rep_of, bad)
    assert steps[0].result.success is False
    assert steps[0].accepted is False
