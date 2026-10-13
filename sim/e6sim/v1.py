"""Visualizer milestone V1: weighted-flag / spectral identities at ``y = 0``.

Pure NumPy.  No solver, no UI, no SymPy.

At ``y = 0`` the solved branch equations are (``u_i = a_i``, ``X_i = A_i``,
``alpha_i = level[i,0]``, ``gamma_i = level[i,1]``)

    ``u_i^* u_i = alpha_i``
    ``X_i^* X_i = gamma_i I_2 + u_i u_i^*``

With ``L_i = image(X_i u_i)`` (a line) and ``P_i = image(X_i)`` (a plane),
and orthogonal projectors ``Pi_Li``, ``Pi_Pi``, the first of these implies

    ``X_i X_i^* = alpha_i Pi_Li + gamma_i Pi_Pi``          (V1 projector identity)
    ``Q_i = alpha_i (Pi_Li - I_3/3) + gamma_i (Pi_Pi - 2 I_3/3)``

so ``Q_i`` (the traceless part of ``X_i X_i^*``) has ordered spectrum

    ``((2 alpha_i + gamma_i)/3, (-alpha_i + gamma_i)/3, -(alpha_i + 2 gamma_i)/3)``

and squared norm ``(2/3)(alpha_i^2 + alpha_i gamma_i + gamma_i^2)``.  The
eigenspace for the top eigenvalue is ``L_i``; the top two span ``P_i``, so
``Q_i`` already encodes the full flag whenever both levels are positive.

``gauge_invariants(z, levels)`` builds these quantities *purely from the
chart flags* ``L_i = image(A_i a_i)``, ``P_i = image(A_i)`` of
:func:`e6sim.charts.candidate_y0_chart`, weighted by ``levels``.  This is the
deterministic reference bundle the browser JS is checked against; it does not
call the Hermitian solver.  Note (see the module caveat in the V1 test): the
chart's positive gauge is non-unitary, so these chart-flag invariants coincide
with the balanced solved representative only in the spectral/edge-norm data
(functions of ``(alpha_i, gamma_i)`` alone), not in the overlap/pairwise data.
"""

from __future__ import annotations

from typing import Dict, List, Sequence

import numpy as np

from .charts import candidate_y0_chart
from .conventions import NB

__all__ = [
    "line_projector",
    "plane_projector",
    "q_from_flags",
    "ordered_spectrum",
    "spectrum_expected",
    "squared_norm_expected",
    "projector_overlaps",
    "gauge_invariants",
]

_I3 = np.eye(3, dtype=complex)


# --------------------------------------------------------------------------
# projectors (thin Gram-Schmidt with a rank check; no Gram inverse)
# --------------------------------------------------------------------------
def line_projector(v) -> np.ndarray:
    """Orthogonal projector onto ``image(v)`` for a single complex vector."""
    v = np.asarray(v, dtype=complex).reshape(-1, 1)
    nrm2 = float(np.real(v.conj().T @ v)[0, 0])
    if not nrm2 > 0.0:
        raise ValueError("line_projector: zero vector")
    return (v @ v.conj().T) / nrm2


def _orthonormal_columns(X: np.ndarray, tol: float) -> np.ndarray:
    """Modified Gram-Schmidt basis of ``col(X)`` with a rank/zero check."""
    X = np.asarray(X, dtype=complex)
    if X.ndim == 1:
        X = X.reshape(-1, 1)
    n, m = X.shape
    scale = max(1.0, float(np.linalg.norm(X, "fro")))
    abs_tol = tol * scale
    basis: List[np.ndarray] = []
    for j in range(m):
        v = X[:, j].copy()
        for _ in range(2):  # reorthogonalization pass
            for qcol in basis:
                v = v - qcol * (qcol.conj() @ v)
        nv = float(np.linalg.norm(v))
        if nv > abs_tol:
            basis.append(v / nv)
    if not basis:
        raise ValueError("plane_projector: zero-rank input")
    return np.column_stack(basis)


def plane_projector(X, tol: float = 1e-9) -> np.ndarray:
    """Orthogonal projector onto ``col(X) = image(X)`` (thin QR / GS).

    A rank check via reorthogonalized Gram-Schmidt drops dependent columns;
    no Gram-matrix inverse is formed.
    """
    B = _orthonormal_columns(X, tol)
    return B @ B.conj().T


# --------------------------------------------------------------------------
# weighted flags -> Q_i, spectra, norms, overlaps
# --------------------------------------------------------------------------
def q_from_flags(L_proj: Sequence[np.ndarray], P_proj: Sequence[np.ndarray],
                 levels) -> List[np.ndarray]:
    """``Q_i = alpha_i (Pi_Li - I3/3) + gamma_i (Pi_Pi - 2 I3/3)``."""
    levels = np.asarray(levels, dtype=float).reshape(NB, 2)
    out = []
    for i in range(NB):
        alpha, gamma = float(levels[i, 0]), float(levels[i, 1])
        out.append(alpha * (np.asarray(L_proj[i], dtype=complex) - _I3 / 3.0)
                   + gamma * (np.asarray(P_proj[i], dtype=complex) - 2.0 * _I3 / 3.0))
    return out


def ordered_spectrum(Q) -> np.ndarray:
    """Eigenvalues of Hermitian ``Q`` in descending order."""
    Q = np.asarray(Q, dtype=complex)
    w = np.linalg.eigvalsh((Q + Q.conj().T) / 2.0)
    return np.sort(w)[::-1]


def spectrum_expected(alpha: float, gamma: float) -> np.ndarray:
    """Ordered spectrum ``((2a+g)/3, (-a+g)/3, -(a+2g)/3)``."""
    a, g = float(alpha), float(gamma)
    return np.array([(2.0 * a + g) / 3.0, (-a + g) / 3.0, -(a + 2.0 * g) / 3.0])


def squared_norm_expected(alpha: float, gamma: float) -> float:
    """``||Q_i||_F^2 = (2/3)(alpha^2 + alpha gamma + gamma^2)``."""
    a, g = float(alpha), float(gamma)
    return (2.0 / 3.0) * (a * a + a * g + g * g)


def projector_overlaps(L_proj: Sequence[np.ndarray], P_proj: Sequence[np.ndarray]) -> Dict[str, np.ndarray]:
    """Return ``{LL, LP, PP}`` with ``X[i,j] = trace(Pi_Xi Pi_Yj)``."""
    def mat(A, B):
        return np.array([[float(np.trace(np.asarray(A[i], dtype=complex)
                                         @ np.asarray(B[j], dtype=complex)).real)
                          for j in range(NB)] for i in range(NB)])
    return {"LL": mat(L_proj, L_proj),
            "LP": mat(L_proj, P_proj),
            "PP": mat(P_proj, P_proj)}


# --------------------------------------------------------------------------
# the chart-flag reference bundle
# --------------------------------------------------------------------------
def gauge_invariants(z, levels) -> dict:
    """JSON-serializable V1 invariants from the chart flags at ``z``.

    Computed purely from ``L_i = image(A_i a_i)``, ``P_i = image(A_i)`` of the
    chart and the given ``levels``; no solver is involved.  Keys:
    ``z_re``, ``z_im``, ``levels`` (3x2), ``edge_norms_sq`` (len 3),
    ``pairwise`` (3x3), ``spectra`` (3x3), ``overlaps`` (``{LL, LP, PP}``),
    ``branch_traces`` (len 3), ``closure_error``.
    """
    levels = np.asarray(levels, dtype=float).reshape(NB, 2)
    zc = complex(z)

    a, A, b, B = candidate_y0_chart(zc)
    L_proj = [line_projector(A[i] @ a[i]) for i in range(NB)]
    P_proj = [plane_projector(A[i]) for i in range(NB)]

    Q = q_from_flags(L_proj, P_proj, levels)

    edge_norms_sq = [float(np.trace(Q[i] @ Q[i]).real) for i in range(NB)]
    pairwise = np.array([[float(np.trace(Q[i] @ Q[j]).real) for j in range(NB)]
                         for i in range(NB)])
    spectra = np.array([ordered_spectrum(Q[i]) for i in range(NB)])
    overlaps = projector_overlaps(L_proj, P_proj)
    branch_traces = [float(levels[i, 0] + 2.0 * levels[i, 1]) for i in range(NB)]
    closure_error = float(np.linalg.norm(sum(Q)))

    return {
        "z_re": float(zc.real),
        "z_im": float(zc.imag),
        "levels": levels.tolist(),
        "edge_norms_sq": edge_norms_sq,
        "pairwise": pairwise.tolist(),
        "spectra": spectra.tolist(),
        "overlaps": {k: v.tolist() for k, v in overlaps.items()},
        "branch_traces": branch_traces,
        "closure_error": closure_error,
    }
