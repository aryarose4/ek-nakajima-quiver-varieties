"""Exact wall arrangement in the six real level coordinates (Milestone 6, task 1).

Setting
-------
Milestone 1 (:mod:`e6sim.stability`) fixes the candidate ``y = 0`` chart and
shows that, at a generic chart parameter ``z`` and for **positive** levels,
King beta-stability is the strict inequality

    ``w(W) = sum_i [ alpha_i dim(W cap L_i) + gamma_i dim(W cap P_i) ]``
    ``       - (dim W)/3 * (sum_i alpha_i + 2 sum_i gamma_i)  <  0``

for *every* nonzero proper central subspace ``W`` (line or plane).  Here

    ``alpha_i = level[i, 0]``  (outer),  ``gamma_i = level[i, 1]`` (middle),

so ``w(W)`` is a **linear form** in the six real level coordinates
``(alpha_1, alpha_2, alpha_3, gamma_1, gamma_2, gamma_3)``.  A *wall* is
``w(W) = 0`` for one realizable incidence class ``W``; the stable region is the
open intersection of the half-spaces ``w(W) < 0`` over all realizable ``W``.

This module does **not** re-derive the incidence classification: it consumes
:func:`e6sim.stability.candidate_subspaces` /
:func:`e6sim.stability.incidence_pattern` (through
:func:`e6sim.stability.class_margins`) and only turns the resulting exact King
weights into exact linear forms and an arrangement enumeration.

What is verified here
---------------------
* :func:`wall_forms` -- the exact, deduplicated wall forms, with a check that
  the arrangement is identical at two (or more) generic rational ``z`` values.
* :func:`classify_levels` -- sign classification of a rational level vector,
  with the definitive all-classes verdict delegated to
  :func:`e6sim.stability.is_stable` (never re-implemented here).
* :func:`chambers` -- the sign-chambers of the arrangement restricted to the
  positive orthant (all six coordinates ``> 0``), each certified by an exact
  rational interior sample whose sign vector is checked exactly and whose King
  margins are recomputed through
  :func:`e6sim.stability.class_margins`.

Scaling convention (projective)
-------------------------------
Every wall form is homogeneous of degree one in the levels, so multiplying all
six coordinates by the same positive number ``c > 0`` preserves every strict
inequality ``w(W) < 0`` and hence preserves the stable region, every chamber,
and the sign vector.  The arrangement is therefore a fan of cones through the
origin and is naturally **projective**: we enumerate chambers of the central
arrangement restricted to the positive orthant, and the interior samples are
returned as honest positive rational points (not normalised).  Two samples that
differ by a positive scalar represent the same chamber; :func:`chambers`
returns one sample per chamber and never rescales it.

Honesty
-------
Only chambers for which an exact rational interior sample exists are returned.
The ``stable`` flag on a chamber is set only when *every* realizable incidence
class has a strictly negative exact margin (recomputed by
:func:`e6sim.stability.class_margins`); the count of stable chambers is a
verified number, not an estimate.  The arrangement count itself is obtained by
an exact (rational LP) breadth-first traversal of the chamber adjacency graph,
which is complete for a central hyperplane arrangement because the tope graph is
connected.
"""

from __future__ import annotations

from collections import namedtuple
from functools import lru_cache
from typing import Dict, List, Optional, Sequence, Tuple

import sympy as sp
from sympy.solvers.simplex import (
    InfeasibleLPError,
    UnboundedLPError,
    linprog,
)

from .fixtures.certified_y0_chart import CERTIFIED_LEVELS, CERTIFIED_Z
from .stability import class_margins, is_stable

__all__ = [
    "ALPHA",
    "GAMMA",
    "LEVEL_SYMBOLS",
    "Chamber",
    "Classification",
    "wall_forms",
    "wall_form_dict",
    "wall_forms_agree",
    "classify_levels",
    "chambers",
    "stable_chambers",
    "generic_z_values",
]

# --------------------------------------------------------------------------
# level coordinates
# --------------------------------------------------------------------------
ALPHA = sp.symbols("alpha_1 alpha_2 alpha_3")
GAMMA = sp.symbols("gamma_1 gamma_2 gamma_3")
LEVEL_SYMBOLS: Tuple[sp.Symbol, ...] = ALPHA + GAMMA

#: Generic rational chart parameters (away from ``{0, 1, infinity}``) used to
#: witness that the incidence pattern -- and hence the wall arrangement -- does
#: not depend on ``z`` in the generic locus.
_GENERIC_Z: Tuple[sp.Expr, ...] = (sp.Rational(2), sp.Rational(5, 2), sp.Rational(3))


def generic_z_values() -> Tuple[sp.Expr, ...]:
    """Generic rational ``z`` values used to witness ``z``-independence."""
    return _GENERIC_Z


def _symbolic_levels() -> List[List[sp.Expr]]:
    return [[ALPHA[i], GAMMA[i]] for i in range(3)]


def _level_mapping(levels) -> Dict[sp.Symbol, sp.Expr]:
    """Map the six level symbols to the values of a ``(3, 2)`` (or flat) level."""
    arr = sp.Matrix(3, 2, lambda i, j: 0)
    flat = list(_flatten_levels(levels))
    for i in range(3):
        for j in range(2):
            arr[i, j] = sp.sympify(flat[2 * i + j])
    mapping: Dict[sp.Symbol, sp.Expr] = {}
    for i in range(3):
        mapping[ALPHA[i]] = arr[i, 0]
        mapping[GAMMA[i]] = arr[i, 1]
    return mapping


def _flatten_levels(levels) -> List[sp.Expr]:
    """Flatten a ``(3, 2)`` level array (or a length-6 sequence) to 6 entries."""
    seq = list(levels)
    if len(seq) == 3 and all(hasattr(r, "__len__") and len(r) == 2 for r in seq):
        return [sp.sympify(seq[i][j]) for i in range(3) for j in range(2)]
    flat = [sp.sympify(x) for x in seq]
    if len(flat) != 6:
        raise ValueError(f"expected 6 level coordinates, got {len(flat)}")
    return flat


def _sample_to_levels(sample: Sequence[sp.Expr]) -> List[List[sp.Expr]]:
    """Turn a length-6 ``(alpha_1, alpha_2, alpha_3, gamma_1, gamma_2, gamma_3)``
    sample into the ``(3, 2)`` ``level[i] = (alpha_i, gamma_i)`` form."""
    return [[sample[i], sample[3 + i]] for i in range(3)]


# --------------------------------------------------------------------------
# exact wall forms
# --------------------------------------------------------------------------
def _primitive(form: sp.Expr) -> sp.Expr:
    """Normalise a homogeneous linear form to primitive integer coefficients.

    Multiplies by the (positive) least common multiple of the denominators and
    divides by the (positive) gcd of the resulting integer coefficients.  Only
    positive scalars are used, so the sign of the form -- and hence the
    half-space ``w < 0`` -- is preserved.
    """
    form = sp.expand(form)
    poly = sp.Poly(form, LEVEL_SYMBOLS)
    den = sp.lcm([sp.denom(c) for c in poly.coeffs()])
    scaled = sp.expand(form * den)
    coeffs = [sp.Poly(scaled, LEVEL_SYMBOLS).coeff_monomial(s) for s in LEVEL_SYMBOLS]
    g = sp.gcd([c for c in coeffs])
    if g not in (0, 1):
        scaled = sp.expand(scaled / g)
    return scaled


def _form_key(form: sp.Expr) -> Tuple[sp.Expr, ...]:
    return tuple(sp.Poly(form, LEVEL_SYMBOLS).coeff_monomial(s) for s in LEVEL_SYMBOLS)


def wall_form_dict(z=CERTIFIED_Z) -> Dict[str, sp.Expr]:
    """All realizable wall forms at ``z``, keyed by incidence-class label.

    Uses :func:`e6sim.stability.class_margins` (which internally enumerates
    :func:`e6sim.stability.candidate_subspaces` and labels them by
    :func:`e6sim.stability.incidence_pattern`), evaluated on symbolic levels.
    Values are exact, primitive-integer linear forms in ``LEVEL_SYMBOLS``.
    """
    margins = class_margins(z, _symbolic_levels())
    return {label: _primitive(form) for label, form in margins.items()}


@lru_cache(maxsize=None)
def wall_forms(z=CERTIFIED_Z) -> Tuple[Tuple[str, sp.Expr], ...]:
    """Exact wall forms ``(label, form)`` deduplicated up to positive scaling.

    Two labels that produce the same form, or positive multiples of it, are the
    same wall and are listed once (the first label wins).  Forms that are
    *negative* multiples of each other are different walls (opposite
    half-spaces) and are kept separately.  Returns an immutable tuple so the
    result can be cached.
    """
    out: List[Tuple[str, sp.Expr]] = []
    seen: set = set()
    for label, form in wall_form_dict(z).items():
        key = _form_key(form)
        if key in seen:
            continue
        seen.add(key)
        out.append((label, form))
    return tuple(out)


def _wall_coeffs(z=CERTIFIED_Z):
    """Primitive integer coefficient rows of the deduplicated wall forms."""
    forms = wall_forms(z)
    labels = [label for label, _ in forms]
    rows = [
        [sp.Poly(form, LEVEL_SYMBOLS).coeff_monomial(s) for s in LEVEL_SYMBOLS]
        for _, form in forms
    ]
    return labels, rows


def wall_forms_agree(z_values: Optional[Sequence[sp.Expr]] = None) -> bool:
    """True iff the deduplicated wall-form set is identical at every ``z``.

    Compares the primitive coefficient rows (up to the labelling) at the given
    generic rational ``z`` values; defaults to :func:`generic_z_values`.
    """
    zs = tuple(z_values) if z_values is not None else _GENERIC_Z
    ref = None
    for z in zs:
        _, rows = _wall_coeffs(z)
        keys = sorted(tuple(int(c) for c in row) for row in rows)
        if ref is None:
            ref = keys
        elif keys != ref:
            return False
    return True


# --------------------------------------------------------------------------
# classification of a level vector
# --------------------------------------------------------------------------
Classification = namedtuple(
    "Classification",
    ["status", "on_wall", "positive", "stable", "wall_values", "margins"],
)


def classify_levels(z, levels) -> Classification:
    """Classify a rational level vector against the wall arrangement at ``z``.

    ``status`` is one of

    * ``"interior"`` -- every wall form is strictly negative (candidate stable
      chamber; for positive levels this agrees with :func:`is_stable`),
    * ``"wall"`` -- some wall form vanishes exactly and none is positive,
    * ``"unstable"`` -- some wall form is strictly positive.

    The definitive all-classes verdict is delegated to
    :func:`e6sim.stability.is_stable` (which calls
    :func:`e6sim.stability.class_margins`); this function never substitutes its
    own enumeration for that.  ``on_wall`` lists the labels of the vanishing
    wall forms, ``positive`` the labels of the strictly positive ones.
    """
    mapping = _level_mapping(levels)
    wall_values: Dict[str, sp.Expr] = {}
    for label, form in wall_form_dict(z).items():
        wall_values[label] = sp.nsimplify(form.subs(mapping))

    positive = [label for label, v in wall_values.items() if v > 0]
    on_wall = [label for label, v in wall_values.items() if v == 0]
    if positive:
        status = "unstable"
    elif on_wall:
        status = "wall"
    else:
        status = "interior"

    stable, margins = is_stable(z, levels)
    return Classification(
        status=status,
        on_wall=tuple(on_wall),
        positive=tuple(positive),
        stable=stable,
        wall_values=wall_values,
        margins=margins,
    )


# --------------------------------------------------------------------------
# exact rational feasibility of a sign vector (rational LP)
# --------------------------------------------------------------------------
def _feasible_sample(signs: Sequence[int], coeff_rows) -> Optional[Tuple[sp.Expr, ...]]:
    """Exact rational interior point of the chamber with the given sign vector.

    ``signs[j] = +1`` demands ``form_j > 0`` and ``-1`` demands ``form_j < 0``.
    The six level coordinates must be strictly positive.  Returns a length-6
    tuple of exact rationals, or ``None`` if no such open point exists.

    Formulation: maximise ``t`` subject to
    ``sign_j * form_j(x) - t >= 0`` for every wall, ``x_i - t >= 0`` for every
    coordinate, and ``t <= 1``; the point is feasible iff the optimum has
    ``t > 0``.  All arithmetic is exact (SymPy rational simplex).
    """
    n = len(LEVEL_SYMBOLS)
    rows: List[List[sp.Expr]] = []
    rhs: List[sp.Expr] = []
    for sign, row in zip(signs, coeff_rows):
        # -sign * form_j(x) + t <= 0
        rows.append([-sign * c for c in row] + [sp.Integer(1)])
        rhs.append(sp.Integer(0))
    for i in range(n):
        # -x_i + t <= 0   (enforces strict positivity of x_i when t > 0)
        r = [sp.Integer(0)] * (n + 1)
        r[i] = sp.Integer(-1)
        r[n] = sp.Integer(1)
        rows.append(r)
        rhs.append(sp.Integer(0))
    # t <= 1
    r = [sp.Integer(0)] * (n + 1)
    r[n] = sp.Integer(1)
    rows.append(r)
    rhs.append(sp.Integer(1))

    A = sp.Matrix(rows)
    b = sp.Matrix(rhs)
    c = [sp.Integer(0)] * n + [sp.Integer(-1)]  # minimise -t
    try:
        _, sol = linprog(c, A, b)
    except (InfeasibleLPError, UnboundedLPError):
        return None
    tval = sol[n]
    if tval <= 0:
        return None
    return tuple(sp.nsimplify(sol[i]) for i in range(n))


# --------------------------------------------------------------------------
# chamber enumeration
# --------------------------------------------------------------------------
Chamber = namedtuple("Chamber", ["index", "signs", "sample", "margins", "stable"])


def _fixture_sign_vector(labels, coeff_rows):
    mapping = _level_mapping(CERTIFIED_LEVELS)
    signs = []
    for row in coeff_rows:
        val = sum(row[k] * mapping[LEVEL_SYMBOLS[k]] for k in range(6))
        signs.append(int(sp.sign(val)))
    return tuple(signs)


@lru_cache(maxsize=None)
def chambers(z=CERTIFIED_Z) -> List[Chamber]:
    """Sign-chambers of the wall arrangement restricted to positive levels.

    Enumerates every full-dimensional chamber of the central arrangement of
    wall hyperplanes intersected with the open positive orthant
    (``alpha_i, gamma_i > 0``).  The traversal is an exact breadth-first search
    of the tope graph: from each chamber and each wall, the sign of that wall is
    flipped and the resulting open region is tested for feasibility by an exact
    rational LP (:func:`_feasible_sample`).  The tope graph of a hyperplane
    arrangement is connected, so the traversal is complete.

    Each returned :class:`Chamber` carries

    * ``signs`` -- the ``+1/-1`` sign vector over :func:`wall_forms` order;
    * ``sample`` -- an exact rational interior level point (six coordinates,
      all strictly positive);
    * ``margins`` -- the exact King margins of the sample, recomputed through
      :func:`e6sim.stability.class_margins`;
    * ``stable`` -- ``True`` iff every margin is strictly negative.

    Chambers are returned sorted by their sign vector for determinism.  The
    enumeration is projective (see the module docstring): uniform positive
    scaling of the levels is the identity on chambers.
    """
    labels, coeff_rows = _wall_coeffs(z)
    nwalls = len(coeff_rows)

    start = _fixture_sign_vector(labels, coeff_rows)
    sample0 = _feasible_sample(start, coeff_rows)
    if sample0 is None:  # pragma: no cover - defensive; generic z is feasible
        raise RuntimeError(f"could not find a starting chamber at z={z}")

    visited: Dict[Tuple[int, ...], Tuple[sp.Expr, ...]] = {start: sample0}
    queue: List[Tuple[int, ...]] = [start]
    while queue:
        cur = queue.pop()
        for k in range(nwalls):
            nxt = list(cur)
            nxt[k] = -nxt[k]
            nxt = tuple(nxt)
            if nxt in visited:
                continue
            sample = _feasible_sample(nxt, coeff_rows)
            if sample is not None:
                visited[nxt] = sample
                queue.append(nxt)

    result: List[Chamber] = []
    for signs in sorted(visited):
        sample = visited[signs]
        # Exact interior verification of the sample against every wall.
        for sign, row in zip(signs, coeff_rows):
            val = sum(row[k] * sample[k] for k in range(6))
            assert sign * val > 0, (signs, row, sample)
        for v in sample:
            assert v > 0, (signs, sample)

        margins = class_margins(z, _sample_to_levels(sample))
        stable = all(bool(sp.simplify(m) < 0) for m in margins.values())
        result.append(
            Chamber(
                index=len(result),
                signs=signs,
                sample=sample,
                margins=margins,
                stable=stable,
            )
        )
    return result


def stable_chambers(z=CERTIFIED_Z) -> List[Chamber]:
    """The chambers of :func:`chambers` whose King margins are all negative."""
    return [c for c in chambers(z) if c.stable]
