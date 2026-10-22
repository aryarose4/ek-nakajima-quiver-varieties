# E_k Nakajima quiver-varieties test suite

Node battery for the E_k Nakajima widget geometry modules
(`../assets/js/ek-nakajima/`). Node is v12: `.mjs` scripts, ESM, no
top-level await, no dependencies. There is no build step.

## What it validates

The batteries cover the geometry layers, E6 complex charts, solver, and widget integration:

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

The E6 atlas batteries additionally check exact chart overlaps, all endpoint
gradings, the necessary infinitesimal fixedness equations, rational King
certificates for eight canonical fixtures, the full E6 root-wall arrangement,
and the widget's actual chart dispatch at each sphere intersection and tip.
`validate-fixed-stability.mjs` detects the frozen fixture's semistable points;
the live explorer uses the separate nearby regular levels.

```bash
bash tests/run.sh          # from the repo root
bash run.sh                # from tests/
```

`run.sh` copies the live modules next to the batteries, then runs
every battery; the script exits non-zero if any battery fails. This is
the gate to run after any change to the geometry layers.

## Not covered

`smoke-widget.mjs` exercises the controls and view wiring using DOM/canvas/THREE
stubs. It does not test real WebGL rendering. Complex-chart residual tests
verify the equations and coordinate transformations, not stability or global
coverage of the moduli space. The real moment-map solver has its own numerical
battery; the widget's complex representatives do not require that solve.

The moving-first-line batteries check both radial endpoint limits at nonzero transverse amplitude, including complex phases and the displayed cotangent coefficients. They also check the exact stability of every central-sphere incidence stratum in the display chamber.
