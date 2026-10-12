"""Candidate finite ``y = 0`` chart and its central flags (Milestone 1).

The chart is the conversation's candidate family, with ``z = r exp(i theta)``:

    a_1 = a_2 = a_3 = [[1], [0]]

    A_1 = [[1, 0],        A_2 = [[0, 1],        A_3 = [[0, 1],
           [0, 1],               [1, 0],               [0, z],
           [0, 1]]               [0, 1]]               [1, 0]]

    b_i = 0,   B_i = 0.

All ``y`` matrices vanish, so the complex equations at ``tau = 0``

    b_i a_i = 0,   B_i A_i - a_i b_i = 0,   -(sum_i A_i B_i)_0 = 0

hold identically (the middle and center residuals are zero because every
product contains a ``b`` or ``B``).  This says nothing about stability, about
injectivity of the quotient coordinate, or about coverage of the sphere; those
are handled by :mod:`e6sim.stability` and the certified fixture.

Central flags (Milestone 1, task 2):

    L_i = image(A_i a_i)      (a line in C^3)
    P_i = image(A_i)          (a plane in C^3)

For this chart ``a_i = e_1`` and the first column of ``A_i`` is ``A_i a_i``:

    L_1 = <e_1>,   L_2 = <e_2>,   L_3 = <e_3>,
    P_1 = <e_1, (0,1,1)>,   P_2 = <e_2, (1,0,1)>,   P_3 = <e_3, (1,z,0)>.

In coordinates the planes are the kernels of the linear forms

    P_1 : y - z_coord = 0,   P_2 : x - z_coord = 0,   P_3 : y - z x = 0

(here ``z_coord`` is the third coordinate, distinct from the chart
parameter ``z``).  These normal forms drive the exact incidence analysis.

Everything in this module uses exact SymPy arithmetic whenever ``z`` is a
SymPy expression (a symbol or an exact ``Rational``); float/complex inputs
fall back to NumPy, which is used only for the numeric smoke tests and the
representation handed to the solver.
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np
import sympy as sp

from .conventions import NB

__all__ = [
    "candidate_y0_chart",
    "central_flags",
    "plane_normals",
    "subspace_contains",
    "intersect_dim",
    "incidence_signature",
    "x_gauge_action",
    "dxdz",
]


# --------------------------------------------------------------------------
# chart matrices
# --------------------------------------------------------------------------
def _is_symbolic(z) -> bool:
    return isinstance(z, sp.Basic) and bool(z.free_symbols)


def candidate_y0_chart(z):
    """Return the four branch matrix lists ``(a, A, b, B)`` of the chart.

    Accepts a Python ``complex``/``float`` or a SymPy expression.  With a
    SymPy expression (including an exact ``Rational``) the returned matrices
    are SymPy ``Matrix`` objects and the arithmetic is exact; otherwise they
    are NumPy complex arrays.
    """
    if isinstance(z, sp.Basic):
        zz = z
        a = [sp.Matrix([[1], [0]]) for _ in range(NB)]
        A = [
            sp.Matrix([[1, 0], [0, 1], [0, 1]]),
            sp.Matrix([[0, 1], [1, 0], [0, 1]]),
            sp.Matrix([[0, 1], [0, zz], [1, 0]]),
        ]
        b = [sp.zeros(1, 2) for _ in range(NB)]
        B = [sp.zeros(2, 3) for _ in range(NB)]
        return a, A, b, B

    zz = complex(z)
    a = [np.array([[1.0], [0.0]], dtype=complex) for _ in range(NB)]
    A = [
        np.array([[1, 0], [0, 1], [0, 1]], dtype=complex),
        np.array([[0, 1], [1, 0], [0, 1]], dtype=complex),
        np.array([[0, 1], [0, zz], [1, 0]], dtype=complex),
    ]
    b = [np.zeros((1, 2), dtype=complex) for _ in range(NB)]
    B = [np.zeros((2, 3), dtype=complex) for _ in range(NB)]
    return a, A, b, B


def _sym(z):
    """Sympify ``z`` exactly when possible (Rational stays Rational)."""
    return z if isinstance(z, sp.Basic) else sp.sympify(z)


# --------------------------------------------------------------------------
# central flags
# --------------------------------------------------------------------------
def central_flags(z):
    """Exact central flags ``L_i = image(A_i a_i)`` and ``P_i = image(A_i)``.

    Returns a dict with

    ``"L"``: list of three ``3 x 1`` SymPy column matrices spanning ``L_i``,
    ``"P"``: list of three ``3 x 2`` SymPy matrices whose columns span ``P_i``.

    Both are exact in ``z``.  The flags are the only chart data the stability
    computation needs (the ``y`` matrices vanish, so no reverse flags enter).
    """
    zz = _sym(z)
    a, A, b, B = candidate_y0_chart(zz)
    L = [A[i] * a[i] for i in range(NB)]
    P = [A[i] for i in range(NB)]
    return {"L": L, "P": P}


def plane_normals(z):
    """Exact normal vectors of the three planes ``P_i`` (each a ``1 x 3`` row).

    ``P_1 : y - w = 0``, ``P_2 : x - w = 0``, ``P_3 : y - z x = 0`` with
    coordinates ``(x, y, w)``.
    """
    zz = _sym(z)
    return [
        sp.Matrix([[0, -1, 1]]),
        sp.Matrix([[1, 0, -1]]),
        sp.Matrix([[-zz, 1, 0]]),
    ]


# --------------------------------------------------------------------------
# exact subspace incidence
# --------------------------------------------------------------------------
def subspace_contains(V, U) -> bool:
    """True iff ``col(U) subset col(V)`` for exact SymPy column matrices."""
    if U.cols == 0:
        return True
    return (V.row_join(U)).rank() == V.rank()


def intersect_dim(U, V) -> int:
    """Exact dimension of ``col(U) intersect col(V)``."""
    return int(U.rank() + V.rank() - U.row_join(V).rank())


def incidence_signature(z) -> Tuple:
    """Exact incidence signature of the chart flags at ``z``.

    The signature collects the dimensions

    ``(dim(L_i cap L_j), dim(L_i cap P_j), dim(P_i cap P_j))``

    together with the containments ``L_k subset P_j`` and, for each pairwise
    plane intersection line ``P_i cap P_j``, the set of planes ``P_k`` that
    contain it.  The last part detects the ``z = 1`` coincidence where the
    three intersection lines collapse to a single common line (dimensions
    alone do not see it).  The signature is constant except at the finitely
    many exceptional values of ``z`` (see :mod:`e6sim.stability`).
    """
    zz = _sym(z)
    fl = central_flags(zz)
    L, P = fl["L"], fl["P"]
    n = plane_normals(zz)
    ll = tuple(intersect_dim(L[i], L[j]) for i in range(3) for j in range(i + 1, 3))
    lp = tuple(
        int(subspace_contains(P[j], L[i]))
        for i in range(3) for j in range(3)
    )
    pp = tuple(intersect_dim(P[i], P[j]) for i in range(3) for j in range(i + 1, 3))
    mm = []
    for i in range(3):
        for j in range(i + 1, 3):
            basis = sp.Matrix([n[i], n[j]]).nullspace()
            if not basis:
                mm.extend([1, 1, 1])  # planes coincide: contained in all P_k
                continue
            Mij = basis[0]
            mm.extend(int(subspace_contains(P[k], Mij)) for k in range(3))
    return (ll, lp, pp, tuple(mm))


# --------------------------------------------------------------------------
# infinitesimal complex x-gauge action (Milestone 1, task 6)
# --------------------------------------------------------------------------
# x-vector ordering: per branch i, [a_i (2 entries), A_i (6 entries)],
# 8 complex entries per branch, 24 total.  The complex gauge algebra is
# sl(3) (8) + sum_i gl(2) (4 each) + sum_i gl(1) (1 each) = 23 complex.
def x_gauge_action(z):
    """Exact ``24 x 23`` complex matrix of the infinitesimal x-gauge action.

    With central ``xi`` (traceless), middle ``eta_i`` and outer ``sigma_i``,

        delta a_i = eta_i a_i - a_i sigma_i,
        delta A_i = xi A_i - A_i eta_i.

    Columns are indexed by the 23 gauge-algebra basis elements in the order
    ``sl(3)`` (8), then ``eta_i`` (4 each), then ``sigma_i`` (1 each); rows by
    the 24 complex x entries.  Exact SymPy entries.
    """
    zz = _sym(z)
    a, A, b, B = candidate_y0_chart(zz)
    n = 24
    cols: List[List[sp.Expr]] = []

    def blank():
        return [sp.Integer(0)] * n

    def place(vec, off, mat):
        m = sp.Matrix(mat)
        vals = [m[r, c] for r in range(m.rows) for c in range(m.cols)]
        for k, v in enumerate(vals):
            vec[off + k] += v

    # central sl(3) basis: E_{pq} (p != q) and two diagonal traceless.
    central = []
    for p in range(3):
        for q in range(3):
            if p != q:
                m = sp.zeros(3, 3)
                m[p, q] = 1
                central.append(m)
    central.append(sp.diag(1, -1, 0))
    central.append(sp.diag(1, 1, -2))
    assert len(central) == 8
    for xi in central:
        col = blank()
        for i in range(NB):
            place(col, i * 8 + 2, xi * A[i])
        cols.append(col)

    # middle gl(2) basis per branch: E_{rs}.
    middle = []
    for r in range(2):
        for c in range(2):
            m = sp.zeros(2, 2)
            m[r, c] = 1
            middle.append(m)
    for i in range(NB):
        for eta in middle:
            col = blank()
            place(col, i * 8, eta * a[i])
            place(col, i * 8 + 2, -A[i] * eta)
            cols.append(col)

    # outer gl(1) basis per branch.
    for i in range(NB):
        col = blank()
        place(col, i * 8, -a[i])
        cols.append(col)

    assert len(cols) == 23
    return sp.Matrix(n, len(cols), lambda r, c: cols[c][r])


def dxdz(z=None):
    """Exact ``dx/dz`` for the chart as a length-24 complex column.

    Only ``A_3`` depends on ``z``, through its ``(2,2)`` entry; all other
    chart entries are constant.  The result is the unit vector at the position
    of that entry (branch 3, ``A_3``, row 1, column 1).
    """
    v = [sp.Integer(0)] * 24
    # branch 2 (0-based) offset 2*8 = 16; A_3 flat row-major index 1*2+1 = 3.
    v[16 + 2 + 3] = sp.Integer(1)
    return sp.Matrix(v)
