"""Solved-geometry bundle for the browser triangle visualizer.

This module is pure NumPy (no UI, no SymPy): it turns a *solved*, at-level
representative of the E6 star quiver into a JSON-serializable geometric record
a browser viewer can render directly.

Why the solved representative and not the chart flags
-----------------------------------------------------
The chart ``Q_i = alpha_i (Pi_Li - I3/3) + gamma_i (Pi_Pi - 2 I3/3)`` built
from the chart's own flags does **not** close (``closure_error ~ 2.9``), and its
pairwise traces differ from the real-moment-map-solved representative's.  The
solver's positive (non-unitary) Hermitian gauge does not preserve orthogonal
projectors, so the chart-flag overlaps/pairwise data are simply wrong.  Every
geometric quantity here is therefore extracted from a representative solved by
:func:`e6sim.hermitian_solver.solve_real_moment_map`.

Central compact alignment (``align_central``)
---------------------------------------------
Balancing leaves a compact central ``U(3)`` freedom.  For a smooth sweep we
align a newly solved representative to the previous displayed one by the
Procrustes problem

    minimize_{u in U(3)}  sum_i || u A_i^new - A_i^prev ||_F^2,

whose solution is ``u = V U^*`` from the SVD ``M = U S V^*`` of
``M = sum_i A_i^new (A_i^prev)^*``.  ``u`` is det-fixed to ``SU(3)`` up to a
global phase (a global phase is harmless: it is unitary).  Applying the central
gauge ``(u, h_i = I_2, q_i = 1)`` sends ``A_i -> u A_i``, ``B_i -> B_i u^*``
and leaves ``a_i, b_i`` unchanged, so the real-moment-map residual is preserved
exactly (unitary central conjugation is a symmetry).
"""

from __future__ import annotations

from typing import List, Optional, Tuple

import numpy as np

from .charts import candidate_y0_chart
from .conventions import CENTER_BASIS, NB, pack_hermitian
from .geometry import extract_geometry
from .hermitian_solver import solve_real_moment_map
from .moment_maps import real_residual_norm
from .representation import Rep
from .stability import is_stable
from .v1 import (
    line_projector,
    ordered_spectrum,
    plane_projector,
    projector_overlaps,
)

__all__ = [
    "align_central",
    "solve_point",
    "point_record",
    "build_solved_bundle",
    "CERTIFIED_SWEEP_LEVELS",
    "SWEEP_Z",
    "PRESET_LEVELS",
    "MARKER_SCALE_LINE",
    "MARKER_SCALE_PLANE",
]

_I2 = np.eye(2, dtype=complex)
_I3 = np.eye(3, dtype=complex)
_ONE = np.array([[1.0 + 0.0j]], dtype=complex)

#: Documented display scales for the projected flag markers (V2).  The marker is
#: ``midpoint(edge_i) + c * p(dir_i)``; ``c = 1`` keeps the decoration at its
#: natural length relative to the triangle edges.
MARKER_SCALE_LINE = 1.0
MARKER_SCALE_PLANE = 1.0

#: Certified ``y = 0`` levels of ``fixtures.certified_y0_chart``.
CERTIFIED_SWEEP_LEVELS = ((3, 1), (3, 2), (3, 3))

#: ``z``-sweep at the certified levels: a continuous path with ``|z|`` from 0.5
#: to 3.0 (21 samples, step 0.125), whose argument rises from 0 to ``pi/6`` and
#: back, so the path passes through the exact sample ``z = 2 e^{i pi/6}`` at
#: ``|z| = 2`` and stays continuous for smooth frame animation.
def _sweep_z():
    zs = []
    for r in np.arange(0.5, 3.0 + 1e-9, 0.125):
        r = round(float(r), 6)
        theta = (np.pi / 6) * (r - 0.5) / 1.5 if r <= 2.0 \
            else (np.pi / 6) * (3.0 - r)
        zs.append(complex(r * np.cos(theta), r * np.sin(theta)))
    return tuple(zs)


SWEEP_Z = _sweep_z()

#: Two extra level presets solved at ``z = 2``.
PRESET_LEVELS = (
    ((2, 1), (2, 1), (2, 1)),
    ((4, 1), (3, 2), (2, 2)),
)

#: Labeled level options advertised to the viewer.
_LEVEL_OPTIONS = (
    {"label": "certified (3,1)(3,2)(3,3)", "levels": CERTIFIED_SWEEP_LEVELS},
    {"label": "equal (2,1)(2,1)(2,1)", "levels": PRESET_LEVELS[0]},
    {"label": "preset (4,1)(3,2)(2,2)", "levels": PRESET_LEVELS[1]},
)


# --------------------------------------------------------------------------
# compact central alignment
# --------------------------------------------------------------------------
def align_central(rep_new: Rep, rep_prev: Rep) -> Tuple[Rep, np.ndarray]:
    """Align ``rep_new`` to ``rep_prev`` by a central unitary ``u``.

    Returns ``(rep_aligned, u)`` where ``u`` is unitary (det-fixed to ``SU(3)``
    up to a global phase) minimizing ``sum_i ||u A_i^new - A_i^prev||_F^2``.
    The applied gauge is ``(u, I_2, 1)``: ``A_i -> u A_i``, ``B_i -> B_i u^*``,
    ``a_i, b_i`` unchanged.  A central unitary is a symmetry of the real moment
    map, so the real residual is unchanged.
    """
    M = np.zeros((3, 3), dtype=complex)
    for i in range(NB):
        M += rep_new.A[i] @ rep_prev.A[i].conj().T

    U, _s, Vh = np.linalg.svd(M)
    u = Vh.conj().T @ U.conj().T  # V @ U^*,  M = U S V^*

    det = complex(np.linalg.det(u))
    if abs(det) > 0.0:
        u = u / (det ** (1.0 / 3.0))  # det-fix to SU(3) up to a global phase

    aligned = rep_new.gauge(u, [_I2.copy() for _ in range(NB)],
                            [_ONE.copy() for _ in range(NB)])
    return aligned, u


def _identity_alignment(rep: Rep) -> Tuple[Rep, np.ndarray]:
    return rep.copy(), np.eye(3, dtype=complex)


def _chart_rep(z) -> Rep:
    """Complex-``tau=0`` chart representative at ``z`` as a :class:`Rep`."""
    a, A, b, B = candidate_y0_chart(complex(z))
    return Rep.from_arrays(a, A, b, B)


# --------------------------------------------------------------------------
# solve one point
# --------------------------------------------------------------------------
def solve_point(z, levels, prev_rep: Optional[Rep] = None):
    """Solve the chart at ``z`` to ``levels`` and align to ``prev_rep``.

    Returns ``(rep_solved, rep_aligned, info)``.  ``rep_solved`` is the raw
    solver output; ``rep_aligned`` is ``rep_solved`` after the central
    alignment (the representative to render).  ``info`` records solver status,
    the recomputed residuals, and the alignment.
    """
    levels_arr = np.asarray(levels, dtype=float).reshape(NB, 2)
    chart = _chart_rep(z)
    res = solve_real_moment_map(chart, levels_arr)

    rep_solved = res.solved_rep
    if prev_rep is None:
        rep_aligned, u = _identity_alignment(rep_solved)
        aligned = False
    else:
        rep_aligned, u = align_central(rep_solved, prev_rep)
        aligned = True

    info = {
        "solver_success": bool(res.success),
        "solver_status": res.diagnostics.get("status", "unknown"),
        "real_norm": float(res.residuals["real_norm"]),
        "complex_norm": float(res.residuals["complex_norm"]),
        "aligned": aligned,
        "align_det": complex(np.linalg.det(u)),
        "align_u": u.tolist(),
        "real_norm_after_align": float(real_residual_norm(rep_aligned, levels_arr)),
    }
    return rep_solved, rep_aligned, info


# --------------------------------------------------------------------------
# rank-checked solved flags
# --------------------------------------------------------------------------
def _solved_flags(rep: Rep, tol: float = 1e-9):
    """Line/plane projectors from the *solved* rep, with explicit rank checks."""
    L_proj, P_proj = [], []
    for i in range(NB):
        X, uvec = rep.A[i], rep.a[i]
        ell = X @ uvec
        if float(np.linalg.norm(ell)) <= tol:
            raise ValueError(f"_solved_flags: L_{i + 1} = image(A_i a_i) is zero")
        if int(np.linalg.matrix_rank(X, tol=tol)) != 2:
            raise ValueError(f"_solved_flags: P_{i + 1} = image(A_i) is not rank 2")
        L_proj.append(line_projector(ell))
        P_proj.append(plane_projector(X, tol=tol))
    return L_proj, P_proj


# --------------------------------------------------------------------------
# viewing frame
# --------------------------------------------------------------------------
def _view_frame(q: np.ndarray, line_dir: np.ndarray, plane_dir: np.ndarray,
                tol: float = 1e-12) -> np.ndarray:
    """Orthonormal frame ``(3, 8)`` with ``e1 ~ q1``, ``e2 ~ q2``.

    Documented rule for the third direction: take the component of the summed
    line decoration ``sum_i d_i`` orthogonal to ``span(e1, e2)``; if that
    vanishes, use the summed plane decoration ``sum_i e_i``; if that also
    vanishes, fall back to the first standard basis vector with a nonzero
    orthogonal component.  The first two rows span the triangle plane, so edge
    lengths and angles are preserved by the projection.
    """
    q1 = np.asarray(q[0], dtype=float)
    q2 = np.asarray(q[1], dtype=float)

    n1 = float(np.linalg.norm(q1))
    if n1 <= tol:
        raise ValueError("_view_frame: q1 is zero; degenerate triangle")
    e1 = q1 / n1

    w2 = q2 - (q2 @ e1) * e1
    n2 = float(np.linalg.norm(w2))
    if n2 <= tol:
        raise ValueError("_view_frame: q1, q2 collide; degenerate triangle")
    e2 = w2 / n2

    def _orthogonalize(v):
        v = np.asarray(v, dtype=float)
        v = v - (v @ e1) * e1 - (v @ e2) * e2
        return v

    candidates = [np.sum(np.asarray(line_dir, dtype=float), axis=0),
                  np.sum(np.asarray(plane_dir, dtype=float), axis=0)]
    e3 = None
    for cand in candidates:
        w3 = _orthogonalize(cand)
        if float(np.linalg.norm(w3)) > tol:
            e3 = w3 / float(np.linalg.norm(w3))
            break
    if e3 is None:
        for k in range(8):
            std = np.zeros(8)
            std[k] = 1.0
            w3 = _orthogonalize(std)
            if float(np.linalg.norm(w3)) > tol:
                e3 = w3 / float(np.linalg.norm(w3))
                break
    if e3 is None:
        raise ValueError("_view_frame: no third orthonormal direction found")

    return np.vstack([e1, e2, e3])


# --------------------------------------------------------------------------
# point record
# --------------------------------------------------------------------------
def point_record(z, levels, rep: Rep) -> dict:
    """JSON-serializable geometric record of a solved/aligned representative.

    Keys exactly: ``z_re, z_im, levels, q, line_dir, plane_dir, edge_norms_sq,
    pairwise, spectra, overlaps, branch_traces, closure_error, stable,
    view_frame, vertices, markers``.  ``q/line_dir/plane_dir`` are eight-vectors
    in the Frobenius-orthonormal traceless-Hermitian central basis of
    :func:`e6sim.conventions.traceless_hermitian_basis` (3).  ``view_frame`` is
    ``(3, 8)``: the three orthonormal viewing directions (rows) in the same
    eight-dimensional space; ``vertices`` and ``markers`` are their ``R^3``
    projections via ``p(v) = (v.e1, v.e2, v.e3)``.
    """
    levels_arr = np.asarray(levels, dtype=float).reshape(NB, 2)
    zc = complex(z)

    g = extract_geometry(rep, levels_arr)
    q = np.asarray(g["q"], dtype=float)                      # (3, 8)

    L_proj, P_proj = _solved_flags(rep)
    line_dir = np.array(
        [pack_hermitian(L_proj[i] - _I3 / 3.0, CENTER_BASIS) for i in range(NB)]
    )
    plane_dir = np.array(
        [pack_hermitian(P_proj[i] - 2.0 * _I3 / 3.0, CENTER_BASIS) for i in range(NB)]
    )

    spectra = np.array([ordered_spectrum(g["Q"][i]) for i in range(NB)])
    overlaps = projector_overlaps(L_proj, P_proj)
    edge_norms_sq = np.array([float(np.dot(q[i], q[i])) for i in range(NB)])

    view_frame = _view_frame(q, line_dir, plane_dir)         # (3, 8)

    def p(v):
        return view_frame @ np.asarray(v, dtype=float)

    q1 = q[0]
    q2 = q[1]
    v0 = p(np.zeros(8))
    v1 = p(q1)
    v2 = p(q1 + q2)
    vertices = np.vstack([v0, v1, v2])

    # edge i is the triangle edge along q_i, i = 1..3; q3 = -(q1+q2).
    midpoints = [(v0 + v1) / 2.0, (v1 + v2) / 2.0, (v2 + v0) / 2.0]
    line_markers = np.array(
        [midpoints[i] + MARKER_SCALE_LINE * p(line_dir[i]) for i in range(NB)]
    )
    plane_markers = np.array(
        [midpoints[i] + MARKER_SCALE_PLANE * p(plane_dir[i]) for i in range(NB)]
    )

    stable, _margins = is_stable(zc, levels_arr)

    return {
        "z_re": float(zc.real),
        "z_im": float(zc.imag),
        "levels": levels_arr.tolist(),
        "q": q.tolist(),
        "line_dir": line_dir.tolist(),
        "plane_dir": plane_dir.tolist(),
        "edge_norms_sq": edge_norms_sq.tolist(),
        "pairwise": np.asarray(g["pairwise"], dtype=float).tolist(),
        "spectra": spectra.tolist(),
        "overlaps": {k: np.asarray(v, dtype=float).tolist()
                     for k, v in overlaps.items()},
        "branch_traces": np.asarray(g["branch_traces"], dtype=float).tolist(),
        "closure_error": float(g["closure_error"]),
        "stable": bool(stable),
        "view_frame": view_frame.tolist(),
        "vertices": vertices.tolist(),
        "markers": {"line": line_markers.tolist(),
                    "plane": plane_markers.tolist()},
    }


# --------------------------------------------------------------------------
# sweep driver
# --------------------------------------------------------------------------
def _levels_option_payload():
    options = []
    for opt in _LEVEL_OPTIONS:
        levels = np.asarray(opt["levels"], dtype=float).reshape(NB, 2)
        options.append({
            "label": opt["label"],
            "alpha": levels[:, 0].tolist(),
            "gamma": levels[:, 1].tolist(),
        })
    return options


def _point_label(z, levels) -> str:
    levels_arr = np.asarray(levels, dtype=float).reshape(NB, 2)
    lv = ",".join(f"({int(a)},{int(g)})" for a, g in levels_arr)
    return f"z={z.real:.4g}{z.imag:+.4g}i levels={lv}"


def build_solved_bundle() -> dict:
    """Solve the sweep and presets and return the full bundle payload.

    Failing solves are **skipped** and recorded in ``skipped`` (never
    fabricated).  Each sweep point is aligned to the previous *successful*
    sweep point.
    """
    sweep: List[dict] = []
    skipped: List[dict] = []
    prev_rep: Optional[Rep] = None

    for z in SWEEP_Z:
        _solved, aligned, info = solve_point(z, CERTIFIED_SWEEP_LEVELS, prev_rep)
        if not info["solver_success"]:
            skipped.append({
                "z_re": float(complex(z).real),
                "z_im": float(complex(z).imag),
                "levels": np.asarray(CERTIFIED_SWEEP_LEVELS, dtype=float).tolist(),
                "reason": f"solver failed: {info['solver_status']}",
            })
            continue
        rec = point_record(z, CERTIFIED_SWEEP_LEVELS, aligned)
        rec["label"] = _point_label(complex(z), CERTIFIED_SWEEP_LEVELS)
        sweep.append(rec)
        prev_rep = aligned

    presets: List[dict] = []
    for levels in PRESET_LEVELS:
        _solved, aligned, info = solve_point(2.0, levels, None)
        if not info["solver_success"]:
            skipped.append({
                "z_re": 2.0,
                "z_im": 0.0,
                "levels": np.asarray(levels, dtype=float).tolist(),
                "reason": f"solver failed: {info['solver_status']}",
            })
            continue
        rec = point_record(2.0, levels, aligned)
        rec["label"] = _point_label(complex(2.0, 0.0), levels)
        presets.append(rec)

    return {
        "schema": "e6-triangle-solved/1",
        "basis": "traceless_hermitian_3",
        "levels_options": _levels_option_payload(),
        "sweep": sweep,
        "presets": presets,
        "skipped": skipped,
    }
