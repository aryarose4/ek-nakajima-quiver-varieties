// element-view.js — dependency-free, Node-safe ES module implementing
// visualizer milestone V2: the weighted-flag geometry at y = 0 and its
// projected su(3) "triangle + flag marker" display data.
//
// Mirrors the verified Python V1 reference `sim/e6sim/flags.py` exactly for the
// flag geometry (line/plane projectors, the traceless central moment map
// decomposition, eigenvalues and squared norms), and adds the V2 projection
// into R^3 described in `sim/E6_Quiver_Simulation_Milestones.md`.
//
// It imports only from `./core-math.js`. Pure: no solver, no UI, no state.
//
// Conventions (identical to core-math / sim/e6sim):
//   u_i = a_i (x_i^(1), 2x1), X_i = A_i (x_i^(2), 3x2);
//   levels[i][0] = alpha_i (outer), levels[i][1] = gamma_i (middle);
//   L_i = image(X_i u_i),  P_i = image(X_i);
//   Pi_Li = ell ell^* / ||ell||^2, Pi_Pi = orthogonal projector onto col(X_i);
//   d_Li = Pi_Li - I/3,  d_Pi = Pi_Pi - 2 I/3,  Q_i = traceless(X_i X_i^*).

import {
  NB,
  CENTER_BASIS,
  eyeZ,
  matAdd,
  matAdj,
  matMul,
  matScale,
  matSub,
  frob2,
  frobNorm,
  traceless,
  packHermitian,
} from "./core-math.js";

// Relative rank / collinearity tolerances (matching sim/e6sim/flags.py).
const RANK_REL_TOL = 1e-10;
const FRAME_ABS_TOL = 1e-9;

// The single, canonical non-injectivity disclaimer. Exported so callers (e.g.
// widget.js) render exactly this string instead of re-typing a copy that could
// drift from the value returned in `notes.injectivity`.
export const INJECTIVITY_NOTE =
  "the 3D marker picture is a projection of the 8D su(3) data and is NOT " +
  "claimed to be injective on the moduli space.";

// ---------------------------------------------------------------------------
// complex matrix helpers (columns, inner product, outer product, determinant)
// ---------------------------------------------------------------------------
function colOf(X, j) {
  return X.map((row) => [row[j]]);
}

// <a, b> = conj(a)^T b for two 3x1 complex columns; returns a complex pair.
function innerZ(a, b) {
  let re = 0;
  let im = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i][0];
    const y = b[i][0];
    re += x[0] * y[0] + x[1] * y[1];
    im += x[0] * y[1] - x[1] * y[0];
  }
  return [re, im];
}

function outerProduct(a) {
  return matMul(a, matAdj(a));
}

// ---------------------------------------------------------------------------
// flag projectors (V1)
// ---------------------------------------------------------------------------
export function lineProjector(ell) {
  // Rank-1 projector onto span(ell), ell a 3x1 complex column.
  const n2 = frob2(ell);
  if (!(n2 > 0) || !isFinite(n2)) {
    throw new Error("elementView: zero/non-finite line vector X_i u_i");
  }
  return matScale(outerProduct(ell), 1 / n2);
}

export function planeProjector(X) {
  // Orthogonal projector onto col(X), X a 3x2 complex matrix, via
  // Gram-Schmidt on the two columns (NO Gram-matrix inverse) with an explicit
  // rank-2 check against the largest singular value.
  const c0 = colOf(X, 0);
  const c1 = colOf(X, 1);
  const n0 = frob2(c0);
  const n1 = frob2(c1);
  const b = innerZ(c0, c1);
  const bAbs2 = b[0] * b[0] + b[1] * b[1];
  // S0^2 = larger eigenvalue of X^* X = [[n0, b], [conj b, n1]].
  const S0sq = ((n0 + n1) + Math.sqrt((n0 - n1) * (n0 - n1) + 4 * bAbs2)) / 2;
  if (!(S0sq > 0) || !isFinite(S0sq)) {
    throw new Error("elementView: X_i has no nonzero singular values");
  }
  // Start Gram-Schmidt with the larger column for conditioning.
  let v1 = c0;
  let v2 = c1;
  if (n1 > n0) {
    v1 = c1;
    v2 = c0;
  }
  const nv1 = frob2(v1);
  const e1c = matScale(v1, 1 / Math.sqrt(nv1));
  const w = matSub(v2, matScale(e1c, innerZ(e1c, v2)));
  const nw = frob2(w); // = S1^2, the second singular value squared
  if (!(nw > RANK_REL_TOL * RANK_REL_TOL * S0sq)) {
    throw new Error("elementView: X_i is not rank 2 (plane projector undefined)");
  }
  const e2c = matScale(w, 1 / Math.sqrt(nw));
  return {
    Pi_P: matAdd(outerProduct(e1c), outerProduct(e2c)),
    singularValues2: [S0sq, nw],
  };
}

// ---------------------------------------------------------------------------
// eigenvalues of a 3x3 Hermitian matrix (scaled complex Jacobi)
// ---------------------------------------------------------------------------
export function eigvalsHermitian3(Q) {
  // Shift before scaling to preserve small gaps on a large common diagonal.
  // A zero shift handles finite diagonal differences that would overflow.
  // No squared invariants or cubic discriminant are formed.
  let shift = Q[0][0][0];
  if (Q.some((row, i) => !Number.isFinite(row[i][0] - shift))) shift = 0;
  const diagonal = Q.map((row, i) => row[i][0] - shift);
  let scale = Math.max(...diagonal.map(Math.abs));
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      scale = Math.max(scale, Math.abs(Q[i][j][0]), Math.abs(Q[i][j][1]));
    }
  }
  if (scale === 0) return [shift, shift, shift];
  const A = Q.map((row, i) => row.map((z, j) =>
    i === j ? [diagonal[i] / scale, 0] : [z[0] / scale, z[1] / scale]));

  // Maximum-pivot unitary Jacobi rotations. The phase of A[p][q] makes its
  // 2x2 rotation real; the stable tangent formula covers equal diagonals.
  // Three dimensions converge in a handful of rotations; 32 is a safe cap.
  for (let iteration = 0; iteration < 32; iteration++) {
    let p = 0, q = 1, off = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const magnitude = Math.hypot(...A[i][j]);
        if (magnitude > off) { p = i; q = j; off = magnitude; }
      }
    }
    const size = Math.max(...A.map((row, i) => Math.abs(row[i][0])));
    if (off === 0 || off <= Number.EPSILON * size) break;
    const u = A[p][q].map((x) => x / off);
    const delta = (A[q][q][0] - A[p][p][0]) / 2;
    const t = (delta < 0 ? -1 : 1) * off / (Math.abs(delta) + Math.hypot(delta, off));
    const c = 1 / Math.hypot(1, t), s = t * c;
    A[p][p][0] -= t * off;
    A[q][q][0] += t * off;
    A[p][q] = A[q][p] = [0, 0];
    for (let k = 0; k < 3; k++) {
      if (k === p || k === q) continue;
      const x = A[k][p], y = A[k][q];
      const xp = [c * x[0] - s * (u[0] * y[0] + u[1] * y[1]),
        c * x[1] - s * (u[0] * y[1] - u[1] * y[0])];
      const yq = [s * (u[0] * x[0] - u[1] * x[1]) + c * y[0],
        s * (u[0] * x[1] + u[1] * x[0]) + c * y[1]];
      A[k][p] = xp; A[p][k] = [xp[0], -xp[1]];
      A[k][q] = yq; A[q][k] = [yq[0], -yq[1]];
    }
  }
  return A.map((row, i) => {
    const value = row[i][0] * scale;
    return Number.isFinite(value) ? shift + value : (shift / scale + row[i][0]) * scale;
  }).sort((u, v) => v - u);
}

// ---------------------------------------------------------------------------
// R^8 vector helpers and the viewing frame (V2)
// ---------------------------------------------------------------------------
const dotVec = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const sqVec = (v) => v.reduce((s, x) => s + x * x, 0);
const normVec = (v) => Math.sqrt(sqVec(v));
const addVec = (a, b) => a.map((x, i) => x + b[i]);
const subVec = (a, b) => a.map((x, i) => x - b[i]);
const scaleVec = (v, s) => v.map((x) => x * s);

function orthVec(v, basis) {
  let w = v.slice();
  for (const e of basis) {
    const d = dotVec(w, e);
    if (d !== 0) w = w.map((x, i) => x - d * e[i]);
  }
  return w;
}

const stdDir = (a) => {
  const v = new Array(8).fill(0);
  v[a] = 1;
  return v;
};

function firstOrthonormalStd(basis) {
  // First CENTER_BASIS coordinate direction (index order) with a genuine
  // component orthogonal to span(basis); used for the deterministic e2/e3
  // fallbacks and for e3 itself.
  for (let a = 0; a < CENTER_BASIS.length; a++) {
    const cand = orthVec(stdDir(a), basis);
    const n = normVec(cand);
    if (n > FRAME_ABS_TOL) return scaleVec(cand, 1 / n);
  }
  return null;
}

export function buildFrame(q1, q2) {
  const ref = Math.max(normVec(q1), normVec(q2), 1);
  const tol = 1e-12 * ref;

  // e1 = normalize(q_1); explicit degeneracy fallback (never divide by zero).
  let e1;
  if (normVec(q1) > tol) e1 = scaleVec(q1, 1 / normVec(q1));
  else e1 = stdDir(0);

  // e2 = normalize(q_2 - (q_2 . e1) e1); explicit collinearity fallback.
  let e2;
  const w = orthVec(q2, [e1]);
  if (normVec(w) > tol) e2 = scaleVec(w, 1 / normVec(w));
  else e2 = firstOrthonormalStd([e1]) || stdDir(0);

  // e3 rule (documented, deterministic): the FIRST CENTER_BASIS coordinate
  // direction, in index order, whose component orthogonal to span(e1, e2) is
  // nonvanishing; normalized. This is a fixed viewing convention, not a
  // canonical/geometric choice; V3 is expected to make it path-continuous.
  let e3 = firstOrthonormalStd([e1, e2]);
  if (!e3) e3 = stdDir(0);

  return {
    e1,
    e2,
    e3,
    e3Rule:
      "first CENTER_BASIS coordinate direction (index order) with a nonvanishing " +
      "component orthogonal to span(e1,e2), normalized",
  };
}

const project = (q, f) => [dotVec(q, f.e1), dotVec(q, f.e2), dotVec(q, f.e3)];

// ---------------------------------------------------------------------------
// V2 main entry point
// ---------------------------------------------------------------------------
export function elementView(rep, levels, options = {}) {
  const cL = options.cL === undefined ? 1 : options.cL;
  const cP = options.cP === undefined ? 1 : options.cP;
  const I3 = eyeZ(3);

  const flags = [];
  const residuals = { projectorIdentity: 0, QProjector: 0, eigenvalue: 0, normSq: 0 };

  for (let i = 0; i < NB; i++) {
    const u = rep.a[i];
    const X = rep.A[i];
    const alpha = levels[i][0];
    const gamma = levels[i][1];

    const ell = matMul(X, u);
    const Pi_L = lineProjector(ell);
    const Pi_P = planeProjector(X).Pi_P;

    const T = matMul(X, matAdj(X));
    const Q = traceless(T);

    const d_Lm = matSub(Pi_L, matScale(I3, 1 / 3));
    const d_Pm = matSub(Pi_P, matScale(I3, 2 / 3));

    const q = packHermitian(Q, CENTER_BASIS);
    const d_L = packHermitian(d_Lm, CENTER_BASIS);
    const d_P = packHermitian(d_Pm, CENTER_BASIS);

    // --- self-check residuals (V1 identities) ---
    const rId = frobNorm(matSub(T, matAdd(matScale(Pi_L, alpha), matScale(Pi_P, gamma))));
    const rQp = frobNorm(matSub(Q, matAdd(matScale(d_Lm, alpha), matScale(d_Pm, gamma))));
    const w = eigvalsHermitian3(Q);
    const wExp = [(2 * alpha + gamma) / 3, (-alpha + gamma) / 3, -(alpha + 2 * gamma) / 3];
    const rEig = Math.max(...w.map((x, k) => Math.abs(x - wExp[k])));
    const rNorm = Math.abs(frob2(Q) - (2 / 3) * (alpha * alpha + alpha * gamma + gamma * gamma));

    residuals.projectorIdentity = Math.max(residuals.projectorIdentity, rId);
    residuals.QProjector = Math.max(residuals.QProjector, rQp);
    residuals.eigenvalue = Math.max(residuals.eigenvalue, rEig);
    residuals.normSq = Math.max(residuals.normSq, rNorm);

    flags.push({
      i, ell, Pi_L, Pi_P, T, Q,
      d_Lm, d_Pm, q, d_L, d_P,
      eigenvalues: w, eigenvaluesExpected: wExp,
      alpha, gamma,
    });
  }

  // Viewing frame from q_1, q_2 (0-based q[0], q[1]).
  const frame = buildFrame(flags[0].q, flags[1].q);
  const p = (vec) => project(vec, frame);

  // Triangle vertices: 0, p(q_1), p(q_1 + q_2).
  const vertices = [[0, 0, 0], p(flags[0].q), p(addVec(flags[0].q, flags[1].q))];
  // Edge i is the triangle side directed along branch i's q_i.
  const edges = [
    [vertices[0], vertices[1]],
    [vertices[1], vertices[2]],
    [vertices[2], vertices[0]],
  ];
  const midpoints = edges.map(([a2, b2]) => [
    (a2[0] + b2[0]) / 2,
    (a2[1] + b2[1]) / 2,
    (a2[2] + b2[2]) / 2,
  ]);

  const markersL = [];
  const markersP = [];
  const projectionLoss = { line: [], plane: [] };
  for (let i = 0; i < NB; i++) {
    const mp = midpoints[i];
    const pdL = p(flags[i].d_L);
    const pdP = p(flags[i].d_P);
    markersL.push(addVec(mp, scaleVec(pdL, cL)));
    markersP.push(addVec(mp, scaleVec(pdP, cP)));
    projectionLoss.line.push(sqVec(flags[i].d_L) - sqVec(pdL));
    projectionLoss.plane.push(sqVec(flags[i].d_P) - sqVec(pdP));
  }

  return {
    flags,
    frame,
    vertices,
    edges,
    midpoints,
    markers: { line: markersL, plane: markersP },
    projectionLoss,
    residuals,
    display: { cL, cP },
    notes: {
      markerConvention:
        "markers are midpoint(edge_i) + c * p(d_i) with p the R^8 -> R^3 " +
        "projection: a DISPLAY CONVENTION, not points on the triangle.",
      injectivity: INJECTIVITY_NOTE,
    },
  };
}
