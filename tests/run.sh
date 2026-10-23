#!/usr/bin/env bash
# E_k Nakajima quiver-varieties battery. Copies the live widget modules next
# to the batteries (Node ESM resolves "./quiver-data.js" etc relative to the
# importing file; tests/package.json sets type:module so Node treats the .js
# copies as ESM) and runs every battery. Exit 1 on failure.
set -e
cd "$(dirname "$0")"

SRC="../assets/js/ek-nakajima"
for f in quiver-data.js core-layout.js diagram-layout.js tree-embed.js core-math.js solver.js balanced-model.js balanced-diagram.js balanced-observables.js weighted-balanced-diagram.js balanced-worker-source.js balanced-client.js element-view.js chart.js limit-chart.js branch-charts.js fixed-point.js e6-levels.js e6-parameters.js e6-wall-transitions.js e6-areas.js parameters-panel.js e6-atlas.js element-model.js element-screen.js element-render.js flag-incidence.js flag-diagram.js representation-readout.js core-view.js widget.js; do
  cp "$SRC/$f" "./$f"
done
# core-view.js imports ../hyperpolygon/sideview-shared.js; flatten that one path
# for the copied tree so the smoke test can import widget.js from tests/.
cp "$SRC/../hyperpolygon/sideview-shared.js" "./sideview-shared.js"
sed -i 's#\.\./hyperpolygon/sideview-shared\.js#./sideview-shared.js#' core-view.js

fail=0
for f in validate-data.mjs validate-layout.mjs validate-diagram.mjs validate-math.mjs validate-solver.mjs validate-element.mjs validate-model.mjs validate-screen.mjs validate-incidence.mjs validate-triple-ratio.mjs validate-flag-diagram.mjs validate-alignment-view.mjs validate-branch-alignment.mjs validate-first-line.mjs validate-first-line-flow.mjs validate-atlas-render.mjs validate-compact-chart.mjs validate-transverse-chart.mjs validate-limit-chart.mjs validate-branch-charts.mjs validate-fixed-points.mjs validate-fixed-stability.mjs validate-e6-levels.mjs validate-e6-parameters.mjs validate-e6-wall-transitions.mjs validate-wall-controls.mjs validate-e6-periods.mjs validate-e6-areas.mjs validate-e6-atlas.mjs validate-balanced-model.mjs validate-beta-continuity.mjs validate-balanced-diagram.mjs validate-balanced-observables.mjs validate-weighted-balanced-diagram.mjs validate-balanced-client.mjs validate-incidence-flash.mjs validate-tensor-render.mjs validate-cotangent-arrows.mjs validate-infinity-control.mjs smoke-widget.mjs; do
  echo "=== $f ==="
  if ! node "$f"; then
    fail=1
  fi
done

exit $fail
