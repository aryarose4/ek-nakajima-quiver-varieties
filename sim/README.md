# E6 simulation core (Python)

Verification-first implementation of the mathematical core for the E6
star-shaped Nakajima quiver variety at complex moment-map level zero, per
`E6_Quiver_Simulation_Milestones.md`.

This package is deliberately decoupled from any UI framework.  It is the
reference implementation (NumPy / SciPy / SymPy); a browser JS port may come
later once the mathematics is verified.

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
- **M3** continuation + chart seed transport: core done.
- **M5** exact transverse `y` kernel `Y(z)`, `rep(z,w)=(x(z), w Y(z))`
  complex-exact for all `w`: core done.
- **V0** `extract_geometry`: done.
- **M4** chart atlas, **M6-M9**, V1+: open.

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
