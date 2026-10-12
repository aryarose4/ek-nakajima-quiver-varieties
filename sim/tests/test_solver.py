"""Milestone 2 tests: the positive-Hermitian-gauge real moment-map solver."""

import numpy as np
import pytest

from e6sim import conventions as C
from e6sim.fixtures import symmetric_y0_fixture
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.moment_maps import complex_residual_norm, real_maps, real_residual_norm


# --- helpers ---------------------------------------------------------------

def _random_sl3(rng, scale=0.5):
    m = scale * (rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3)))
    m += 3.0 * np.eye(3)
    return m / np.linalg.det(m) ** (1.0 / 3.0)


def _random_complex_gauge(rng, scale=0.5):
    g = _random_sl3(rng, scale)
    h = [np.eye(2) + scale * (rng.normal(size=(2, 2)) + 1j * rng.normal(size=(2, 2)))
         for _ in range(3)]
    q = [np.array([[1.0 + scale * (rng.normal() + 1j * rng.normal())]])
         for _ in range(3)]
    return g, h, q


def _central_Q(rep):
    """Traceless Hermitian ``Q_i = (A_i A_i^* - B_i^* B_i)_0`` for each branch."""
    out = []
    for i in range(3):
        m = rep.A[i] @ rep.A[i].conj().T - rep.B[i].conj().T @ rep.B[i]
        out.append(C.traceless(m))
    return out


def _sorted_spectra(rep):
    return np.array([np.sort(np.linalg.eigvalsh(q)) for q in _central_Q(rep)])


# --- identity-gauge solves on the certified fixture ------------------------

@pytest.mark.parametrize("alpha,gamma", [(1.0, 1.0), (1.5, 2.0), (0.7, 3.2),
                                         (2.0, 0.5)])
def test_solve_symmetric_fixture_from_identity(alpha, gamma):
    rep, levels = symmetric_y0_fixture(alpha, gamma)
    res = solve_real_moment_map(rep, levels)
    assert res.success
    assert res.residuals["real_norm"] < 1e-9
    assert res.residuals["complex_norm"] < 1e-9
    # y = 0 is preserved by every gauge of a y = 0 representative.
    for i in range(3):
        assert np.allclose(res.solved_rep.b[i], 0.0, atol=1e-12)
        assert np.allclose(res.solved_rep.B[i], 0.0, atol=1e-12)
    assert abs(np.linalg.det(res.H["center"]) - 1.0) < 1e-10


def test_solved_levels_are_recovered():
    rep, levels = symmetric_y0_fixture(1.3, 0.9)
    res = solve_real_moment_map(rep, levels)
    assert res.success
    maps = real_maps(res.solved_rep)
    for i in range(3):
        assert np.allclose(maps["outer"][i], levels[i, 0] * np.eye(1),
                           atol=1e-9)
        assert np.allclose(maps["middle"][i], levels[i, 1] * np.eye(2),
                           atol=1e-9)
    assert np.allclose(maps["center"], 0.0, atol=1e-9)


# --- complex-gauge transform: solve modulo compact gauge -------------------

@pytest.mark.parametrize("seed", [0, 1, 2])
def test_complex_gauge_transform_modulo_compact(seed):
    rng = np.random.default_rng(seed)
    rep0, levels = symmetric_y0_fixture(1.4, 2.1)
    g, h, q = _random_complex_gauge(rng)
    rep_k = rep0.gauge(g, h, q)
    assert complex_residual_norm(rep_k) < 1e-10

    res = solve_real_moment_map(rep_k, levels)
    assert res.success
    assert res.residuals["real_norm"] < 1e-8
    assert res.residuals["real_rel"] < 1e-8
    assert res.residuals["complex_norm"] < 1e-8
    assert abs(np.linalg.det(res.H["center"]) - 1.0) < 1e-9

    # Gauge-invariant observables only: spectra of the central Q_i must agree
    # with the original fixture modulo compact gauge.
    spec_ref = _sorted_spectra(rep0)
    spec_sol = _sorted_spectra(res.solved_rep)
    assert np.allclose(spec_sol, spec_ref, atol=1e-7)


def test_manufactured_general_rep_recovers_levels():
    # Manufactured input: an explicit scalar-level rep, pushed through a known
    # complex gauge.  The solver must recover the original levels.
    rng = np.random.default_rng(7)
    base, levels = symmetric_y0_fixture(0.8, 1.6)
    g, h, q = _random_complex_gauge(rng, scale=0.8)
    rep_k = base.gauge(g, h, q)

    res = solve_real_moment_map(rep_k, levels)
    assert res.success
    maps = real_maps(res.solved_rep)
    for i in range(3):
        assert maps["outer"][i][0, 0].real == pytest.approx(levels[i, 0],
                                                           abs=1e-8)
        assert np.allclose(maps["middle"][i], levels[i, 1] * np.eye(2),
                           atol=1e-8)
    assert np.allclose(maps["center"], 0.0, atol=1e-8)
    assert real_residual_norm(res.solved_rep, levels) < 1e-8


def test_warm_start_from_identity_dict():
    rep, levels = symmetric_y0_fixture(1.1, 1.1)
    seed = {"center": np.zeros(8), "middle": [np.zeros(4)] * 3,
            "outer": [np.zeros(1)] * 3}
    res = solve_real_moment_map(rep, levels, initial_log_gauge=seed)
    assert res.success


# --- diagnostics -----------------------------------------------------------

REQUIRED_DIAGNOSTIC_KEYS = {
    "status", "status_code", "message", "n_iter", "nit", "nfev", "cost",
    "optimality", "max_log_gauge", "jacobian_condition",
    "det_H_center", "gauge_finite", "gauge_positive", "det_center_ok",
}


def test_diagnostics_keys_present():
    rep, levels = symmetric_y0_fixture(1.0, 1.0)
    res = solve_real_moment_map(rep, levels, options={"max_nfev": 5})
    assert REQUIRED_DIAGNOSTIC_KEYS <= set(res.diagnostics)
    assert set(res.residuals) >= {
        "real_packed", "real_norm", "real_rel", "complex_norm", "per_vertex"}
    assert res.residuals["real_packed"].shape == (23,)
    assert set(res.log_gauge) >= {"center", "middle", "outer", "raw"}
    assert set(res.H) == {"center", "middle", "outer"}


def test_hard_input_fails_without_claiming_cause():
    rng = np.random.default_rng(11)
    rep0, levels = symmetric_y0_fixture(1.0, 1.0)
    g, h, q = _random_complex_gauge(rng, scale=50.0)
    rep_k = rep0.gauge(g, h, q)
    res = solve_real_moment_map(rep_k, levels, options={"max_nfev": 2})
    assert res.success is False
    # Diagnosis reports state, not a cause.
    assert "status" in res.diagnostics
    assert "message" in res.diagnostics
    assert res.diagnostics["solver_success"] is False
    assert "cause" not in res.diagnostics


def test_invalid_input_returns_failure():
    rep, levels = symmetric_y0_fixture(1.0, 1.0)
    bad = np.array(levels, dtype=float)
    bad[0, 0] = np.nan
    res = solve_real_moment_map(rep, bad)
    assert res.success is False
    assert res.diagnostics["status"] == "invalid_input"
