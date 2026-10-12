"""Milestone 3: continuation, warm starts, and chart seed transport.

The solver in :mod:`e6sim.hermitian_solver` is a one-shot solve.  A UI needs a
smooth slider motion, so this module provides:

1. ``H_to_log_gauge`` / ``log_gauge_to_H`` -- convert between the solved
   positive Hermitian data ``H_v`` and the solver's log-gauge coordinates.
2. ``transport_seed`` -- the chart-change rule from the milestone spec: if
   ``rep_new = k . rep_old`` and ``H_old`` solves the old input, then

       ``H_new,v = (k_v^{-1})^* H_old,v k_v^{-1}``

   is a seed solving the same quotient point in the new chart.
3. ``continue_path`` -- a step-controlled sweep over a parameterised family of
   complex representatives at fixed levels, warm-starting each solve from the
   previous accepted gauge, subdividing on failure, and falling back to a cold
   start.  A failed step never reports the previous matrices as the solution of
   the new input: the returned record carries the failed ``SolveResult`` for
   that point.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, List, Optional, Sequence

import numpy as np

from .conventions import (
    CENTER_BASIS,
    MIDDLE_BASIS,
    NB,
    N_GAUGE_REAL,
    OUTER_BASIS,
    pack_hermitian,
)
from .hermitian_solver import SolveResult, solve_real_moment_map
from .representation import Rep


# --- H <-> log-gauge coordinates -------------------------------------------

def _hermitian_log(m: np.ndarray) -> np.ndarray:
    """Principal Hermitian logarithm of a Hermitian positive-definite ``m``."""
    m = np.asarray(m, dtype=complex)
    m = (m + m.conj().T) / 2.0
    w, v = np.linalg.eigh(m)
    if np.min(w) <= 0:
        raise ValueError("H is not positive definite; cannot take log")
    return (v * np.log(w)) @ v.conj().T


def H_to_log_gauge(H: dict) -> dict:
    """Convert solved ``H_v`` data to log-gauge coordinates for a warm start.

    Returns a dict with keys ``'center'`` (8,), ``'middle'`` (three (4,)),
    ``'outer'`` (three (1,)) -- exactly the seed format accepted by
    :func:`e6sim.hermitian_solver.solve_real_moment_map`.
    """
    center = _hermitian_log(H["center"])
    center = center - (np.trace(center) / 3.0) * np.eye(3, dtype=complex)
    c_coords = pack_hermitian(center, CENTER_BASIS)
    middle = [pack_hermitian(_hermitian_log(H["middle"][i]), MIDDLE_BASIS)
              for i in range(NB)]
    outer = [np.array([np.log(np.real(H["outer"][i][0, 0]))]) for i in range(NB)]
    return {"center": c_coords, "middle": middle, "outer": outer}


def log_gauge_to_H(log_gauge: dict) -> dict:
    """Inverse of :func:`H_to_log_gauge` (reconstruct ``H_v`` matrices)."""
    from scipy.linalg import expm
    from .conventions import unpack_hermitian
    center = unpack_hermitian(log_gauge["center"], CENTER_BASIS)
    middle = [unpack_hermitian(log_gauge["middle"][i], MIDDLE_BASIS)
              for i in range(NB)]
    outer = [np.array([[np.exp(float(np.real(log_gauge["outer"][i][0])))]],
                      dtype=complex) for i in range(NB)]
    return {"center": expm(center),
            "middle": [expm(m) for m in middle],
            "outer": outer}


# --- chart-change seed transport -------------------------------------------

def transport_seed(H_old: dict, k: dict) -> dict:
    """Transport a solved ``H_old`` across a chart gauge ``k``.

    ``k`` is a complex gauge with keys ``'center'`` (3x3), ``'middle'``
    (three 2x2) and ``'outer'`` (three 1x1).  Returns a *log-gauge seed dict*
    for the solver of the new chart.
    """
    kc = np.asarray(k["center"], dtype=complex)
    kc_inv = np.linalg.inv(kc)
    H_center = kc_inv.conj().T @ H_old["center"] @ kc_inv
    H_middle = []
    for i in range(NB):
        ki = np.asarray(k["middle"][i], dtype=complex)
        ki_inv = np.linalg.inv(ki)
        H_middle.append(ki_inv.conj().T @ H_old["middle"][i] @ ki_inv)
    H_outer = []
    for i in range(NB):
        qi = complex(np.asarray(k["outer"][i]).reshape(-1)[0])
        H_outer.append(np.array([[np.real(H_old["outer"][i][0, 0]) / (qi * qi.conjugate())]]))
    return H_to_log_gauge({"center": H_center, "middle": H_middle, "outer": H_outer})


# --- step-controlled continuation ------------------------------------------

@dataclass
class ContinuationStep:
    """One accepted/failed point along a continuation path."""

    point: float
    result: SolveResult
    seed_kind: str            # 'warm' | 'refined' | 'cold'
    accepted: bool = field(init=False)
    seed: Optional[dict] = None

    def __post_init__(self):
        self.accepted = bool(self.result.success)


def continue_path(
    points: Sequence[float],
    rep_of: Callable[[float], Rep],
    levels,
    initial_seed: Optional[dict] = None,
    options: Optional[dict] = None,
    max_subdivisions: int = 6,
    cold_start_on_failure: bool = True,
) -> List[ContinuationStep]:
    """Warm-started sweep over ``points`` at fixed ``levels``.

    Between consecutive points the representation changes (e.g. a different
    ``z``); the previous solved ``H`` is the seed.  On failure at a target
    point, the interval back to the last accepted point is subdivided
    (nearest-midpoint first, up to ``max_subdivisions``) to obtain a nearer
    seed; if that still fails and ``cold_start_on_failure`` is set, a cold
    start is attempted at the target.  The recorded step always refers to the
    target point's own input, never to the previous matrices.
    """
    opts = dict(options or {})
    steps: List[ContinuationStep] = []
    seed = initial_seed
    last_point: Optional[float] = None

    for p in points:
        # warm start from the running seed
        rep = rep_of(p)
        res = solve_real_moment_map(rep, levels, initial_log_gauge=seed, options=opts)
        if res.success:
            steps.append(ContinuationStep(p, res, "warm", seed=seed))
            seed = H_to_log_gauge(res.H)
            last_point = p
            continue

        # subdivide the interval [last_point, p] to find a nearer warm start
        refined = False
        if last_point is not None and seed is not None:
            lo, hi = float(last_point), float(p)
            best_seed = seed
            for _ in range(max_subdivisions):
                mid = 0.5 * (lo + hi)
                rmid = solve_real_moment_map(rep_of(mid), levels,
                                             initial_log_gauge=best_seed, options=opts)
                if rmid.success:
                    best_seed = H_to_log_gauge(rmid.H)
                    lo = mid
                else:
                    hi = mid
            if lo != float(last_point):
                res2 = solve_real_moment_map(rep, levels,
                                             initial_log_gauge=best_seed, options=opts)
                if res2.success:
                    steps.append(ContinuationStep(p, res2, "refined", seed=best_seed))
                    seed = H_to_log_gauge(res2.H)
                    last_point = p
                    refined = True
        if refined:
            continue

        if cold_start_on_failure:
            res3 = solve_real_moment_map(rep, levels, initial_log_gauge=None, options=opts)
            if res3.success:
                steps.append(ContinuationStep(p, res3, "cold"))
                seed = H_to_log_gauge(res3.H)
                last_point = p
                continue

        # genuinely failed at this point: record it, keep the previous seed and
        # last_point so the next target is measured from the last good state
        steps.append(ContinuationStep(p, res, "warm", seed=seed))

    return steps
