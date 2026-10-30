# E6 quiver simulation: mathematical roadmap

## Purpose and scope

Build a simulation of the star-shaped E6 ALE quiver variety at complex moment-map level zero. Start with one verified chart of the stable `y = 0` locus. Then add a reusable Hermitian gauge solver, continuation, transverse complex representatives, chamber routing, and fixed-component navigation.

The intended controls are `(r, theta, t, psi)` together with six real stability parameters. The `t` slider changes a **complex representative**; the solver then restores the real moment-map equations. It does not directly change the solved matrices. Eventually, buttons labeled `lim_{t -> 0}` and `~_{t -> infinity}` will navigate between classified core components and higher Morse strata using verified transition rules.

This roadmap records mathematical requirements and acceptance criteria, including
work already implemented. It is not a completed global chamber or fixed-point
classification. See [STATE.md](STATE.md) for current implementation scope and
the distinction between the frozen Python fixture and the live browser.
The browser already includes a Hermitian solver, continuation, supported chart
and component navigation, matrix inspection, and E6 chamber transport. The
visualizer track below preserves earlier triangle/projection proposals as
design specifications; it does not describe every current display.

The equations and candidate chart are stated below, so no private notes or
external TeX source are required. Executable conventions live in
[e6sim/conventions.py](e6sim/conventions.py),
[e6sim/moment_maps.py](e6sim/moment_maps.py), and
[e6sim/stability.py](e6sim/stability.py). Browser transport is documented in
[e6-chamber-transport.md](../docs/e6-chamber-transport.md).

## Verification principles

Separate **verified**, **candidate**, and **unsupported** mathematical data.
Only verified entries may be selected automatically. A failed nonlinear solve
is not proof of instability or emptiness; a small residual is not a proof of
an exhaustive classification. Preserve the last successful result on failure,
and label it with its actual input. Keep conventions centralized and the
mathematical core independent of the UI. Each extension needs reproducible
fixtures, checks, and an explicit statement of unsupported cases.

## Milestone 0 — Freeze the equations and data contract

**Goal:** eliminate ambiguity before implementing a solver.

There are three branches, each `C^1 -> C^2 -> C^3`, with the common central space `C^3`. Write

| Symbol | Matrix shape | Direction |
| --- | --- | --- |
| `a_i = x_i^(1)` | `2 x 1` | outer vertex to middle vertex |
| `A_i = x_i^(2)` | `3 x 2` | middle vertex to center |
| `b_i = y_i^(1)` | `1 x 2` | middle vertex to outer vertex |
| `B_i = y_i^(2)` | `2 x 3` | center to middle vertex |

Here `b_i` is a matrix; use a different identifier, such as `level[i,k]`, for real stability parameters in code.

The complex gauge group in the source is

`SL(3,C) x product_i (GL(2,C) x GL(1,C))`.

For central `g`, middle `h_i`, and outer scalar `q_i`, implement

```text
a_i -> h_i a_i q_i^(-1)
A_i -> g A_i h_i^(-1)
b_i -> q_i b_i h_i^(-1)
B_i -> h_i B_i g^(-1)
```

Define `M_0 = M - trace(M)/n * I_n`. At `tau = 0`, the complex equations are

```text
b_i a_i = 0
B_i A_i - a_i b_i = 0
-(sum_i A_i B_i)_0 = 0
```

For implementation, use Hermitian real moment maps with the `i/2` factor removed:

```text
R_i1 = a_i^* a_i - b_i b_i^*
R_i2 = A_i^* A_i - B_i B_i^* - a_i a_i^* + b_i^* b_i
R_center = (sum_i (-A_i A_i^* + B_i^* B_i))_0
```

Solve `R_i1 = level[i,1] I_1`, `R_i2 = level[i,2] I_2`, and `R_center = 0`.

**Parameter convention:** if the source's Lie-algebra-valued level is `beta_i^(k) = i c_i^(k) I`, then `level[i,k] = 2 c_i^(k)`. If the user's six numerical beta values already mean levels in the Hermitian equations, use them directly. Document the conversion; never silently introduce a factor of two. A uniform positive scaling does not change the strict stability inequalities.

The central level is traceless zero. Do not impose an additional independent central scalar equation. The determinant-one central convention removes the continuous common scalar gauge freedom; do not subtract another scalar variable from this formulation.

**Deliverables:** `conventions.md`, matrix data type, shape validation, gauge action, complex residual, real residual.

**Acceptance checks:** random well-conditioned invertible gauges preserve complex zero solutions; real maps transform by conjugation under unitary gauges; output matrices are Hermitian/traceless where required. At a point with discrete stabilizer, the count is 24 complex `x` variables, 24 complex `y` variables, and gauge dimension 23, giving expected complex quotient dimension `48 - 2*23 = 2`.

## Milestone 1 — Verify one y = 0 chart and one stability region

**Goal:** obtain a trusted input family before numerical gauge fixing.

Use the candidate finite chart, with `z = r exp(i theta)`:

```text
a_1 = a_2 = a_3 = [[1], [0]]

A_1 = [[1, 0],
       [0, 1],
       [0, 1]]

A_2 = [[0, 1],
       [1, 0],
       [0, 1]]

A_3 = [[0, 1],
       [0, z],
       [1, 0]]

b_i = 0; B_i = 0
```

These matrices satisfy the complex equations because all `y` matrices vanish. That fact alone does not establish stability, injectivity of the quotient coordinate, or coverage of the sphere.

Tasks:

1. Implement `candidate_y0_chart(z)` exactly.
2. Define central flags `L_i = image(A_i a_i)` and `P_i = image(A_i)`.
3. Derive strict stability inequalities using the source's subrepresentation convention. For **positive** Hermitian levels and injective `x` maps, the maximal branch subspaces over a central subspace `W` have dimensions `dim(W intersect L_i)` and `dim(W intersect P_i)`. Thus check

   `sum_i [level[i,1] dim(W intersect L_i) + level[i,2] dim(W intersect P_i)] - dim(W)/3 * sum_i [level[i,1] + 2 level[i,2]] < 0`

   for every nonzero proper `W` in `C^3`. Explain why smaller branch subspaces cannot give a larger weight in this positive-level case. Do not reuse this shortcut unproved for negative levels or nonzero `y`.
4. Enumerate the realizable intersection patterns of lines and planes for this chart. Sampling random `W` is insufficient: special incidences carry potential destabilizers. Use exact linear algebra for incidence changes in `z`.
5. Find one rational level vector and one exact `z` for which every necessary strict inequality is proved. Prefer an interior point with a visible positive stability margin. Produce the inequalities and their evaluated margins as a fixture.
6. Compute the infinitesimal `x`-gauge action and verify rank 23 at the fixture. Check that `dx/dz` is not in its image. This validates a local quotient coordinate, not global coverage.

**Deliverables:** chart module; exact stability derivation; one certified stable fixture; list of excluded or unresolved values of `z`.

**Acceptance checks:** exact complex residual zero, exact stability certificate, and quotient tangent dimension one. Treat all special values, including finite ones, individually. Do not assume the only missing points are `0` and `infinity`. Do not substitute equal levels merely because they look symmetric; they may lie on a wall.

## Milestone 2 — Solve the real moment map using Hermitian gauges

**Goal:** one solver that works for arbitrary supplied complex-zero representatives.

Use positive gauges

```text
g = exp(S_center / 2),  trace(S_center) = 0
h_i = exp(S_i / 2)
q_i = exp(s_i / 2)
```

where `S_center` and `S_i` are Hermitian and `s_i` real. Then `H_v = g_v^* g_v = exp(S_v)`, and the center has `det(H_center) = 1`.

There are `8 + 3*4 + 3 = 23` real unknowns. Pack the residual into orthonormal Hermitian bases, with eight traceless central components, four per middle vertex, and one per outer vertex. With Frobenius-orthonormal bases, residual-coordinate norms have a direct matrix interpretation. Do not discard the off-diagonal real equations.

Tasks:

1. Implement basis packing/unpacking and positive-gauge construction.
2. Apply the gauge to the entire `(x,y)` representation, then evaluate the equations from milestone 0. Start with this transparent implementation before deriving an optimized formula in `H`.
3. Use a trust-region nonlinear least-squares method with configurable tolerances and iteration limits. Start with finite-difference derivatives; verify any later analytic Jacobian against directional finite differences.
4. Return both Hermitian data and solved matrices, together with solver status, iteration count, per-vertex residuals, condition estimates, and maximum log-gauge magnitude.
5. Require a directly recomputed real residual, a directly recomputed complex residual, and finite positive gauge data for success. Use absolute and relative residuals, reporting their normalization. Large matrices can make an absolute residual misleading.
6. Diagnose failure without claiming its cause is known: invalid input, iteration limit, numerical overflow, ill conditioning, or unresolved mathematical input.

Suggested interface:

```python
solve_real_moment_map(rep, levels, initial_log_gauge=None, options=None)
# Result: success, log_gauge, H, solved_rep, residuals, diagnostics
```

**Deliverables:** reusable solver, command-line demo for the certified fixture, documented tolerances.

**Acceptance checks:** solve the milestone-1 fixture from identity; preserve `y = 0`; verify center determinant one; solve a well-conditioned complex-gauge transform of the same fixture. Compare solved results modulo compact gauge or via suitable gauge-invariant observables, not by raw matrix equality. Include a manufactured general `(x,y)` test: begin with explicit matrices, take their branch real levels only when each branch moment map is scalar and the central equation is zero, then apply a known complex gauge. Arbitrary random matrices are not valid scalar-level fixtures.

## Milestone 3 — Add continuation and numerical recovery

**Goal:** smooth slider motion with reliable warm starts.

Continue in `z`, levels, and later transverse parameters. Reuse the previous log-Hermitian gauge when the representation remains in the same chart. Reduce step size on failure and retry; increase cautiously after repeated success. Keep a cold-start fallback for diagnosis.

Across chart changes, transform the seed correctly. If `rep_new = k . rep_old`, and `H_old` solves the old input, then a seed solving the same quotient point in the new chart is

`H_new,v = (k_v^(-1))^* H_old,v k_v^(-1)`.

Use the Hermitian logarithm to convert it back to solver variables. The chart gauge must satisfy the central determinant convention. The positive square root of this seed gives a solved representative differing by compact gauge from the earlier one.

**Acceptance checks:** a loop within a certified stable domain; independently recomputed residuals at every accepted point; recovery after an intentionally oversized step; no label/input mismatch after a failed step. A closed loop need not return identical matrix entries without compact gauge alignment.

## Milestone 4 — Complete the first sphere's chart atlas

**Goal:** extend the initial chart only where stable representatives are proved.

Derive alternate finite representatives near every excluded value that belongs to the chosen component. Use a south coordinate `zeta = 1/z` where appropriate. Explicitly compute gauge transformations and coordinate transitions on overlaps. Do not evaluate the original matrices at `z = infinity`.

At a coordinate pole, verify that changing `theta` leaves the quotient class unchanged. The gauge needed for this statement may depend on the approach direction. Distinguish a missing representative from a genuinely unstable orbit requiring a different representative family.

**Deliverables:** atlas entries with representative formula, stable domain, excluded set, inverse coordinate where available, and overlap gauges.

**Acceptance checks:** exact overlap identities; real solves on both sides of an overlap agree modulo compact gauge; verified endpoint coverage. Claim a whole sphere only after the atlas and stability argument establish it.

## Milestone 5 — Construct nonzero y directions and the first t slider

**Goal:** move off the verified `y = 0` component without violating complex equations.

For fixed `x(z)`, solve the homogeneous linear system in the 24 complex `y` entries:

```text
b_i a_i = 0
B_i A_i - a_i b_i = 0
-(sum_i A_i B_i)_0 = 0
```

At a verified point where the `x`-gauge action has rank 23, the cotangent moment-map linear map is its transpose under the trace pairing; check this identity and expect a one-dimensional kernel. A numerical SVD can identify rank, but derive an exact local basis `Y(z)` where possible.

Normalize the basis using the trace pairing with `dx/dz`, for example `sum_a trace((dx_a/dz) Y_a) = 1`, wherever that pairing is nonzero. An arbitrary SVD phase will create artificial jumps. Phase alignment between nearby bases is a numerical fallback and must be explicit.

The family

`rep(z,w) = (x(z), w Y(z))`, with `w = t exp(i psi)`,

then satisfies the complex equations **exactly for every complex w**, because the equations are linear in `y` at fixed `x`. Its stable domain and coverage must still be checked. Feed each member into the general solver.

Implement `t = 0` directly; all `psi` values then yield the same input. Uniform scaling from a nonzero `w` is the residual complexified circle orbit in this chart. The slider radius is not automatically the solved circle moment-map value or a specified time parameter for a gradient ODE.

On chart overlaps, derive the transverse transition from the representative gauges and/or cotangent pairing. If a smooth rational component has a verified cotangent normal model, the inverse-coordinate transition is of degree two, with sign depending on the chosen fiber conventions: for literal covectors `w dz`, `w_tilde = -z^2 w`. A constant sign can be absorbed into a fiber coordinate. Do not hard-code either convention without derivation.

**Acceptance checks:** exact kernel equation, transverse tangent independence modulo gauge, stable small nonzero fibers, solved residuals over a range of `t` and `psi`, and agreement on overlapping charts. The one-dimensional kernel calculation does not prove a global parameterization of the entire E6 space.

## Milestone 6 — Route chambers and representative templates

**Goal:** expand beyond one component/domain with auditable chamber data.

Maintain two distinct records:

- Full stability/root chambers, once their arrangement is derived in the actual six parameter coordinates.
- Stable domains of individual chart templates, which need not equal single full chambers.

Tasks:

1. Derive the wall forms in these coordinates, including the central level determined by the branch levels. Use exact rational arithmetic for reference chamber enumeration.
2. Enumerate chambers and certify an interior rational sample for each one. Counts require exact certificates in the stated parameter coordinates.
3. Implement branch permutations together with their actions on levels, matrices, coordinates, and solver seeds.
4. Derive any proposed duality as an actual map of this oriented doubled-quiver problem; verify the transformed levels and residual circle action. Duality is not just swapping `x` and `y` in code.
5. Reduce to representative templates only under transformations actually established as valid. An arbitrary Weyl action cannot be assumed to preserve the chosen circle action or the `y = 0` locus.
6. For a requested input, choose a certified compatible chart with good numerical conditioning. Retain the current chart while it remains valid; do not force a switch merely because a full root wall was crossed.
7. Classify exact wall inputs separately from near-wall generic inputs. Do not silently perturb levels to another moduli problem. If wall behavior is unsupported, report it.

**Acceptance checks:** verified sample per supported chamber; forward/inverse permutation tests; explicit level transformation tests; continuity modulo gauge where a valid overlap supports it. Never promise continuous coordinates across all walls without a theorem or explicit transition construction.

## Milestone 7 — Add classified fixed components and Morse strata

**Goal:** reuse the solver for minima with nonzero `y` and higher strata.

The project owner will supply or commission the fixed-point classification. Store each component's representative family, stable domain, compensating gauge weights, normal weights, charts, and verified outgoing/incoming transitions. Do not assume every fixed component is a sphere.

Verify fixedness modulo gauge. One convention is `lambda . rep = g(lambda) . rep`, where the residual action multiplies all `y` by `lambda`. For an inward arrow from source `s` to target `d`, nonzero `x` blocks then require `weight(d) - weight(s) = 0`; nonzero reverse `y` blocks require `weight(s) - weight(d) = 1`. Enforce the central determinant condition; rational weights may require a finite cover of the circle. These equations depend on the stated compensation convention.

For every family away from a fixed component, provide an exact complex-zero construction. At a nonzero-`y` base point, an arbitrary linearized deformation need not integrate to an exact family: the complex equations are bilinear when both `x` and `y` vary. Uniform `y` scaling still preserves complex zero, but scaling a fixed orbit may remain constant in the quotient.

**Acceptance checks:** explicit compensation identity; residual equations; tangent weights; valid small transverse families; consistency with the verified classification. Solver convergence alone does not certify fixedness.

## Milestone 8 — Implement the limit and asymptotic navigation buttons

**Goal:** buttons perform certified chart/stratum transitions, not numerical guesses.

For each button, register source domain, branch/direction information, target chart, coordinate map, gauge renormalization, level restrictions, and proof status. Some limits require additional direction data; preserve it rather than identifying distinct trajectories.

For `lim_{t -> 0}`, use the derived limiting representative or chart transition. Near a nonzero-`y` fixed component, the relevant local `t` need not mean multiplying the original `y` by zero.

For `~_{t -> infinity}`, use an established asymptotic normalization and transition. Do not replace infinity by a large constant or assume every orbit has a limit in the noncompact space. Distinguish an actual quotient limit from an asymptotic description or a transition into a different stratum.

Transport the Hermitian seed through known chart gauges. If a limiting gauge is singular, use a nearby finite transition or initialize afresh in the target chart. Recompute residuals after the jump.

**Acceptance checks:** agreement of direct target-chart solutions with transformed finite approximations; convergence of stated observables in the predicted regime; correct labels for actual limits versus asymptotics. An unsupported transition is disabled with a concise explanation.

## Milestone 9 — Build the interface and regression examples

**Goal:** expose only functionality supported by the mathematical registry.

Controls: six levels, component/chart selector, `r`, `theta`, `t`, `psi`, and the two transition buttons. Use finite chart coordinates or logarithmic radius for wide ranges, with explicit endpoint modes. Wrap angles periodically. Solve new complex inputs in a worker or queued task; cancel or ignore outdated results using an input-generation identifier.

Display: selected component/chart, solver state, moment-map residual, stability status/margin when certified, and compact-gauge-invariant observables. One useful solved observable is `Phi = 1/2 sum_a ||y_a||_F^2`, under a consistently documented circle moment-map convention. Do not identify `Phi` with `t`.

Before choosing a geometric embedding or rendering, specify what its coordinates mean and whether they are injective. Raw matrix entries depend on compact gauge. A smooth visual trajectory may require compact gauge alignment even when the quotient trajectory is smooth.

Regression set: certified interior `y = 0` points; alternate charts/poles; small transverse fibers; long continuation paths; a supported chamber change; near-wall failure; nonzero-`y` fixed data when available; each supported navigation transition.

**Acceptance checks:** no stale result shown as current; solver failure preserves the previous valid state; periodic angles agree modulo gauge; all displayed solved points pass independently recomputed equations.

## Suggested module boundaries

```text
conventions.py       # dimensions, parameter conversion, Hermitian bases
representation.py    # matrices, validation, gauge action
moment_maps.py       # complex/real equations and diagnostics
charts.py            # representative builders and overlap gauges
stability.py         # certified inequalities and domain checks
hermitian_solver.py  # positive gauge solve; accepts arbitrary complex-zero input
continuation.py      # warm starts, step control, chart seed transport
chambers.py          # exact wall data, symmetries, template routing
fixed_components.py  # verified classification data and circle weights
transitions.py       # limit/asymptotic maps with source and target contracts
fixtures/            # exact certified examples and expected properties
tests/               # algebra, solver, continuation, and transition tests
```

These are proposed filenames, not files already implemented. Add a registry entry only when its mathematical dependencies have been checked.

## Completion record for every milestone

```text
Milestone:
Implemented files:
Verified mathematical inputs:
Exact fixture(s):
Checks run and results:
Known unsupported cases:
Open question and next smallest task:
```

Each record should make its claims independently reproducible from committed sources and fixtures.

## Visualizer Milestones

These milestones are a separate rendering track. They consume verified, gauge-balanced solutions from the implementation milestones above. First implement the positive-level `y = 0` geometry, then continuity and chart transitions, and finally nonzero `y`. A renderer must not supply unverified representatives to compensate for missing mathematical charts.

The geometric aim is a closed triangle in `su(3)`, viewed as an eight-dimensional Euclidean space, with decorations that reveal the flag data. A three-dimensional view is a projection of that data. The triangle itself can be rendered exactly, since its edges sum to zero and therefore span at most a two-dimensional plane.

Background reference: Steven Rayan and Laura P. Schaposnik, *Moduli spaces of generalized hyperpolygons*, https://arxiv.org/abs/2001.06911. Their polygon interpretation provides context; verify the formulas here directly against this project's conventions.

### V0 — Extract geometric data from solved matrices

**Dependency:** implementation milestone 2.

Use the solved matrices, after any compact gauge alignment. In this section set

```text
u_i = x_i^(1), X_i = x_i^(2)
v_i = y_i^(1), Y_i = y_i^(2)
alpha_i = level[i,1], gamma_i = level[i,2]
```

Both `alpha_i` and `gamma_i` are real Hermitian levels, not imaginary Lie algebra elements. Define

```text
T_i = X_i X_i^* - Y_i^* Y_i
Q_i = T_i - trace(T_i)/3 I_3
```

The central real moment map says `sum_i Q_i = 0`. Work with traceless Hermitian `Q_i`; the corresponding anti-Hermitian vector is `i Q_i`. The Euclidean pairing is `trace(Q_i Q_j)`, equivalently `-trace((i Q_i)(i Q_j))`.

Tasks:

1. Reuse a Frobenius-orthonormal basis of traceless Hermitian `3 x 3` matrices from the solver. Convert `Q_i` to real eight-vectors `q_i` by taking traces against that basis.
2. Check that vector dot products equal the matrix trace pairing. Do not use unnormalized Gell-Mann coordinates without compensating for their normalization.
3. Record the closure error, edge lengths, and branch traces. The branch equations imply `trace(T_i) = alpha_i + 2 gamma_i`, also for nonzero `y`.
4. Keep full matrices in the geometry record; eight-vectors and projections are derived display data.

**Deliverable:** a pure `extract_geometry(solved_rep, levels)` function.

**Acceptance checks:** Hermitian/traceless outputs; trace identities; agreement of matrix and vector norms; closure error consistent with the solver residual. Do not silently force closure by replacing the third edge with minus the first two.

### V1 — Verify the weighted-flag interpretation at y = 0

**Dependency:** V0 and a certified positive-level `y = 0` fixture.

For positive `alpha_i, gamma_i`, the solved branch equations are

```text
u_i^* u_i = alpha_i
X_i^* X_i = gamma_i I_2 + u_i u_i^*
```

Let `L_i = image(X_i u_i)` and `P_i = image(X_i)`, with orthogonal projectors `Pi_Li` and `Pi_Pi`. Then

```text
X_i X_i^* = alpha_i Pi_Li + gamma_i Pi_Pi
Q_i = alpha_i (Pi_Li - I_3/3) + gamma_i (Pi_Pi - 2 I_3/3)
```

Compute line projectors from `ell_i = X_i u_i` as `ell_i ell_i^* / ||ell_i||^2`. Compute plane projectors by a thin QR or SVD with a rank check. Avoid an explicit Gram-matrix inverse when possible.

The ordered eigenvalues of `Q_i` are

```text
(2 alpha_i + gamma_i)/3
(-alpha_i + gamma_i)/3
-(alpha_i + 2 gamma_i)/3
```

The first eigenspace is `L_i`; the first two span `P_i`. Thus `Q_i` already encodes the full flag when both levels are positive. Decorations expose this information visually; they are not additional independent degrees of freedom. Phase changes of a line eigenvector do not change its projector.

Its squared norm is `2/3 (alpha_i^2 + alpha_i gamma_i + gamma_i^2)`. Together with closure, these fixed lengths determine the ordinary Euclidean triangle shape:

`trace(Q_i Q_j) = (||Q_k||^2 - ||Q_i||^2 - ||Q_j||^2)/2`.

**Critical interpretation:** at fixed levels, the undecorated triangle is rigid up to Euclidean rotation. The `y = 0` sphere varies through matrix configurations modulo simultaneous `SU(3)` conjugation, not through changing Euclidean side lengths or angles. A viewer showing only this triangle would hide the moduli.

**Acceptance checks:** compare the projector identity, ordered spectra, squared norms, and pairwise trace formulas against solved fixtures. Recover the flag projectors spectrally and compare with those computed from `x`.

### V2 — Render the exact triangle and projected flag markers

**Dependency:** V1.

Choose an orthonormal viewing frame `e_1,e_2,e_3` in the eight-dimensional Hermitian space. Its first two directions should contain the nondegenerate triangle plane. For example, normalize `q_1`, then orthogonalize `q_2` against it. Handle zero or collinear edges explicitly; do not divide by a vanishing norm.

Define projection `p(q) = (dot(q,e_1), dot(q,e_2), dot(q,e_3))`. Render vertices

`0`, `p(q_1)`, and `p(q_1 + q_2)`,

with directed branch-colored edges. Since the viewing space contains the triangle plane, its edge lengths and angles are preserved, apart from reported numerical residuals.

For the line decoration, use `D_i = Pi_Li - I_3/3` and its eight-vector `d_i`. Place a colored marker at

`midpoint(edge_i) + c_L p(d_i)`.

An optional second marker can use `E_i = Pi_Pi - 2 I_3/3` with a separate display scale `c_P`. Draw a short connector to the edge midpoint. These marker positions are a display convention, not points lying on the original triangle or scalar coordinates along an edge. A dot constrained to the edge alone does not faithfully show a general flag.

Choose the third viewing direction from the decorations' components orthogonal to the triangle plane, using a documented rule. A dominant covariance direction is one option. Permit manual frame controls and alternative projections because one projection may hide a variation visible in another.

**Acceptance checks:** exact triangle lengths in the rendered coordinates; stable colors and branch ordering; no NaNs at degeneracies; marker invariance under changing a chosen line-vector phase. Label decorations as projected flag data. Do not claim the three-dimensional marker picture is injective on the moduli space.

### V3 — Make the displayed balanced data and frame continuous

**Dependency:** implementation milestones 3–4 and V2.

Balancing does not remove compact gauge freedom. Before extracting/rendering a new result, align it with the previous displayed result by locally minimizing

`sum_a (||u . x_new,a - x_old,a||_F^2 + ||u . y_new,a - y_old,a||_F^2)`

over `u` in `SU(3) x product_i(U(2) x U(1))`. Use the gauge action from implementation milestone 0. Initialize near the previous alignment and reduce continuation steps if alignment becomes ambiguous. This is a coupled optimization; independently aligning each matrix can violate the common vertex-gauge constraints.

Tasks:

1. Apply the compact alignment before computing geometry, retaining its transform for the next step.
2. Recheck moment-map residuals after alignment. Unitary gauge changes preserve the equations.
3. Transport the viewing frame along with the aligned data. Fix eigenvector signs/phases and avoid independently recomputing unstable PCA directions at every frame.
4. When the third-direction selection becomes degenerate, retain a continuous usable frame or invoke a documented local fallback. Do not promise a globally canonical frame.
5. At `z = 0, 1, infinity`, use verified stable chart representatives and transitions first, then align the resulting balanced data. Compact alignment cannot repair an unstable complex representative.

**Distinguish gauge from viewing rotation:** simultaneous `SU(3)` conjugation preserves the matrix structure and induces an orthogonal action on the eight-vectors. A general `SO(8)` transformation is only a Euclidean viewing operation; it need not preserve spectra, cubic traces, or commutators if interpreted as new matrices. Keep it out of the solver and mathematical equivalence tests.

Pathwise alignment can accumulate holonomy. Returning to the same `(r, theta)` need not return identical matrix entries, although the quotient point agrees. A globally single-valued continuous choice of balanced matrices requires a separate section-existence analysis. Record this distinction instead of introducing a hidden reset.

**Acceptance checks:** smooth small-step trajectories; overlaps at all supported special points; periodic angles agree modulo compact gauge; no visible jump caused solely by a phase/sign choice; closed-loop diagnostics distinguish quotient agreement from literal matrix agreement.

### V4 — Add invariant inspection and projection diagnostics

**Dependency:** V2–V3.

Provide an inspector showing full `Q_i` matrices, ordered eigenvalues, closure error, and the available flag overlaps. At `y = 0`, useful quantities include

```text
trace(Pi_Li Pi_Lj)
trace(Pi_Li Pi_Pj)
trace(Pi_Pi Pi_Pj)
trace(Q_i^2 Q_j)
||[Q_i,Q_j]||_F^2
```

These are invariant under simultaneous `SU(3)` conjugation. The first three can help explain relative flag positions; mixed traces and commutators expose matrix information absent from the triangle's Euclidean shape. Do not assert that this list is a complete set of coordinates or separates every quotient point without verification.

For each projected decoration, report its lost squared norm `||d||^2 - ||p(d)||^2`, up to roundoff. Offer a projection change when the image conceals most of the data. Fixed view scaling or an explicit zoom control prevents automatic rescaling from hiding changes in edge lengths later.

**Acceptance checks:** invariants unchanged under a random simultaneous central `SU(3)` gauge; projection loss nonnegative within tolerance; inspect trajectories where the triangle shape stays fixed while matrix/flag data vary.

### V5 — Extend the geometry to nonzero y

**Dependency:** implementation milestone 5 and V0–V4.

Continue to render the real triangle using `Q_i = (X_i X_i^* - Y_i^* Y_i)_0`. Its branch traces remain `alpha_i + 2 gamma_i`, but the fixed-spectrum and weighted-projector identities from V1 are specific to `y = 0` and must not be applied automatically.

When `X_i` and `X_i u_i` have the required ranks, extract the `x`-flags directly as decorations. Label them as `x`-flags; for nonzero `y`, they are not generally the ordered spectral flag of `Q_i`. In charts where these ranks fail, use the verified component-specific geometric data or mark the decoration unavailable. Do not manufacture a line by normalizing a zero vector.

Also extract `K_i = X_i Y_i`. At complex level zero, the branch equations imply `trace(K_i) = 0`, and the central equation gives `sum_i K_i = 0`. Split

```text
C_i = (K_i + K_i^*)/2
F_i = (K_i - K_i^*)/(2i)
K_i = C_i + i F_i
```

Both `C_i` and `F_i` are traceless Hermitian, and each triple closes. Show them as optional overlays or separate panels using a common projection. The exact complex polygon lives in a sixteen-dimensional real space; these overlays are projections and need not preserve its lengths.

The residual circle sends `K_i -> exp(i psi) K_i`. Thus

```text
C_i -> cos(psi) C_i - sin(psi) F_i
F_i -> sin(psi) C_i + cos(psi) F_i
```

while `Q_i` is unchanged by multiplying all `y` by a unit phase at fixed `x`. This makes clear why the real triangle alone cannot display the residual phase direction. If the solver chooses another compact gauge, compare after alignment.

**Acceptance checks:** all three closure relations; branch trace identities; circle rotation formulas; recovery of `K_i = 0` and V1 geometry at `y = 0`. Display the solved energy `Phi = 1/2 sum_a ||y_a||_F^2` separately from the complex slider radius `t`.

### V6 — Integrate chamber and stratum navigation

**Dependency:** implementation milestones 6–9 and the supported visualizer milestones.

Keep the geometry extractor independent of the selected holomorphic chart. Preserve branch colors under any permutation by using the original branch identities. Transport compact alignments and viewing frames through verified transitions whenever possible.

For the limit and asymptotic buttons, show the predicted target geometry from the transition registry. Only animate between mathematically supported points; interpolation of matrix entries generally does not preserve moment-map equations. Distinguish a genuine limit from an asymptotic change of description. Update the inspector, projection quality, and solve status with the same input-generation identifier as the rendered scene.

**Acceptance checks:** supported chart/component changes maintain consistent geometry and labels; no stale inspector data; failures retain the last valid scene; regression examples include the special values `z = 0, 1, infinity`, nonzero transverse fibers, and every enabled navigation button.
