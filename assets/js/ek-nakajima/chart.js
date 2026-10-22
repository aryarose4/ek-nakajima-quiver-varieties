// chart.js — dependency-free, Node-safe port of the candidate finite
// ``y = 0`` chart from sim/e6sim/charts.py (Milestone 1).
//
// The chart is the conversation's candidate family, with ``z = r exp(i theta)``:
//
//   a_1 = a_2 = a_3 = [[1], [0]]
//
//   A_1 = [[1, 0],        A_2 = [[0, 1],        A_3 = [[0, 1],
//          [0, 1],               [1, 0],               [0, z],
//          [0, 1]]               [0, 1]]               [1, 0]]
//
//   b_i = 0,   B_i = 0.
//
// All ``y`` matrices vanish, so the complex moment-map equations at tau = 0
// hold identically. This says nothing about stability or coverage; those live
// in sim/e6sim/stability.py and sim/e6sim/atlas.py.
//
// Complex numbers are 2-element arrays [re, im]; complex matrices are arrays
// of rows of such pairs (the core-math convention).

import { makeRep, cMul, cSub, cScale, matScale } from "./core-math.js";

// Convert a nested array whose leaves are numbers or [re, im] pairs into the
// core-math complex-matrix representation (leaves are always [re, im]).
const Z = (rows) => rows.map((r) => r.map((e) => (Array.isArray(e) ? [e[0], e[1]] : [e, 0])));

// ---------------------------------------------------------------------------
// chart matrices
// ---------------------------------------------------------------------------
// candidateY0Chart(z): z is a complex [re, im]. Returns a core-math rep
// {a, A, b, B} of complex matrices with a_i = [[1],[0]], the three A_i above
// with A_3 carrying z, and b = B = 0.
export function candidateY0Chart(z) {
  const zc = Array.isArray(z) ? [z[0], z[1]] : [z, 0];
  const a = [Z([[1], [0]]), Z([[1], [0]]), Z([[1], [0]])];
  const A = [
    Z([[1, 0], [0, 1], [0, 1]]),
    Z([[0, 1], [1, 0], [0, 1]]),
    Z([[0, 1], [0, zc], [1, 0]]),
  ];
  const b = [Z([[0, 0]]), Z([[0, 0]]), Z([[0, 0]])];
  const B = [
    Z([[0, 0, 0], [0, 0, 0]]),
    Z([[0, 0, 0], [0, 0, 0]]),
    Z([[0, 0, 0], [0, 0, 0]]),
  ];
  return makeRep(a, A, b, B);
}

// ---------------------------------------------------------------------------
// convenience: the chart parameter z = r exp(i theta)
// ---------------------------------------------------------------------------
// chartZ(r, theta) -> the complex [re, im] = r (cos theta, sin theta).
export function chartZ(r, theta) {
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

// chartAt(r, theta) -> the chart rep at z = r exp(i theta).
export function chartAt(r, theta) {
  return candidateY0Chart(chartZ(r, theta));
}

// Compact radial coordinate: z = r exp(i theta)/(1-r), 0 <= r <= 1.
// Scale the second column of A_3 by 1-r before taking the endpoint. The
// resulting map stays finite and rank two even at z=infinity. For r<1 this
// is a change of basis in the third C^2, preserving its first basis vector.
export function compactChart(r, theta) {
  if (!Number.isFinite(r) || r < 0 || r > 1 || !Number.isFinite(theta)) {
    throw new RangeError("Expected 0 <= r <= 1 and finite theta.");
  }
  const rep = candidateY0Chart(0);
  rep.A[2] = Z([[0, 1 - r], [0, chartZ(r, theta)], [1, 0]]);
  return rep;
}

// M5 transverse cotangent chart, matching sim/e6sim/transverse.py.
// The trace pairing <dx/dz,Y>=B_3[1][1]=1 fixes its normalization.
// BA=ab and sum AB=0 are polynomial identities for every complex z,w.
// Complex moment-map validity does not assert stability or global coverage.
export function transverseChart(z, w = 1) {
  const zc = Array.isArray(z) ? z : [z, 0];
  const wc = Array.isArray(w) ? w : [w, 0];
  if (!zc.concat(wc).every(Number.isFinite)) throw new RangeError("Expected finite complex z and w.");
  const rep = candidateY0Chart(zc);
  const zz = cMul(zc, zc), neg = cScale(zc, -1);
  const d = cSub(zz, zc);
  rep.b = [Z([[0, cSub(zc, [1, 0])]]), Z([[0, d]]), Z([[0, d]])].map(m => matScale(m, wc));
  rep.B = [
    Z([[0, -1, zc], [0, neg, zc]]),
    Z([[zz, 0, neg], [zc, 0, neg]]),
    Z([[neg, zc, 0], [neg, 1, 0]])
  ].map(m => matScale(m, wc));
  return rep;
}

// Finite compact-gauge extension of M5. Set s=1-r, u=r exp(i theta),
// z=u/s and w=s^2 eta, eta=t/(1-t) exp(i phi). Transform middle vertex 3
// by diag(1,1/s): A_3 -> A_3 diag(1,s), b_3 -> b_3 diag(1,s),
// B_3 -> diag(1,1/s) B_3. The formulas below are polynomial in s,u;
// therefore they extend to r=1 without dividing by zero. This is a chosen
// fiber trivialization, not a global coordinate atlas. Endpoint stability
// and Morse-limit transitions require separate analysis; t=1 is not finite.
export function compactTransverseChart(r, theta, t = 0, phi = 0) {
  const rep = compactChart(r, theta);
  if (!Number.isFinite(t) || t < 0 || t >= 1 || !Number.isFinite(phi)) {
    throw new RangeError("Expected 0 <= t < 1 and finite phi; t=1 requires a limit chart.");
  }
  const s = 1 - r, u = chartZ(r, theta), su = cScale(u, s);
  const uu = cMul(u, u), minusSU = cScale(su, -1), d = cSub(uu, su);
  const eta = chartZ(t / (1 - t), phi);
  rep.b = [Z([[0, cSub(su, [s * s, 0])]]), Z([[0, d]]), Z([[0, cScale(d, s)]])]
    .map(m => matScale(m, eta));
  rep.B = [
    Z([[0, -s * s, su], [0, minusSU, su]]),
    Z([[uu, 0, minusSU], [su, 0, minusSU]]),
    Z([[minusSU, su, 0], [cScale(u, -1), s, 0]])
  ].map(m => matScale(m, eta));
  return rep;
}
