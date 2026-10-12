"""Complex and real moment-map residuals and their Hermitian packing.

Complex equations at ``tau = 0`` (Milestone 0):

    b_i a_i                = 0            (outer vertex)
    B_i A_i - a_i b_i      = 0            (middle vertex)
    -(sum_i A_i B_i)_0     = 0            (center vertex)

Real (Hermitian) moment maps, with the ``i/2`` factor removed:

    R_i1 = a_i^* a_i - b_i b_i^*
    R_i2 = A_i^* A_i - B_i B_i^* - a_i a_i^* + b_i^* b_i
    R_center = (sum_i (-A_i A_i^* + B_i^* B_i))_0

and the real equations ``R_i1 = level[i,0] I_1``,
``R_i2 = level[i,1] I_2``, ``R_center = 0``.  Levels are stored 0-based:
``level[i, 0]`` is the outer (`level[i,1]` in the milestone doc) and
``level[i, 1]`` is the middle (`level[i,2]``).
"""

from __future__ import annotations

from typing import Dict

import numpy as np

from .conventions import (
    CENTER_BASIS,
    MIDDLE_BASIS,
    NB,
    N_CENTER,
    N_MIDDLE,
    N_OUTER,
    OUTER_BASIS,
    pack_hermitian,
    traceless,
)
from .representation import Rep


def _I(n: int) -> np.ndarray:
    return np.eye(n, dtype=complex)


def complex_residual(rep: Rep) -> Dict[str, list]:
    """Return the complex-``tau=0`` residuals, one matrix per vertex."""
    outer, middle, center = [], [], np.zeros((N_CENTER, N_CENTER), dtype=complex)
    for i in range(NB):
        ai, Ai, bi, Bi = rep.a[i], rep.A[i], rep.b[i], rep.B[i]
        outer.append(bi @ ai)
        middle.append(Bi @ Ai - ai @ bi)
        center = center - Ai @ Bi
    center = traceless(center)
    return {"outer": outer, "middle": middle, "center": center}


def complex_residual_norm(rep: Rep) -> float:
    r = complex_residual(rep)
    s = sum(np.sum(np.abs(m) ** 2) for m in r["outer"])
    s += sum(np.sum(np.abs(m) ** 2) for m in r["middle"])
    s += np.sum(np.abs(r["center"]) ** 2)
    return float(np.sqrt(s))


def is_complex_zero(rep: Rep, tol: float = 1e-9) -> bool:
    return complex_residual_norm(rep) <= tol


def real_maps(rep: Rep) -> Dict[str, list]:
    """Return the *raw* Hermitian moment maps ``R_i1, R_i2, R_center``."""
    outer, middle = [], []
    center = np.zeros((N_CENTER, N_CENTER), dtype=complex)
    for i in range(NB):
        ai, Ai, bi, Bi = rep.a[i], rep.A[i], rep.b[i], rep.B[i]
        outer.append(ai.conj().T @ ai - bi @ bi.conj().T)
        middle.append(
            Ai.conj().T @ Ai - Bi @ Bi.conj().T
            - ai @ ai.conj().T + bi.conj().T @ bi
        )
        center = center - Ai @ Ai.conj().T + Bi.conj().T @ Bi
    center = traceless(center)
    return {"outer": outer, "middle": middle, "center": center}


def real_residual(rep: Rep, levels) -> Dict[str, list]:
    """Return ``R - level`` per vertex (the equations to drive to zero)."""
    levels = np.asarray(levels, dtype=float).reshape(NB, 2)
    raw = real_maps(rep)
    outer = [raw["outer"][i] - levels[i, 0] * _I(N_OUTER) for i in range(NB)]
    middle = [raw["middle"][i] - levels[i, 1] * _I(N_MIDDLE) for i in range(NB)]
    center = raw["center"]
    return {"outer": outer, "middle": middle, "center": center}


def pack_real_residual(rep: Rep, levels) -> np.ndarray:
    """Pack ``R - level`` into 23 orthonormal Hermitian coordinates.

    Layout: 3 outer (1 each) + 3 middle (4 each) + 8 center = 23.
    Because the bases are Frobenius-orthonormal, the Euclidean norm of the
    packed vector equals the Frobenius norm of the residual matrices gathered.
    """
    r = real_residual(rep, levels)
    parts = []
    for i in range(NB):
        parts.append(pack_hermitian(r["outer"][i], OUTER_BASIS))
    for i in range(NB):
        parts.append(pack_hermitian(r["middle"][i], MIDDLE_BASIS))
    parts.append(pack_hermitian(r["center"], CENTER_BASIS))
    return np.concatenate(parts)


def pack_vector_to_maps(coords) -> Dict[str, list]:
    """Inverse of :func:`pack_real_residual`: coords -> per-vertex Hermitian."""
    from .conventions import unpack_hermitian

    coords = np.asarray(coords, dtype=float).ravel()
    if coords.size != 23:
        raise ValueError(f"expected 23 packed coords, got {coords.size}")
    off = 0
    outer, middle = [], []
    for _ in range(NB):
        outer.append(unpack_hermitian(coords[off:off + 1], OUTER_BASIS)); off += 1
    for _ in range(NB):
        middle.append(unpack_hermitian(coords[off:off + 4], MIDDLE_BASIS)); off += 4
    center = unpack_hermitian(coords[off:off + 8], CENTER_BASIS); off += 8
    return {"outer": outer, "middle": middle, "center": center}


def real_residual_norm(rep: Rep, levels) -> float:
    return float(np.linalg.norm(pack_real_residual(rep, levels)))


def branch_traces(rep: Rep, levels) -> np.ndarray:
    """``trace(T_i)`` where ``T_i = A_i A_i^* - B_i^* B_i``.

    The middle real moment-map equation implies ``trace(T_i) = level[i,0] +
    2 level[i,1]`` (V0/V5 identity), used as a self-check.
    """
    levels = np.asarray(levels, dtype=float).reshape(NB, 2)
    out = np.zeros(NB)
    for i in range(NB):
        Ai, Bi = rep.A[i], rep.B[i]
        out[i] = np.trace(Ai @ Ai.conj().T - Bi.conj().T @ Bi).real
    return out
