"""One certified stable rational ``y = 0`` fixture (Milestone 1, task 3).

Certified data
--------------
* chart parameter ``z = 2`` (exact ``Rational``): an interior point, away
  from every exceptional value ``{0, 1, infinity}`` of the chart;
* levels ``alpha = (3, 3, 3)`` (outer), ``gamma = (1, 2, 3)`` (middle),
  i.e. ``level[i] = (alpha_i, gamma_i)``.

The chart satisfies the complex equations identically (all ``y`` matrices
vanish).  At ``z = 2`` the incidence pattern is generic, and every realizable
``W``-class has an exactly negative King weight; the tightest is
``w = -1`` (the axis ``L_3``).  :func:`certified_fixture` returns
``(rep, levels, margins)`` with ``margins`` mapping each ``W``-class label to
its exact evaluated ``sympy.Rational`` value, all ``< 0``.

The fixture deliberately uses a *distinct* level vector rather than the
fully symmetric ``alpha_i = gamma_i`` choice, which can lie on a wall; the
exact certificate is what makes stability unconditional.
"""

from __future__ import annotations

from typing import Dict

import numpy as np
import sympy as sp

from ..charts import candidate_y0_chart, dxdz, x_gauge_action
from ..representation import Rep
from ..stability import class_margins, exceptional_z, is_stable

__all__ = [
    "CERTIFIED_Z",
    "CERTIFIED_LEVELS",
    "EXCEPTIONAL_Z",
    "certified_fixture",
    "certified_margins",
    "gauge_action_matrix",
    "dxdz_vector",
]

#: Exact interior chart parameter (away from ``{0, 1, infinity}``).
CERTIFIED_Z = sp.Rational(2)

#: ``(alpha_i, gamma_i)`` for the three branches.
CERTIFIED_LEVELS = ((3, 1), (3, 2), (3, 3))

#: Complete excluded set of the chart (finite values plus the pole).
EXCEPTIONAL_Z = exceptional_z()


def _to_numpy(m: sp.Matrix) -> np.ndarray:
    return np.array(m.tolist(), dtype=complex)


def certified_fixture():
    """Return ``(rep, levels, margins)`` for the certified stable fixture.

    ``rep`` is a complex :class:`~e6sim.representation.Rep` with exact integer
    entries (complex residual zero); ``levels`` is a ``(3, 2)`` float array;
    ``margins`` is a dict of exact ``sympy.Rational`` King weights, all ``< 0``.
    """
    a, A, b, B = candidate_y0_chart(CERTIFIED_Z)
    rep = Rep.from_arrays(
        [_to_numpy(m) for m in a],
        [_to_numpy(m) for m in A],
        [_to_numpy(m) for m in b],
        [_to_numpy(m) for m in B],
    )
    levels = np.array(CERTIFIED_LEVELS, dtype=float)
    margins = class_margins(CERTIFIED_Z, CERTIFIED_LEVELS)
    return rep, levels, margins


def certified_margins() -> Dict[str, sp.Expr]:
    """Exact King-weight margins of the certified fixture."""
    return class_margins(CERTIFIED_Z, CERTIFIED_LEVELS)


def gauge_action_matrix() -> sp.Matrix:
    """Exact ``24 x 23`` infinitesimal complex x-gauge action at the fixture."""
    return x_gauge_action(CERTIFIED_Z)


def dxdz_vector() -> sp.Matrix:
    """Exact ``dx/dz`` column (length 24) of the chart."""
    return dxdz(CERTIFIED_Z)


def stability_status():
    """Convenience: ``(is_stable, margins)`` at the certified fixture."""
    return is_stable(CERTIFIED_Z, CERTIFIED_LEVELS)
