// validate-math.mjs — Node battery for assets/js/ek-nakajima/core-math.js.
//
// Checks that the JavaScript port reproduces the frozen, independently
// verified Python conventions (sim/e6sim): basis orthonormality, moment-map
// residuals, the Hermitian packing norm identity, unitary gauge covariance,
// and the V0/V5 geometry (closure, branch traces, triangle identities).
//
// The certified chart at z=2 is complex-zero but NOT a real-moment-map
// solution (a Hermitian gauge is needed); geometry identities therefore use
// the exact symmetric y=0 solution, which solves the real equations exactly.
//
// Run from tests/ after the modules are copied next to this file (see run.sh):
//   node validate-math.mjs
import {
  NB,
  N_GAUGE_REAL,
  matMul,
  matTrace,
  zerosZ,
  cConj,
  cScale,
  frob2,
  frobNorm,
  CENTER_BASIS,
  MIDDLE_BASIS,
  OUTER_BASIS,
  tracelessHermitianBasis,
  hermitianBasis,
  traceless,
  packHermitian,
  betaToLevel,
  makeRep,
  validateRep,
  gaugeAction,
  diagonalUnitaryGauge,
  complexResidualNorm,
  realResidualNorm,
  branchTraces,
  extractGeometry,
  triangleSideFromPairwise,
} from "./core-math.js";

let pass = 0;
let fail = 0;
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  FAIL: ${name}${detail ? " :: " + detail : ""}`);
  }
}

const Z = (rows) => rows.map((r) => r.map((e) => (Array.isArray(e) ? e : [e, 0])));
const zcol21 = () => Z([[0], [0]]);
const zrow12 = () => Z([[0, 0]]);
const zmat23 = () => Z([[0, 0, 0], [0, 0, 0]]);

// certified y=0 chart at z = 2 (exact integers), levels alpha=(3,3,3), gamma=(1,2,3)
function certifiedFixture() {
  const a = [Z([[1], [0]]), Z([[1], [0]]), Z([[1], [0]])];
  const A = [
    Z([[1, 0], [0, 1], [0, 1]]),
    Z([[0, 1], [1, 0], [0, 1]]),
    Z([[0, 1], [0, 2], [1, 0]]),
  ];
  const b = [zrow12(), zrow12(), zrow12()];
  const B = [zmat23(), zmat23(), zmat23()];
  return { rep: makeRep(a, A, b, B), levels: [[3, 1], [3, 2], [3, 3]] };
}

// exact symmetric y=0 solution with scalar branch levels (alpha, gamma).
function symmetricFixture(alpha, gamma) {
  const sq = Math.sqrt;
  const a = [];
  for (let i = 0; i < NB; i++) a.push(Z([[sq(alpha)], [0]]));
  const A1 = Z([[sq(gamma + alpha), 0], [0, sq(gamma)], [0, 0]]); // [sqrt(g+a)e1, sqrt(g)e2]
  const A2 = Z([[0, 0], [sq(gamma + alpha), 0], [0, sq(gamma)]]); // [sqrt(g+a)e2, sqrt(g)e3]
  const A3 = Z([[0, sq(gamma)], [0, 0], [sq(gamma + alpha), 0]]); // [sqrt(g+a)e3, sqrt(g)e1]
  const b = [zrow12(), zrow12(), zrow12()];
  const B = [zmat23(), zmat23(), zmat23()];
  return {
    rep: makeRep(a, [A1, A2, A3], b, B),
    levels: [[alpha, gamma], [alpha, gamma], [alpha, gamma]],
  };
}

// ---------------------------------------------------------------------------
// A. certified chart: complex-zero, shape-valid, K = 0 at y = 0
// ---------------------------------------------------------------------------
{
  const { rep } = certifiedFixture();
  const errs = validateRep(rep);
  check("certified: validateRep()", errs.length === 0, errs.join(","));
  check("certified: complex residual ~ 0", complexResidualNorm(rep) < 1e-12,
    `norm=${complexResidualNorm(rep)}`);
  const g = extractGeometry(rep, certifiedFixture().levels);
  check("certified: K_i = 0 at y=0", g.K.every((K) => frobNorm(K) < 1e-12));
}

// ---------------------------------------------------------------------------
// B. symmetric fixture solves the real equations
// ---------------------------------------------------------------------------
{
  const { rep, levels } = symmetricFixture(1.3, 0.9);
  check("symmetric: complex residual ~ 0", complexResidualNorm(rep) < 1e-12);
  check("symmetric: real residual ~ 0", realResidualNorm(rep, levels) < 1e-12,
    `norm=${realResidualNorm(rep, levels)}`);
}

// ---------------------------------------------------------------------------
// C. V0/V5 geometry on an exact solved fixture
// ---------------------------------------------------------------------------
{
  const alpha = 1.3, gamma = 0.9;
  const { rep, levels } = symmetricFixture(alpha, gamma);
  const g = extractGeometry(rep, levels);
  check("geometry: closure sum Q_i ~ 0", g.closureError < 1e-10, `err=${g.closureError}`);
  check("geometry: closure sum K_i ~ 0", g.closureKError < 1e-12);
  check("geometry: branch traces = alpha + 2 gamma",
    g.branchTraces.every((t) => close(t, alpha + 2 * gamma, 1e-9)),
    g.branchTraces.map((t) => t.toFixed(6)).join(","));
  check("geometry: branchTraces == expected",
    g.branchTraces.every((t, i) => close(t, g.branchTracesExpected[i], 1e-9)));
  const expectedNorm2 = (2 / 3) * (alpha * alpha + alpha * gamma + gamma * gamma);
  for (let i = 0; i < NB; i++) {
    check(`geometry: ||Q_${i}||^2 identity`, close(frob2(g.Q[i]), expectedNorm2, 1e-8),
      `${frob2(g.Q[i])} vs ${expectedNorm2}`);
    check(`geometry: ||q_${i}||^2 = ||Q_${i}||_F^2`, close(g.edgeNorms[i] ** 2, frob2(g.Q[i]), 1e-9));
  }
  // vector dot = matrix trace pairing
  for (let i = 0; i < NB; i++)
    for (let j = 0; j < NB; j++) {
      const dot = g.q[i].reduce((s, x, a) => s + x * g.q[j][a], 0);
      check(`geometry: dot(q_${i},q_${j}) = trace(Q_${i}Q_${j})`, close(dot, g.pairwise[i][j], 1e-9));
    }
  // triangle pairwise identity for the closing triple (distinct edges i != j)
  for (let i = 0; i < NB; i++)
    for (let j = 0; j < NB; j++) {
      if (i === j) continue;
      const k = [0, 1, 2].find((t) => t !== i && t !== j);
      check(`geometry: pairwise formula (${i},${j})`,
        close(g.pairwise[i][j], triangleSideFromPairwise(g.pairwise, i, j, k), 1e-9));
    }
}

// ---------------------------------------------------------------------------
// D. basis orthonormality and packing norm identity
// ---------------------------------------------------------------------------
{
  check("bases: center 8, middle 4, outer 1",
    CENTER_BASIS.length === 8 && MIDDLE_BASIS.length === 4 && OUTER_BASIS.length === 1);
  check("bases: gauge-unknown count = 23", N_GAUGE_REAL === 23);
  const basis = tracelessHermitianBasis(3);
  let orth = true;
  for (let a = 0; a < basis.length; a++)
    for (let b = 0; b < basis.length; b++) {
      const d = matTrace(matMul(basis[a], basis[b]))[0];
      if (!close(d, a === b ? 1 : 0, 1e-9)) orth = false;
    }
  check("bases: traceless Hermitian orthonormal", orth);
  check("bases: hermitianBasis(2) has 4", hermitianBasis(2).length === 4);

  const M = zerosZ(3, 3);
  for (let i = 0; i < 3; i++)
    for (let j = i; j < 3; j++) {
      const re = Math.sin(1 + i * 3 + j), im = j > i ? Math.cos(2 + i + j) : 0;
      M[i][j] = [re, im];
      M[j][i] = [re, -im];
    }
  const Mt = traceless(M);
  const coords = packHermitian(Mt, CENTER_BASIS);
  check("pack: ||coords|| = ||M||_F", close(Math.hypot(...coords), frobNorm(Mt), 1e-9),
    `${Math.hypot(...coords)} vs ${frobNorm(Mt)}`);
}

// ---------------------------------------------------------------------------
// E. unitary gauge covariance
// ---------------------------------------------------------------------------
{
  const { rep, levels } = symmetricFixture(1.3, 0.9);
  const ang = {
    g: [0.3, -0.1, -0.2],
    h: [[0.5, -0.4], [0.2, 0.7], [-0.6, 0.1]],
    q: [0.9, -1.1, 0.4],
  };
  check("gauge: det g = 1 (sum angles = 0)", close(ang.g[0] + ang.g[1] + ang.g[2], 0, 1e-12));
  const { g, h, q } = diagonalUnitaryGauge(ang);
  const g2 = gaugeAction(rep, g, h, q);
  check("gauge: complex residual preserved", complexResidualNorm(g2) < 1e-10,
    `norm=${complexResidualNorm(g2)}`);
  check("gauge: real residual ~ 0 (solution preserved)", realResidualNorm(g2, levels) < 1e-10,
    `norm=${realResidualNorm(g2, levels)}`);
}

// ---------------------------------------------------------------------------
// F. beta/level conversion and rep validation
// ---------------------------------------------------------------------------
{
  check("levels: betaToLevel doubles",
    JSON.stringify(betaToLevel([[1, 2], [3, 4], [5, 6]])) ===
    JSON.stringify([[2, 4], [6, 8], [10, 12]]));
  const bad = certifiedFixture().rep;
  bad.a[0] = Z([[1], [0], [0]]);
  check("validateRep catches wrong shape", validateRep(bad).length > 0);
}

// ---------------------------------------------------------------------------
console.log(`core-math: ${pass}/${pass + fail} checks passed`);
process.exit(fail === 0 ? 0 : 1);
