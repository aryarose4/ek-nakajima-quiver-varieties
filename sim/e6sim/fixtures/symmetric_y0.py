"""A hand-built exact solution of the real moment-map equations (y = 0).

For any ``alpha, gamma > 0`` this returns ``(rep, levels)`` with

- ``a_i = sqrt(alpha) [1, 0]^T``, ``b_i = 0``, ``B_i = 0``,
- ``A_1 = [sqrt(g+a) e1, sqrt(g) e2]``,
  ``A_2 = [sqrt(g+a) e2, sqrt(g) e3]``,
  ``A_3 = [sqrt(g+a) e3, sqrt(g) e1]``.

Then ``R_i1 = alpha``, ``R_i2 = gamma I_2`` and
``sum_i A_i A_i^* = (2 gamma + alpha) I`` (traceless part zero), so the rep
solves the real equations exactly and has complex residual zero (all ``y``
vanish).  Used as a manufactured test input for the Hermitian solver.
"""

from __future__ import annotations

import numpy as np

from ..representation import Rep


def symmetric_y0_fixture(alpha: float = 1.0, gamma: float = 1.0):
    alpha = float(alpha)
    gamma = float(gamma)
    sa = np.sqrt(alpha)
    sg = np.sqrt(gamma)
    sga = np.sqrt(gamma + alpha)

    ai = np.array([[sa], [0.0]], dtype=complex)
    bi = np.zeros((1, 2), dtype=complex)
    Bi = np.zeros((2, 3), dtype=complex)

    A1 = np.array([[sga, 0.0], [0.0, sg], [0.0, 0.0]], dtype=complex)
    A2 = np.array([[0.0, 0.0], [sga, 0.0], [0.0, sg]], dtype=complex)
    A3 = np.array([[0.0, sg], [0.0, 0.0], [sga, 0.0]], dtype=complex)

    rep = Rep.from_arrays([ai, ai, ai], [A1, A2, A3],
                          [bi, bi, bi], [Bi, Bi, Bi])
    levels = np.array([[alpha, gamma]] * 3, dtype=float)
    return rep, levels
