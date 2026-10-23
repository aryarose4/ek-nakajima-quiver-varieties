# E6 wall controls: first milestone

`e6-wall-transitions.js` is a pure parameter planner. It never changes beta,
selects a live chamber, transports representatives, or enables controls.
`e6WallTransitionOptions(beta)` accepts regular strictly positive beta and
returns six chamber facets. Root coefficients pair directly with beta to
give periods. IDs identify unoriented root hyperplanes and remain stable
on reversal. The default chamber has five `positive-beta` facets and one
`coordinate-zero` facet (middle beta on leg zero). Crossing the latter
leaves the positive flag-level domain; it has no target.

Each reachable facet has `wallBeta` and a backend-only `crossing.targetBeta`.
These are not an instruction to jump the UI to another beta. The intended
Hyperpolygon interaction is: reach a wall; show Cross Wall; change the
tracked chamber side at that same beta; drag into the new chamber. At the
wall the beta tuple alone cannot determine the selected side. Keep the
regular chamber's sign vector/basis as explicit state. The current planner
rejects singular inputs rather than guessing that state. Both `canCross`
and `canApproach` are false until the singular display and transported
solver/atlas paths are integrated.

## Mathematical justification and evidence

The existing bounded-root enumeration supplies all 72 roots, in 36 opposite
pairs. Multiplying coefficient forms by three makes their coordinates
integral, so positive-root decomposition is tested with exact integer keys.
For a regular parameter, the indecomposable positive roots are the six
simple roots; their zero hyperplanes bound its Weyl chamber. Every positive
root is a nonnegative integer combination of the simple roots. In particular,
each beta coordinate is itself a positive root in the positive-beta domain.

To reach facet j, the planner solves the six linear equations keeping the
other five simple periods unchanged and setting period j to zero. All
other positive roots remain positive unless they are the selected simple
root. Thus the facet interior has positive beta except when a coordinate
root is precisely the selected simple root. This explains the distinction
between positive-beta and coordinate-zero facets without heuristics about
slider endpoints.

Beyond the wall the planner follows the same line. For each other root and
each beta coordinate it computes the first possible zero; it moves at most
halfway to the earliest such zero. Consequently only the chosen opposite
root pair changes sign. This is a linear-algebra argument, not a statement
about stability of representatives. Runtime tolerances reject ill-conditioned
near-intersection plans; floating-point computation is not an exact certificate.

Numerically checked: the new battery examines 100 regular chamber states,
543 positive-beta targets, exactly two vanishing bounded roots per wall,
exactly two sign changes per crossing, positivity, input immutability, stable
unique wall IDs and singular/malformed-input rejection. Long paths reset
periodically because repeated small steps can converge to intersections.
The tests do not establish atlas stability or global solver convergence.

## First live crossing

The live panel supports the second-sphere wall on the r=0 branch and its
reverse. Drag beta_1^(1) upward to the boundary near 1.55; Cross Wall appears.
The click retains the beta tuple and chart coordinates. The selected chamber
is explicit state, and subsequent drags use that chamber's root signs.
The remaining walls, including coordinate-zero walls, stay locked.

The adjacent solver pulls levels back through the reflection word
`[4,1,0,3,0,1,4]`, balances the source chart, and applies the balanced
reflection formula from `e6-chamber-transport.md`. Orthonormal complement
choices change only unitary gauge. Target residuals are checked independently
against real `1e-9` and complex `1e-8` tolerances; a conditional target polish
handles small accumulated numerical error. Wrong-chamber inputs are rejected.

At the pinned boundary the widget explicitly uses a nearby interior sample
with signed crossed period at least `1e-7`. The DOM records requested levels,
displayed levels and `data-wall-approximation`. Both incidence and sphere
radii use the displayed sample. This avoids claiming an exact singular solve;
the regular solver rejects singular levels. At non-boundary parameters the
requested and displayed levels agree. A small boundary collar remains a
numerical approximation, so convergence tests do not establish exact continuity.

If c is the second-sphere root and b its first-sphere neighbor, the adjacent
area basis is c'=-c, b'=b+c, with the other four unchanged. The live area layer
uses this basis rather than absolute values of the old periods. Worker
requests include chamber identity and epoch; changes invalidate previous
seeds and reject stale progress/results.

Validation covers transported chart fixtures, fixed-point checks from the
original transport battery, strict target residuals, pinned controls and
back-crossing, areas, and shrinking neighborhoods in r, theta, t, phi and all
six beta coordinates. Continuity checks compare invariant tensors and visible
line/dot/arrow data rather than raw gauge-dependent matrices. They are sampled
regressions, not a proof of a globally regular planar camera. Browser checks
exercise both source modules and the generated standalone HTML.

Further crossings require validated transport words and corresponding
chart/area identification. Negative-beta flag rendering and an exact singular
wall representative remain outside this implementation.