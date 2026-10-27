# E7 Endpoint Charts And Exact King Weights

This is a bounded extension of `E7_OPEN_CHART.md`, at its fixed regular levels. It is not the full seven-component exceptional atlas.

## Raw Endpoint Status

The two full flags remain standard/opposite. Let s_j denote their total coefficient on coordinate axis e_j. In units 1/10000,

    s = [30007,30038,30052,30056], lambda = 130281/40000.

For a coordinate two-plane U with dim(U intersect W)=1, its King weight is s(U)+level_short-2 lambda. A single vanishing Pluecker minor creates precisely one formerly marginal such U (the complement of the minor's row indices). Every other proper U keeps a uniformly negative weight by the projector/integer-gap argument in the open-chart document.

* Original W(z)=[I2;[[1,1],[1,z]]] at z=0: U=span(e2,e3), weight +54/40000 = +0.00135. Unstable.
* Original W(z) at z=1: U=span(e1,e2), weight -126/40000 = -0.00315. Stable.
* Raw reciprocal Wraw(w)=[I2;[[1,w],[1,1]]] at w=0: U=span(e2,e4), weight +70/40000 = +0.00175. Unstable.

For the original finite chart use T=[[z,-z],[-z,1]]. For the raw reciprocal chart use T=[[-w,w],[1,-w]], N=[-M,I2]. All reverse arrows are built from K=W T N and -strictUpper(K), -strictLower(K), as before. At either unstable endpoint, its indicated U is preserved by ALL three K endomorphisms, and the short reverse arrow sends U to zero. The induced maximal vertex subspaces therefore remain a subrepresentation for every finite cotangent parameter. Thus these raw endpoints are unstable for ALL p (or q), not just on the zero section. No raw endpoint here is strictly semistable at the regular levels. Numerical nonconvergence alone would not establish any of these classifications.

## Two Stable Cotangent Charts

North chart, finite z in C:

    W_N(z) = [[1,0],[0,1],[z,1],[1,1]],
    T_N(z) = [[1,-z],[-z,z]],   N_N=[-M_N,I2].

South chart, finite w in C:

    W_S(w) = [[1,0],[0,1],[1,1],[w,1]],
    T_S(w) = [[-w,1],[w,-w]],   N_S=[-M_S,I2].

Build all reverse arrows using the common construction, multiplied by p_N or p_S respectively. The diagonal entries of K vanish identically, NW=0, and the complex moments are zero. Tautological one-forms are p_N dz and p_S dw: the varying W_N entry is row3,column1, paired with (T_N N_N) row1,column3=1; the varying W_S entry is row4,column1, paired with row1,column4=1.

North minors (12,13,14,23,24,34): [1,1,1,-z,-1,z-1]. South minors: [1,1,1,-1,-w,1-w]. The only special finite base values are 0 and 1. North z=0 has U=span(e1,e4), weight -54/40000. South w=0 has U=span(e1,e3), weight -70/40000. At z=w=1 both have U=span(e1,e2), weight -126/40000. All are strictly stable; the open-case proof covers every other finite base value. As before x-stability implies (x,y)-stability for every finite cotangent value. Thus both whole charts are stable at these levels.

## Explicit Gauge Transitions

The original chart at z != 0 maps to north using D=diag(1,z,z,1), g=sD with s^4=z^-2, and short-node gauge h=s diag(1,z). On each full arm take the restriction of g to that coordinate flag, written in its standard/reversed basis. These peripheral gauges preserve every forward inclusion, and send W_original to W_N. Direct multiplication gives p_N=p_original, including reverse arrows.

On the north/south overlap z !=0, w=1/z,

    p_S = -p_N / w^2,
    D = diag(1,w,w,w),  g=sD with s^4=w^-3,
    h_short = s diag(1,w).

The full-arm gauges again are the restrictions of g in their flag bases. Then g has determinant one, and x'=g_target x g_source^-1, y'=g_source y g_target^-1 sends the WHOLE north representation to the south representation with the displayed parameter transition. The fourth root is chosen locally on the overlap; its alternatives differ by the common ineffective scalar central kernel. There is no single-valued global fourth-root gauge choice being asserted. The cotangent transition also follows from p_N dz=p_S dw.

The raw reciprocal chart maps to south for w !=0 using D=diag(1,w,1,w), s^4=w^-2, h_short=s diag(1,w); its cotangent parameter is unchanged.

## Scope

These two charts give the cotangent bundle of the stable forward-flag quotient P1 inside the quiver variety. They replace unstable raw endpoint representatives by genuinely different stable limiting orbits; they do not gauge-transform the unstable endpoint itself. This does not cover limits at infinite cotangent parameter or configurations outside these injective, opposite-full-flag representatives. In particular it is not a completed seven-sphere E7 atlas or an identification of all other core components.

## Next Bounded Chart Problem

The base is now covered; the remaining boundary problem is cotangent infinity. On the north chart det(T_N)=z(1-z); on the south chart det(T_S)=w(w-1). Thus the cotangent endomorphism drops from rank two to rank one precisely above the three base points 0,1,infinity (for nonzero fiber coordinate). These are distinguished directions for investigating new boundary charts. Rank alone does not identify the remaining exceptional components or prove that a given large-fiber path has a compact limit.

A next experiment should follow the balanced representatives as |p_N| grows above z=0 and z=1, and as |p_S| grows above w=0; measure gauge growth, then derive any required rescaling in v=1/p before extending to a candidate tip chart. The limiting representatives must satisfy the complex equations and their own stability inequalities. Neither a large solver gauge nor an apparent finite rendered limit is sufficient evidence of a new chart.

## Implemented And Numerically Checked

`assets/js/ek-nakajima/e7-atlas.js` exports `makeE7AtlasChart(chart,base,fiber)` for north/south and `transitionE7NorthToSouth(base,fiber)`, returning the south coordinates and all-node gauge/inverse. The prototype UI remains unchanged; the new atlas is a separately tested mathematical module.

    node tests/validate-e7-endpoint-stability.mjs
    node tests/validate-e7-atlas.mjs

The integer certificate checks 2173 dimension bounds per endpoint and obtains the weights above without floating-point decisions. The arrow battery verifies the raw destabilizing subrepresentation for zero, small complex, and large complex cotangent values. The maximum tested complex-moment residual is 3.56e-15; full forward/reverse overlap error is 1.79e-15, with determinant-one central gauge and the canonical cotangent transition independently checked.

At fiber 0.02+0.01i, cold balancing of north0, north1, south0 takes 14,11,14 iterations, with real residuals 9.08e-12,5.59e-11,6.43e-13. Nearby complex continuation also converges. Independently balanced north/south overlap representatives agree in their central-arm Frobenius norms within 1.51e-13 (these are unitary-invariant comparisons, not raw matrix equality). Bounded 20-iteration raw0/rawInfinity solves fail with residuals approximately 0.002346 and 0.001186; their instability is proved by the exact weights, not inferred from these numerical failures.
