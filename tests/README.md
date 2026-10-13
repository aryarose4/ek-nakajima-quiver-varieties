# E_k Nakajima quiver-varieties test suite

Node battery for the E_k Nakajima widget geometry modules
(`../assets/js/ek-nakajima/`). Node is v12: `.mjs` scripts, ESM, no
top-level await, no dependencies. There is no build step.

## What it validates

The four batteries cover the settled geometry layers (the triangle battery
additionally consumes a solved bundle):

- `validate-data.mjs` — the per-type affine ADE table
  (`quiver-data.js`): the affine Cartan condition `2 delta_i =
  sum_{j ~ i} delta_j`, the marks, the unique junction, the finite-tree
  structure, `dim_H M(v = delta, w = e_j) = 1` at every framing node, and
  the `affineA(n)` members.
- `validate-layout.mjs` — the core-tree layout (`core-layout.js`):
  `orientCore` / `layoutCore` / `validateLayout`, checking tangency of
  every core edge, attachments on their spheres and non-overlap of the
  externally-tangent radial packing for every type.
- `validate-diagram.mjs` — the full-diagram layout (`diagram-layout.js`):
  finite positions, connectivity, the finite core is a tree with
  `coreSpheres - 1` edges, cycle spacing for the A-type members, and
  tree non-overlap.
- `triangle-geometry.test.mjs` — the E6 triangle geometry
  (`triangle-geometry.js`, visualizer milestones V0–V2), driven by the
  **solved, at-level** bundle `../assets/data/e6-triangle-solved.json`
  (schema `e6-triangle-solved/1`, read with `fs`). For every sweep and
  preset point it checks `isValidPoint`, `stable`, `closure_error
  < 1e-9`, `view_frame` orthonormality with `e3` orthogonal to the
  triangle plane, that JS `project(q_i, frame)` reproduces the stored
  `vertices` to rel 1e-9, that the three edge lengths equal
  `sqrt(edge_norms_sq)`, that the edge vectors sum to zero, and that the
  stored vertices/markers are finite. The earlier chart-flag /
  `triangle_reference.json` comparison was removed: the chart's
  orthogonal projectors are not equivariant under the solver's
  non-unitary gauge, so the chart is not the physical representative.

## Running

```bash
bash tests/run.sh          # from the repo root
bash run.sh                # from tests/
```

`run.sh` copies the five live modules next to the batteries, then runs
every battery; the script exits non-zero if any battery fails. This is
the gate to run after any change to the geometry layers.

## Not covered

The 3D display layer (`core-view.js`, `widget.js`, `triangle-view.js`) needs
a browser (`THREE`) and is not exercised here; the single-element /
moment-map view is an open mathematical question and has no solver to test.
`triangle.html` is the browser shell for the triangle view.
