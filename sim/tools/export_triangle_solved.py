"""Export the solved-geometry bundle for the browser triangle viewer.

Runnable from ``sim/`` as::

    python tools/export_triangle_solved.py

Writes exactly one file outside ``sim/``::

    assets/data/e6-triangle-solved.json

with schema ``e6-triangle-solved/1``.  Every point is produced from a
representative solved by ``hermitian_solver.solve_real_moment_map`` (never the
chart's own flags), aligned to the previous sweep point by
``e6sim.bundle.align_central``.  Prints the number of points and the maximum
frame jump (Frobenius distance between consecutive aligned ``view_frame``s).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

SIM_ROOT = Path(__file__).resolve().parent.parent
if str(SIM_ROOT) not in sys.path:
    sys.path.insert(0, str(SIM_ROOT))

from e6sim.bundle import build_solved_bundle  # noqa: E402

OUT_PATH = SIM_ROOT.parent / "assets" / "data" / "e6-triangle-solved.json"


def _max_frame_jump(sweep) -> float:
    max_jump = 0.0
    for prev, cur in zip(sweep, sweep[1:]):
        a = np.asarray(prev["view_frame"], dtype=float)
        b = np.asarray(cur["view_frame"], dtype=float)
        max_jump = max(max_jump, float(np.linalg.norm(a - b)))
    return max_jump


def main() -> int:
    payload = build_solved_bundle()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n")

    n_sweep = len(payload["sweep"])
    n_presets = len(payload["presets"])
    max_jump = _max_frame_jump(payload["sweep"])

    print(f"wrote {n_sweep + n_presets} points "
          f"({n_sweep} sweep + {n_presets} presets) to {OUT_PATH}")
    print(f"sweep size = {n_sweep}")
    print(f"max frame jump between consecutive aligned sweep points = {max_jump:.6e}")
    print(f"skipped = {payload['skipped']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
