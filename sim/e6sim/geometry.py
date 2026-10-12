"""Visualizer milestone V0: extract geometric data from solved matrices.

Consumes a solved representative and its real levels and returns the traceless
Hermitian central moment maps ``Q_i`` together with their eight-vectors in the
Frobenius-orthonormal central basis, plus the closure/trace diagnostics.

    ``u_i = a_i`` (x_i^(1)), ``X_i = A_i`` (x_i^(2))
    ``v_i = b_i`` (y_i^(1)), ``Y_i = B_i`` (y_i^(2))
    ``T_i = X_i X_i^* - Y_i^* Y_i``
    ``Q_i = T_i - trace(T_i)/3 I_3``

The central real moment map says ``sum_i Q_i = 0``.  The Euclidean pairing is
``trace(Q_i Q_j)``; the anti-Hermitian vector is ``i Q_i``.  This module is
pure (no solver, no UI) and works on any representative, since the ``Q_i``
transform by simultaneous central ``SU(3)`` conjugation.
"""

from __future__ import annotations

import numpy as np

from .conventions import CENTER_BASIS, NB, pack_hermitian
from .representation import Rep


def extract_geometry(solved_rep: Rep, levels=None) -> dict:
    """Return the geometric record for a solved representative.

    Keys: ``u/X/v/Y`` (lists of the raw matrices), ``T`` and ``Q`` (lists of
    traceless Hermitian 3x3), ``q`` (list of real 8-vectors), ``closure``
    (``sum_i Q_i``), ``closure_error`` (Frobenius norm of ``closure``),
    ``edge_norms`` (``||q_i||``), ``pairwise`` (``trace(Q_i Q_j)``),
    ``branch_traces`` (``trace(T_i)``).  When ``levels`` is given, also
    ``branch_traces_expected`` (``level[i,0] + 2 level[i,1]``).
    """
    u = [solved_rep.a[i] for i in range(NB)]
    X = [solved_rep.A[i] for i in range(NB)]
    v = [solved_rep.b[i] for i in range(NB)]
    Y = [solved_rep.B[i] for i in range(NB)]

    T, Q, q = [], [], []
    for i in range(NB):
        Ti = X[i] @ X[i].conj().T - Y[i].conj().T @ Y[i]
        Qi = Ti - (np.trace(Ti) / 3.0) * np.eye(3, dtype=complex)
        T.append(Ti)
        Q.append(Qi)
        q.append(pack_hermitian(Qi, CENTER_BASIS))

    closure = sum(Q)
    edge_norms = np.array([float(np.linalg.norm(qi)) for qi in q])
    pairwise = np.zeros((NB, NB))
    for i in range(NB):
        for j in range(NB):
            pairwise[i, j] = float(np.trace(Q[i] @ Q[j]).real)
    branch_traces = np.array([float(np.trace(Ti).real) for Ti in T])

    # V5 bilinear data: K_i = X_i Y_i = A_i B_i, split into Hermitian C_i, F_i.
    # At complex level zero the branch equations give trace(K_i) = 0 and the
    # central equation gives sum_i K_i = 0.
    K, C, F = [], [], []
    for i in range(NB):
        Ki = X[i] @ Y[i]
        K.append(Ki)
        C.append((Ki + Ki.conj().T) / 2.0)
        F.append((Ki - Ki.conj().T) / (2.0j))
    closure_K = sum(K)

    out = {
        "u": u, "X": X, "v": v, "Y": Y,
        "T": T, "Q": Q, "q": q,
        "closure": closure,
        "closure_error": float(np.linalg.norm(closure)),
        "edge_norms": edge_norms,
        "pairwise": pairwise,
        "branch_traces": branch_traces,
        "K": K, "C": C, "F": F,
        "closure_K": closure_K,
        "closure_K_error": float(np.linalg.norm(closure_K)),
    }
    if levels is not None:
        levels = np.asarray(levels, dtype=float).reshape(NB, 2)
        out["branch_traces_expected"] = levels[:, 0] + 2.0 * levels[:, 1]
    return out


def vector_dot_matrix_trace(q_i, q_j, Q_i, Q_j) -> tuple:
    """Compare the vector dot product with the matrix trace pairing."""
    return (float(np.dot(q_i, q_j)), float(np.trace(Q_i @ Q_j).real))


def triangle_side_from_pairwise(pairwise: np.ndarray, i: int, j: int, k: int) -> float:
    """``trace(Q_i Q_j)`` from the three squared edge norms (V1 identity).

    ``trace(Q_i Q_j) = (||Q_k||^2 - ||Q_i||^2 - ||Q_j||^2)/2`` for a closing
    triple.
    """
    return (pairwise[k, k] - pairwise[i, i] - pairwise[j, j]) / 2.0
