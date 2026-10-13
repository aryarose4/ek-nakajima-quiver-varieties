"""Export the deterministic V1 *chart-invariant* reference (test fixture).

Runnable from ``sim/`` as::

    python tools/export_chart_invariants.py

Writes exactly one file outside ``sim/``::

    tests/fixtures/chart_invariants_reference.json

with schema ``e6-chart-invariants/1`` and one point per ``(z, levels)`` grid
pair.  Each point is :func:`e6sim.v1.gauge_invariants`, computed purely from the
chart flags at ``z`` and the given levels (no solver).  Prints the point count.

NOTE: this is the *chart* invariant bundle used to pin down V1's chart-flag
identities.  It is NOT the triangle visualizer's geometry source: the chart's
orthogonal projectors are not equivariant under the solver's non-unitary gauge,
so the chart's ``Q_i`` do not close.  The browser triangle reads the SOLVED,
at-level bundle ``assets/data/e6-triangle-solved.json`` instead.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

SIM_ROOT = Path(__file__).resolve().parent.parent
if str(SIM_ROOT) not in sys.path:
    sys.path.insert(0, str(SIM_ROOT))

from e6sim.v1 import gauge_invariants  # noqa: E402

SCHEMA = "e6-chart-invariants/1"

# z values as (re, im).
GRID_Z = [
    (0.5, 0.0),
    (1.5, 0.0),
    (2.0, 0.0),
    (3.0, 0.0),
    (2.0, 0.5),
]

# levels as ((alpha_1, gamma_1), (alpha_2, gamma_2), (alpha_3, gamma_3)).
GRID_LEVELS = [
    ((3, 1), (3, 2), (3, 3)),
    ((2, 1), (2, 1), (2, 1)),
    ((4, 1), (3, 2), (2, 2)),
]

OUT_PATH = SIM_ROOT / "tests" / "fixtures" / "chart_invariants_reference.json"


def build_points():
    points = []
    for re, im in GRID_Z:
        z = complex(re, im)
        for levels in GRID_LEVELS:
            points.append(gauge_invariants(z, levels))
    return points


def main() -> int:
    points = build_points()
    payload = {"schema": SCHEMA, "points": points}
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n")
    print(f"wrote {len(points)} points to {OUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
