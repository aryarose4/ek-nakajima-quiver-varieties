# E_k Nakajima quiver-varieties test suite

Node battery for the E_k Nakajima widget geometry modules
(`../assets/js/ek-nakajima/`). Node is v12: `.mjs` scripts, ESM, no
top-level await, no dependencies. There is no build step.

## What it validates

The three batteries cover the settled, solver-free geometry layers:

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

## Running

```bash
bash tests/run.sh          # from the repo root
bash run.sh                # from tests/
```

`run.sh` copies the four live modules next to the batteries, then runs
every battery; the script exits non-zero if any battery fails. This is
the gate to run after any change to the geometry layers.

## Not covered

The 3D display layer (`core-view.js`, `widget.js`) needs a browser
(`THREE`) and is not exercised here; the single-element / moment-map view
is an open mathematical question and has no solver to test.
