"""Visualizer milestone V1: weighted-flag interpretation at ``y = 0``.

At positive levels ``alpha_i, gamma_i`` and ``y = 0`` the solved branch
equations are

    ``u_i^* u_i = alpha_i``,   ``X_i^* X_i = gamma_i I_2 + u_i u_i^*``,

so with the line ``L_i = image(X_i u_i)`` and the plane ``P_i = image(X_i)``
one has the exact projector identity

    ``X_i X_i^* = alpha_i Pi_Li + gamma_i Pi_Pi``

and the traceless central moment map decomposes as

    ``Q_i = alpha_i (Pi_Li - I_3/3) + gamma_i (Pi_Pi - 2 I_3/3)``.

Hence the ordered spectrum of ``Q_i`` is ``(2a+g)/3, (-a+g)/3, -(a+2g)/3``
with first eigenspace ``L_i`` and first two spanning ``P_i``, its squared norm
is ``2/3 (a^2 + a g + g^2)``, and the closing-triple pairwise identity

    ``trace(Q_i Q_j) = (||Q_k||^2 - ||Q_i||^2 - ||Q_j||^2)/2``

holds.  This module computes all of the above from a solved representative;
it is pure (no solver, no UI).  The line projector uses ``ell ell^* / ||ell||^2``
and the plane projector uses a thin SVD with an explicit rank check, so no
Gram-matrix inverse is formed.
"""

from __future__ import annotations

import numpy as np

from .conventions import CENTER_BASIS, NB, pack_hermitian
from .representation import Rep

__all__ = ["flag_geometry"]

_RANK_REL_TOL = 1e-10


def _line_projector(ell: np.ndarray):
    """Rank-1 projector onto ``span(ell)`` together with a validity flag."""
    ell = np.asarray(ell, dtype=complex).reshape(3, 1)
    nrm2 = float(np.real(ell.conj().T @ ell)[0, 0])
    if nrm2 <= 0.0 or not np.isfinite(nrm2):
        raise ValueError("flag_geometry: zero/non-finite line vector X_i u_i")
    Pi = (ell @ ell.conj().T) / nrm2
    return Pi, nrm2


def _plane_projector(X: np.ndarray):
    """Projector onto ``col(X)`` via thin SVD, with an explicit rank check."""
    X = np.asarray(X, dtype=complex)
    U, S, _ = np.linalg.svd(X, full_matrices=False)
    if S.size == 0 or S[0] <= 0.0:
        raise ValueError("flag_geometry: X_i has no nonzero singular values")
    rank = int(np.sum(S > _RANK_REL_TOL * S[0]))
    if rank != 2:
        raise ValueError(f"flag_geometry: X_i is rank {rank}, expected 2")
    Q = U[:, :2]
    return Q @ Q.conj().T, S


def _ordered_eig(Q: np.ndarray):
    """Descending eigendecomposition of a Hermitian matrix."""
    w, V = np.linalg.eigh(Q)          # ascending
    order = np.argsort(w)[::-1]
    return w[order], V[:, order]


def flag_geometry(solved_rep: Rep, levels) -> dict:
    """Return the weighted-flag record of a ``y = 0`` solved representative.

    ``levels`` has shape (3, 2); ``levels[i, 0] = alpha_i`` (outer) and
    ``levels[i, 1] = gamma_i`` (middle).

    The returned dict has per-branch lists indexed by ``i`` (0-based):

    ``Pi_L``, ``Pi_P``      line/plane projectors (3x3 Hermitian idempotent);
    ``ell``                 ``X_i u_i``;
    ``T``                   ``X_i X_i^*``;
    ``Q``                   traceless central moment map;
    ``eigenvalues``         descending spectrum of ``Q``;
    ``eigenvectors``        columns of the corresponding eigenbasis;
    ``norm_sq``             ``||Q_i||_F^2``;
    ``d_L``, ``d_P``        eight-vectors of ``Pi_L - I/3``, ``Pi_P - 2 I/3``;
    ``q``                   eight-vector of ``Q_i``.

    Plus aggregate diagnostics: ``projector_identity_residual``,
    ``Q_projector_residual``, ``eigenvalue_residual``, ``norm_sq_residual``,
    ``line_eigenspace_residual``, ``plane_eigenspace_residual``,
    ``pack_dot_residual``, ``branch_line_residual``, ``branch_plane_residual``,
    and ``pairwise`` / ``pairwise_expected``.
    """
    levels = np.asarray(levels, dtype=float).reshape(NB, 2)

    Pi_L, Pi_P, ells, T, Q = [], [], [], [], []
    eigvals, eigvecs, norm_sq = [], [], []
    d_L, d_P, q = [], [], []
    projector_res, Q_proj_res, eig_res, norm_res = [], [], [], []
    line_eig_res, plane_eig_res = [], []
    branch_line_res, branch_plane_res = [], []

    I3 = np.eye(3, dtype=complex)

    for i in range(NB):
        u = np.asarray(solved_rep.a[i], dtype=complex).reshape(2, 1)
        X = np.asarray(solved_rep.A[i], dtype=complex)
        alpha = float(levels[i, 0])
        gamma = float(levels[i, 1])

        ell = X @ u
        P_L, _ = _line_projector(ell)
        P_P, _ = _plane_projector(X)

        Ti = X @ X.conj().T
        Qi = Ti - (np.trace(Ti) / 3.0) * I3

        # identity X_i X_i^* = alpha Pi_L + gamma Pi_P
        proj_id = alpha * P_L + gamma * P_P
        projector_res.append(float(np.linalg.norm(Ti - proj_id)))

        # Q_i decomposition
        Qi_proj = alpha * (P_L - I3 / 3.0) + gamma * (P_P - 2.0 * I3 / 3.0)
        Q_proj_res.append(float(np.linalg.norm(Qi - Qi_proj)))

        # ordered spectrum and eigenspace identification
        w, V = _ordered_eig(Qi)
        w_expected = np.array([
            (2.0 * alpha + gamma) / 3.0,
            (-alpha + gamma) / 3.0,
            -(alpha + 2.0 * gamma) / 3.0,
        ])
        eig_res.append(float(np.max(np.abs(w - w_expected))))
        # ||Q_i||_F^2
        n2 = float(np.sum(w ** 2))
        norm_sq.append(n2)
        norm_res.append(abs(n2 - (2.0 / 3.0) * (alpha ** 2 + alpha * gamma + gamma ** 2)))
        # first eigenvector lies in L_i (so in P_i)
        v0 = V[:, 0].reshape(3, 1)
        line_eig_res.append(float(np.linalg.norm(P_L @ v0 - v0)))
        # first two eigenvectors span P_i
        W2 = V[:, :2]
        plane_eig_res.append(float(np.linalg.norm((I3 - P_P) @ W2)))

        d_l = P_L - I3 / 3.0
        d_p = P_P - 2.0 * I3 / 3.0

        Pi_L.append(P_L)
        Pi_P.append(P_P)
        ells.append(ell)
        T.append(Ti)
        Q.append(Qi)
        eigvals.append(w)
        eigvecs.append(V)
        d_L.append(pack_hermitian(d_l, CENTER_BASIS))
        d_P.append(pack_hermitian(d_p, CENTER_BASIS))
        q.append(pack_hermitian(Qi, CENTER_BASIS))

        # branch equations: u^*u = alpha, X^*X = gamma I_2 + u u^*
        uu = float(np.real(u.conj().T @ u)[0, 0])
        branch_line_res.append(abs(uu - alpha))
        XtX = X.conj().T @ X
        branch_plane_res.append(
            float(np.linalg.norm(XtX - (gamma * np.eye(2) + u @ u.conj().T)))
        )

    # 8-vector dot must equal the matrix trace pairing for the deviations.
    pack_dot_res = 0.0
    for i in range(NB):
        for j in range(NB):
            for vec, mat in ((d_L, Pi_L), (d_P, Pi_P)):
                Di = vec[i]
                Dj = vec[j]
                Mi = mat[i] - (I3 / 3.0 if mat is Pi_L else 2.0 * I3 / 3.0)
                Mj = mat[j] - (I3 / 3.0 if mat is Pi_L else 2.0 * I3 / 3.0)
                pack_dot_res = max(
                    pack_dot_res,
                    abs(float(np.dot(Di, Dj)) - float(np.trace(Mi @ Mj).real)),
                )

    # closure triple pairwise identity
    pairwise = np.zeros((NB, NB))
    for i in range(NB):
        for j in range(NB):
            pairwise[i, j] = float(np.trace(Q[i] @ Q[j]).real)
    pairwise_expected = np.zeros((NB, NB))
    for i in range(NB):
        for j in range(NB):
            if i == j:
                pairwise_expected[i, j] = norm_sq[i]
                continue
            k = 3 - i - j
            pairwise_expected[i, j] = (
                norm_sq[k] - norm_sq[i] - norm_sq[j]
            ) / 2.0

    return {
        "Pi_L": Pi_L, "Pi_P": Pi_P, "ell": ells, "T": T, "Q": Q,
        "eigenvalues": eigvals, "eigenvectors": eigvecs, "norm_sq": norm_sq,
        "d_L": d_L, "d_P": d_P, "q": q,
        "projector_identity_residual": float(max(projector_res)),
        "Q_projector_residual": float(max(Q_proj_res)),
        "eigenvalue_residual": float(max(eig_res)),
        "norm_sq_residual": float(max(norm_res)),
        "line_eigenspace_residual": float(max(line_eig_res)),
        "plane_eigenspace_residual": float(max(plane_eig_res)),
        "pack_dot_residual": float(pack_dot_res),
        "branch_line_residual": float(max(branch_line_res)),
        "branch_plane_residual": float(max(branch_plane_res)),
        "pairwise": pairwise,
        "pairwise_expected": pairwise_expected,
    }
