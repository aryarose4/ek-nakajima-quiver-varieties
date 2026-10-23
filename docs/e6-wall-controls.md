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

## First live crossing: required integration

The read-only prototype at commit `cc4202c` handles the old side-zero
second-sphere wall. Its root is
`(center=1; middle=1,0,1; outer=1,0,0)` and its reflection word in vertex
order `(center,middle0,middle1,middle2,outer0,outer1,outer2)` is
`[4,1,0,3,0,1,4]`. It supplies useful transport tests but no live adapter.
The old side-zero middle/tip representatives have positive King witnesses
in that adjacent chamber: unlocking the current solver is incorrect.

Before enabling that one crossing:

1. Add explicit chamber/basis/word state. At a wall retain the side selection
   separately from beta and define a singular display that does not request
   an ordinary regular stable solve. Preserve the dot's chart coordinates
   with a documented wall-limit interpretation.
2. At target regular levels pull back by the reflection word, construct a
   stable source chart at those levels, then transport its arrows forward.
   Validate chart overlaps, finite and infinity charts, nonzero transverse
   coordinates, fixed gradings, and continuity of observables across pivot
   changes. Existing source-atlas regularity is not a stability certificate.
3. Carry the transported effective root labels through the area/core layer.
   With c the crossed second-sphere class and b its neighboring first-sphere
   class, use c'=-c and b'=b+c; the other four classes stay fixed. Taking
   absolute values of old periods gives the wrong first-sphere area.
   `e6CoreAreas` currently enforces the original basis and must be adapted.
4. Include chamber identity/transport word in balanced-client requests and
   worker messages, reject stale results across chamber epochs, and clear or
   transform cached previous solutions/seeds. `invalidate()` currently
   suppresses deliveries but does not clear the fallback `previous` seed.
   Regenerate worker source after changing its solver path.
5. Validate forward ranks, real/complex residuals, fixed Hamiltonians,
   transported period/incidence labels, UI boundary behavior and back-crossing.
   Only then expose this wall's Cross Wall action. The other four positive
   facets need their own validated words/atlas paths before enabling them.

No transported solver, live area change, or certified wall-limit display is
implemented in this milestone. The planner and UI adapter are independent
foundations; they are not evidence that current representatives work in a
new chamber.
