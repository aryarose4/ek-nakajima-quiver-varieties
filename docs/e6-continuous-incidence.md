# Representation-derived flag camera

The main widget now uses the straight-line QR camera accepted in the isolated
preview. It replaces the bounded 12-variable incidence fit. No incidence
residual changes a geometric fitting weight, and there is no temporal camera
interpolation or parameter-specific camera switch.

## Construction

Balanced observables provide H_i=A_i A_i*, J_i=(A_i a_i)(A_i a_i)* and K_i=A_i B_i.
The fixed Hermitian combinations H and T are the earlier camera's tensors.
Spectral projectors of H remove the H-diagonal from a polynomial correlation
of T. The leading spectral projector of that correlation determines a line q.

The old camera independently normalized each component of q in the H eigenframe.
At the reported default r=.574877 and .780388 failures, a component crossed zero
while both spectra remained simple. Its normalized phase flipped an entire
axis although the source representation was regular.

The new frame instead orthonormalizes the three covariant vectors

```
q, H q, R q,
R = H^2 + size(H) * (0.3 H_1 + 0.7 J_2).
```

If q is multiplied by a common phase, every frame vector receives that same
phase. If the representation is changed by unitary gauge, every frame vector
is transformed by that unitary, up to the same common phase. Affine projective
coordinates cancel the common phase. This explains the sampled gauge
invariance and removes the individual phase-component normalization defect.
The frame is unitary whenever the spectra are simple and the three vectors
remain independent. These are conditions, not a global existence theorem.

Points use a fixed-scale real affine projection. Dual lines use the common
camera's adjugate and an oriented real equation. Own-point anchoring is the
earlier projection convention. Source flags decide classification and hue;
the screen equation does not redefine complex incidence. Boundary markers
report clipping. A clipped point's boundary marker follows a ray from the
midpoint of its visible own-line segment toward its raw point. This keeps
an own-incident off-screen point's marker at that line's viewport exit;
radial clipping from the canvas origin did not. Entering and leaving the
viewport remains continuous. Raw coordinates and complex classification
are untouched. Concurrency and collinearity guides appear only when source
classification and the screen geometry agree.

## Current limitations

- Spectral collisions, QR rank loss, affine infinity and zero real projected
  normals can still make a camera undefined. Actual camera defects are reported;
  source rank loss and its physical visibility remain separate.
- A complex point-plane incidence need not be an exact real intersection after
  real projection. At default beta, r=1, sphere=0, t=.8, phi=.6, one known
  cross-incidence discrepancy is about .00566 diagram units (about one pixel
  at the validation canvas scale). Exact complex classification remains true.
- Some equal-plane and equal-point synthetic configurations have a degenerate
  spectral synchronizer. The earlier fit could draw those configurations;
  that does not establish a valid frame for the current camera.
- The strict positive-wall contraction regression is still failing: at
  beta_2^(2)=1+epsilon on the reference r=1 branch, the tested diagram diameter
  is about .0665 at epsilon=1e-7, exceeding the .001 target. This is retained
  as a real camera regression, not waived as a change of architecture.
  A subsequent audit measured .00665 at epsilon=1e-9, indicating roughly
  square-root convergence rather than a demonstrated nonzero limiting jump.
  The third QR residual tends to zero while the spectral gaps remain
  separated. The tested affine point, projected-normal and dual-phase
  denominators stay bounded away from zero, so a fixed chart adjustment
  has no identified projection singularity to repair.
- Clipped boundary markers need not retain the affine incidence of their
  off-screen raw points. Tests distinguish raw geometry from clipped markers.
  The own-line marker correction cannot put an off-screen intersection of
  two distinct lines simultaneously on both lines at the viewport boundary.

These limits were disclosed before the prototype was promoted for iteration.
No claim is made that every complex flag configuration has a faithful planar
straight-line realization under this camera.

## Line hues, cotangent arrows and validation

Line hue uses twice the product n0 conjugate(n1), where n is the normalized
dual-line vector in the QR camera. This restores the earlier projected
complex phase cue without choosing the phase of an individual component.
A common phase cancels in the product, and a zero component makes the
correlation vanish continuously. The separate hue bands and dot colors
computed from actual complex incidence residuals remain in use.
The weighted renderer had instead used tr(J_i H_j H_k). Its imaginary part
vanishes on the central zero-cotangent locus, so it failed to provide the
intended changing hue there.

The three physical block norms ||E1 K E2||, ||E1 K E3|| and ||E2 K E3|| still
control arrow opacity. Complex contractions against the declared balanced
reference control hue and saturation. A zero phase reference turns a nonzero
block gray; it does not erase its magnitude. Full matrices remain available.

Targeted regressions cover the known phase cuts, source classifications,
nonzero visible plane segments, unitary changes of gauge and actual arrows.
Motion diagnostics compare screen travel against the balanced source
invariants; shrinking numerical increments alone is insufficient evidence
that a camera moves naturally. The former incidence fit and rejected camera
experiments must not be used as hidden fallbacks.
Strict tests for unresolved contraction and degenerate configurations remain
registered and failing; this iteration does not claim an entirely green suite.

The promotion run completed 62 Node batteries: 58 passed and four remained
red (`validate-weighted-balanced-diagram`, `validate-global-camera-contract`,
`validate-adaptive-camera-scan`, `validate-wall-glyph-phase`). The adaptive
failure distinguishes a clipped marker from its incident raw point; its
additional modes also expose complex cross-incidence and synthetic limits.
The wall-glyph phase error converges but exceeds its finite-resolution bound
(.011887 versus .01). Default, adjacent and all six tested multichamber paths
passed their parameter and arrow continuity checks (234 multichamber cases,
1,404 strict solves). Browser checks passed for modular and bundled pages,
including snaps, infinity access and amber wall buttons.

After the boundary-marker correction, the full registered suite has 64
batteries: 60 pass and the same four named batteries fail. The adaptive
scanner now proceeds past the old own-line marker error and exposes further
cuts: default r approximately .425744 and .612256 cross affine infinity,
while the asymmetric chamber has a third-QR-axis cancellation near .396861.
Comparison with the preceding source confirms these cuts are inherited.
The boundary correction does not claim to resolve them. A tested complex
quadrature bridge removes the latter axis flip but breaks real special
incidences; it was rejected. Browser checks retain native snaps, smooth
snap animation and changing line hues in modular and bundled versions.

## Paired boundary indicators

Off-screen marked points now have two outward boundary indicators with
complementary brightness. At the two tested real affine-infinity crossings
(default r approximately .425744384 and .612256178), both indicators approach
half brightness, avoiding an abrupt exchange of viewport ends. The camera,
line hues and complex incidence classifications are unchanged. The first
two cotangent arrows share the indicators' weights; the third remains at
its existing line target. Screen-only snap interpolation matches endpoints
and handles entering and leaving the paired display.

The registered paired-boundary battery checks both crossings, rendered
chevrons and nonzero cotangent arrows, viewport entry, snap transitions and
unitary gauge invariance. Modular and bundled browser checks also retain
native snaps and changing line hues. This is a fix for the tested real
infinity crossings, not a global continuity claim for arbitrary complex
poles or the separate QR-axis cancellation. The legacy single primary
marker coordinate can still exchange ends; continuity checks must examine
the actual weighted pair drawn by the renderer.
