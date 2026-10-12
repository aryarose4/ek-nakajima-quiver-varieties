"""Milestone 4: the first ``y = 0`` sphere's north/south chart atlas.

The initial (north) chart of :mod:`e6sim.charts` is parameterised by ``z`` and
has a pole at ``z = infinity`` (its ``A_3`` carries an entry ``z``).  This
module adds the **south** chart in the coordinate ``zeta = 1/z``, in which the
pole is finite, and records the overlap gauge and the honest classification of
the exceptional values ``z in {0, 1, infinity}``.

South representative (verified)
-------------------------------
Clear the ``z = 1/zeta`` denominator of the north chart by a *diagonal middle
gauge* on branch 3 only.  The gauge is

    k(zeta) = ( g = I_3,
                h_1 = h_2 = I_2,  h_3 = diag(1, 1/zeta),
                q_1 = q_2 = q_3 = 1 ).

Then, with ``z = 1/zeta``,

    north(1/zeta) . gauge(k(zeta))  ==  south(zeta),

where the **south chart** is the finite family

    a_i = e_1,  b_i = B_i = 0,
    A_1 = [[1,0],[0,1],[0,1]],
    A_2 = [[0,1],[1,0],[0,1]],
    A_3 = [[0, zeta],[0, 1],[1, 0]].

Indeed ``A_3`` north is ``[[0,1],[0,1/zeta],[1,0]]`` and right-multiplying by
``h_3^{-1} = diag(1,zeta)`` scales its second column to ``(zeta,1,0)``; the
scalar ``a_3 = e_1`` is unchanged because ``h_3 e_1 = e_1``.  Every identity is
checked exactly in :func:`overlap_identity`.  The inverse gauge
``diag(1,zeta)`` (same structure) gives ``south(zeta).gauge(k^{-1}) =
north(1/zeta)`` (see :func:`inverse_overlap_identity`).  The south chart is
complex-moment-map zero because all ``y`` vanish.

Overlap transition (task 2)
---------------------------
On the overlap ``z != 0`` (equivalently ``zeta != 0``) the coordinate
transition is ``zeta = 1/z`` (an involution on the Riemann sphere) and the
gauge transition is ``k(zeta)`` above, with inverse ``k^{-1}``.  Both are
verified exactly.

Stability of the south chart (task 3, and the proof of the reuse)
-----------------------------------------------------------------
Gauge transformations act on the central flags by a single invertible
``g`` in ``L_i -> g L_i``, ``P_i -> g P_i``, so *incidences are gauge
invariant*.  Since our overlap gauge has ``g = I`` and only scales a column of
``A_3``, the south flags at ``zeta`` are **literally equal** to the north flags
at ``z = 1/zeta``:

    L^S = (e_1, e_2, e_3),
    P^S_1 = <e_1,(0,1,1)>, P^S_2 = <e_2,(1,0,1)>, P^S_3 = <e_3,(zeta,1,0)>.

Hence for ``zeta != 0`` the south King margins are exactly
``class_margins(1/zeta, levels)`` (same flags, same levels).

At the **pole** (``zeta = 0``) the limit plane is ``P_3 = <e_2, e_3>``.  There
the south configuration equals ``sigma . (north configuration at z = 0)``,
where ``sigma`` is the coordinate swap ``(x,y,w) -> (y,x,w)`` together with the
branch relabelling ``1 <-> 2``.  Because ``sigma`` is an invertible linear map,
``dim(W cap V) = dim(sigma^{-1}W cap sigma^{-1}V)``; summing the weights shows
that the *multiset* of south margins at the pole equals the multiset of
``class_margins(0, swap_branches_12(levels))``, with the class labels relabelled
by ``sigma``.  This reduces the pole computation to the already-verified
:func:`e6sim.stability.class_margins`; no new enumeration is invented.  The
identity is cross-checked in the tests (multiset equality for ``zeta != 0``,
explicit flag relabelling, and the destabilising labels at the pole).

Honest classification with the certified levels ``alpha=(3,3,3)``,
``gamma=(1,2,3)``
--------------------------------------------------------------------------
* ``z = 1`` : the incidence changes (the three pairwise plane intersections
  collapse to the single common line ``(1,1,1)``) but every King weight stays
  strictly negative (tightest ``-1``).  **Stable**, already covered by the
  north chart; no alternate chart is needed.
* ``z = 0`` : the chart is **strictly unstable**: a realizable line class has
  weight ``0`` (a wall) and a realizable plane class (``W = P_3``) has weight
  ``+1``.  Because stability is gauge invariant, **no gauge can repair this**:
  it is a genuinely unstable orbit (a different stratum), not a missing
  representative.
* ``z = infinity`` (the pole, ``zeta = 0``) : the south chart supplies the
  missing *finite* representative, but its limit orbit is again **strictly
  unstable** (line ``L_2`` and plane ``P_3`` both weight ``+1``).  Again this
  is gauge invariant, so it is a genuinely unstable orbit.

Consequently the stable locus covered by this atlas is
``P^1 \\ {0, infinity}`` (a cylinder), not the whole sphere: the coverage is
**partial**.  ``z = 0`` and the pole are genuinely unstable for these levels;
whether they are attached through a different (e.g. nonzero-``y``) family is
left **open**.  This module does not silently perturb the levels or invent a
replacement family.
"""

from __future__ import annotations

import re
from typing import Dict, List, Tuple

import numpy as np
import sympy as sp

from .charts import (
    candidate_y0_chart,
    incidence_signature,
    intersect_dim,
    subspace_contains,
)
from .conventions import NB
from .representation import Rep
from .stability import class_margins

__all__ = [
    "north_chart",
    "south_chart",
    "north_rep",
    "south_rep",
    "north_coordinate",
    "south_coordinate",
    "overlap_gauge",
    "overlap_gauge_numeric",
    "inverse_overlap_gauge",
    "overlap_identity",
    "inverse_overlap_identity",
    "south_flags",
    "flag_incidence_signature",
    "south_incidence_signature",
    "pole_flags",
    "pole_incidence_signature",
    "swap_branches_12",
    "south_class_margins",
    "north_class_margins",
    "north_stability",
    "south_stability",
    "classify_margins",
    "destabilising_classes",
    "endpoint_records",
    "atlas_entries",
    "coverage_verdict",
]


# --------------------------------------------------------------------------
# exact helpers
# --------------------------------------------------------------------------
def _sym(x):
    return x if isinstance(x, sp.Basic) else sp.sympify(x)


def _to_numpy(m) -> np.ndarray:
    return np.array(sp.Matrix(m).tolist(), dtype=complex)


def _apply_sym_gauge(mats, k):
    """Exact complex gauge action on ``(a, A, b, B)`` with a gauge dict ``k``."""
    a, A, b, B = mats
    g = sp.Matrix(k["center"])
    g_inv = g.inv()
    out_a, out_A, out_b, out_B = [], [], [], []
    for i in range(NB):
        h = sp.Matrix(k["middle"][i])
        h_inv = h.inv()
        q = sp.sympify(k["outer"][i])
        out_a.append(h * a[i] / q)
        out_A.append(g * A[i] * h_inv)
        out_b.append(q * b[i] * h_inv)
        out_B.append(h * B[i] * g_inv)
    return out_a, out_A, out_b, out_B


# --------------------------------------------------------------------------
# charts
# --------------------------------------------------------------------------
def north_chart(z):
    """The initial (north) chart ``(a, A, b, B)`` of :mod:`e6sim.charts`."""
    return candidate_y0_chart(_sym(z) if isinstance(z, sp.Basic) else z)


def south_chart(zeta):
    """The finite south chart in ``zeta = 1/z`` (exact SymPy or NumPy).

    Same as the north chart except ``A_3 = [[0, zeta],[0, 1],[1, 0]]``.  At
    ``zeta = 0`` this is finite, giving the pole's representative.
    """
    if isinstance(zeta, sp.Basic):
        zz = zeta
        a = [sp.Matrix([[1], [0]]) for _ in range(NB)]
        A = [
            sp.Matrix([[1, 0], [0, 1], [0, 1]]),
            sp.Matrix([[0, 1], [1, 0], [0, 1]]),
            sp.Matrix([[0, zz], [0, 1], [1, 0]]),
        ]
        b = [sp.zeros(1, 2) for _ in range(NB)]
        B = [sp.zeros(2, 3) for _ in range(NB)]
        return a, A, b, B

    zz = complex(zeta)
    a = [np.array([[1.0], [0.0]], dtype=complex) for _ in range(NB)]
    A = [
        np.array([[1, 0], [0, 1], [0, 1]], dtype=complex),
        np.array([[0, 1], [1, 0], [0, 1]], dtype=complex),
        np.array([[0, zz], [0, 1], [1, 0]], dtype=complex),
    ]
    b = [np.zeros((1, 2), dtype=complex) for _ in range(NB)]
    B = [np.zeros((2, 3), dtype=complex) for _ in range(NB)]
    return a, A, b, B


def north_rep(z) -> Rep:
    """A complex :class:`~e6sim.representation.Rep` of the north chart at ``z``."""
    a, A, b, B = candidate_y0_chart(_sym(z))
    return Rep.from_arrays([_to_numpy(m) for m in a], [_to_numpy(m) for m in A],
                           [_to_numpy(m) for m in b], [_to_numpy(m) for m in B])


def south_rep(zeta) -> Rep:
    """A complex :class:`~e6sim.representation.Rep` of the south chart at ``zeta``."""
    a, A, b, B = south_chart(_sym(zeta))
    return Rep.from_arrays([_to_numpy(m) for m in a], [_to_numpy(m) for m in A],
                           [_to_numpy(m) for m in b], [_to_numpy(m) for m in B])


# --------------------------------------------------------------------------
# coordinates and overlap gauge
# --------------------------------------------------------------------------
def south_coordinate(z):
    """North coordinate ``z`` -> south coordinate ``zeta = 1/z``."""
    return 1 / _sym(z)


def north_coordinate(zeta):
    """South coordinate ``zeta`` -> north coordinate ``z = 1/zeta``."""
    return 1 / _sym(zeta)


def overlap_gauge(zeta):
    """Exact gauge ``k(zeta)`` with ``north(1/zeta).gauge(k) = south(zeta)``.

    ``k = (I_3, [I_2, I_2, diag(1, 1/zeta)], [1, 1, 1])``.  The central part is
    the identity, so the flag configuration is unchanged (only a column of
    ``A_3`` is scaled by ``zeta``).
    """
    zz = _sym(zeta)
    return {
        "center": sp.eye(3),
        "middle": [sp.eye(2), sp.eye(2), sp.diag(1, 1 / zz)],
        "outer": [sp.Integer(1) for _ in range(NB)],
    }


def overlap_gauge_numeric(zeta):
    """NumPy version of :func:`overlap_gauge` (for :func:`transport_seed`)."""
    zz = complex(zeta)
    return {
        "center": np.eye(3, dtype=complex),
        "middle": [np.eye(2, dtype=complex), np.eye(2, dtype=complex),
                   np.diag([1.0, 1.0 / zz]).astype(complex)],
        "outer": [np.array([[1.0 + 0j]]) for _ in range(NB)],
    }


def inverse_overlap_gauge(zeta):
    """Inverse gauge ``k^{-1}``: ``south(zeta).gauge(k^{-1}) = north(1/zeta)``."""
    zz = _sym(zeta)
    return {
        "center": sp.eye(3),
        "middle": [sp.eye(2), sp.eye(2), sp.diag(1, zz)],
        "outer": [sp.Integer(1) for _ in range(NB)],
    }


def overlap_identity(zeta=None) -> List[sp.Expr]:
    """Exact residuals of ``north(1/zeta).gauge(k) - south(zeta)``.

    Returns the list of simplified entrywise differences; all zero iff the
    overlap identity holds.
    """
    zz = _sym(zeta) if zeta is not None else sp.Symbol("zeta")
    north = candidate_y0_chart(1 / zz)
    south = south_chart(zz)
    gauged = _apply_sym_gauge(north, overlap_gauge(zz))
    diffs: List[sp.Expr] = []
    for gm, sm in zip(gauged, south):
        for m1, m2 in zip(gm, sm):
            diffs.extend(sp.simplify(m1[r, c] - m2[r, c])
                         for r in range(m1.rows) for c in range(m1.cols))
    return diffs


def inverse_overlap_identity(zeta=None) -> List[sp.Expr]:
    """Exact residuals of ``south(zeta).gauge(k^{-1}) - north(1/zeta)``."""
    zz = _sym(zeta) if zeta is not None else sp.Symbol("zeta")
    south = south_chart(zz)
    north = candidate_y0_chart(1 / zz)
    gauged = _apply_sym_gauge(south, inverse_overlap_gauge(zz))
    diffs: List[sp.Expr] = []
    for gm, nm in zip(gauged, north):
        for m1, m2 in zip(gm, nm):
            diffs.extend(sp.simplify(m1[r, c] - m2[r, c])
                         for r in range(m1.rows) for c in range(m1.cols))
    return diffs


# --------------------------------------------------------------------------
# south / pole flags and incidence signature
# --------------------------------------------------------------------------
def south_flags(zeta):
    """Exact south central flags ``L_i = image(A_i a_i)``, ``P_i = image(A_i)``."""
    a, A, b, B = south_chart(_sym(zeta))
    return {"L": [A[i] * a[i] for i in range(NB)], "P": [A[i] for i in range(NB)]}


def _plane_normal(Pi):
    """A ``1 x 3`` exact normal vector of the plane ``col(Pi)`` (or ``None``)."""
    ns = sp.Matrix(Pi).T.nullspace()
    if not ns:
        return None
    return sp.Matrix([ns[0].T])


def flag_incidence_signature(L, P) -> Tuple:
    """Incidence signature of an explicit flag family ``(L, P)``.

    Mirrors :func:`e6sim.charts.incidence_signature` but takes the flags
    directly, so it works for the south chart at the pole.  Returns
    ``(ll, lp, pp, mm)`` with the same meaning as there.
    """
    L = [sp.Matrix(m) for m in L]
    P = [sp.Matrix(m) for m in P]
    n = [_plane_normal(Pi) for Pi in P]
    ll = tuple(intersect_dim(L[i], L[j]) for i in range(3) for j in range(i + 1, 3))
    lp = tuple(int(subspace_contains(P[j], L[i])) for i in range(3) for j in range(3))
    pp = tuple(intersect_dim(P[i], P[j]) for i in range(3) for j in range(i + 1, 3))
    mm: List[int] = []
    for i in range(3):
        for j in range(i + 1, 3):
            if n[i] is None or n[j] is None:
                mm.extend([1, 1, 1])
                continue
            basis = sp.Matrix([n[i], n[j]]).nullspace()
            if not basis:
                mm.extend([1, 1, 1])
                continue
            Mij = basis[0]
            mm.extend(int(subspace_contains(P[k], Mij)) for k in range(3))
    return (ll, lp, pp, tuple(mm))


def south_incidence_signature(zeta) -> Tuple:
    """Exact incidence signature of the south flags at ``zeta``."""
    fl = south_flags(zeta)
    return flag_incidence_signature(fl["L"], fl["P"])


def pole_flags():
    """The south flags at the pole ``zeta = 0``: ``P_3 = <e_2, e_3>``."""
    return south_flags(sp.Integer(0))


def pole_incidence_signature() -> Tuple:
    """Exact incidence signature at the pole ``zeta = 0``."""
    return south_incidence_signature(sp.Integer(0))


# --------------------------------------------------------------------------
# stability on the atlas (all reuse of e6sim.stability)
# --------------------------------------------------------------------------
def swap_branches_12(levels):
    """``(3, 2)`` levels with branches ``1`` and ``2`` exchanged (0-based)."""
    arr = np.array([[sp.sympify(c) for c in row] for row in
                    np.asarray(levels, dtype=object).reshape(NB, 2)], dtype=object)
    arr = arr.copy()
    arr[[0, 1]] = arr[[1, 0]]
    return [tuple(arr[i]) for i in range(NB)]


def _sigma_label(key: str) -> str:
    """Relabel a north W-class string by the branch/axis swap ``1 <-> 2``."""
    return re.sub(r"[12]", lambda m: "2" if m.group(0) == "1" else "1", key)


def north_class_margins(z, levels) -> Dict[str, sp.Expr]:
    """Exact King margins of the north chart at ``z`` (reuses ``class_margins``)."""
    return class_margins(_sym(z), levels)


def south_class_margins(zeta, levels) -> Dict[str, sp.Expr]:
    """Exact King margins of the **south** chart at ``zeta``.

    For ``zeta != 0`` the south flags equal the north flags at ``z = 1/zeta``
    (the overlap gauge has ``g = I``), so the margins are literally
    ``class_margins(1/zeta, levels)``.  At the pole ``zeta = 0`` the multiset is
    ``class_margins(0, swap_branches_12(levels))`` (proved via the ``sigma``
    symmetry), relabelled to the south frame.  See the module docstring.
    """
    zz = _sym(zeta)
    if zz == 0:
        m = class_margins(sp.Integer(0), swap_branches_12(levels))
        return {_sigma_label(k): v for k, v in m.items()}
    return class_margins(1 / zz, levels)


def _stability(margins) -> bool:
    return all(bool(sp.simplify(v) < 0) for v in margins.values())


def north_stability(z, levels) -> Tuple[bool, Dict[str, sp.Expr]]:
    """``(stable, margins)`` of the north chart at ``z``."""
    m = north_class_margins(z, levels)
    return _stability(m), m


def south_stability(zeta, levels) -> Tuple[bool, Dict[str, sp.Expr]]:
    """``(stable, margins)`` of the south chart at ``zeta``."""
    m = south_class_margins(zeta, levels)
    return _stability(m), m


def classify_margins(margins) -> str:
    """``"stable"`` (all ``< 0``), ``"wall"`` (max ``== 0``), else ``"unstable"``."""
    vals = [sp.simplify(v) for v in margins.values()]
    m = max(vals)
    if m < 0:
        return "stable"
    if m == 0:
        return "wall"
    return "unstable"


def destabilising_classes(margins) -> Dict[str, sp.Expr]:
    """The classes with weight ``>= 0`` (walls and destabilisers)."""
    return {k: sp.simplify(v) for k, v in margins.items()
            if sp.simplify(v) >= 0}


# --------------------------------------------------------------------------
# atlas records
# --------------------------------------------------------------------------
def endpoint_records(levels=None) -> List[dict]:
    """Honest classification of the exceptional values of the first sphere.

    Each record has ``name``, ``chart``, ``coordinate``, ``signature``,
    ``margins``, ``verdict`` and ``destabilising`` (the ``>= 0`` classes).
    """
    if levels is None:
        from .fixtures.certified_y0_chart import CERTIFIED_LEVELS as levels
    records = []
    for name, chart, coord, sig, marg in (
        ("z=0", "north", sp.Integer(0),
         incidence_signature(sp.Integer(0)), north_class_margins(0, levels)),
        ("z=1", "north", sp.Integer(1),
         incidence_signature(sp.Integer(1)), north_class_margins(1, levels)),
        ("z=infinity (pole)", "south", sp.Integer(0),
         pole_incidence_signature(), south_class_margins(0, levels)),
    ):
        records.append({
            "name": name,
            "chart": chart,
            "coordinate": coord,
            "signature": sig,
            "margins": marg,
            "verdict": classify_margins(marg),
            "destabilising": destabilising_classes(marg),
        })
    return records


def atlas_entries(levels=None) -> List[dict]:
    """The atlas entries: representative, coordinate, stable domain, overlap."""
    if levels is None:
        from .fixtures.certified_y0_chart import CERTIFIED_LEVELS as levels
    return [
        {
            "name": "north",
            "representative": "north_chart(z)",
            "coordinate": "z",
            "chart": "north_chart",
            "inverse_coordinate": "zeta = 1/z",
            "inverse_chart": "south_chart",
            "excluded": [sp.Integer(0), sp.Integer(1), sp.oo],
            "stable_domain": "C minus {0} (z=1 and all generic finite z are stable; z=infinity needs south)",
            "stable_domain_exact": "P^1 \\ {0, infinity}",
            "overlap_gauge": "overlap_gauge(1/z)",
            "verified": True,
        },
        {
            "name": "south",
            "representative": "south_chart(zeta)",
            "coordinate": "zeta = 1/z",
            "chart": "south_chart",
            "inverse_coordinate": "z = 1/zeta",
            "inverse_chart": "north_chart",
            "excluded": [sp.Integer(0)],
            "stable_domain": "C minus {0} (the pole zeta=0 is strictly unstable)",
            "stable_domain_exact": "P^1 \\ {0, infinity}",
            "overlap_gauge": "overlap_gauge(zeta)",
            "verified": True,
        },
    ]


def coverage_verdict(levels=None) -> dict:
    """Honest coverage status of the atlas for ``levels``.

    Returns ``{"verdict", "stable_locus", "unstable_points", "open"}``.  With
    the certified levels the verdict is ``"partial"``: the two exceptional
    points ``z = 0`` and ``z = infinity`` are genuinely unstable (strictly
    positive King weight), so the atlas establishes stability exactly on the
    punctured sphere ``P^1 \\ {0, infinity}``.
    """
    if levels is None:
        from .fixtures.certified_y0_chart import CERTIFIED_LEVELS as levels
    unstable = []
    for name, chart, coord, fn in (
        ("z=0", "north", sp.Integer(0), north_class_margins),
        ("z=infinity", "south", sp.Integer(0), south_class_margins),
    ):
        m = fn(coord, levels)
        if classify_margins(m) != "stable":
            unstable.append({
                "name": name,
                "chart": chart,
                "verdict": classify_margins(m),
                "destabilising": destabilising_classes(m),
            })
    stable = (not unstable)
    return {
        "verdict": "verified" if stable else "partial",
        "stable_locus": "P^1 \\ {0, infinity}" if unstable else "P^1",
        "unstable_points": unstable,
        "z1_stable": classify_margins(north_class_margins(1, levels)) == "stable",
        "open": ("Whether z=0 and the pole are attached through a different "
                 "(e.g. nonzero-y) family is not decided here."),
    }
