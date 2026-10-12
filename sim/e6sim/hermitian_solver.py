"""Milestone 2: positive-Hermitian-gauge solver for the real moment map.

Given an *arbitrary* complex-moment-map-zero representative ``(x, y)`` and a
real level ``levels`` of shape (3, 2), find a positive gauge

    ``g = exp(S_center / 2)``   (traceless Hermitian 3x3, so ``det g = 1``)
    ``h_i = exp(S_i / 2)``      (Hermitian 2x2)
    ``q_i = exp(s_i / 2)``      (real scalar)

putting the real moment map at the level.  There are ``8 + 3*4 + 3 = 23``
real unknowns, packed in the Frobenius-orthonormal Hermitian bases of
:mod:`e6sim.conventions` (8 central, 4 per middle vertex, 1 per outer).

The implementation is deliberately transparent: it applies the gauge to the
whole representation with :meth:`e6sim.representation.Rep.gauge` and then
evaluates the milestone-0 real residual :func:`e6sim.moment_maps.pack_real_residual`.
The nonlinear least-squares problem is solved with
``scipy.optimize.least_squares(method='trf')`` and a finite-difference
Jacobian.  Success is only reported after *directly recomputing* the real and
complex residuals and verifying finite positive gauge data with
``det(H_center) = 1``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np
from scipy.linalg import expm
from scipy.optimize import least_squares

from .conventions import (
    CENTER_BASIS,
    MIDDLE_BASIS,
    NB,
    N_GAUGE_REAL,
    OUTER_BASIS,
    unpack_hermitian,
)
from .moment_maps import (
    complex_residual_norm,
    pack_real_residual,
    real_residual,
)
from .representation import Rep

_LEAST_SQUARES_KEYS = (
    "jac",
    "bounds",
    "method",
    "ftol",
    "xtol",
    "gtol",
    "x_scale",
    "loss",
    "f_scale",
    "diff_step",
    "tr_solver",
    "tr_options",
    "jac_sparsity",
    "max_nfev",
    "verbose",
)

_DEFAULT_OPTIONS: Dict[str, object] = {
    "ftol": 1e-12,
    "xtol": 1e-12,
    "gtol": 1e-12,
    "max_nfev": 400,
    "x_scale": "jac",
    "abs_tol": 1e-9,
    "rel_tol": 1e-9,
    "complex_tol": 1e-8,
    "det_tol": 1e-8,
    "pos_tol": 0.0,
}


@dataclass
class SolveResult:
    """Outcome of :func:`solve_real_moment_map`.

    ``success`` is true only when the directly recomputed residuals are small
    (absolute *and* relative) and the gauge data are finite, positive, with
    ``det(H_center) = 1``.  ``diagnostics`` reports the raw solver status and
    numbers without asserting a cause for a failed solve.
    """

    success: bool
    log_gauge: dict
    H: dict
    solved_rep: Rep
    residuals: dict
    diagnostics: dict


# --- packing / unpacking of the 23 log-gauge unknowns ----------------------

def _center_slice() -> slice:
    return slice(0, len(CENTER_BASIS))


def _middle_slice(i: int) -> slice:
    n = len(MIDDLE_BASIS)
    start = len(CENTER_BASIS) + n * i
    return slice(start, start + n)


def _outer_slice(i: int) -> slice:
    start = len(CENTER_BASIS) + len(MIDDLE_BASIS) * NB + i
    return slice(start, start + 1)


def _coords_from_log_gauge(log_gauge) -> np.ndarray:
    """Pack a ``{'center', 'middle', 'outer'}`` log-gauge dict into a vector."""
    x = np.zeros(N_GAUGE_REAL, dtype=float)
    x[_center_slice()] = np.asarray(log_gauge["center"], dtype=float).ravel()
    for i in range(NB):
        x[_middle_slice(i)] = np.asarray(log_gauge["middle"][i], dtype=float).ravel()
        x[_outer_slice(i)] = np.asarray(log_gauge["outer"][i], dtype=float).ravel()
    return x


def _raw_from_coords(x: np.ndarray):
    """Coordinates -> the Hermitian log-gauge matrices ``(S_center, S_i, s_i)``."""
    x = np.asarray(x, dtype=float).ravel()
    if x.size != N_GAUGE_REAL:
        raise ValueError(f"expected {N_GAUGE_REAL} log-gauge coords, got {x.size}")
    center = unpack_hermitian(x[_center_slice()], CENTER_BASIS)
    middle = [unpack_hermitian(x[_middle_slice(i)], MIDDLE_BASIS) for i in range(NB)]
    outer = [unpack_hermitian(x[_outer_slice(i)], OUTER_BASIS) for i in range(NB)]
    return center, middle, outer


def _positive_gauge(raw):
    """Build ``(g, h, q)`` from the Hermitian log-gauge matrices."""
    center, middle, outer = raw
    g = expm(0.5 * center)
    h = [expm(0.5 * si) for si in middle]
    q = [np.array([[np.exp(0.5 * float(np.real(oi[0, 0])))]], dtype=complex)
         for oi in outer]
    return g, h, q


def _H_matrices(raw):
    """``H_v = g_v^* g_v = exp(S_v)`` for center, middle, and outer vertices."""
    center, middle, outer = raw
    H_center = expm(center)
    H_middle = [expm(si) for si in middle]
    H_outer = [np.array([[np.exp(float(np.real(oi[0, 0])))]], dtype=complex)
               for oi in outer]
    return {"center": H_center, "middle": H_middle, "outer": H_outer}


def _log_gauge_dict(x: np.ndarray) -> dict:
    center, middle, outer = _raw_from_coords(x)
    return {
        "center": x[_center_slice()].copy(),
        "middle": [x[_middle_slice(i)].copy() for i in range(NB)],
        "outer": [x[_outer_slice(i)].copy() for i in range(NB)],
        "raw": {"center": center, "middle": middle, "outer": outer},
    }


# --- residual --------------------------------------------------------------

def _packed_residual(x: np.ndarray, rep: Rep, levels: np.ndarray) -> np.ndarray:
    """Gauged real-moment-map residual in 23 orthonormal coordinates."""
    g, h, q = _positive_gauge(_raw_from_coords(x))
    gauged = rep.gauge(g, h, q)
    r = pack_real_residual(gauged, levels)
    if not np.all(np.isfinite(r)):
        return np.full_like(r, 1e8)
    return r


def _level_scale(levels: np.ndarray, rep: Rep) -> float:
    """Normalization used to form the relative real residual.

    A large representation can make an absolute residual misleading, so the
    relative residual is ``real_norm / real_scale`` with
    ``real_scale = max(1, ||levels||, sqrt(||rep||_F^2))``.  The chosen scale is
    reported in the result.
    """
    return float(max(1.0, np.linalg.norm(levels), np.sqrt(rep.frobenius_sq())))


def _per_vertex_residuals(solved: Rep, levels: np.ndarray) -> dict:
    r = real_residual(solved, levels)
    def norm(m):
        return float(np.sqrt(np.sum(np.abs(m) ** 2)))
    return {
        "outer": [norm(m) for m in r["outer"]],
        "middle": [norm(m) for m in r["middle"]],
        "center": norm(r["center"]),
    }


# --- main entry point ------------------------------------------------------

def solve_real_moment_map(
    rep: Rep,
    levels,
    initial_log_gauge: Optional[dict] = None,
    options: Optional[dict] = None,
) -> SolveResult:
    """Find a positive Hermitian gauge putting the real moment map at ``levels``.

    Parameters
    ----------
    rep:
        A complex-moment-map-zero representative.  It is not modified.
    levels:
        Real levels, shape (3, 2); ``levels[i, 0]`` is the outer level and
        ``levels[i, 1]`` the middle level (0-based, per ``moment_maps``).
    initial_log_gauge:
        Optional warm start as a log-gauge dict with keys ``'center'`` (8,),
        ``'middle'`` (three (4,)), ``'outer'`` (three (1,)).  Defaults to the
        identity gauge (all zeros).
    options:
        Optional overrides.  Keys understood by ``scipy.optimize.least_squares``
        are forwarded; ``abs_tol``, ``rel_tol``, ``complex_tol``, ``det_tol``,
        and ``pos_tol`` control the success criteria.

    Returns
    -------
    SolveResult
    """
    opts = dict(_DEFAULT_OPTIONS)
    opts.update(options or {})
    levels_arr = np.asarray(levels, dtype=float).reshape(NB, 2)

    ls_kwargs = {k: opts[k] for k in _LEAST_SQUARES_KEYS if k in opts}
    ls_kwargs.setdefault("jac", "2-point")
    ls_kwargs.setdefault("method", "trf")

    x0 = (np.zeros(N_GAUGE_REAL, dtype=float)
          if initial_log_gauge is None
          else _coords_from_log_gauge(initial_log_gauge))

    finite_input = (np.all(np.isfinite(levels_arr))
                    and np.isfinite(rep.frobenius_sq()))
    if not finite_input:
        return _failure_result(rep, levels_arr, x0, opts,
                               status="invalid_input",
                               message="non-finite level or representation data")

    fun = lambda x: _packed_residual(x, rep, levels_arr)  # noqa: E731
    try:
        result = least_squares(fun, x0, **ls_kwargs)
    except (ValueError, FloatingPointError, np.linalg.LinAlgError) as exc:
        return _failure_result(rep, levels_arr, x0, opts,
                               status="solver_error", message=str(exc))

    return _build_result(rep, levels_arr, result, opts)


def _build_result(rep: Rep, levels: np.ndarray, result, opts: dict) -> SolveResult:
    """Recompute all reported quantities directly from the solved gauge."""
    x = np.asarray(result.x, dtype=float)
    raw = _raw_from_coords(x)
    g, h, q = _positive_gauge(raw)
    solved_rep = rep.gauge(g, h, q)

    real_packed = pack_real_residual(solved_rep, levels)
    real_norm = float(np.linalg.norm(real_packed))
    complex_norm = complex_residual_norm(solved_rep)
    real_scale = _level_scale(levels, rep)
    real_rel = real_norm / real_scale

    H = _H_matrices(raw)
    det_H_center = complex(np.linalg.det(H["center"]))
    finite_gauge = _all_finite(H)
    positive_gauge = _all_positive(H, float(opts["pos_tol"]))
    det_ok = abs(det_H_center - 1.0) <= float(opts["det_tol"])

    success = bool(
        getattr(result, "success", False)
        and real_norm <= float(opts["abs_tol"])
        and real_rel <= float(opts["rel_tol"])
        and complex_norm <= float(opts["complex_tol"])
        and finite_gauge
        and positive_gauge
        and det_ok
    )

    H_center = H["center"]
    jac_cond = _jacobian_condition(result)
    diagnostics = {
        "status": "success" if bool(getattr(result, "success", False)) else "failure",
        "solver_success": bool(getattr(result, "success", False)),
        "status_code": int(getattr(result, "status", -1)),
        "message": str(getattr(result, "message", "")),
        "n_iter": int(getattr(result, "nit", 0)),
        "nit": int(getattr(result, "nit", 0)),
        "nfev": int(getattr(result, "nfev", 0)),
        "njev": int(getattr(result, "njev", 0)) if getattr(result, "njev", None) else 0,
        "cost": float(getattr(result, "cost", np.nan)),
        "optimality": float(getattr(result, "optimality", np.nan)),
        "max_log_gauge": float(np.max(np.abs(x))) if x.size else 0.0,
        "jacobian_condition": jac_cond,
        "H_center_condition": _hermitian_condition(H_center),
        "det_H_center": det_H_center,
        "gauge_finite": finite_gauge,
        "gauge_positive": positive_gauge,
        "det_center_ok": det_ok,
        "real_norm_scale": real_scale,
        "abs_tol": float(opts["abs_tol"]),
        "rel_tol": float(opts["rel_tol"]),
        "complex_tol": float(opts["complex_tol"]),
    }

    residuals = {
        "real_packed": real_packed,
        "real_norm": real_norm,
        "real_rel": real_rel,
        "complex_norm": complex_norm,
        "per_vertex": _per_vertex_residuals(solved_rep, levels),
    }

    return SolveResult(
        success=success,
        log_gauge=_log_gauge_dict(x),
        H=H,
        solved_rep=solved_rep,
        residuals=residuals,
        diagnostics=diagnostics,
    )


def _failure_result(rep: Rep, levels: np.ndarray, x0: np.ndarray, opts: dict,
                    status: str, message: str) -> SolveResult:
    """Cause-free failure record: no successful gauge is claimed."""
    log_gauge = _log_gauge_dict(x0)
    raw = _raw_from_coords(x0)
    H = _H_matrices(raw)
    maybe_gauged = None
    try:
        g, h, q = _positive_gauge(raw)
        maybe_gauged = rep.gauge(g, h, q)
    except (ValueError, np.linalg.LinAlgError, FloatingPointError):
        maybe_gauged = rep.copy()
    real_packed = pack_real_residual(maybe_gauged, levels)
    return SolveResult(
        success=False,
        log_gauge=log_gauge,
        H=H,
        solved_rep=maybe_gauged,
        residuals={
            "real_packed": real_packed,
            "real_norm": float(np.linalg.norm(real_packed)),
            "real_rel": float(np.linalg.norm(real_packed)
                              / _level_scale(levels, rep)),
            "complex_norm": complex_residual_norm(maybe_gauged),
            "per_vertex": _per_vertex_residuals(maybe_gauged, levels),
        },
        diagnostics={
            "status": status,
            "solver_success": False,
            "status_code": -1,
            "message": message,
            "n_iter": 0,
            "nit": 0,
            "nfev": 0,
            "njev": 0,
            "cost": float("nan"),
            "optimality": float("nan"),
            "max_log_gauge": float(np.max(np.abs(x0))) if x0.size else 0.0,
            "jacobian_condition": float("inf"),
            "H_center_condition": _hermitian_condition(H["center"]),
            "det_H_center": complex(np.linalg.det(H["center"])),
            "gauge_finite": _all_finite(H),
            "gauge_positive": _all_positive(H, float(opts["pos_tol"])),
            "det_center_ok": False,
            "real_norm_scale": _level_scale(levels, rep),
            "abs_tol": float(opts["abs_tol"]),
            "rel_tol": float(opts["rel_tol"]),
            "complex_tol": float(opts["complex_tol"]),
        },
    )


# --- small numerical helpers ----------------------------------------------

def _all_finite(H: dict) -> bool:
    mats = [H["center"]] + list(H["middle"]) + list(H["outer"])
    return all(bool(np.all(np.isfinite(m))) for m in mats)


def _all_positive(H: dict, tol: float) -> bool:
    mats = [H["center"]] + list(H["middle"]) + list(H["outer"])
    for m in mats:
        if not np.all(np.isfinite(m)):
            return False
        eig = np.linalg.eigvalsh((m + m.conj().T) / 2.0)
        if np.min(eig) <= tol:
            return False
    return True


def _hermitian_condition(m: np.ndarray) -> float:
    if not np.all(np.isfinite(m)):
        return float("inf")
    eig = np.linalg.eigvalsh((m + m.conj().T) / 2.0)
    if np.min(np.abs(eig)) == 0.0:
        return float("inf")
    return float(np.max(np.abs(eig)) / np.min(np.abs(eig)))


def _jacobian_condition(result) -> float:
    jac = getattr(result, "jac", None)
    if jac is None or jac.size == 0 or not np.all(np.isfinite(jac)):
        return float("inf")
    sv = np.linalg.svd(jac, compute_uv=False)
    if sv.size == 0 or sv[-1] == 0.0:
        return float("inf")
    return float(sv[0] / sv[-1])
