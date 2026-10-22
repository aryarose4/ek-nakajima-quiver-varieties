# E6 adjacent-chamber transport prototype

This is an experimental, dependency-free mathematical layer. It does not
change the beta panel, live atlas, solver, or displayed radii. Run it with:

```
node tests/validate-e6-chamber-transport.mjs
```

## One concrete adjacent chamber

All values here are **code levels**, twice beta. Starting at
`[[3,1],[3,21/10],[3,3]]`, the prototype transports representatives to

```
[[46/15, 1], [3, 61/30], [44/15, 46/15]].
```

The endpoints are regular, all six leg levels are positive, and their root
signs differ on precisely one complementary root pair. Since wall forms
are linear, their straight segment crosses exactly one wall. That wall is
the current `r=0` second-sphere wall. The crossed bounded root is
`(center=1; middle=1,0,1; outer=1,0,0)`; its weight changes from `-1/15`
to `+1/15`.

The **original** side-zero middle and tip representatives are unstable at
the target. Both contain the invariant central line `W=span(e1)`, with
outer incidences `(1,0,0)` and middle incidences `(1,0,1)`. Its exact King
weight is `+1/15`. Consequently no complex gauge can balance either orbit
there. This is a mathematical obstruction, independent of the solver.
Some old orbits remain stable: chamber membership alone does not say that
every representative fails, and a failed numerical solve is not itself a
stability certificate.

The transported replacements of these two fixed points do balance. The
tests also cover the central family, both long arms, the short arm, and
nonzero complex transverse coordinates: 20 transported fixtures in total.
The old UI's eight canonical configurations are included; seven of those
and a generic central point have transported diagonal integral gradings.
The short tip's original grading
is not diagonal in its supplied basis and is tested numerically here.

## Local reflection and why it preserves balanceability

Use vertex order `(center,middle0,middle1,middle2,outer0,outer1,outer2)`.
The dimensions are `delta=(3,2,2,2,1,1,1)` and extended real levels are

```
lambda=(-T/3, gamma0,gamma1,gamma2, alpha0,alpha1,alpha2),
T=sum(alpha)+2*sum(gamma).
```

These agree with the extended-weight convention and King sign in the
author's *Star Shaped Quivers and Higgs Bundle Moduli Spaces.tex*,
definitions “extended GIT weight vector” and “King stability”.

At vertex `v` collect outgoing arrows into `p:V_v -> N` and signed incoming
arrows into `q:N -> V_v`:

| Vertex | p (stack vertically) | q (concatenate horizontally) |
| --- | --- | --- |
| outer i | a_i | b_i |
| middle i | A_i, b_i | B_i, -a_i |
| center | B_0, B_1, B_2 | -A_0, -A_1, -A_2 |

Then `qp=0` and the real equation is `p* p - q q* = lambda_v I`.
Here `*` denotes adjoint. Because delta is the null root, `dim N=2 dim V_v`;
reflection therefore preserves **every vertex dimension**.

For `lambda_v>0`, p is injective. Choose a quotient `P:N -> coker p`
and section S with `PS=I`. Set

```
p' = p q S,    q' = P.
```

Since `qp=0`, `q=qSP`, whence `p'q'=pq` and `q'p'=0`. Thus every complex
moment equation is preserved, including neighboring equations. For
`lambda_v<0`, q is surjective: take `K:ker q -> N` and a left inverse L,
and set `p'=K, q'=Lpq`. These formulas are inverse up to vertex gauge.
The code chooses quotient/kernel coordinate charts by pivoting. A chart
switch can change raw matrices discontinuously while preserving the orbit.

There is also a constructive check of the real level and existence claim.
Suppose the input has already been balanced and `lambda=lambda_v>0`.
Take an isometry U onto `ker p*`, put `Q=qU` and
`H=(lambda I+Q*Q)^(1/2)`. Then

```
p'_balanced = p Q H^(-1),    q'_balanced = H U*.
```

Direct multiplication, using `p*p=lambda I+QQ*`, gives

```
p'_balanced* p'_balanced - q'_balanced q'_balanced* = -lambda I,
p'_balanced q'_balanced = pq,
p'_balanced p'_balanced* - q'_balanced* q'_balanced
    = pp* - q*q - lambda I_N.
```

The last identity changes each neighbor level by `+lambda`. These maps
are complex-gauge equivalent to the quotient construction (use `P=U*`,
`S=U`, and new-vertex gauge H). Different choices of quotient basis only
change vertex gauge. The negative-level construction is the inverse.
Therefore a balanceable input transports to a balanceable output with

```
lambda'_v=-lambda_v,   lambda'_u=lambda_u+lambda_v (u adjacent to v).
```

This proves existence for transported stable source orbits; it does not
prove convergence of the numerical Hermitian solver. Regularity excludes
the root-wall reducible cases. The effective GL(3) central action modulo
the common scalar is equivalent to the existing SL(3) convention: a
common scalar shift normalizes the central determinant without changing
any arrow. The construction introduces no framing or dimension change.

For this adjacent chamber use the palindrome

```
outer0, middle0, center, middle2, center, middle0, outer0
```

or vertex indices `[4,1,0,3,0,1,4]`. The first three reflections reduce
the crossed root to the middle2 vertex root; the last three undo that
change of root basis. Intermediate leg levels need not be positive.
They are auxiliary quiver presentations, not flag displays. Final
positive leg levels give injective forward arrows and the usual
`C^1 subset C^2 subset C^3` flags. The tests independently check those ranks.

## Circle action and fixed-point gradings

The circle remains `x -> x, y -> exp(i theta)y`. For an outgoing arrow of
degree d (0 for x, 1 for y), give its summand of N generator
`H_neighbor-d I`. This yields `H_N p=p H_v` and
`H_v q-q H_N=q`. On the reflected vertex use

```
positive-level quotient: H'_v = H_coker(p) + I,
negative-level kernel:   H'_v = H_ker(q).
```

These equations give degree zero for all reflected x arrows and degree
one for all reflected y arrows. Equivalently, the reflection is
C*-equivariant after the induced change of vertex basis. Integral
semisimple gradings remain integral and semisimple. The optional grading
argument implements this for diagonal witnesses only; non-diagonal
witness transport is not implemented.

For example, the transported side-zero middle point has center weights
`(1,1,0)`, middle weights `((1,1),(1,0),(1,0))`, and outer weights
`(1,1,0)`. The transported side-zero tip has center `(1,0,-1)`, middle
`((-1,1),(1,0),(0,-1))`, and outer `(-1,1,0)`. Every nonzero entry obeys
the degree equation exactly. Their balanced Hamiltonians are respectively
`29/60` and `11/20`. The difference is `1/15`; dividing by circle weight
two gives the new second-sphere period `1/30`.

The test checks the fixed-point trace formula
`F=-sum_v lambda_v Tr(H_v)/2` against `||y||^2/2` after solving.
The transported central, first-long, second-long, and short components
retain their source circle actions and generic stabilizer orders
(fixed central sphere, then orders 1, 2, and 1). This conclusion uses
equivariance, not a relabeling of raw fixed-point matrices.

## Effective roots, incidence, and areas

`e6-chamber-roots.js` enumerates the finite roots by reducing each bounded
affine root modulo delta to outer2 coefficient zero. It selects roots
of positive level pairing and removes those decomposable as a sum of
two positive roots. The remaining six are the chamber's simple roots.
Their Cartan Gram matrix supplies incidence: an entry -1 means adjacent
components. Their periods (area divided by `2*pi`) are `lambda dot root/2`,
with the factor two converting code levels to beta.

Let c be the old second-sphere root on the side-zero arm and b its old
first-sphere neighbor. Across this wall the new effective classes are

```
c'=-c,    b'=b+c,
```

with the other four unchanged. Thus the new period of the first sphere
is the **sum** of the old first and second linear forms, whereas the new
second period is minus the old second form. Absolute values of the six
old forms would miss the changed first sphere. Reflection preserves the
Gram matrix, so transported component labels keep the E6 tree. At the
specific reflected fixture, all six new periods equal their source values.

The geometric component identification is supplied by transporting the
charts and their overlaps through the reflection equivalence. Roots
alone do not supply representatives, fixed gradings, overlaps, or a map
from the old UI's coordinates. This prototype has not installed such a
live atlas adapter or replaced `e6-areas.js`.

## Evidence and remaining work

**Algebraically established:** the local complex identities, reflected
real levels and balanceability construction, inverse up to gauge,
dimension preservation, and grading rule above; the two exact positive
King witnesses; the root change `b -> b+c, c -> -c`. Integer grading
checks on the eight supplied diagonal fixtures have zero error.

**Numerically checked:** 20 target solves, strict real residual below
`1e-9` and complex residual below `1e-8`, forward-map ranks, fixed
Hamiltonians, and three inverse-word round trips. In the initial run the
worst norms were `6.72e-10` real and `2.30e-14` complex. These tests do
not certify arbitrary nonzero-y source stability or global solver convergence.

**Not implemented:** a chamber-to-word planner; continuous choices of
quotient/kernel gauges; transported atlas transition functions and their
bounded numerical seeds; non-diagonal grading transport; negative-beta
flag rendering; UI chamber crossing; or a test battery for all chambers.

The generalization path is to choose a Weyl word carrying a requested
regular chamber to the certified source chamber, pull its levels back,
construct a stable source representative at those pulled-back levels,
then transport the representative and effective-root labels forward.
Source stability still needs its own certificate or successful balancing;
regularity of the levels alone never certifies a chosen chart. A word
and root basis are not sufficient to make the current UI safe to unlock.
