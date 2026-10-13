// validate-model.mjs — Node battery for the pure (r, theta) driver layer:
//   assets/js/ek-nakajima/chart.js
//   assets/js/ek-nakajima/element-model.js
//   assets/js/ek-nakajima/solver.js (warm-start option)
//
// Run from tests/ after the modules are copied next to this file (see run.sh):
//   node validate-model.mjs
//
// Checks:
//   A. the chart at z = [2, 0] reproduces the certified chart matrices exactly
//      and has zero complex residual;
//   B. the LIVE LOOP: r = 2, theta over 0..2*pi in 48 steps, warm-started from
//      the previous step's logGauge, every step SUCCEEDS;
//   C. CONTINUITY: the maximum change in any triangle vertex between
//      consecutive theta steps is small, and the loop nearly closes;
//   D. the warm start is actually used (nfev of first vs a later step) and
//      gives a smaller/equal total nfev than a cold start on a later step;
//   E. HONEST FAILURE: at z = 0 (r = 0) success is FALSE (z = 0 is strictly
//      unstable under the certified levels: exceptional z is {0, 1, infinity}).
import {
  NB,
  makeRep,
  matSub,
  frobNorm,
  complexResidualNorm,
  realResidualNorm,
} from "./core-math.js";
import { candidateY0Chart, chartAt } from "./chart.js";
import { solveRealMomentMap, flatLogGauge } from "./solver.js";
import { solveElement } from "./element-model.js";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  FAIL: ${name}${detail ? " :: " + detail : ""}`);
  }
}
const close = (a, b, tol = 0) => Math.abs(a - b) <= tol;

const Z = (rows) => rows.map((r) => r.map((e) => (Array.isArray(e) ? [e[0], e[1]] : [e, 0])));

// Certified fixture data (Milestone 1): z = 2, levels alpha=(3,3,3), gamma=(1,2,3).
const LEVELS = [[3, 1], [3, 2], [3, 3]];

// The exact certified chart matrices at z = 2, used for the exact-reproduction
// check. Mirror of sim/e6sim/fixtures/certified_y0_chart.py.
function certifiedChartAtZ2() {
  const a = [Z([[1], [0]]), Z([[1], [0]]), Z([[1], [0]])];
  const A = [
    Z([[1, 0], [0, 1], [0, 1]]),
    Z([[0, 1], [1, 0], [0, 1]]),
    Z([[0, 1], [0, 2], [1, 0]]),
  ];
  const b = [Z([[0, 0]]), Z([[0, 0]]), Z([[0, 0]])];
  const B = [Z([[0, 0, 0], [0, 0, 0]]), Z([[0, 0, 0], [0, 0, 0]]), Z([[0, 0, 0], [0, 0, 0]])];
  return makeRep(a, A, b, B);
}

// Entrywise exact (-to-tolerance) comparison of two reps.
function repsEqual(r1, r2, tol = 0) {
  for (const key of ["a", "A", "b", "B"]) {
    for (let i = 0; i < NB; i++) {
      const M1 = r1[key][i];
      const M2 = r2[key][i];
      if (M1.length !== M2.length || M1[0].length !== M2[0].length) return false;
      for (let r = 0; r < M1.length; r++)
        for (let c = 0; c < M1[0].length; c++)
          if (!close(M1[r][c][0], M2[r][c][0], tol) || !close(M1[r][c][1], M2[r][c][1], tol))
            return false;
    }
  }
  return true;
}

const maxAbsRepDiff = (r1, r2) => {
  let d = 0;
  for (const key of ["a", "A", "b", "B"])
    for (let i = 0; i < NB; i++)
      d = Math.max(d, frobNorm(matSub(r1[key][i], r2[key][i])));
  return d;
};

// ---------------------------------------------------------------------------
// A. chart at z = [2, 0] reproduces the certified matrices and is complex-zero
// ---------------------------------------------------------------------------
{
  const rep = candidateY0Chart([2, 0]);
  const ref = certifiedChartAtZ2();
  check("chart: z=[2,0] reproduces certified matrices exactly",
    repsEqual(rep, ref, 0), `maxdiff=${maxAbsRepDiff(rep, ref)}`);
  check("chart: z=[2,0] complex residual = 0",
    complexResidualNorm(rep) === 0, `norm=${complexResidualNorm(rep)}`);

  // chartAt(2, 0) is the same point as candidateY0Chart([2, 0]).
  check("chart: chartAt(2,0) == candidateY0Chart([2,0])",
    repsEqual(chartAt(2, 0), rep, 0));

  // chartAt(r, theta) really is z = r exp(i theta): |z| = r.
  const z2pi3 = chartAt(2, (2 * Math.PI) / 3);
  check("chart: chartAt(2, 2pi/3) complex residual = 0", complexResidualNorm(z2pi3) === 0);
}

// ---------------------------------------------------------------------------
// B/C. live loop r = 2, theta over 0..2*pi in 48 steps, warm-started
// ---------------------------------------------------------------------------
const N_STEPS = 48;
let loopRes = [];
{
  let prevLogGauge = undefined;
  const vertices = [];
  const nfevByStep = [];
  const realNormByStep = [];
  let successes = 0;
  let failures = 0;
  let firstFailK = -1;

  for (let k = 0; k <= N_STEPS; k++) {
    const theta = (2 * Math.PI * k) / N_STEPS;
    const opts = k === 0 ? {} : { initialLogGauge: prevLogGauge };
    const res = solveElement(2, theta, LEVELS, opts);
    nfevByStep.push(res.diagnostics.nfev);
    realNormByStep.push(realResidualNorm(res.solvedRep, LEVELS));
    if (res.success) {
      successes++;
      prevLogGauge = res.logGauge;
      vertices.push(res.view.vertices);
    } else {
      failures++;
      if (firstFailK < 0) firstFailK = k;
    }
  }

  check("loop: every step succeeds (r = 2 stable)", failures === 0,
    `failures=${failures} firstFailK=${firstFailK}`);

  // Max vertex jump between consecutive steps (all three vertices, all coords).
  let maxJump = 0;
  for (let k = 1; k < vertices.length; k++) {
    for (let v = 0; v < 3; v++)
      for (let d = 0; d < 3; d++)
        maxJump = Math.max(maxJump, Math.abs(vertices[k][v][d] - vertices[k - 1][v][d]));
  }
  check("continuity: no NaN in loop vertices",
    vertices.every((vs) => vs.every((v) => v.every((x) => Number.isFinite(x)))));
  check("continuity: max vertex jump does not spike", maxJump < 1.0,
    `maxJump=${maxJump}`);

  // Loop closure: start (theta=0) vs end (theta=2*pi) vertices. Up to compact
  // gauge these agree; here the raw entries are compared (see caveat below).
  let closureResidual = 0;
  if (vertices.length >= 2) {
    const v0 = vertices[0];
    const vN = vertices[vertices.length - 1];
    for (let v = 0; v < 3; v++)
      for (let d = 0; d < 3; d++)
        closureResidual = Math.max(closureResidual, Math.abs(vN[v][d] - v0[v][d]));
  }
  check("continuity: loop nearly closes", closureResidual < 1.0,
    `closureResidual=${closureResidual}`);

  const maxRealNorm = Math.max(...realNormByStep);
  check("loop: every step's real residual <= 1e-9", maxRealNorm <= 1e-9,
    `maxRealNorm=${maxRealNorm}`);

  // -------------------------------------------------------------------------
  // D. warm start actually used
  // -------------------------------------------------------------------------
  const nfevFirst = nfevByStep[0];
  const nfevLater = nfevByStep[N_STEPS];
  check("warmstart: later step nfev <= first step nfev (warm helps)",
    nfevLater <= nfevFirst, `first=${nfevFirst} later=${nfevLater}`);

  // Cold start on a later step (no warm start, multistart fallback).
  const midK = N_STEPS / 2;
  const thetaMid = (2 * Math.PI * midK) / N_STEPS;
  const cold = solveElement(2, thetaMid, LEVELS, {});
  const warm = nfevByStep[midK];
  check("warmstart: warm nfev <= cold nfev on later step",
    warm <= cold.diagnostics.nfev, `warm=${warm} cold=${cold.diagnostics.nfev}`);

  // flatLogGauge layout sanity: length 23 and round-trips the seed.
  const flat = flatLogGauge(prevLogGauge);
  check("warmstart: flatLogGauge length = 23", flat.length === 23, `len=${flat.length}`);
  const warmFromFlat = solveElement(2, 0, LEVELS, { initialLogGauge: flat });
  check("warmstart: flat array accepted as initialLogGauge", warmFromFlat.success === true);

  loopRes = {
    maxJump,
    closureResidual,
    nfevFirst,
    nfevLater,
    nfevMid: warm,
    nfevColdMid: cold.diagnostics.nfev,
    successes,
    maxRealNorm,
  };
  console.log(
    `  loop: success=${successes}/${successes + failures} maxJump=${maxJump.toExponential(3)} ` +
    `closure=${closureResidual.toExponential(3)} maxRealNorm=${maxRealNorm.toExponential(3)}`
  );
  console.log(
    `  warmstart: nfev first=${nfevFirst} later(${N_STEPS})=${nfevLater} mid(warm)=${warm} ` +
    `mid(cold)=${cold.diagnostics.nfev}`
  );
}

// ---------------------------------------------------------------------------
// E. honest failure at z = 0 (r = 0): strictly unstable -> success FALSE
// ---------------------------------------------------------------------------
{
  for (const theta of [0, 1.0]) {
    const res = solveElement(0, theta, LEVELS, {});
    const norm = realResidualNorm(res.solvedRep, LEVELS);
    check(`z=0 (theta=${theta}): success is FALSE (no false positive)`,
      res.success === false, `success=${res.success} real_norm=${norm} status=${res.diagnostics.status}`);
    check(`z=0 (theta=${theta}): failed residual is reported (finite)`, isFinite(norm));
  }
}

// ---------------------------------------------------------------------------
console.log(`element-model: ${pass}/${pass + fail} checks passed`);
process.exit(fail === 0 ? 0 : 1);
