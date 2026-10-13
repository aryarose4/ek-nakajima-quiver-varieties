// core-math.js — dependency-free, Node-safe port of the frozen E6 math core.
//
// This mirrors the verified Python reference in the standalone repo's
// `sim/e6sim/` package (Milestone 0 conventions/representation/moment maps and
// the V0/V5 geometry). It is the foundation for the browser solver and the
// single-element (su(3) triangle) view. Nothing here is a new mathematical
// claim: it re-expresses the frozen, independently-verified conventions.
//
// Conventions (identical to sim/e6sim):
//   three branches i = 0,1,2, each C^1 -> C^2 -> C^3, common central C^3;
//   matrices a_i (2x1), A_i (3x2), b_i (1x2), B_i (2x3);
//   levels stored 0-based: level[i][0] = outer (alpha_i),
//                          level[i][1] = middle (gamma_i);
//   the level/beta factor of two lives ONLY in betaToLevel;
//   the real Hermitian moment maps have the i/2 factor removed.
//
// Complex numbers are 2-element arrays [re, im]; complex matrices are arrays
// of rows of such pairs.

// ---------------------------------------------------------------------------
// dimensions (Milestone 0)
// ---------------------------------------------------------------------------
export const NB = 3;
export const N_CENTER = 3;
export const N_MIDDLE = 2;
export const N_OUTER = 1;
export const N_GAUGE_REAL = 8 + NB * (4 + 1); // 23

// ---------------------------------------------------------------------------
// complex scalar
// ---------------------------------------------------------------------------
export const c = (re, im = 0) => [re, im];
export const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const cSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cNeg = (a) => [-a[0], -a[1]];
export const cConj = (a) => [a[0], -a[1]];
export const cAbs2 = (a) => a[0] * a[0] + a[1] * a[1];

const _sc = (s) => (typeof s === "number" ? [s, 0] : s);
export const cScale = (a, s) => {
  const t = _sc(s);
  return [a[0] * t[0] - a[1] * t[1], a[0] * t[1] + a[1] * t[0]];
};

// ---------------------------------------------------------------------------
// complex matrices (array of rows of [re,im])
// ---------------------------------------------------------------------------
export function zerosZ(r, cols) {
  return Array.from({ length: r }, () => Array.from({ length: cols }, () => [0, 0]));
}
export function eyeZ(n) {
  const M = zerosZ(n, n);
  for (let i = 0; i < n; i++) M[i][i] = [1, 0];
  return M;
}
export function shapeOf(A) {
  return [A.length, A.length ? A[0].length : 0];
}
export function matMul(A, B) {
  const [r, k] = shapeOf(A);
  const [k2, cc] = shapeOf(B);
  if (k !== k2) throw new Error(`matMul: ${r}x${k} times ${k2}x${cc}`);
  const M = zerosZ(r, cc);
  for (let i = 0; i < r; i++)
    for (let j = 0; j < cc; j++) {
      let s = [0, 0];
      for (let t = 0; t < k; t++) s = cAdd(s, cMul(A[i][t], B[t][j]));
      M[i][j] = s;
    }
  return M;
}
export function matAdd(A, B) {
  return A.map((row, i) => row.map((e, j) => cAdd(e, B[i][j])));
}
export function matSub(A, B) {
  return A.map((row, i) => row.map((e, j) => cSub(e, B[i][j])));
}
export function matScale(A, s) {
  const t = _sc(s);
  return A.map((row) => row.map((e) => cScale(e, t)));
}
export function matAdj(A) {
  const [r, cc] = shapeOf(A);
  const M = zerosZ(cc, r);
  for (let i = 0; i < cc; i++) for (let j = 0; j < r; j++) M[i][j] = cConj(A[j][i]);
  return M;
}
export function matTrace(A) {
  let s = [0, 0];
  for (let i = 0; i < A.length; i++) s = cAdd(s, A[i][i]);
  return s;
}
export function frob2(A) {
  let s = 0;
  for (const row of A) for (const e of row) s += e[0] * e[0] + e[1] * e[1];
  return s;
}
export function frobNorm(A) {
  return Math.sqrt(frob2(A));
}

// ---------------------------------------------------------------------------
// conventions: traceless part and Frobenius-orthonormal Hermitian bases
// ---------------------------------------------------------------------------
export function traceless(M) {
  const n = M.length;
  const t = matTrace(M);
  return matSub(M, matScale(eyeZ(n), cScale(t, 1 / n)));
}

// symmetric off-diagonal, antisymmetric off-diagonal, then diagonal traceless.
export function tracelessHermitianBasis(n) {
  const basis = [];
  for (let j = 0; j < n; j++)
    for (let k = j + 1; k < n; k++) {
      const M = zerosZ(n, n);
      M[j][k] = [1, 0];
      M[k][j] = [1, 0];
      basis.push(matScale(M, 1 / Math.SQRT2));
    }
  for (let j = 0; j < n; j++)
    for (let k = j + 1; k < n; k++) {
      const M = zerosZ(n, n);
      M[j][k] = [0, 1];
      M[k][j] = [0, -1];
      basis.push(matScale(M, 1 / Math.SQRT2));
    }
  for (let m = 1; m < n; m++) {
    const d = new Array(n).fill(0);
    for (let t = 0; t < m; t++) d[t] = 1;
    d[m] = -m;
    const M = zerosZ(n, n);
    for (let i = 0; i < n; i++) M[i][i] = [d[i], 0];
    basis.push(matScale(M, 1 / Math.sqrt(m * (m + 1))));
  }
  return basis;
}

export function hermitianBasis(n) {
  const basis = tracelessHermitianBasis(n);
  basis.push(matScale(eyeZ(n), 1 / Math.sqrt(n)));
  return basis;
}

// Cached bases for the three vertex types.
export const CENTER_BASIS = tracelessHermitianBasis(N_CENTER); // 8, traceless
export const MIDDLE_BASIS = hermitianBasis(N_MIDDLE); // 4, includes trace
export const OUTER_BASIS = hermitianBasis(N_OUTER); // 1

// coord_a = trace(B_a m) because the basis is Frobenius-orthonormal.
export function packHermitian(m, basis) {
  return basis.map((B) => matTrace(matMul(B, m))[0]);
}
export function unpackHermitian(coords, basis) {
  const n = basis.length ? basis[0].length : 0;
  let out = zerosZ(n, n);
  coords.forEach((x, a) => {
    out = matAdd(out, matScale(basis[a], x));
  });
  return out;
}

// Source Lie-algebra level i c I -> Hermitian-equation level 2c.
export function betaToLevel(beta) {
  return beta.map((b) => b.map((x) => 2 * x));
}

// ---------------------------------------------------------------------------
// representation: matrices, validation, unitary gauge action
// ---------------------------------------------------------------------------
export function makeRep(a, A, b, B) {
  return { a, A, b, B };
}

export function validateRep(rep) {
  const ok = (M, r, cc) => Array.isArray(M) && M.length === r && M[0].length === cc;
  const errs = [];
  for (let i = 0; i < NB; i++) {
    if (!ok(rep.a[i], 2, 1)) errs.push(`a[${i}] shape`);
    if (!ok(rep.A[i], 3, 2)) errs.push(`A[${i}] shape`);
    if (!ok(rep.b[i], 1, 2)) errs.push(`b[${i}] shape`);
    if (!ok(rep.B[i], 2, 3)) errs.push(`B[${i}] shape`);
  }
  return errs;
}

// Unitary gauge, per Milestone 0:
//   a_i -> h_i a_i q_i^{-1},  A_i -> g A_i h_i^{-1},
//   b_i -> q_i b_i h_i^{-1},  B_i -> h_i B_i g^{-1}.
// For unitary g, h_i, q_i the inverse is the adjoint.
export function gaugeAction(rep, g, h, q) {
  const a = [], A = [], b = [], B = [];
  for (let i = 0; i < NB; i++) {
    const qinv = cScale(cConj(q[i]), 1 / cAbs2(q[i]));
    a.push(matScale(matMul(h[i], rep.a[i]), qinv));
    A.push(matMul(matMul(g, rep.A[i]), matAdj(h[i])));
    b.push(matScale(matMul(rep.b[i], matAdj(h[i])), q[i]));
    B.push(matMul(matMul(h[i], rep.B[i]), matAdj(g)));
  }
  return makeRep(a, A, b, B);
}

// Diagonal unitary gauges (exact, no QR needed).
// angles: {g:[a,b,cc], h:[[p,q],...], q:[t,...]}
export function diagonalUnitaryGauge(angles) {
  const ph = (t) => [Math.cos(t), Math.sin(t)];
  const g = zerosZ(3, 3);
  g[0][0] = ph(angles.g[0]);
  g[1][1] = ph(angles.g[1]);
  g[2][2] = ph(angles.g[2]);
  const h = angles.h.map(([p, q2]) => {
    const M = zerosZ(2, 2);
    M[0][0] = ph(p);
    M[1][1] = ph(q2);
    return M;
  });
  const q = angles.q.map(ph);
  return { g, h, q };
}

// ---------------------------------------------------------------------------
// moment maps
// ---------------------------------------------------------------------------
export function complexResidual(rep) {
  const outer = [], middle = [];
  let center = zerosZ(N_CENTER, N_CENTER);
  for (let i = 0; i < NB; i++) {
    const ai = rep.a[i], Ai = rep.A[i], bi = rep.b[i], Bi = rep.B[i];
    outer.push(matMul(bi, ai));
    middle.push(matSub(matMul(Bi, Ai), matMul(ai, bi)));
    center = matSub(center, matMul(Ai, Bi));
  }
  return { outer, middle, center: traceless(center) };
}

export function complexResidualNorm(rep) {
  const r = complexResidual(rep);
  let s = 0;
  for (const m of r.outer) s += frob2(m);
  for (const m of r.middle) s += frob2(m);
  s += frob2(r.center);
  return Math.sqrt(s);
}

export function realMaps(rep) {
  const outer = [], middle = [];
  let center = zerosZ(N_CENTER, N_CENTER);
  for (let i = 0; i < NB; i++) {
    const ai = rep.a[i], Ai = rep.A[i], bi = rep.b[i], Bi = rep.B[i];
    outer.push(matSub(matMul(matAdj(ai), ai), matMul(bi, matAdj(bi))));
    // R_i2 = A^*A - B B^* - a a^* + b^* b
    middle.push(
      matAdd(
        matSub(matMul(matAdj(Ai), Ai), matMul(Bi, matAdj(Bi))),
        matSub(matMul(matAdj(bi), bi), matMul(ai, matAdj(ai)))
      )
    );
    // center += -A A^* + B^* B
    center = matAdd(
      center,
      matAdd(matScale(matMul(Ai, matAdj(Ai)), -1), matMul(matAdj(Bi), Bi))
    );
  }
  return { outer, middle, center: traceless(center) };
}

export function realResidual(rep, levels) {
  const raw = realMaps(rep);
  const outer = [], middle = [];
  for (let i = 0; i < NB; i++) {
    outer.push(matSub(raw.outer[i], matScale(eyeZ(N_OUTER), levels[i][0])));
    middle.push(matSub(raw.middle[i], matScale(eyeZ(N_MIDDLE), levels[i][1])));
  }
  return { outer, middle, center: raw.center };
}

// 23 orthonormal Hermitian coordinates: 3 outer (1 each) + 3 middle (4) + 8.
export function packRealResidual(rep, levels) {
  const r = realResidual(rep, levels);
  const parts = [];
  for (let i = 0; i < NB; i++) parts.push(...packHermitian(r.outer[i], OUTER_BASIS));
  for (let i = 0; i < NB; i++) parts.push(...packHermitian(r.middle[i], MIDDLE_BASIS));
  parts.push(...packHermitian(r.center, CENTER_BASIS));
  return parts;
}

export function realResidualNorm(rep, levels) {
  return Math.hypot(...packRealResidual(rep, levels));
}

export function branchTraces(rep) {
  return rep.A.map((Ai, i) => {
    const Bi = rep.B[i];
    const T = matSub(matMul(Ai, matAdj(Ai)), matMul(matAdj(Bi), Bi));
    return matTrace(T)[0];
  });
}

// ---------------------------------------------------------------------------
// geometry (V0 + V5)
// ---------------------------------------------------------------------------
export function extractGeometry(rep, levels) {
  const T = [], Q = [], q = [], K = [], Cf = [], Ff = [];
  for (let i = 0; i < NB; i++) {
    const X = rep.A[i], Y = rep.B[i];
    const Ti = matSub(matMul(X, matAdj(X)), matMul(matAdj(Y), Y));
    const t = matTrace(Ti)[0];
    const Qi = matSub(Ti, matScale(eyeZ(3), t / 3));
    T.push(Ti);
    Q.push(Qi);
    q.push(packHermitian(Qi, CENTER_BASIS));
    const Ki = matMul(X, Y);
    K.push(Ki);
    Cf.push(matScale(matAdd(Ki, matAdj(Ki)), 0.5));
    Ff.push(matScale(matSub(Ki, matAdj(Ki)), [0, -0.5]));
  }
  // closure sum_i Q_i and sum_i K_i
  let closure = zerosZ(3, 3);
  let closureK = zerosZ(3, 3);
  for (let i = 0; i < NB; i++) {
    closure = matAdd(closure, Q[i]);
    closureK = matAdd(closureK, K[i]);
  }
  const pairwise = Q.map((Qi, i) => Q.map((Qj) => {
    // trace(Qi Qj) is real
    return matTrace(matMul(Qi, Qj))[0];
  }));
  return {
    T, Q, q, K, C: Cf, F: Ff,
    closure,
    closureError: frobNorm(closure),
    closureK,
    closureKError: frobNorm(closureK),
    edgeNorms: q.map((qi) => Math.hypot(...qi)),
    pairwise,
    branchTraces: T.map((Ti) => matTrace(Ti)[0]),
    branchTracesExpected: levels.map((L) => L[0] + 2 * L[1]),
  };
}

// trace(Q_i Q_j) = (||Q_k||^2 - ||Q_i||^2 - ||Q_j||^2)/2 for a closing triple.
export function triangleSideFromPairwise(pairwise, i, j, k) {
  return (pairwise[k][k] - pairwise[i][i] - pairwise[j][j]) / 2;
}
