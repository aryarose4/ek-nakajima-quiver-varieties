"""King beta-stability of the candidate ``y = 0`` chart (Milestone 1).

Setup
-----
The chart is the one in :mod:`e6sim.charts`.  Write

    alpha_i = level[i, 0]   (outer level),
    gamma_i = level[i, 1]   (middle level),

and let ``W`` run over the nonzero proper complex subspaces of the central
``C^3`` (lines, ``dim W = 1``, and planes, ``dim W = 2``).  King
beta-stability for this positive-level ``y = 0`` chart is the strict
inequality

    w(W) = sum_i [ alpha_i dim(W cap L_i) + gamma_i dim(W cap P_i) ]
           - (dim W)/3 * sum_i (alpha_i + 2 gamma_i)  <  0,

for **every** nonzero proper ``W``.  The subtracted term is the
``beta_*`` normalization fixed by requiring ``w(C^3) = 0`` (the full
central space is not a proper subrepresentation and is excluded).

Why the maximal subspaces ``W cap L_i``, ``W cap P_i`` suffice
--------------------------------------------------------------
For a subrepresentation with central space ``W``, the branch ``i`` subspace
must be contained in the maximal subrepresentation whose central part is
``W``.  On the outer vertex that maximal subspace is exactly ``W cap L_i``
(a line or ``0``), because the only ``x``-line available is ``L_i`` and the
only allowed ``y``-direction is ``0`` (``b_i = 0``); on the middle vertex it
is ``W cap P_i`` (a plane, line or ``0``), because the only available
``x``-plane is ``P_i`` and again ``B_i = 0``.  Any genuine subrepresentation
therefore has branch dimensions at most these, and since every level is
positive the beta-weight is monotone in those dimensions: shrinking a branch
subspace can only lower ``w``.  Hence it is enough to test the maximal choice
for each ``W``.  Equivalently, a destabilizer exists iff one of the maximal
subspaces ``W cap L_i`` or ``W cap P_i`` already has ``w >= 0``.

The argument uses two hypotheses and fails without them:

* **Positive levels.**  With a negative ``alpha_i`` or ``gamma_i`` the weight
  is no longer monotone in the branch dimensions, so a *smaller* branch
  subspace could carry the larger weight; the maximal-subspace test would
  then miss destabilizers.  Negative levels require the full subrepresentation
  lattice, not just ``W cap L_i``, ``W cap P_i``.
* **``y = 0`` (injective ``x``).**  With nonzero ``y`` the reverse maps
  ``b_i, B_i`` add further branch subspaces (kernels/images mixing with ``W``)
  that are not among ``W cap L_i``, ``W cap P_i``, and the maximal branch
  subspace need not be the ``x``-flag piece.  The shortcut is specific to the
  ``y = 0`` chart.

Incidence enumeration
---------------------
``W`` enters only through the dimensions ``dim(W cap L_i)`` and
``dim(W cap P_i)``, so ``w`` is constant on each incidence pattern.  We
enumerate the finitely many *realizable* patterns exactly with SymPy by
building a finite set of representative subspaces that realizes every
pattern (see :func:`candidate_subspaces`) and evaluating the dimensions with
exact rank arithmetic.  No random sampling is used.

For a **line** ``W``: ``dim(W cap L_i) = 1`` iff ``W = L_i``, else ``0``;
``dim(W cap P_i) = 1`` iff ``W subset P_i``, else ``0``.
For a **plane** ``W``: ``dim(W cap L_i) = 1`` iff ``L_i subset W``, else
``0``; ``dim(W cap P_i) = 2`` iff ``W = P_i``, else ``1`` (two planes in
``C^3`` always meet in a line).

Realizable representatives are: the axes ``L_i``; the pairwise plane
intersections ``P_i cap P_j`` (lines); a generic line inside a single plane;
a generic line in no plane; the planes ``P_i``; the axis-span planes
``<L_i, L_j>``; a plane through exactly one axis that is not one of the
``P_i``; and a generic plane containing no axis.  These cover every realizable
incidence pattern for lines and planes (positive levels make the extreme
cases within each pattern dominate the weight).

Exceptional ``z``
-----------------
An incidence changes only where one of the containments ``L_k subset P_j`` or
``P_i cap P_j subset P_k`` switches on/off.  With the plane normals
``n_1 = (0,-1,1)``, ``n_2 = (1,0,-1)``, ``n_3 = (-z,1,0)`` and intersection
directions ``n_i x n_j`` these are linear conditions in ``z``; solving them
exactly gives ``z = 0`` and ``z = 1``, and the chart additionally degenerates
at the pole ``z = infinity`` (where ``P_3`` tends to ``<e_2, e_3>`` and
``L_2`` becomes contained in it).  The complete excluded set is therefore
``{0, 1, infinity}`` -- not merely ``{0, infinity}``.  See
:func:`exceptional_z`.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import numpy as np
import sympy as sp

from .charts import (
    central_flags,
    intersect_dim,
    plane_normals,
    subspace_contains,
)

__all__ = [
    "stability_weight",
    "candidate_subspaces",
    "incidence_pattern",
    "class_margins",
    "is_stable",
    "exceptional_z",
    "incidence_signature_at",
]


# --------------------------------------------------------------------------
# levels
# --------------------------------------------------------------------------
def _as_levels(levels) -> Tuple[List[sp.Expr], List[sp.Expr]]:
    """Split a ``(3, 2)`` level array into exact ``alpha`` and ``gamma``."""
    arr = np.asarray(levels, dtype=object).reshape(3, 2)
    alpha = [sp.sympify(arr[i, 0]) for i in range(3)]
    gamma = [sp.sympify(arr[i, 1]) for i in range(3)]
    return alpha, gamma


# --------------------------------------------------------------------------
# weight
# --------------------------------------------------------------------------
def stability_weight(W, z, levels) -> sp.Expr:
    """Exact King weight ``w(W)`` of a central subspace ``W``.

    ``W`` is an exact SymPy column matrix (span of its columns) of dimension
    ``1`` or ``2``; ``levels`` is a ``(3, 2)`` array of exact or float
    numbers.  The result is a SymPy expression, exactly rational at exact
    inputs.
    """
    zz = z if isinstance(z, sp.Basic) else sp.sympify(z)
    alpha, gamma = _as_levels(levels)
    A = sum(alpha)
    G = sum(gamma)
    fl = central_flags(zz)
    L, P = fl["L"], fl["P"]
    d = int(W.rank())
    s = sp.Integer(0)
    for i in range(3):
        s += alpha[i] * intersect_dim(W, L[i])
        s += gamma[i] * intersect_dim(W, P[i])
    return sp.simplify(s - sp.Rational(d, 3) * (A + 2 * G))


# --------------------------------------------------------------------------
# representative subspaces
# --------------------------------------------------------------------------
def candidate_subspaces(z) -> List[Tuple[str, sp.Matrix]]:
    """Finite exact representatives realizing every realizable incidence.

    Returns a list of ``(label, W)`` where ``W`` is an exact SymPy column
    matrix (line or plane).  Deduplication by incidence pattern is left to
    :func:`class_margins`.
    """
    zz = z if isinstance(z, sp.Basic) else sp.sympify(z)
    fl = central_flags(zz)
    L, P = fl["L"], fl["P"]
    n = plane_normals(zz)

    out: List[Tuple[str, sp.Matrix]] = []

    # --- lines ---------------------------------------------------------
    for i in range(3):
        out.append((f"line L{i + 1}", L[i]))
    # pairwise plane intersections (generic dim 1)
    for i in range(3):
        for j in range(i + 1, 3):
            basis = sp.Matrix([n[i], n[j]]).nullspace()
            if basis:
                out.append((f"line P{i + 1}capP{j + 1}", basis[0]))
    # a generic line inside a single plane (second column of P_i)
    for i in range(3):
        out.append((f"line generic in P{i + 1}", P[i].col(1)))
    # a generic line in no plane
    out.append(("line generic", sp.Matrix([1, 3, 5])))

    # --- planes --------------------------------------------------------
    for i in range(3):
        out.append((f"plane P{i + 1}", P[i]))
    for i in range(3):
        for j in range(i + 1, 3):
            out.append((f"plane <L{i + 1},L{j + 1}>", L[i].row_join(L[j])))
    # planes through exactly ONE axis that are NOT equal to any P_i (the
    # remaining one-axis pattern; e.g. <e_1, e_2 + 2 e_3>).  The companion
    # vectors are chosen generically so the representative stays off every P_j
    # for all z (verified by the incidence label in class_margins).
    one_axis_extra = (sp.Matrix([0, 1, 2]), sp.Matrix([1, 0, 2]), sp.Matrix([1, 1, 1]))
    for i in range(3):
        out.append((f"plane 1axis!=P via L{i + 1}", L[i].row_join(one_axis_extra[i])))
    # a generic plane containing no axis: x + y + w = 0
    gb = sp.Matrix([[1, 1, 1]]).nullspace()
    out.append(("plane generic", gb[0].row_join(gb[1])))

    return out


# --------------------------------------------------------------------------
# incidence patterns
# --------------------------------------------------------------------------
def incidence_pattern(W, z) -> Tuple:
    """Exact incidence pattern of ``W`` (line or plane) at ``z``.

    Line pattern: ``("line", axis_index_or_None, tuple(planes containing W))``.
    Plane pattern: ``("plane", tuple(axes contained), equal_plane_index_or_None)``.
    """
    zz = z if isinstance(z, sp.Basic) else sp.sympify(z)
    fl = central_flags(zz)
    L, P = fl["L"], fl["P"]
    d = int(W.rank())
    if d == 1:
        axis = None
        for i in range(3):
            if intersect_dim(W, L[i]) == 1:
                axis = i
        planes = tuple(j for j in range(3) if intersect_dim(W, P[j]) == 1)
        return ("line", axis, planes)
    elif d == 2:
        axes = tuple(i for i in range(3) if intersect_dim(W, L[i]) == 1)
        equal = None
        for j in range(3):
            if intersect_dim(W, P[j]) == 2:
                equal = j
        return ("plane", axes, equal)
    raise ValueError(f"W has dimension {d}; expected a line or plane")


def _pattern_label(pat: Tuple) -> str:
    if pat[0] == "line":
        _, axis, planes = pat
        ax = f"L{axis + 1}" if axis is not None else "-"
        return f"line axis={ax} inPlanes={tuple(p + 1 for p in planes)}"
    _, axes, equal = pat
    eq = f"P{equal + 1}" if equal is not None else "-"
    return f"plane axes={tuple(a + 1 for a in axes)} equal={eq}"


def class_margins(z, levels) -> Dict[str, sp.Expr]:
    """Exact weight of every realizable ``W``-class at ``z``.

    Keys are readable incidence-pattern labels; values are exact SymPy
    expressions.  The chart is stable iff every value is strictly negative.
    """
    zz = z if isinstance(z, sp.Basic) else sp.sympify(z)
    alpha, gamma = _as_levels(levels)
    A = sum(alpha)
    G = sum(gamma)
    margins: Dict[str, sp.Expr] = {}
    for label, W in candidate_subspaces(zz):
        pat = incidence_pattern(W, zz)
        w = stability_weight(W, zz, levels)
        key = _pattern_label(pat)
        if key in margins:
            assert sp.simplify(margins[key] - w) == 0, (label, key)
        else:
            margins[key] = w
    # Unconditional generic classes (representative chosen symbolically so the
    # pattern holds for every z): a line in no plane and a plane with no axis.
    margins.setdefault("line axis=- inPlanes=()", -A / 3 - sp.Rational(2, 3) * G)
    margins.setdefault("plane axes=() equal=-", -sp.Rational(2, 3) * A - G / 3)
    return margins


def is_stable(z, levels) -> Tuple[bool, Dict[str, sp.Expr]]:
    """Return ``(all margins < 0, margins)`` for the chart at ``z``."""
    margins = class_margins(z, levels)
    stable = all(bool(sp.simplify(v) < 0) for v in margins.values())
    return stable, margins


# --------------------------------------------------------------------------
# exceptional z
# --------------------------------------------------------------------------
def exceptional_z() -> List[sp.Expr]:
    """Complete set of ``z`` where an incidence changes (incl. the pole).

    Computed exactly: for every ``L_k subset P_j`` containment and every
    ``(P_i cap P_j) subset P_k`` containment, solve the resulting linear
    condition in ``z``.  The pole ``z = infinity`` (``oo``) is appended
    because ``P_3`` degenerates there and picks up ``L_2``.
    """
    z = sp.symbols("z")
    n = plane_normals(z)
    axes = [sp.Matrix([1, 0, 0]), sp.Matrix([0, 1, 0]), sp.Matrix([0, 0, 1])]
    conds: List[sp.Expr] = []
    for nv in n:
        for e in axes:
            conds.append(sp.expand((nv * e)[0]))
    dirs = [n[0].cross(n[1]), n[0].cross(n[2]), n[1].cross(n[2])]
    for nv in n:
        for dv in dirs:
            conds.append(sp.expand((nv * dv.T)[0]))

    sols = set()
    for c in conds:
        c = sp.expand(c)
        if c == 0:
            continue
        for s in sp.solve(sp.Eq(c, 0), z):
            if s.is_real:
                sols.add(sp.nsimplify(s))
    result = sorted(sols)
    if sp.oo not in result:
        result.append(sp.oo)
    return result


def incidence_signature_at(z) -> Tuple:
    """Public wrapper around :func:`e6sim.charts.incidence_signature`."""
    from .charts import incidence_signature

    return incidence_signature(z)
