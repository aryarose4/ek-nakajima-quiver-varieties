# E6 simulation core (Python)

Verification-first implementation of the mathematical core for the E6
star-shaped Nakajima quiver variety at complex moment-map level zero, per
`E6_Quiver_Simulation_Milestones.md`.

This package is deliberately decoupled from any UI framework.  It is the
reference implementation (NumPy / SciPy / SymPy) for a frozen E6 fixture.
The browser JS implementation is already shipped, with a broader live atlas
and different regular default levels; see [`STATE.md`](STATE.md) for scope.

> **Current state: see [`STATE.md`](STATE.md).** Run the suite with
> `python -m pytest -q` from this directory.

## Layout

```
e6sim/
  conventions.py       dimensions, level/beta conversion, Hermitian bases
  representation.py    (a, A, b, B) matrices, validation, gauge action
  moment_maps.py       complex/real residuals, orthonormal Hermitian packing
  charts.py            candidate y=0 chart, exact flags, x-gauge action   (M1)
  stability.py         King weights, exact enumeration, exceptional z     (M1)
  hermitian_solver.py  positive-gauge real moment-map solver              (M2)
  continuation.py      warm starts, seed transport across chart gauges    (M3)
  transverse.py        exact transverse y kernel Y(z), family rep(z,w)     (M5)
  geometry.py          V0 extract_geometry (traceless central Q_i, 8-vec) (V0)
  fixtures/            exact certified examples (y=0 symmetric; certified chart)
tests/                 pytest suite
```

## Status

- **M0** conventions/representation/moment maps: done.
- **M1** certified stable rational `y=0` fixture (`z=2`, levels
  `alpha=(3,3,3)`, `gamma=(1,2,3)`), exact King certificate (all weights `< 0`,
  tightest `-1`), `x`-gauge rank 23, `dx/dz` not in the image, exceptional
  `z in {0,1,infinity}`: done (independently re-verified).
- **M2** 23-variable positive-Hermitian-gauge solver: done (solves the
  certified fixture, residual ~1e-14).
- **M3** continuation + chart seed transport (warm starts, midpoint
  subdivision, cold-start fallback) + `z`-sweep and closed-loop tests: done.
- **M4** north/south chart atlas (`zeta = 1/z`), exact overlap gauge,
  honest endpoint classification: `z=1` stable, `z=0` and the pole strictly
  unstable (positive King weights). Coverage **partial** — stable locus is
  `P^1 \ {0, infinity}`; the two unstable points are genuinely different
  strata, not missing representatives: done (independently re-verified).
- **M5** exact transverse `y` kernel `Y(z)`, `rep(z,w)=(x(z), w Y(z))`
  complex-exact for all `w`, cotangent-transpose identity checked: core done.
- **V0** `extract_geometry`; **V5** bilinear `K_i=X_iY_i` geometry
  (`C_i/F_i`, closure, phase rotation): done.
- **M6** exact wall arrangement in the six level coordinates: 20 wall forms
  (z-generic), 64 sign-chambers in the positive orthant, exactly 1 stable
  chamber (forced by convexity), certified fixture `interior`/stable: done
  (independently re-verified).
- **V1** weighted-flag identity at `y=0` (`flags.py`): done.
- **JS port** (dependency-free, Node batteries via Docker): `core-math.js`
  (M0 + V0/V5, 40 checks), `element-view.js` (V2, 28 checks), `solver.js`
  (M2 solver, 35 checks): done.
- These milestone labels describe the Python reference package. The browser
  already includes continuation, chart/component navigation, matrix inspection
  and supported chamber transport. See [`STATE.md`](STATE.md) for limits.

Run the tests from this directory:

```
python -m pytest -q
```

## Conventions summary

Three branches `i = 0,1,2`, each `C^1 -> C^2 -> C^3`, common central `C^3`.
Matrices: `a_i` (2x1), `A_i` (3x2), `b_i` (1x2), `B_i` (2x3).
Levels are stored 0-based: `level[i,0]` = outer (doc `level[i,1]`),
`level[i,1]` = middle (doc `level[i,2]`).  The level/beta factor of two lives
only in `conventions.beta_to_level`.
