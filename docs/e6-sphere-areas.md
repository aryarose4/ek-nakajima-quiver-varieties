# E6 sphere areas

The Parameters panel uses the compact levels `a_i = beta_i^(1)`,
`g_i = beta_i^(2)`, with `T = sum_i(a_i + 2*g_i)`.
The Hermitian solver levels are twice these beta values. The live default
pairs are `(1.23,.40), (1.64,1.41), (1.06,1.82)`.

The formulas below use the initial chamber. The reference beta pairs are
`(3/2,1/2), (3/2,21/20), (3/2,3/2)`; the table evaluates their periods.
Live chamber crossings transport the ordered curve classes; see the
[chamber transport notes](e6-chamber-transport.md) and
[wall-control notes](e6-wall-controls.md).

## Periods and rendered radii

In the initial chamber the following periods are the symplectic areas
divided by `2*pi`, with first/second counted outward from the central sphere:

| Component | Area / (2*pi) | Original reference fixture |
| --- | --- | --- |
| Central | `g_1` | `1/2` |
| r=0, first | `T/3 - a_2 - g_1 - g_2` | `29/60` |
| r=0, second | `(-2*a_1+a_2+a_3-g_1+2*g_2-g_3)/3` | `1/30` |
| r=1, first | `T/3 - a_3 - g_1 - g_3` | `1/30` |
| r=1, second | `(-2*a_1+a_2+a_3-g_1-g_2+2*g_3)/3` | `29/60` |
| r=1/2, short | `(sum_i a_i - sum_i g_i)/3` | `29/60` |

The rendered spheres use radii `sqrt(Area/(4*pi))`, so their surface areas
match these symplectic areas. Roundness and the surrounding embedding are
schematic; the drawing does not represent the intrinsic metric. At extreme
allowed beta values, the fixed attachment directions can make nonadjacent
round spheres overlap; those apparent intersections do not change the E6
incidence graph. Adjacent tangencies remain exact.

## Moment-map derivation

For the flat form `(i/2) sum dz wedge dbar(z)`, the positive Hamiltonian
of `y -> exp(i*theta)*y` is `F = ||y||^2/2`, with theta period `2*pi`.
Multiplying the real moment equations by a compensating fixed grading
and tracing gives

```
F = (T/3) Tr H_center - sum_i(a_i Tr H_outer_i + g_i Tr H_middle_i).
```

The central fixed sphere has F=0. The first fixed points along r=0 and
r=1 have F equal to their first periods above. The exterior tips have
`F_02=-a_1+a_3-g_1+g_2` and `F_12=-a_1+a_2-g_1+g_3`.
The short tip has F equal to its period. Action-angle integration gives
`Area = 2*pi*Delta F/m`, where m is the generic stabilizer order.
The first long spheres and short sphere have m=1; the second long spheres
have `m=2`, since their local coordinate has circle weight two.
Equivalently, using the squared norm itself gives `Area=pi*Delta||y||^2/m`.

The central area needs a separate argument because F is constant there.
At y=0, reduction of a leg gives a flag orbit with Kahler class
`2*pi*(a_i H_line + g_i H_plane)`. The compact central chart holds all
three lines and planes 2 and 3 fixed, while plane 1 traces a projective
line with degree one. The remaining SL(3) quotient introduces no
character degree. Thus its area is exactly `2*pi*g_1`.

## Chamber scope and root identification

For a bounded affine real root d=(c; m_i; o_i), the wall is
`W_d=sum_i[(o_i-c/3)*a_i + (m_i-2*c/3)*g_i]=0`.
The initial chamber is specified by the signs of these 72 roots (36 walls).
Its clipping uses a positive 1e-7 margin in each signed wall form.

An exact root-lattice check identifies the six periods above with the
six positive indecomposable E6 roots in this chamber. Delete outer vertex
3 and use finite vertex order `(center,outer1,middle1,outer2,middle2,middle3)`;
pair roots with `(-T/3,a_1,g_1,a_2,g_2,g_3)`. The roots, in table order, are

```
( 0, 0, 1, 0, 0, 0)
(-1, 0,-1,-1,-1, 0)
(-1,-1,-1, 0, 0,-1)
( 2, 1, 1, 1, 2, 1)
(-1,-1,-1, 0,-1, 0)
(-1, 0,-1, 0,-1,-1)
```

Their Cartan Gram matrix has diagonal 2, central-to-first/short entries
-1, first-to-second entries -1, and all other entries zero. The standard
ADE period description extends this to other regular chambers by choosing
the positive indecomposable roots for that chamber and pairing with the
levels. This yields chamberwise linear areas, but changes the effective
component labels: taking absolute values of these six formulas does not
supply a global continuation of the current atlas. The live chamber graph
instead transports the atlas and its ordered curve classes through Weyl
reflection words, evaluating each area's linear form on the pulled-back
source parameters. Negative-beta flag displays remain unsupported.

The fixed-point formulas were also checked against 15 balanced representatives
at three level vectors in this chamber, with moment errors below 9e-10.
The area derivation above uses the grading and action-angle calculation.
