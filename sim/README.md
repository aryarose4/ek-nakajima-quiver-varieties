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
  charts.py            representative builders and overlap gauges      (M1)
  stability.py         certified inequalities and domain checks        (M1)
  hermitian_solver.py  positive-gauge real moment-map solver           (M2)
  fixtures/            exact certified examples and expected properties
tests/                 pytest suite
```

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
