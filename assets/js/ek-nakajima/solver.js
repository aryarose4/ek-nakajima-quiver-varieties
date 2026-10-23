// solver.js — dependency-free, Node-safe port of the Milestone-2
// positive-Hermitian-gauge real-moment-map solver.
//
// Mirrors the verified Python reference `sim/e6sim/hermitian_solver.py`. Given
// an arbitrary complex-moment-map-zero representative and real levels it finds
// a positive gauge
//
//   g   = exp(S_center / 2)   (traceless Hermitian 3x3, det g = 1)
//   h_i = exp(S_i / 2)        (Hermitian 2x2)
//   q_i = exp(s_i / 2)        (real scalar)
//
// putting the Hermitian real moment map at the level. There are
// 8 + 3*4 + 3 = 23 real unknowns, packed in the Frobenius-orthonormal Hermitian
// bases of core-math (8 central, 4 per middle, 1 per outer).
//
// The positive gauge is NOT unitary, so core-math's `gaugeAction` (which uses
// the adjoint as the inverse) is NOT valid here. This module applies the true
// complex inverses:
//
//   a_i -> h_i a_i q_i^{-1},   A_i -> g A_i h_i^{-1},
//   b_i -> q_i b_i h_i^{-1},   B_i -> h_i B_i g^{-1}.
//
// Success is reported only after *directly recomputing* the packed real
// residual, the complex residual, finite/positive-definite gauge data, and
// det(H_center) = 1. The optimizer's own flag is never trusted.
//
// Complex numbers are 2-element arrays [re, im]; complex matrices are arrays
// of rows of such pairs (the core-math convention).

import {
  NB,
  N_GAUGE_REAL,
  CENTER_BASIS,
  MIDDLE_BASIS,
  OUTER_BASIS,
  zerosZ,
  eyeZ,
  matMul,
  matAdd,
  matSub,
  matScale,
  matAdj,
  frob2,
  frobNorm,
  unpackHermitian,
  packHermitian,
  traceless,
  packRealResidual,
  complexResidualNorm,
  realResidual,
  makeRep,
} from "./core-math.js";

// ---------------------------------------------------------------------------
// complex scalar helpers (arrays [re, im])
// ---------------------------------------------------------------------------
const sSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const sMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const sConj = (a) => [a[0], -a[1]];
const sAbs = (a) => Math.hypot(a[0], a[1]);
const sInv = (a) => {
  const d = a[0] * a[0] + a[1] * a[1];
  return [a[0] / d, -a[1] / d];
};

// ---------------------------------------------------------------------------
// complex matrix inverse (general, Gauss-Jordan with partial pivoting)
// ---------------------------------------------------------------------------
function matInv(M) {
  const n = M.length;
  const aug = M.map((row, i) =>
    row.map((e) => [e[0], e[1]]).concat(eyeZ(n)[i])
  );
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = sAbs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = sAbs(aug[r][col]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (!(best > 1e-300)) throw new Error("matInv: singular matrix");
    if (piv !== col) {
      const t = aug[col];
      aug[col] = aug[piv];
      aug[piv] = t;
    }
    const pivInv = sInv(aug[col][col]);
    for (let j = 0; j < 2 * n; j++) aug[col][j] = sMul(aug[col][j], pivInv);
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      if (f[0] === 0 && f[1] === 0) continue;
      for (let j = 0; j < 2 * n; j++)
        aug[r][j] = sSub(aug[r][j], sMul(f, aug[col][j]));
    }
  }
  return aug.map((row) => row.slice(n));
}

// ---------------------------------------------------------------------------
// Hermitian eigendecomposition via complex Jacobi rotations.
// Returns { vals: number[], U } with H = U diag(vals) U^*.
// ---------------------------------------------------------------------------
function jacobiHermitian(H) {
  const n = H.length;
  let A = H.map((row) => row.map((e) => [e[0], e[1]]));
  let U = eyeZ(n);
  for (let sweep = 0; sweep < 80; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        const h = A[p][q];
        off += h[0] * h[0] + h[1] * h[1];
      }
    if (off < 1e-28) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        const hpq = A[p][q];
        const abs = sAbs(hpq);
        if (abs < 1e-300) continue;
        const a = A[p][p][0];
        const b = A[q][q][0];
        const d = abs;
        const tau = (b - a) / (2 * d);
        let t;
        if (tau >= 0) t = 1 / (tau + Math.sqrt(1 + tau * tau));
        else t = -1 / (-tau + Math.sqrt(1 + tau * tau));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;
        const phi = [hpq[0] / d, hpq[1] / d];
        const phic = sConj(phi);
        const V = eyeZ(n);
        V[p][p] = [c, 0];
        V[p][q] = [s, 0];
        V[q][p] = sMul([-s, 0], phic);
        V[q][q] = sMul([c, 0], phic);
        A = matMul(matMul(matAdj(V), A), V);
        U = matMul(U, V);
      }
  }
  const vals = A.map((row, i) => row[i][0]);
  return { vals, U };
}

// exp(H) for Hermitian H (dependency-free, real-symmetric-eigenvalue route).
export function expmHermitian(H) {
  const { vals, U } = jacobiHermitian(H);
  const n = H.length;
  const E = eyeZ(n);
  for (let i = 0; i < n; i++) E[i][i] = [Math.exp(vals[i]), 0];
  return matMul(matMul(U, E), matAdj(U));
}

function expmSmooth(H) {
  const n = H.length;
  const size = Math.max(...H.map(row=>row.reduce((s,z)=>s+sAbs(z),0)));
  if(!Number.isFinite(size)) throw new RangeError('Nonfinite exponential argument');
  const squarings = Math.max(0, Math.ceil(Math.log2(Math.max(1,size/.5))));
  const small = matScale(H, Math.pow(2,-squarings));
  let E = eyeZ(n), term = eyeZ(n);
  for(let k=1;k<=18;k++) {
    term = matScale(matMul(term,small),1/k);
    E = E.map((row,i)=>row.map((z,j)=>[z[0]+term[i][j][0],z[1]+term[i][j][1]]));
  }
  for(let k=0;k<squarings;k++) E=matMul(E,E);
  return E;
}

// Differentiate the same scaled Taylor polynomial used above. Keeping the
// exponential and its derivative on one algorithm avoids eigenvector phases
// and subtractive finite-difference noise close to chamber walls.
function expmTangent(H, direction) {
  const n=H.length;
  const size=Math.max(...H.map(row=>row.reduce((s,z)=>s+sAbs(z),0)));
  if(!Number.isFinite(size)) throw new RangeError('Nonfinite exponential argument');
  const squarings=Math.max(0,Math.ceil(Math.log2(Math.max(1,size/.5))));
  const small=matScale(H,Math.pow(2,-squarings));
  const dsmall=matScale(direction,Math.pow(2,-squarings));
  let E=eyeZ(n),dE=zerosZ(n,n),term=eyeZ(n),dterm=zerosZ(n,n);
  for(let k=1;k<=18;k++) {
    dterm=matScale(matAdd(matMul(dterm,small),matMul(term,dsmall)),1/k);
    term=matScale(matMul(term,small),1/k);
    E=matAdd(E,term);dE=matAdd(dE,dterm);
  }
  for(let k=0;k<squarings;k++) {
    dE=matAdd(matMul(dE,E),matMul(E,dE));E=matMul(E,E);
  }
  return dE;
}

// Hermitian divided differences are regular at repeated eigenvalues. Cache
// the eigensystem per log-gauge block, shared by all its Jacobian columns.
function cachedExpmTangent(entry, basis, direction) {
  const H=matScale(unpackHermitian(entry.coords,basis),.5);
  try {
    if(!entry.spectrum) entry.spectrum=jacobiHermitian(H);
    const {vals,U}=entry.spectrum,adj=matAdj(U);
    const rotated=matMul(matMul(adj,direction),U);
    const derivative=rotated.map((row,i)=>row.map((z,j)=>{
      const half=(vals[i]-vals[j])/2, square=half*half;
      const sinhc=Math.abs(half)<1e-4 ? 1+square/6+square*square/120 : Math.sinh(half)/half;
      const factor=Math.exp((vals[i]+vals[j])/2)*sinhc;
      if(!Number.isFinite(factor)) throw new RangeError('Nonfinite divided difference');
      return [z[0]*factor,z[1]*factor];
    }));
    return matMul(matMul(U,derivative),adj);
  } catch (_) { return expmTangent(H,direction); }
}

// Eigenvalues of a Hermitian matrix (real, ascending not guaranteed).
export function hermitianEigenvalues(H) {
  return jacobiHermitian(H).vals.slice();
}

// determinant of a small complex matrix (Gauss elimination)
function matDet(M) {
  const n = M.length;
  const A = M.map((row) => row.map((e) => [e[0], e[1]]));
  let det = [1, 0];
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = sAbs(A[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = sAbs(A[r][col]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (best < 1e-300) return [0, 0];
    if (piv !== col) {
      const t = A[col];
      A[col] = A[piv];
      A[piv] = t;
      det = [-det[0], -det[1]];
    }
    det = sMul(det, A[col][col]);
    const inv = sInv(A[col][col]);
    for (let r = col + 1; r < n; r++) {
      const f = sMul(A[r][col], inv);
      for (let j = col; j < n; j++) A[r][j] = sSub(A[r][j], sMul(f, A[col][j]));
    }
  }
  return det;
}

// ---------------------------------------------------------------------------
// packing / unpacking of the 23 log-gauge unknowns
//   layout: [center(8)] [middle_i(4) x3] [outer_i(1) x3]
// (mirrors hermitian_solver.py's slices)
// ---------------------------------------------------------------------------
const CENTER_SLICE = [0, 8];
const MIDDLE_START = 8;
const OUTER_START = 8 + 4 * NB; // 20

function middleSlice(i) {
  return [MIDDLE_START + 4 * i, MIDDLE_START + 4 * i + 4];
}
function outerSlice(i) {
  return [OUTER_START + i, OUTER_START + i + 1];
}

// Flatten the ``logGauge`` object returned by the solver into a length-23
// real vector in the same coordinate layout the solver seeds from:
//   [center(8)] [middle_0(4) middle_1(4) middle_2(4)] [outer_0(1) ... outer_2(1)].
export function flatLogGauge(logGauge) {
  const out = [];
  out.push(...logGauge.center);
  for (let i = 0; i < NB; i++) out.push(...logGauge.middle[i]);
  for (let i = 0; i < NB; i++) out.push(...logGauge.outer[i]);
  return out;
}

// Normalize a warm start given as either a flat length-23 array or a solver
// ``logGauge`` object into a flat array, or null when unusable.
function normalizeWarmGauge(initialLogGauge) {
  if (initialLogGauge === undefined || initialLogGauge === null) return null;
  let warm;
  if (Array.isArray(initialLogGauge)) warm = initialLogGauge.slice();
  else if (typeof initialLogGauge === "object") warm = flatLogGauge(initialLogGauge);
  else return null;
  if (warm.length !== N_GAUGE_REAL || !warm.every((v) => isFinite(v))) return null;
  return warm;
}

function rawFromCoords(x) {
  const center = unpackHermitian(x.slice(CENTER_SLICE[0], CENTER_SLICE[1]), CENTER_BASIS);
  const middle = [];
  const outer = [];
  for (let i = 0; i < NB; i++) {
    const [s, e] = middleSlice(i);
    middle.push(unpackHermitian(x.slice(s, e), MIDDLE_BASIS));
    outer.push(x[outerSlice(i)[0]]);
  }
  return { center, middle, outer };
}

// positive gauge (g, h, q): g = exp(S/2), h_i = exp(S_i/2), q_i = exp(s_i/2)
function positiveGauge(raw, exponential = expmHermitian) {
  const g = exponential(matScale(raw.center, 0.5));
  const h = raw.middle.map((S) => exponential(matScale(S, 0.5)));
  const q = raw.outer.map((s) => Math.exp(0.5 * s));
  return { g, h, q };
}

// H_v = g_v^* g_v = exp(S_v)
function HMatrices(raw, exponential = expmHermitian) {
  return {
    center: exponential(raw.center),
    middle: raw.middle.map((S) => exponential(S)),
    outer: raw.outer.map((s) => Math.exp(s)),
  };
}

// true-inverse gauge action (positive gauge is not unitary).
// `q` is an array of complex scalars (one per branch). Exported so tests and
// callers can build genuinely complex (non-unitary) gauge transforms.
export function applyComplexGauge(rep, g, h, q) {
  return applyGaugeWithInverses(rep, g, h, q, matInv(g), h.map(matInv));
}

function applyGaugeWithInverses(rep, g, h, q, ginv, hInv) {
  const a = [];
  const A = [];
  const b = [];
  const B = [];
  for (let i = 0; i < NB; i++) {
    const hi = h[i];
    const hiInv = hInv[i];
    const qi = Array.isArray(q[i]) ? q[i] : [q[i], 0];
    const qInv = sInv(qi);
    a.push(matScale(matMul(hi, rep.a[i]), qInv));
    A.push(matMul(matMul(g, rep.A[i]), hiInv));
    b.push(matScale(matMul(rep.b[i], hiInv), qi));
    B.push(matMul(matMul(hi, rep.B[i]), ginv));
  }
  return makeRep(a, A, b, B);
}

// frobenius_sq of the whole representation
function repFrob2(rep) {
  let s = 0;
  for (const list of [rep.a, rep.A, rep.b, rep.B])
    for (const M of list) s += frob2(M);
  return s;
}

function allFiniteRep(rep) {
  for (const list of [rep.a, rep.A, rep.b, rep.B])
    for (const M of list)
      for (const row of M) for (const e of row) if (!isFinite(e[0]) || !isFinite(e[1])) return false;
  return true;
}

// ---------------------------------------------------------------------------
// residual
// ---------------------------------------------------------------------------
function makePackedResidual(rep, levels, options = {}) {
  // A finite-difference column changes only one log-gauge block. Reuse the
  // other exponentials and inverses, with exact keys and solve-local lifetime.
  const cache = new Array(4);
  function block(x, slot, start, count, basis) {
    const old = cache[slot];
    if (old && old.coords.every((v, i) => v === x[start + i])) return old;
    const coords = x.slice(start, start + count);
    const gauge = (options.analytic ? expmSmooth : expmHermitian)(matScale(unpackHermitian(coords, basis), .5));
    const inverse = matInv(gauge);
    const entry = { coords, gauge, inverse };
    cache[slot] = entry;
    return entry;
  }
  const residual = function (x) {
    try {
      const center = block(x, 0, 0, 8, CENTER_BASIS);
      const middle = [0, 1, 2].map(i => block(x, i + 1, MIDDLE_START + 4 * i, 4, MIDDLE_BASIS));
      const q = [0, 1, 2].map(i => Math.exp(.5 * x[OUTER_START + i]));
      const gauged = applyGaugeWithInverses(rep, center.gauge, middle.map(b => b.gauge), q,
        center.inverse, middle.map(b => b.inverse));
      const r = packRealResidual(gauged, levels);
      if (!r.every((v) => isFinite(v))) return r.map(() => 1e8);
      return r;
    } catch (e) {
      return new Array(N_GAUGE_REAL).fill(1e8);
    }
  };
  residual.jacobian = function(x) {
    const center=block(x,0,0,8,CENTER_BASIS);
    const middle=[0,1,2].map(i=>block(x,i+1,MIDDLE_START+4*i,4,MIDDLE_BASIS));
    const q=[0,1,2].map(i=>Math.exp(.5*x[OUTER_START+i]));
    const gauged=applyGaugeWithInverses(rep,center.gauge,middle.map(b=>b.gauge),q,center.inverse,middle.map(b=>b.inverse));
    const productTangent=(X,dX,left)=>left ? matAdd(matMul(matAdj(dX),X),matMul(matAdj(X),dX)) : matAdd(matMul(dX,matAdj(X)),matMul(X,matAdj(dX)));
    const columns=[];
    for(let j=0;j<N_GAUGE_REAL;j++) {
      let Lg=zerosZ(3,3), Lh=[0,1,2].map(()=>zerosZ(2,2)), lq=[0,0,0];
      if(j<8) Lg=matMul(cachedExpmTangent(center,CENTER_BASIS,matScale(CENTER_BASIS[j],.5)),center.inverse);
      else if(j<OUTER_START) {
        const i=Math.floor((j-MIDDLE_START)/4),k=(j-MIDDLE_START)%4;
        Lh[i]=matMul(cachedExpmTangent(middle[i],MIDDLE_BASIS,matScale(MIDDLE_BASIS[k],.5)),middle[i].inverse);
      } else lq[j-OUTER_START]=.5;
      const outer=[],mid=[];let central=zerosZ(3,3);
      for(let i=0;i<NB;i++) {
        const a=gauged.a[i],A=gauged.A[i],b=gauged.b[i],B=gauged.B[i];
        const da=matSub(matMul(Lh[i],a),matScale(a,lq[i]));
        const dA=matSub(matMul(Lg,A),matMul(A,Lh[i]));
        const db=matSub(matScale(b,lq[i]),matMul(b,Lh[i]));
        const dB=matSub(matMul(Lh[i],B),matMul(B,Lg));
        outer.push(productTangent(a,da,true));
        outer[i]=matSub(outer[i],productTangent(b,db,false));
        mid.push(matAdd(matSub(productTangent(A,dA,true),productTangent(B,dB,false)),matSub(productTangent(b,db,true),productTangent(a,da,false))));
        central=matAdd(central,matSub(productTangent(B,dB,true),productTangent(A,dA,false)));
      }
      const packed=[];
      outer.forEach(M=>packed.push(...packHermitian(M,OUTER_BASIS)));
      mid.forEach(M=>packed.push(...packHermitian(M,MIDDLE_BASIS)));
      packed.push(...packHermitian(traceless(central),CENTER_BASIS));columns.push(packed);
    }
    return columns[0].map((_,i)=>columns.map(col=>col[i]));
  };
  return residual;
}

function levelScale(rep, levels) {
  const lvlNorm = Math.sqrt(levels.reduce((s, row) => s + row[0] * row[0] + row[1] * row[1], 0));
  return Math.max(1.0, lvlNorm, Math.sqrt(repFrob2(rep)));
}

function perVertexResiduals(solved, levels) {
  const r = realResidual(solved, levels);
  return {
    outer: r.outer.map((M) => frobNorm(M)),
    middle: r.middle.map((M) => frobNorm(M)),
    center: frobNorm(r.center),
  };
}

// ---------------------------------------------------------------------------
// small dense linear algebra for the LM step
// ---------------------------------------------------------------------------
function sumsq(v) {
  let s = 0;
  for (const x of v) s += x * x;
  return s;
}

function fdJacobian(f, x, r, baseStep, centered) {
  const n = x.length;
  const m = r.length;
  const J = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    const h = baseStep * (1 + Math.abs(x[j]));
    const xp = x.slice();
    xp[j] += h;
    const rp = f(xp);
    let rm = r;
    if(centered) { const xm=x.slice();xm[j]-=h;rm=f(xm); }
    for (let i = 0; i < m; i++) J[i][j] = (rp[i] - rm[i]) / (centered ? 2 * h : h);
  }
  return J;
}

// solve A z = b for a small dense real system (Gaussian elimination)
function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((row, i) => row.slice().concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (!(best > 1e-300)) return null;
    if (piv !== col) {
      const t = M[col];
      M[col] = M[piv];
      M[piv] = t;
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  const z = new Array(n);
  for (let i = 0; i < n; i++) z[i] = M[i][n] / M[i][i];
  return z;
}

// ---------------------------------------------------------------------------
// Levenberg-Marquardt least squares (finite-difference Jacobian)
// ---------------------------------------------------------------------------
// Householder QR of the augmented damped system avoids squaring the condition
// number of the Jacobian in recovery near a chamber wall.
function leastSquaresStep(J, r, lambda, N, floor) {
  const n = N.length;
  const A = J.map((row,i) => row.slice().concat([-r[i]]));
  for(let j=0;j<n;j++) A.push(Array.from({length:n+1},(_,k)=>k===j?Math.sqrt(lambda*Math.max(N[j][j],floor)):0));
  const m=A.length;
  for(let j=0;j<n;j++) {
    const length=Math.hypot(...A.slice(j).map(row=>row[j]));
    if(!(length>1e-300)) return null;
    const alpha=A[j][j]>=0?-length:length;
    const v=A.slice(j).map(row=>row[j]);v[0]-=alpha;
    const scale=Math.hypot(...v);for(let i=0;i<v.length;i++)v[i]/=scale;
    for(let k=j;k<=n;k++) {
      let dot=0;for(let i=j;i<m;i++)dot+=v[i-j]*A[i][k];
      for(let i=j;i<m;i++)A[i][k]-=2*v[i-j]*dot;
    }
  }
  const x=new Array(n).fill(0);
  for(let j=n-1;j>=0;j--) {
    let rhs=A[j][n];for(let k=j+1;k<n;k++)rhs-=A[j][k]*x[k];
    x[j]=rhs/A[j][j];
  }
  return x;
}

function levMar(f, x0, opts) {
  const n = x0.length;
  let x = x0.slice();
  let r = f(x);
  let cost = sumsq(r);
  let lambda = opts.lambda0;
  let nfev = 1;
  let iter = 0;
  let status = "iteration_limit";
  const maxIter = opts.maxIter;
  let trust = opts.trust0 || 2.0;

  for (iter = 0; iter < maxIter; iter++) {
    // Reuse the accepted residual before paying for another full Jacobian.
    // buildResult still checks complex equations and positivity independently.
    if (cost <= opts.residualCost) { status = "residual_tol"; break; }
    const J = opts.analytic ? f.jacobian(x) : fdJacobian(f, x, r, opts.fdStep, opts.centered);
    nfev += opts.analytic ? 0 : (opts.centered ? 2 : 1) * n;
    const g = new Array(n).fill(0);
    const N = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < r.length; i++) {
      const Ji = J[i];
      for (let a = 0; a < n; a++) {
        g[a] += Ji[a] * r[i];
        for (let b = a; b < n; b++) N[a][b] += Ji[a] * Ji[b];
      }
    }
    for (let a = 0; a < n; a++) for (let b = 0; b < a; b++) N[a][b] = N[b][a];

    let maxDiag = 0;
    for (let a = 0; a < n; a++) maxDiag = Math.max(maxDiag, N[a][a]);
    const floor = maxDiag > 0 ? maxDiag * 1e-10 : 1.0;

    const gn = Math.sqrt(sumsq(g));
    if (gn < opts.gtol) {
      status = "gradient_tol";
      break;
    }

    let accepted = false;
    for (let trial = 0; trial < 24; trial++) {
      const Nl = N.map((row, a) =>
        row.map((v, b) => (a === b ? v + lambda * Math.max(N[a][a], floor) : v))
      );
      let dx = (opts.centered || opts.analytic) ? leastSquaresStep(J, r, lambda, N, floor) : solveLinear(Nl, g.map((v) => -v));
      if (!dx || !dx.every((v) => isFinite(v))) {
        lambda *= 10;
        if (lambda > 1e16) break;
        continue;
      }
      // trust-region step cap
      let dn = Math.sqrt(sumsq(dx));
      if (dn > trust) {
        const sc = trust / dn;
        dx = dx.map((v) => v * sc);
        dn = trust;
      }
      const xn = x.map((v, a) => v + dx[a]);
      const rn = f(xn);
      nfev++;
      const cn = sumsq(rn);
      if (isFinite(cn) && cn < cost) {
        const relStep = dn / (1 + Math.sqrt(sumsq(x)));
        const relCost = (cost - cn) / Math.max(cost, 1e-300);
        x = xn;
        r = rn;
        cost = cn;
        // Wall-near directions can be much weaker than 1e-16 relative to the
        // strongest normal-equation entry. QR can safely reduce damping further.
        lambda = Math.max(lambda * 0.3, opts.analytic ? 1e-28 : 1e-16);
        trust = Math.min(trust * 1.5, 5.0);
        accepted = true;
        if (relStep < opts.xtol || relCost < opts.ftol) {
          status = "converged";
          return { x, r, cost, iter: iter + 1, nfev, status };
        }
        break;
      }
      lambda *= 8;
      if (lambda > 1e16) break;
    }
    if (!accepted) {
      if (trust > 1e-8) {
        trust *= 0.25;
        lambda = opts.lambda0;
        continue;
      }
      status = "no_descent";
      break;
    }
  }
  return { x, r, cost, iter, nfev, status };
}

function multiStartSeeds() {
  const seeds = [new Array(N_GAUGE_REAL).fill(0)];
  const modes = [
    (sc, k) => sc * Math.sin(1.7 * (k + 1)),
    (sc, k) => sc * Math.cos(0.9 * (k + 2)),
    (sc, k) => sc * Math.sin(0.4 * (k + 1) * (k + 2)),
  ];
  const scales = [0.1, 0.3, 0.6];
  for (let s = 0; s < scales.length; s++)
    seeds.push(Array.from({ length: N_GAUGE_REAL }, (_, k) => modes[s](scales[s], k)));
  return seeds;
}

// ---------------------------------------------------------------------------
// public solver
// ---------------------------------------------------------------------------
const DEFAULT_OPTIONS = {
  abs_tol: 1e-9,
  rel_tol: 1e-9,
  complex_tol: 1e-8,
  det_tol: 1e-8,
  pos_tol: 0.0,
  maxIter: 250,
  max_nfev: 20000,
  ftol: 1e-14,
  xtol: 1e-14,
  gtol: 1e-14,
  fdStep: 1e-6,
  lambda0: 1e-3,
  trust0: 2.0,
  multistart: true,
};

export function solveRealMomentMap(rep, levels, options = {}) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);
  const levelsArr = levels.map((row) => [Number(row[0]), Number(row[1])]);

  const finiteInput =
    levelsArr.every((row) => isFinite(row[0]) && isFinite(row[1])) && allFiniteRep(rep);

  if (!finiteInput) {
    return buildResult(rep, levelsArr, new Array(N_GAUGE_REAL).fill(0), opts, {
      status: "invalid_input",
      iter: 0,
      nfev: 0,
    });
  }

  const f = makePackedResidual(rep, levelsArr, opts);
  const seeds = opts.multistart ? multiStartSeeds() : [new Array(N_GAUGE_REAL).fill(0)];

  // Warm start, when supplied, is the FIRST seed; the existing multi-start
  // seeds remain as fallbacks. Absent option -> behaviour is unchanged.
  const warm = normalizeWarmGauge(options.initialLogGauge);
  if (warm) seeds.unshift(warm);

  let best = null;
  let totalNfev = 0;
  // Respect both acceptance bars, including callers with a tighter relative
  // tolerance. Meeting them also makes further fallback seeds redundant.
  const residualTol = Math.min(opts.abs_tol, opts.rel_tol * levelScale(rep, levelsArr));
  const successCost = residualTol * residualTol;
  for (const seed of seeds) {
    if (totalNfev >= opts.max_nfev) break;
    const res = levMar(f, seed, {
      lambda0: opts.lambda0,
      trust0: opts.trust0,
      maxIter: opts.maxIter,
      ftol: opts.ftol,
      xtol: opts.xtol,
      gtol: opts.gtol,
      fdStep: opts.fdStep,
      residualCost: successCost,
      centered: opts.centered,
      analytic: opts.analytic,
    });
    totalNfev += res.nfev;
    if (best === null || res.cost < best.cost) best = res;
    if (best.cost <= successCost) break; // residual success bar met
  }

  return buildResult(rep, levelsArr, best.x, opts, {
    status: best.status,
    iter: best.iter,
    nfev: totalNfev,
  });
}

function buildResult(rep, levels, x, opts, meta) {
  let solvedRep;
  let raw;
  let H;
  let realPacked;
  let complexNorm;
  let perVertex;
  let gaugeFinite = false;
  let gaugePositive = false;
  let detH = [NaN, NaN];

  try {
    raw = rawFromCoords(x);
    const exponential=opts.analytic ? expmSmooth : expmHermitian;
    const { g, h, q } = positiveGauge(raw, exponential);
    solvedRep = applyComplexGauge(rep, g, h, q);
    H = HMatrices(raw, exponential);
    realPacked = packRealResidual(solvedRep, levels);
    complexNorm = complexResidualNorm(solvedRep);
    perVertex = perVertexResiduals(solvedRep, levels);
    detH = matDet(H.center);
    const mats = [H.center, ...H.middle, ...H.outer.map((v) => [[[v, 0]]])];
    gaugeFinite = mats.every((M) =>
      M.every((row) => row.every((e) => isFinite(e[0]) && isFinite(e[1])))
    );
    gaugePositive = true;
    for (const M of [H.center, ...H.middle]) {
      const eigs = hermitianEigenvalues(M);
      if (!eigs.every((v) => isFinite(v)) || Math.min(...eigs) <= opts.pos_tol) {
        gaugePositive = false;
        break;
      }
    }
    if (gaugePositive && H.outer.some((v) => !(v > opts.pos_tol))) gaugePositive = false;
  } catch (e) {
    solvedRep = rep;
    H = { center: zerosZ(3, 3), middle: [eyeZ(2), eyeZ(2), eyeZ(2)], outer: [1, 1, 1] };
    realPacked = packRealResidual(rep, levels);
    complexNorm = complexResidualNorm(rep);
    perVertex = perVertexResiduals(rep, levels);
  }

  const realNorm = Math.hypot(...realPacked);
  const scale = levelScale(rep, levels);
  const realRel = realNorm / scale;
  const detDev = Math.abs(Math.hypot(detH[0] - 1, detH[1]));

  const success =
    realNorm <= opts.abs_tol &&
    realRel <= opts.rel_tol &&
    complexNorm <= opts.complex_tol &&
    gaugeFinite &&
    gaugePositive &&
    detDev <= opts.det_tol;

  const logGauge = {
    center: x.slice(CENTER_SLICE[0], CENTER_SLICE[1]),
    middle: [0, 1, 2].map((i) => x.slice(middleSlice(i)[0], middleSlice(i)[1])),
    outer: [0, 1, 2].map((i) => x.slice(outerSlice(i)[0], outerSlice(i)[1])),
  };

  const diagnostics = {
    status: success ? "success" : meta.status,
    iterations: meta.iter,
    nfev: meta.nfev,
    max_log_gauge: x.length ? Math.max(...x.map((v) => Math.abs(v))) : 0,
    det_H_center: [detH[0], detH[1]],
    gauge_finite: gaugeFinite,
    gauge_positive: gaugePositive,
    abs_tol: opts.abs_tol,
    rel_tol: opts.rel_tol,
    complex_tol: opts.complex_tol,
    det_tol: opts.det_tol,
    real_norm_scale: scale,
  };

  return {
    success,
    logGauge,
    H,
    solvedRep,
    residuals: {
      real_norm: realNorm,
      real_rel: realRel,
      complex_norm: complexNorm,
      per_vertex: perVertex,
      real_packed: realPacked,
    },
    diagnostics,
  };
}
