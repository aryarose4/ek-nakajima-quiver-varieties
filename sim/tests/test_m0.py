"""Milestone 0 tests: conventions, gauge action, residuals."""

import numpy as np
import pytest

from e6sim import conventions as C
from e6sim.moment_maps import (
    branch_traces,
    complex_residual,
    complex_residual_norm,
    is_complex_zero,
    pack_real_residual,
    pack_vector_to_maps,
    real_maps,
    real_residual,
    real_residual_norm,
)
from e6sim.representation import Rep


# --- conventions -----------------------------------------------------------
@pytest.mark.parametrize("n", [1, 2, 3])
def test_hermitian_basis_orthonormal(n):
    basis = C.hermitian_basis(n)
    assert len(basis) == n * n
    for i, bi in enumerate(basis):
        for j, bj in enumerate(basis):
            val = np.trace(bi.conj().T @ bj)
            assert val.imag == pytest.approx(0.0, abs=1e-12)
            assert val.real == pytest.approx(1.0 if i == j else 0.0, abs=1e-12)


@pytest.mark.parametrize("n", [2, 3])
def test_traceless_basis(n):
    basis = C.traceless_hermitian_basis(n)
    assert len(basis) == n * n - 1
    for b in basis:
        assert np.trace(b) == pytest.approx(0.0, abs=1e-12)
        assert np.allclose(b, b.conj().T)


def test_traceless_projection():
    rng = np.random.default_rng(0)
    m = rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3))
    t = C.traceless(m)
    assert np.trace(t) == pytest.approx(0.0, abs=1e-12)
    assert np.allclose(m - t, (np.trace(m) / 3) * np.eye(3))


def test_dimension_counts():
    assert C.N_GAUGE_REAL == 23
    assert C.N_GAUGE_COMPLEX == 23
    assert C.N_COMPLEX_X == 24
    assert C.N_COMPLEX_Y == 24
    assert C.EXPECTED_QUOTIENT_DIM == 2


def test_beta_level_conversion():
    beta = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])
    lev = C.beta_to_level(beta)
    assert np.allclose(lev, 2 * beta)
    assert np.allclose(C.level_to_beta(lev), beta)


# --- helpers ---------------------------------------------------------------
def random_rep(seed=0, scale=1.0):
    rng = np.random.default_rng(seed)
    z = lambda *s: scale * (rng.normal(size=s) + 1j * rng.normal(size=s))  # noqa: E731
    return Rep.from_arrays(
        a=[z(2, 1) for _ in range(3)],
        A=[z(3, 2) for _ in range(3)],
        b=[z(1, 2) for _ in range(3)],
        B=[z(2, 3) for _ in range(3)],
    )


def random_unitary(n, rng):
    q, r = np.linalg.qr(rng.normal(size=(n, n)) + 1j * rng.normal(size=(n, n)))
    d = np.diagonal(r)
    return q * (d / np.abs(d))


def random_sl3(rng):
    m = rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3))
    m += 3 * np.eye(3)
    return m / np.linalg.det(m) ** (1.0 / 3.0)


# --- shape validation ------------------------------------------------------
def test_shape_validation():
    rep = Rep.zeros()
    rep.validate()
    bad = Rep.zeros()
    bad.a[0] = np.zeros((3, 1), dtype=complex)
    with pytest.raises(ValueError):
        bad.validate()


def test_vector_roundtrip():
    rep = random_rep(1)
    v = rep.to_vector()
    assert v.size == 48
    rep2 = Rep.from_vector(v)
    np.testing.assert_allclose(rep2.to_vector(), v)


# --- gauge equivariance ----------------------------------------------------
def test_complex_zero_preserved_by_gauge():
    rep = Rep.zeros()
    assert is_complex_zero(rep)
    rng = np.random.default_rng(2)
    g = random_sl3(rng)
    h = [rng.normal(size=(2, 2)) + 1j * rng.normal(size=(2, 2)) + 2 * np.eye(2)
         for _ in range(3)]
    q = [np.array([[rng.normal() + 1j * rng.normal() + 2.0]]) for _ in range(3)]
    out = rep.gauge(g, h, q)
    assert is_complex_zero(out, tol=1e-9)


def test_real_maps_conjugate_under_unitary_gauge():
    rng = np.random.default_rng(3)
    rep = random_rep(4)
    g = random_unitary(3, rng)
    h = [random_unitary(2, rng) for _ in range(3)]
    q = [np.array([[np.exp(1j * a)]]) for a in rng.uniform(0, 6.28, 3)]
    out = rep.gauge(g, h, q)
    before = real_maps(rep)
    after = real_maps(out)
    # center: conj by g
    assert np.allclose(after["center"], g @ before["center"] @ g.conj().T, atol=1e-10)
    for i in range(3):
        assert np.allclose(
            after["middle"][i], h[i] @ before["middle"][i] @ h[i].conj().T,
            atol=1e-10)
        # outer scalar is invariant under a unit-modulus gauge
        assert np.allclose(after["outer"][i], before["outer"][i], atol=1e-10)


def test_hermitian_and_traceless_outputs():
    rep = random_rep(5)
    maps = real_maps(rep)
    for m in maps["outer"]:
        assert m.shape == (1, 1)
        assert m[0, 0].imag == pytest.approx(0.0, abs=1e-12)
    for m in maps["middle"]:
        assert np.allclose(m, m.conj().T, atol=1e-12)
    assert np.allclose(maps["center"], maps["center"].conj().T, atol=1e-12)
    assert np.trace(maps["center"]) == pytest.approx(0.0, abs=1e-12)


# --- residual packing ------------------------------------------------------
def test_pack_roundtrip():
    rep = random_rep(6)
    levels = np.array([[1.0, 2.0], [1.0, 2.0], [1.0, 2.0]])
    coords = pack_real_residual(rep, levels)
    assert coords.size == 23
    maps = pack_vector_to_maps(coords)
    r = real_residual(rep, levels)
    for i in range(3):
        assert np.allclose(maps["outer"][i], r["outer"][i], atol=1e-12)
        assert np.allclose(maps["middle"][i], r["middle"][i], atol=1e-12)
    assert np.allclose(maps["center"], r["center"], atol=1e-12)


def test_packed_norm_matches_frobenius():
    rep = random_rep(7)
    levels = np.array([[1.0, 2.0], [1.0, 2.0], [1.0, 2.0]])
    r = real_residual(rep, levels)
    frob = np.sqrt(
        sum(np.sum(np.abs(m) ** 2) for m in r["outer"])
        + sum(np.sum(np.abs(m) ** 2) for m in r["middle"])
        + np.sum(np.abs(r["center"]) ** 2)
    )
    assert real_residual_norm(rep, levels) == pytest.approx(frob, rel=1e-12)


def test_branch_trace_identity():
    # On a rep that solves the branch real equations exactly,
    # trace(T_i) = level[i,0] + 2 level[i,1]  (the V0/V5 identity).
    alpha, gamma = 2.0, 3.0
    ai = np.array([[np.sqrt(alpha)], [0.0]], dtype=complex)
    Ai = np.array([[np.sqrt(gamma + alpha), 0.0],
                   [0.0, np.sqrt(gamma)],
                   [0.0, 0.0]], dtype=complex)
    bi = np.zeros((1, 2), dtype=complex)
    Bi = np.zeros((2, 3), dtype=complex)
    rep = Rep.from_arrays([ai] * 3, [Ai] * 3, [bi] * 3, [Bi] * 3)
    levels = np.array([[alpha, gamma]] * 3)
    # branch real equations hold:
    assert np.allclose(real_residual(rep, levels)["outer"][0], 0, atol=1e-12)
    assert np.allclose(real_residual(rep, levels)["middle"][0], 0, atol=1e-12)
    tr = branch_traces(rep, levels)
    for i in range(3):
        assert tr[i] == pytest.approx(alpha + 2 * gamma, rel=1e-12)
