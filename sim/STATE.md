# Simulation status and frozen E6 reference fixture

Standalone repo `ek-nakajima-quiver-varieties` is the **source of truth** for
the E6 star-shaped Nakajima quiver-variety simulator (`r_star = 3`), complex
moment-map level zero, per `sim/E6_Quiver_Simulation_Milestones.md`.

This public status record uses committed sources and fixtures; local work
journals are not required for reproduction.

## Run

```
cd sim
python -m pytest -q          # full suite
python -m e6sim.cli_solve    # solver demo (certified fixture)
```

Python 3 with numpy, scipy, sympy, pytest. `pip install sympy` if missing.

## Python reference implementation

The Python package is a frozen E6 reference, not a mirror of every browser
feature. M0-M2 (conventions, exact stable fixture and Hermitian solver), M3
continuation/seed transport, M4 partial north/south atlas, M5 exact transverse
kernel, V0/V5 geometry, V1 weighted flags, and M6 chart-specific walls/chambers
are implemented. M6 has 20 generic-chart wall forms and 64 positive-orthant
sign chambers, with one stable chamber for that template. This is not the
full E6 root arrangement or a global atlas classification.

## Current browser implementation

The dependency-free JS port is shipped under assets/js/ek-nakajima/, with
Node batteries under tests/. E6 has live background balancing, compact and
branch charts, continuation, matrix inspection, fixed-point certificates and
supported chamber transport. See [chamber transport](../docs/e6-chamber-transport.md),
[wall controls](../docs/e6-wall-controls.md), and
[incidence display](../docs/e6-continuous-incidence.md) for their scope.
These features supersede the roadmap's initial implementation tasks; they do
not establish complete coverage or global convergence/continuity.

E7 now has a live central-sphere solver and flag-incidence/matrix views in the
main widget. Its t and phi controls are not extended beyond the central
sphere. Separate modules and the prototype test cotangent charts; see
[open chart](../docs/E7_OPEN_CHART.md) and
[endpoint charts](../docs/E7_ENDPOINT_CHARTS.md). E8 remains a quiver and
schematic-core portrait, without a live solver or flag-incidence view.

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

## Browser contract and its distinction from the reference

Live balanced display (2026-10-21): `balanced-model.js` now solves the E6
atlas at the display levels below, in a background worker. Exact bounded
overlaps handle incoming long-arm and concurrency limits. `balanced-diagram.js`
uses only a unitary display frame, with temporal phase alignment, to extract
positions, slopes and cotangent glyphs from the solved matrices. Numerical
tests cover fixed configurations, branch interiors and near-limit continuity;
this is not a global convergence or continuity theorem. General complex
incidences need not be literal incidences in the real-part affine projection.
The previous schematic display gauges are no longer used by the live widget.

Browser atlas update (2026-10-21): the explorer now uses separate regular
levels `alpha=(3,3,3), gamma=(1,21/10,3)`; the Python fixture above is unchanged.
The frozen levels lie on two root hyperplanes. `assets/js/ek-nakajima/branch-charts.js`
provides a compact moving-line-1 chart, stable on the whole central sphere,
and two overlapping charts on each long arm.
`fixed-point.js`, `stability-certificates.js`, and the Node batteries verify
integer C* gradings and exact rational King certificates for all eight
canonical E6 attachment/intersection/tip configurations. This does not claim
complete coverage of the quiver variety or certify arbitrary nonzero-y matrices.
The original
compact endpoint representatives remain unstable; the new endpoints are
limits of differently gauged families, not gauges of those unstable orbits.

See `e6sim/conventions.py`, `representation.py`, `moment_maps.py`. Key points:
levels are 0-based (`level[i,0]` outer, `level[i,1]` middle); the level/beta
factor of two lives only in `conventions.beta_to_level`; the real residual packs
into `3 + 3*4 + 8 = 23` Frobenius-orthonormal Hermitian coordinates.

## Verified / candidate / unsupported

- **Verified in the Python reference:** exact complex equations, strict King
  stability at the frozen rational fixture, gauge rank and local quotient
  tangent, overlap identities, M4 endpoint classification, M5 kernel/transpose
  identities, weighted-flag/bilinear geometry, and chart-specific M6 walls.
  Numerical solver checks establish only their tested tolerances.
- **Candidate scope:** the named candidate chart is the input family; its
  certified fixture and stated stable domain do not certify every proposed
  extension, global parameterization, or visualizer design in the roadmap.
- **Browser certificates:** exact E6 fixed-point/King and root/chamber checks
  are distinct from bounded numerical continuation and camera regression
  checks. E7's documented chart proofs are distinct from solver convergence.
- **Unsupported / not claimed:** negative-level use of the positive-level
  maximal-subspace shortcut, arbitrary nonzero-y stability from the frozen
  y=0 certificate, complete E6/E7 global atlas coverage, a global convergence
  or continuity theorem, E7 live transverse navigation, or an E8 live solver.
  Particular nonzero-y families can have their own certificates; these do
  not extend the frozen fixture's proof to arbitrary matrices.

## Remaining mathematical directions

Complete exceptional charts and their exact overlaps/stability domains;
classify unsupported nonzero-y families and asymptotic transitions; extend
E7's live controls beyond the central sphere; and establish the mathematics
needed for an E8 solver. The [roadmap](E6_Quiver_Simulation_Milestones.md)
preserves acceptance criteria, including options that are not current features.
