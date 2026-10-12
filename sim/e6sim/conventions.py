"""Single source of truth for conventions (Milestone 0).

Dimensions, the level/beta conversion, and the Frobenius-orthonormal
Hermitian bases used to pack moment-map residuals.  Every other module
imports its conventions from here; no sign or factor-of-two repair should
live anywhere else.
"""

from __future__ import annotations

import numpy as np

# --- Dimensions of the star-shaped E6 quiver -------------------------------
# Common central space C^3; each of the three branches is C^1 -> C^2 -> C^3.
NB = 3          # number of branches
N_CENTER = 3    # central space C^3
N_MIDDLE = 2    # middle space C^2
N_OUTER = 1     # outer space C^1

# Complex variables: for each branch, a_i (2x1), A_i (3x2), b_i (1x2),
# B_i (2x3):  (2 + 6 + 2 + 6) = 16 complex entries per branch, 48 total.
# Complex gauge group SL(3,C) x prod_i (GL(2,C) x GL(1,C)):
#   central 3x3 traceless : 8 complex   (SL(3,C))
#   middle  2x2           : 4 complex each (GL(2,C))
#   outer   1x1           : 1 complex each (GL(1,C))
#   total: 8 + 3*(4 + 1) = 23 complex
# Expected quotient dimension (discrete stabilizer): 48 - 2*23 = 2.
N_COMPLEX_X = NB * (N_MIDDLE * N_OUTER + N_CENTER * N_MIDDLE)
N_COMPLEX_Y = NB * (N_OUTER * N_MIDDLE + N_MIDDLE * N_CENTER)
N_GAUGE_COMPLEX = (N_CENTER ** 2 - 1) + NB * (N_MIDDLE ** 2 + N_OUTER ** 2)
EXPECTED_QUOTIENT_DIM = N_COMPLEX_X + N_COMPLEX_Y - 2 * N_GAUGE_COMPLEX


def traceless(m: np.ndarray) -> np.ndarray:
    """``M_0 = M - trace(M)/n * I_n`` (the traceless part)."""
    m = np.asarray(m, dtype=complex)
    n = m.shape[0]
    return m - (np.trace(m) / n) * np.eye(n, dtype=complex)


def traceless_hermitian_basis(n: int):
    """Frobenius-orthonormal basis of traceless Hermitian ``n x n`` matrices.

    ``trace(B_a B_b) = delta_ab``.  For ``n = 1`` the basis is empty (no
    traceless 1x1 Hermitian matrix).  There are ``n^2 - 1`` elements.
    """
    basis = []
    # symmetric off-diagonal: (e_jk + e_kj) / sqrt(2)
    for j in range(n):
        for k in range(j + 1, n):
            m = np.zeros((n, n), dtype=complex)
            m[j, k] = 1.0
            m[k, j] = 1.0
            basis.append(m / np.sqrt(2.0))
    # antisymmetric off-diagonal: i (e_jk - e_kj) / sqrt(2)  (Hermitian)
    for j in range(n):
        for k in range(j + 1, n):
            m = np.zeros((n, n), dtype=complex)
            m[j, k] = 1j
            m[k, j] = -1j
            basis.append(m / np.sqrt(2.0))
    # diagonal traceless: diag(1,...,1,-m,0,...) / sqrt(m(m+1)), m = 1..n-1
    for m in range(1, n):
        d = np.zeros(n)
        d[:m] = 1.0
        d[m] = -float(m)
        basis.append(np.diag(d).astype(complex) / np.sqrt(m * (m + 1.0)))
    assert len(basis) == n * n - 1
    return basis


def hermitian_basis(n: int):
    """Frobenius-orthonormal basis of *all* Hermitian ``n x n`` matrices.

    ``trace(B_a B_b) = delta_ab``.  There are ``n^2`` elements: the
    traceless basis plus ``I_n / sqrt(n)``.
    """
    basis = list(traceless_hermitian_basis(n))
    basis.append(np.eye(n, dtype=complex) / np.sqrt(float(n)))
    assert len(basis) == n * n
    return basis


# Cached bases for the three vertex types.
#   center: 8 traceless Hermitian 3x3  (SL(3) direction; central level is 0)
#   middle: 4 Hermitian 2x2 (includes trace part)
#   outer : 1 Hermitian 1x1 (the scalar)
CENTER_BASIS = traceless_hermitian_basis(N_CENTER)
MIDDLE_BASIS = hermitian_basis(N_MIDDLE)
OUTER_BASIS = hermitian_basis(N_OUTER)

# Real gauge-unknown count: 8 + 3*(4 + 1) = 23.
N_GAUGE_REAL = len(CENTER_BASIS) + NB * (len(MIDDLE_BASIS) + len(OUTER_BASIS))


def pack_hermitian(m: np.ndarray, basis) -> np.ndarray:
    """Coordinates of a Hermitian ``m`` in an orthonormal basis.

    Because ``basis`` is Frobenius-orthonormal, ``coord_a = trace(B_a m)``.
    """
    m = np.asarray(m, dtype=complex)
    return np.array([np.trace(b @ m).real for b in basis], dtype=float)


def unpack_hermitian(coords, basis) -> np.ndarray:
    """Reconstruct a Hermitian matrix from orthonormal-basis coordinates."""
    coords = np.asarray(coords, dtype=float)
    n = basis[0].shape[0] if basis else 0
    out = np.zeros((n, n), dtype=complex)
    for c, b in zip(coords, basis):
        out += c * b
    return out


def beta_to_level(beta):
    """Convert source Lie-algebra levels to Hermitian-equation levels.

    In the source the compact level is ``beta_i^{(k)} = i c_i^{(k)} I``,
    while the Hermitian moment map used here has the ``i/2`` factor removed
    (Milestone 0).  With ``beta`` meaning ``c`` (the real coefficient of the
    ``i``), the Hermitian equation reads ``level[i,k] = 2 c_i^{(k)}``.

    If a caller's six numbers are *already* Hermitian-equation levels, pass
    them through ``identity``/``level_to_beta`` instead.  The factor of two is
    documented here and nowhere else.
    """
    return 2.0 * np.asarray(beta, dtype=float)


def level_to_beta(level):
    """Inverse of :func:`beta_to_level` (level -> source ``c`` coefficient)."""
    return np.asarray(level, dtype=float) / 2.0
