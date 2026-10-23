# Continuous balanced incidence schematic

The former eigenframe camera had several independent singular choices:
ordering eigenvectors, fixing their phases, choosing an affine chart, and
normalizing projected plane directions. Changing its tensor weights moved
some failures rather than removing the underlying choices. Reported examples
include default central-sphere jumps near r=.574877 and .780388, a different
chamber near r=.802870, and an outgoing-sphere eigenvalue crossing.

The replacement preserves three lines, three marked points, and the three
cotangent arrows per flag. It is a bounded schematic built from balanced data,
not a literal projective camera or a complete invariant.

## Coordinates and incidence fit

`balancedObservables` supplies H=A A*, J=(Aa)(Aa)*, the weighted normal
projector obtained from wedge-squared A, and K=A B. Bounded Hermitian reference
tensors are fixed linear combinations of H/(1+||H||F) and J/(1+||J||F).
Traces against the point and plane projectors give bounded coordinate priors,
plane-offset priors, and scalar angles. A screen normal is (cos(angle),
sin(angle)); it never requires normalization of a possibly zero vector.

The fit has twelve real variables: three point positions, three plane offsets,
a common intersection point, and a collinearity offset. Its objective is

```
||v - prior||^2 + sum_rows weight * (row dot v)^2.
```

Rows encode point-plane incidences, equality of points/planes, concurrence,
and collinearity. Their finite weights vary continuously with the actual
complex incidence residuals and physical object visibility. They do not
switch on numerical Boolean classifications. The matrix is
`I + sum(weight * row * row^T)`, hence has least eigenvalue at least one.
A Cholesky solve gives a unique solution. A common smooth scale keeps every
line anchor inside the panel, where clipping has a nonempty continuous result.

Every tensor contraction is unchanged by simultaneous unitary gauge change.
The positive definite solve and bounded scalar operations introduce no
eigenvector, phase, or affine-chart choices. At a rank loss, fitting weights
vanish quadratically and object visibility vanishes linearly, so the lost
flag direction stops steering surviving objects. These properties explain
the continuity of the mathematical construction for finite balanced data;
the implementation still has numerical presence thresholds and roundoff.

At full visibility, equal normalized projectors give symmetric targets and
equations, so equal points and planes coincide. Finite fitting penalties
give true incidences subpixel geometric residuals rather than exact affine
identities. Explicit tests also cover equal flags with opacity .5 versus 1.
The original complex classification, including stronger strata, remains
independent of the schematic and supplies the hue and incidence flashes.

## Intrinsic cotangent arrows

For a full flag let E1 project onto L, E3 onto P-perpendicular, and
E2=I-E1-E3. The three physical block magnitudes are
`||E1 K E2||F`, `||E1 K E3||F`, and `||E2 K E3||F`. They determine arrow opacity.
The three complex correlations `trace(Ea K Eb C)`, with C a declared bounded
equivariant reference tensor, determine hue and saturation. They are relative
phase information, not globally phase-fixed scalar matrix entries.
When a reference correlation vanishes, the arrow becomes gray while retaining
its nonzero physical magnitude. This avoids hiding y data or dividing by a
vanishing phase reference. Full matrices remain in the balanced readout.

## Validation

The normal battery includes targeted historical failures, an adaptive r scan,
all-parameter continuity, independent random unitary gauges, full-turn phase
closure, visit-order independence, physical block reconstruction, rank-loss
limits, and nonvacuous equal-point/equal-plane/concurrency fixtures. The old
camera remains a negative control. A broader numerical search is available:

```
node tests/scan-adaptive-camera-continuity.mjs --extended --steps=8 --incidence
```

The extended search is sampled evidence, not a proof of convergence of the
moment-map solver or a faithful Euclidean realization of complex flags.
