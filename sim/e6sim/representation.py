"""Quiver representation, shape validation, and the gauge action (Milestone 0).

Arrays per branch ``i`` (python 0-based ``i = 0..NB-1``):

===========  =========  ==================================
symbol       shape      direction
===========  =========  ==================================
``a[i]``     2 x 1      outer vertex  -> middle vertex
``A[i]``     3 x 2      middle vertex -> center
``b[i]``     1 x 2      middle vertex -> outer vertex
``B[i]``     2 x 3      center        -> middle vertex
===========  =========  ==================================

The complex gauge group is ``SL(3,C) x prod_i (GL(2,C) x GL(1,C))`` with
central ``g`` (3x3, det 1), middle ``h_i`` (2x2), outer scalar ``q_i``
(1x1).  Acting as

    a_i -> h_i a_i q_i^{-1}
    A_i -> g A_i h_i^{-1}
    b_i -> q_i b_i h_i^{-1}
    B_i -> h_i B_i g^{-1}
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence

import numpy as np

from .conventions import NB, N_CENTER, N_MIDDLE, N_OUTER

_AS = (N_MIDDLE, N_OUTER)          # a: 2x1
_BS = (N_OUTER, N_MIDDLE)          # b: 1x2
_AS_CAP = (N_CENTER, N_MIDDLE)     # A: 3x2
_BS_CAP = (N_MIDDLE, N_CENTER)     # B: 2x3


@dataclass
class Rep:
    """A representation ``(x, y) = (a, A, b, B)`` of the star quiver."""

    a: List[np.ndarray]
    A: List[np.ndarray]
    b: List[np.ndarray]
    B: List[np.ndarray]

    # -- construction -------------------------------------------------------
    @staticmethod
    def zeros() -> "Rep":
        z = lambda *s: np.zeros(s, dtype=complex)  # noqa: E731
        return Rep(
            a=[z(*_AS) for _ in range(NB)],
            A=[z(*_AS_CAP) for _ in range(NB)],
            b=[z(*_BS) for _ in range(NB)],
            B=[z(*_BS_CAP) for _ in range(NB)],
        )

    @staticmethod
    def from_arrays(a, A, b, B) -> "Rep":
        rep = Rep(
            a=[np.asarray(m, dtype=complex) for m in a],
            A=[np.asarray(m, dtype=complex) for m in A],
            b=[np.asarray(m, dtype=complex) for m in b],
            B=[np.asarray(m, dtype=complex) for m in B],
        )
        rep.validate()
        return rep

    def copy(self) -> "Rep":
        return Rep(
            a=[m.copy() for m in self.a],
            A=[m.copy() for m in self.A],
            b=[m.copy() for m in self.b],
            B=[m.copy() for m in self.B],
        )

    # -- validation ---------------------------------------------------------
    def validate(self) -> "Rep":
        def need(lst, shape, name):
            if len(lst) != NB:
                raise ValueError(f"{name}: expected {NB} matrices, got {len(lst)}")
            for i, m in enumerate(lst):
                if m.shape != shape:
                    raise ValueError(
                        f"{name}[{i}]: expected shape {shape}, got {m.shape}"
                    )

        need(self.a, _AS, "a")
        need(self.A, _AS_CAP, "A")
        need(self.b, _BS, "b")
        need(self.B, _BS_CAP, "B")
        return self

    # -- gauge action -------------------------------------------------------
    def gauge(self, g, h, q) -> "Rep":
        """Apply a complex gauge ``(g, {h_i}, {q_i})``.

        ``g`` is 3x3 (det 1), ``h`` a length-``NB`` sequence of 2x2 matrices,
        ``q`` a length-``NB`` sequence of 1x1 matrices (or scalars).
        """
        g = np.asarray(g, dtype=complex)
        ginv = np.linalg.inv(g)
        out = self.copy()
        for i in range(NB):
            hi = np.asarray(h[i], dtype=complex)
            hi_inv = np.linalg.inv(hi)
            qi = np.asarray(q[i], dtype=complex).reshape(N_OUTER, N_OUTER)
            qi_inv = np.linalg.inv(qi)
            out.a[i] = hi @ self.a[i] @ qi_inv
            out.A[i] = g @ self.A[i] @ hi_inv
            out.b[i] = qi @ self.b[i] @ hi_inv
            out.B[i] = hi @ self.B[i] @ ginv
        return out

    def gauge_unitary(self, g, h, q) -> "Rep":
        """Gauge with unitary ``g, h`` and unit-modulus scalars ``q``."""
        return self.gauge(g, h, q)

    # -- flat complex vector (for linear algebra / solver seeds) ------------
    def to_vector(self) -> np.ndarray:
        parts = []
        for i in range(NB):
            parts += [self.a[i].ravel(), self.A[i].ravel(),
                      self.b[i].ravel(), self.B[i].ravel()]
        return np.concatenate(parts)

    @staticmethod
    def from_vector(v: np.ndarray) -> "Rep":
        v = np.asarray(v, dtype=complex).ravel()
        if v.size != NB * (2 + 6 + 2 + 6):
            raise ValueError(f"vector size {v.size} does not match quiver layout")
        off = 0
        a, A, b, B = [], [], [], []
        for i in range(NB):
            n = _AS[0] * _AS[1]
            a.append(v[off:off + n].reshape(_AS)); off += n
            n = _AS_CAP[0] * _AS_CAP[1]
            A.append(v[off:off + n].reshape(_AS_CAP)); off += n
            n = _BS[0] * _BS[1]
            b.append(v[off:off + n].reshape(_BS)); off += n
            n = _BS_CAP[0] * _BS_CAP[1]
            B.append(v[off:off + n].reshape(_BS_CAP)); off += n
        return Rep(a, A, b, B)

    def max_abs(self) -> float:
        m = 0.0
        for lst in (self.a, self.A, self.b, self.B):
            for mat in lst:
                if mat.size:
                    m = max(m, float(np.max(np.abs(mat))))
        return m

    def frobenius_sq(self) -> float:
        return float(
            sum(np.sum(np.abs(m) ** 2) for lst in (self.a, self.A, self.b, self.B)
                for m in lst)
        )
