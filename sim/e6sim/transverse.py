"""Milestone 5: the transverse ``y`` direction of the ``y = 0`` chart.

At a fixed ``x = candidate_y0_chart(z)`` the complex ``tau = 0`` equations are
*linear* in the 24 complex ``y`` entries

    b_i a_i = 0,   B_i A_i - a_i b_i = 0,   -(sum_i A_i B_i)_0 = 0.

Because the ``x``-gauge action at a certified point has rank 23, the linearised
cotangent moment map (its transpose under the trace pairing
``<x, y> = sum_i [trace(a_i b_i) + trace(A_i B_i)]``) has a one-dimensional
kernel.  A basis vector ``Y(z)`` spans it, normalised so that

    <dx/dz, Y(z)> = sum_i [trace((da_i/dz) b_i) + trace((dA_i/dz) B_i)] = 1.

Then ``rep(z, w) = (x(z), w * Y(z))`` satisfies the complex equations *exactly*
for every complex ``w``, since the equations are linear in ``y`` at fixed
``x``.

The kernel is derived exactly (symbolically in ``z``) with SymPy; a basis
chosen by an arbitrary SVD phase would jump between nearby points, so the
exact normalisation matters.  This module does not by itself prove global
coverage of the E6 space.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List, Tuple

import numpy as np
import sympy as sp

from .charts import candidate_y0_chart
from .representation import Rep

__all__ = [
    "y_system_matrix",
    "transverse_kernel",
    "symbolic_transverse_kernel",
    "transverse_y_matrices",
    "build_transverse_rep",
    "transverse_pairing",
]


# --- exact Hermitian bases (SymPy) -----------------------------------------
def _traceless_hermitian_basis(n: int):
    basis = []
    for j in range(n):
        for k in range(j + 1, n):
            m = sp.zeros(n, n); m[j, k] = 1; m[k, j] = 1
            basis.append(m / sp.sqrt(2))
    for j in range(n):
        for k in range(j + 1, n):
            m = sp.zeros(n, n); m[j, k] = sp.I; m[k, j] = -sp.I
            basis.append(m / sp.sqrt(2))
    for mm in range(1, n):
        d = [0] * n
        for t in range(mm):
            d[t] = 1
        d[mm] = -mm
        basis.append(sp.diag(*d) / sp.sqrt(mm * (mm + 1)))
    return basis


def _hermitian_basis(n: int):
    b = _traceless_hermitian_basis(n)
    b.append(sp.eye(n) / sp.sqrt(n))
    return b


_CEN = _traceless_hermitian_basis(3)
_MID = _hermitian_basis(2)


def _sym(z):
    return z if isinstance(z, sp.Basic) else sp.sympify(z)


# --- the linear y-system ---------------------------------------------------
def y_system_matrix(z):
    """Exact ``23 x 24`` matrix of the complex equations in the y entries.

    Rows: outer (3), middle (3 * 4), center (8) -- 23 complex equations.
    Columns: ``[b_i (2), B_i (6)]`` per branch, 24 complex unknowns.
    """
    zz = _sym(z)
    a, A, b, B = candidate_y0_chart(zz)

    def row_for(dbs, dBs):
        rows = [(dbs[i] * a[i])[0, 0] for i in range(3)]
        for i in range(3):
            E = dBs[i] * A[i] - a[i] * dbs[i]
            rows += [sp.simplify(sp.trace(M * E)) for M in _MID]
        C = sp.zeros(3, 3)
        for i in range(3):
            C += A[i] * dBs[i]
        rows += [-sp.simplify(sp.trace(M * C)) for M in _CEN]
        return sp.Matrix(rows)

    cols = []
    for k in range(24):
        dbs = [sp.zeros(1, 2) for _ in range(3)]
        dBs = [sp.zeros(2, 3) for _ in range(3)]
        i, r = divmod(k, 8)
        if r < 2:
            dbs[i][0, r] = 1
        else:
            dBs[i][(r - 2) // 3, (r - 2) % 3] = 1
        cols.append(row_for(dbs, dBs))
    return sp.Matrix.hstack(*cols)


def _unpack_y(v: List[sp.Expr]):
    b, B = [], []
    for i in range(3):
        b.append(sp.Matrix(v[8 * i:8 * i + 2]).reshape(1, 2))
        B.append(sp.Matrix(v[8 * i + 2:8 * i + 8]).reshape(2, 3))
    return b, B


@lru_cache(maxsize=None)
def symbolic_transverse_kernel():
    """Cached exact kernel vector ``Y(z)`` normalised so ``<dx/dz, Y> = 1``."""
    z = sp.symbols("z")
    M = y_system_matrix(z)
    ns = M.nullspace()
    if len(ns) != 1:
        raise ValueError(f"expected a 1-dimensional kernel, got {len(ns)}")
    Y = ns[0]
    _, BY = _unpack_y(list(Y))
    pair = sp.simplify(BY[2][1, 1])          # <dx/dz, Y> = trace(dA_3 B_3)
    if pair == 0:
        raise ValueError("kernel pairing <dx/dz, Y> vanishes; cannot normalise")
    return sp.simplify(Y / pair)


def transverse_kernel(z):
    """Exact kernel vector at ``z`` (evaluated from the cached symbolic basis).

    Returns a list of 24 SymPy expressions.
    """
    Ysym = symbolic_transverse_kernel()
    zz = _sym(z)
    zsym = sp.symbols("z")
    return [sp.simplify(sp.together(expr).subs(zsym, zz)) for expr in Ysym]


def transverse_pairing(z) -> sp.Expr:
    """``<dx/dz, Y(z)>`` -- should be exactly 1 after normalisation."""
    _, BY = _unpack_y(transverse_kernel(z))
    return sp.simplify(BY[2][1, 1])


def transverse_y_matrices(z, w=1):
    """Return ``(b, B)`` lists for ``y = w * Y(z)`` (SymPy or numeric)."""
    ww = _sym(w)
    Y = transverse_kernel(z)
    b, B = _unpack_y([ww * sp.sympify(e) for e in Y])
    return b, B


def build_transverse_rep(z, w=1) -> Rep:
    """``Rep`` at ``(z, w)`` with numeric complex entries (x(z), w Y(z))."""
    zz = complex(z)
    ww = complex(w)
    a, A, b, B = candidate_y0_chart(zz)
    Yb, YB = transverse_y_matrices(z, 1)
    yn = lambda M: np.array(M.tolist(), dtype=complex)  # noqa: E731
    b_out = [ww * yn(Yb[i]) for i in range(3)]
    B_out = [ww * yn(YB[i]) for i in range(3)]
    return Rep.from_arrays(a, A, b_out, B_out)
