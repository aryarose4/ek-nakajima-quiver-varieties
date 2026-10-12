# E6 simulation — STATE (read this first)

Standalone repo `ek-nakajima-quiver-varieties` is the **source of truth** for
the E6 star-shaped Nakajima quiver-variety simulator (`r_star = 3`), complex
moment-map level zero, per `sim/E6_Quiver_Simulation_Milestones.md`.

Two short facts let a fresh agent start without exploring: this file and
`journal/` (a local, untracked work log; read `PROGRESS.md`'s top RESUME block).

## Run

```
cd sim
python -m pytest -q          # full suite
python -m e6sim.cli_solve    # solver demo (certified fixture)
```

Python 3 with numpy, scipy, sympy, pytest. `pip install sympy` if missing.

## Status (branch `main` — run `git log --oneline -1` for HEAD)

| Milestone | State |
|---|---|
| M0 conventions / representation / moment maps | done, verified |
| M1 certified stable y=0 chart + exact King certificate | done, verified |
| M2 positive-Hermitian real moment-map solver | done, verified |
| M3 continuation + chart seed transport | done (core) |
| M4 north/south chart atlas | done, **PARTIAL** coverage |
| M5 exact transverse y kernel Y(z) | done (core) |
| V0 geometry extraction | done |
| V5 bilinear K_i = X_i Y_i geometry | done |
| M6-M9, V1-V4, V6, browser JS port | not started |

## Frozen exact fixture (do not change without re-deriving)

- chart `e6sim.charts.candidate_y0_chart(z)`; certified `z = 2`;
  exceptional values `z in {0, 1, infinity}`.
- levels `alpha = (3,3,3)` (outer), `gamma = (1,2,3)` (middle);
  code `level[i] = (alpha_i, gamma_i)` (0-based).
- King weights all `< 0`, tightest `-1` (axis `L_3`); `rank x-gauge action = 23`;
  `dx/dz` not in its image.
- M4 coverage: stable exactly on `P^1 \ {0, infinity}`; `z = 0` and the pole are
  **strictly unstable** (max weight `+1`) — genuinely different strata, not
  missing representatives.

## Data contract (frozen)

See `e6sim/conventions.py`, `representation.py`, `moment_maps.py`. Key points:
levels are 0-based (`level[i,0]` outer, `level[i,1]` middle); the level/beta
factor of two lives only in `conventions.beta_to_level`; the real residual packs
into `3 + 3*4 + 8 = 23` Frobenius-orthonormal Hermitian coordinates.

## Verified / candidate / unsupported

- **verified**: M0-M2, M3 core, M4 endpoints+coverage, M5 kernel+transpose, V0, V5.
- **candidate**: the chart family itself is supplied (its *stability at z=2* is verified).
- **unsupported / not claimed**: negative levels (maximal-subspace shortcut off),
  nonzero-y stability, global sphere coverage, M6+ chambers/fixed points.

## Next smallest tasks

1. **V1**: weighted-flag spectral identity (`Q_i` eigenspaces = flag) on the
   certified fixture.
2. **M6**: exact wall arrangement in the six level coordinates (reuse the
   stability enumeration machinery).
3. Nonzero-y stability (the M4 open question) feeding M5/M7.
