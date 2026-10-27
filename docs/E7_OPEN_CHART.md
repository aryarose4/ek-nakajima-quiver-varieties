# E7 Open Cotangent Chart - Derived Specification

## Conventions And Dimension

No framing. Central SL(4,C), two full arms 1 -> 2 -> 3 -> 4 and a short arm 2 -> 4. Gauge dimension 47; forward-arrow dimension 48; expected complex quotient dimension 2. Seven levels ordered A1,A2,A3,B1,B2,B3,C2, equal to twice beta in one conversion function only.

## Complex Chart

Use standard full flag A and reversed-coordinate full flag B. Put W(z)=[I2;M], M=[[1,1],[1,z]], z outside {0,1}. Its six Pluecker coordinates are 1,1,z,-1,-1,z-1. The torus-invariant ratio p12 p34/(p13 p24)=1-z proves z is a genuine quotient parameter. All six minors nonzero imply the diagonal stabilizer is scalar; central SL restricts it to a finite group. This covers an open chart only, not the exceptional divisor atlas.

Explicit cotangent: N=[-M,I2], T=[[z,-z],[-z,1]], K=W T N. Since NW=0, K W=0 and image K lies in W. Its four diagonal entries vanish exactly. Set central endomorphisms KA=-strictUpper(K), KB=-strictLower(K), KC=K. Their sum is zero. In each full-flag frame F (I4 or coordinate reversal), C=F^-1 Ki F is strictly upper triangular. Forward arrows are inclusions Jk:Ck -> C(k+1), except top F J3. Reverse arrows are the first k rows and first k+1 columns of C (top multiplied by F^-1). Short reverse arrow is T N. Multiply ALL reverse arrows by p in C. Then yk xk=x(k-1)y(k-1), short yx=0 and central sum xy=0 exactly. No conjugates occur in this construction.

## Gauge And Real Equations

Gauge action: x_e -> g_target x_e g_source^-1, y_e -> g_source y_e g_target^-1. Real equations after removing i/2: at each noncentral node, xout* xout - yout yout* - xin xin* + yin* yin = level I; central traceless sum(-x x*+y* y)=0. Pack in orthonormal Hermitian bases, 47 real components. Positive Hermitian gauges exp(S/2), central traceless S; directly recompute both residuals before declaring success.

## Stable Fixture And Its Scope

Take long levels all 1 and short level epsilon=1/2. For any d-dimensional central U, d=1,2,3, the two opposite full flags have total intersection sum at most 3d. Indeed dim(U intersect F) <= trace(P_U P_F) for orthogonal projectors, and the six flag projectors sum to 3I. Equality requires P_U to commute with every flag projector, hence U is coordinate.

If the inequality is strict, its integer gap is at least 1, while the short-arm contribution epsilon(dim(U intersect W)-d/2) is at most epsilon < 1. If equality holds, all six nonzero Pluecker coordinates imply dim(U intersect W)=max(0,d-2), making that short contribution strictly negative. Thus maximal-subrepresentation King weight sum(level dim intersections) - (3+epsilon/2)d is strictly negative. Positive levels justify replacing each vertex subspace by the maximal allowed intersection. Central U=0 gives only the zero subrepresentation because all forward arrows inject; U=C4 with any proper peripheral subspace has smaller weight and is also strictly negative.

Consequently the forward-arrow representation is stable throughout z outside {0,1} at these levels. Every subrepresentation of (x,y) is a subrepresentation of x, so the same strict inequality proves stability for ALL p in C, not only p=0. This is an algebraic stability proof, not a numerical convergence guarantee. Arbitrary beta, exceptional endpoints and global atlas coverage remain unsupported.

## 3D Picture

Full flags in C4 are projective point contained in line contained in plane in CP3; the short C2 gives a projective line. On the real slice these sit literally in RP3, using an affine chart and clipping near infinity. For complex data the real-part affine projection of a selected real-coefficient slice is a display only; complex incidence is checked before projection. General complex lines and planes do not project faithfully to real lines and planes. Never claim literal projected incidence for all complex flags or describe this as an su4 polygon.

## Regular Default Levels

The symmetric fixture above lies on root walls, although this particular open chart consists of stable points. The prototype instead uses regular levels

    [1.0001, 1.0002, 1.0004, 1.0008, 1.0016, 1.0032, 0.5064]

in arm order A1,A2,A3,B1,B2,B3,C2. Beta is half this tuple. The exact integer numerators over 10000 are [10001,10002,10004,10008,10016,10032,5064]. The sum weighted by vertex dimensions is 130281/10000, so the auxiliary central King weight is -130281/40000. This King weight is bookkeeping for subrepresentations, not an extra U(4) level: the actual central moment equation remains traceless SL(4).

The weighted absolute perturbation from the symmetric fixture is 281/10000, less than its uniform strict King margin 1/4, hence stability survives throughout the same open chart for every p. The independent exact integer battery `tests/validate-e7-stability.mjs` verifies the stronger direct inequalities for 2173 possible dimension bounds and coordinate subspaces; its largest King weight is -10003/40000. It also enumerates the 126 vectors 0 <= d <= delta with affine Tits form q(d)=1, finding no zero parameter pairing (smallest absolute pairing 42/40000). This is the affine E7 real-root regularity check; it does not construct the exceptional-divisor atlas.

## Cotangent Normalization And Coverage

Only the short forward arrow W depends on z, and its derivative has sole nonzero entry (row 4,column 2)=1. The corresponding short reverse entry is y(row 2,column 4)=p. Thus the tautological one-form sum tr(y dx) restricts to p dz. In particular p is a genuine cotangent coordinate, not an arbitrary amplitude relabeling.

Every pair of opposite full flags can be normalized to the standard/reversed pair. Their residual diagonal torus normalizes a generic plane graph to the displayed M by setting three nonzero entries to 1; the fourth is z. Nonzero six minors say precisely z != 0,1 in this normalization. Its stabilizer is scalar, so the forward gauge differential has rank 47. The moment-map annihilator in the 48-dimensional reverse-arrow space consequently has dimension one, and the displayed nonzero reverse-arrow tuple spans it. These facts establish a genuine local open cotangent parameterization with coordinates (z,p). They do not cover configurations with non-opposite full flags, degenerate Pluecker minors, or chart infinity. New representatives and transition maps are required for a global E7 atlas.

## Verification Commands

    node tests/validate-e7-core.mjs
    node tests/validate-e7-stability.mjs

The algebraic chart equations, stability inequalities and exact root certificate are distinct from numerical convergence. The solver directly checks real and complex residuals. A successful solve establishes the tested point to its stated tolerance; a failed solve is not an instability certificate.

## Prototype And Checked Milestone

Open `e7-prototype.html` through a local HTTP server. It runs the independent E7 worker/renderer and does not change the E6 widget. Additional checks:

    node tests/validate-e7-geometry.mjs
    node tests/validate-e7-prototype.mjs

The tested regular real fixture balanced in seven iterations, with real residual 2.57e-11 and complex residual zero. A browser sample z=2+0.2i, p=0.03i balanced in three warm-start iterations, with real residual 1.14e-11 and complex residual below 2.7e-16. Browser review also checked the explicit complex projection note, a 390-pixel mobile layout without horizontal overflow, and invalid z=0 clearing the geometry and reporting failure without JavaScript errors. These are bounded numerical/UI checks, not global convergence or continuity claims.
