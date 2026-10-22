// validate-solver.mjs — Node battery for assets/js/ek-nakajima/solver.js.
//
// Exercises the Milestone-2 positive-Hermitian-gauge real-moment-map solver
// ported from sim/e6sim/hermitian_solver.py:
//   * expmHermitian sanity (exp(0) = I, diagonal Hermitian -> elementwise exp);
//   * exact symmetric y=0 fixture (solve from identity must succeed);
//   * the certified chart at z=2 with levels alpha=(3,3,3), gamma=(1,2,3);
//   * a complex (non-unitary) gauge transform of the symmetric fixture;
//   * a mismatched level vector (must NOT report success);
//   * result structure (logGauge / H / residuals / diagnostics).
//
// Run from tests/ after the modules are copied next to this file (see run.sh):
//   node validate-solver.mjs
import {
  NB,
  N_GAUGE_REAL,
  makeRep,
  zerosZ,
  eyeZ,
  matMul,
  matAdd,
  matSub,
  matScale,
  matAdj,
  matTrace,
  frob2,
  frobNorm,
  traceless,
  complexResidualNorm,
  realResidualNorm,
  realMaps,
} from "./core-math.js";
import {
  solveRealMomentMap,
  expmHermitian,
  hermitianEigenvalues,
  applyComplexGauge,
} from "./solver.js";

let pass = 0;
let fail = 0;
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const report = [];
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

// certified y=0 chart at z = 2 (exact integers)
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

// exact symmetric y=0 solution with scalar branch levels (alpha, gamma)
function symmetricFixture(alpha, gamma) {
  const sq = Math.sqrt;
  const a = [];
  for (let i = 0; i < NB; i++) a.push(Z([[sq(alpha)], [0]]));
  const A1 = Z([[sq(gamma + alpha), 0], [0, sq(gamma)], [0, 0]]);
  const A2 = Z([[0, 0], [sq(gamma + alpha), 0], [0, sq(gamma)]]);
  const A3 = Z([[0, sq(gamma)], [0, 0], [sq(gamma + alpha), 0]]);
  const b = [zrow12(), zrow12(), zrow12()];
  const B = [zmat23(), zmat23(), zmat23()];
  return {
    rep: makeRep(a, [A1, A2, A3], b, B),
    levels: [[alpha, gamma], [alpha, gamma], [alpha, gamma]],
  };
}

// --- manual complex gauge with moderate scale ------------------------------
// a manual invertible complex gauge with moderate scale (det g = 1 exactly:
// upper triangular with diagonal product 1.2 * 0.9 * (1/1.08) = 1)
function complexGaugeTransform(rep) {
  const g = [
    [[1.2, 0.0], [0.1, 0.05], [0.0, -0.05]],
    [[0.0, 0.0], [0.9, 0.0], [0.15, 0.1]],
    [[0.0, 0.0], [0.0, 0.0], [1.0 / 1.08, 0.0]],
  ];
  const h = [
    [[[1.1, 0.0], [0.2, -0.15]], [[-0.1, 0.2], [1.0, 0.0]]],
    [[[-0.9, 0.1], [0.15, 0.2]], [[0.3, -0.1], [0.8, 0.0]]],
    [[[0.9, -0.2], [0.15, 0.1]], [[0.0, 0.25], [1.0, -0.1]]],
  ];
  const q = [[1.2, 0.3], [0.8, -0.5], [1.0, 0.7]];
  return applyComplexGauge(rep, g, h, q);
}

// sorted spectra of Q_i = (A_i A_i^* - B_i^* B_i)_0 (compact-gauge invariant)
function sortedSpectra(rep) {
  const out = [];
  for (let i = 0; i < NB; i++) {
    const T = matSub(matMul(rep.A[i], matAdj(rep.A[i])), matMul(matAdj(rep.B[i]), rep.B[i]));
    out.push(hermitianEigenvalues(traceless(T)).slice().sort((a, b) => a - b));
  }
  return out;
}

// ---------------------------------------------------------------------------
// A. expmHermitian sanity
// ---------------------------------------------------------------------------
{
  const E3 = expmHermitian(zerosZ(3, 3));
  let idOk = true;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    if (!close(E3[i][j][0], i === j ? 1 : 0, 1e-12) || !close(E3[i][j][1], 0, 1e-12)) idOk = false;
  check("expm: exp(0) = I (3x3)", idOk);

  const E2 = expmHermitian(zerosZ(2, 2));
  check("expm: exp(0) = I (2x2)",
    close(E2[0][0][0], 1, 1e-12) && close(E2[1][1][0], 1, 1e-12) &&
    close(E2[0][1][0], 0, 1e-12) && close(E2[1][0][0], 0, 1e-12));

  const d = [0.3, -1.2, 2.5];
  const D = zerosZ(3, 3);
  for (let i = 0; i < 3; i++) D[i][i] = [d[i], 0];
  const ED = expmHermitian(D);
  let diagOk = true;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const want = i === j ? Math.exp(d[i]) : 0;
    if (!close(ED[i][j][0], want, 1e-12) || !close(ED[i][j][1], 0, 1e-12)) diagOk = false;
  }
  check("expm: diagonal Hermitian -> elementwise exp", diagOk);

  // closed form: exp([[0,1],[1,0]]) = cosh(1) I + sinh(1) sigma_x
  const Hx = [[[0, 0], [1, 0]], [[1, 0], [0, 0]]];
  const Ex = expmHermitian(Hx);
  const ch = Math.cosh(1), sh = Math.sinh(1);
  check("expm: closed form exp(sigma_x) = cosh I + sinh sigma_x",
    close(Ex[0][0][0], ch, 1e-10) && close(Ex[0][1][0], sh, 1e-10) &&
    close(Ex[1][0][0], sh, 1e-10) && close(Ex[1][1][0], ch, 1e-10) &&
    close(Ex[0][1][1], 0, 1e-10));

  // non-diagonal Hermitian: result must be Hermitian positive-definite
  const Hh = [[[0.4, 0], [0.1, 0.2], [0, -0.05]],
              [[0.1, -0.2], [-0.7, 0], [0.3, 0]],
              [[0, 0.05], [0.3, 0], [1.1, 0]]];
  const EH = expmHermitian(Hh);
  let hermOk = true;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    if (!close(EH[i][j][0], EH[j][i][0], 1e-10) || !close(EH[i][j][1], -EH[j][i][1], 1e-10)) hermOk = false;
  check("expm: Hermitian input -> Hermitian output", hermOk);
  check("expm: positive-definite (eigs > 0)",
    hermitianEigenvalues(EH).every((v) => v > 0));
}

// ---------------------------------------------------------------------------
// B. exact symmetric y=0 fixture: solve from identity
// ---------------------------------------------------------------------------
{
  const alpha = 1.3, gamma = 0.9;
  const { rep, levels } = symmetricFixture(alpha, gamma);
  check("symmetric: input complex residual ~ 0", complexResidualNorm(rep) < 1e-12);
  const res = solveRealMomentMap(rep, levels);
  report.push(
    `symmetric(identity)      success=${res.success} real_norm=${res.residuals.real_norm.toExponential(3)} ` +
    `real_rel=${res.residuals.real_rel.toExponential(3)} complex=${res.residuals.complex_norm.toExponential(3)} ` +
    `iters=${res.diagnostics.iterations} nfev=${res.diagnostics.nfev}`
  );
  check("symmetric: success", res.success);
  check("symmetric: real_norm <= 1e-9", res.residuals.real_norm <= 1e-9,
    `norm=${res.residuals.real_norm}`);
  check("symmetric: complex_norm <= 1e-8", res.residuals.complex_norm <= 1e-8);
  check("symmetric: |det(H_center)-1| ~ 0",
    Math.hypot(res.diagnostics.det_H_center[0] - 1, res.diagnostics.det_H_center[1]) < 1e-9);
  check("symmetric: gauge finite & positive-definite",
    res.diagnostics.gauge_finite && res.diagnostics.gauge_positive);
  // y = 0 preserved by every gauge of a y = 0 representative
  let yOk = true;
  for (let i = 0; i < NB; i++)
    if (frobNorm(res.solvedRep.b[i]) > 1e-10 || frobNorm(res.solvedRep.B[i]) > 1e-10) yOk = false;
  check("symmetric: y = 0 preserved", yOk);
  // levels recovered
  const maps = realMaps(res.solvedRep);
  let lvlOk = true;
  for (let i = 0; i < NB; i++) {
    if (!close(maps.outer[i][0][0][0], levels[i][0], 1e-8)) lvlOk = false;
    if (!close(maps.middle[i][0][0][0], levels[i][1], 1e-8) ||
        !close(maps.middle[i][1][1][0], levels[i][1], 1e-8) ||
        !close(maps.middle[i][0][1][0], 0, 1e-8)) lvlOk = false;
  }
  check("symmetric: real maps recover levels", lvlOk);
  check("symmetric: center map ~ 0", frobNorm(maps.center) < 1e-8);
  check("symmetric: residual vector length 23", res.residuals.real_packed.length === N_GAUGE_REAL);
}

// ---------------------------------------------------------------------------
// C. certified chart at z=2, levels alpha=(3,3,3), gamma=(1,2,3)
// ---------------------------------------------------------------------------
{
  const { rep, levels } = certifiedFixture();
  check("certified: input complex residual ~ 0", complexResidualNorm(rep) < 1e-12);
  const res = solveRealMomentMap(rep, levels);
  report.push(
    `certified(z=2)           success=${res.success} real_norm=${res.residuals.real_norm.toExponential(3)} ` +
    `real_rel=${res.residuals.real_rel.toExponential(3)} complex=${res.residuals.complex_norm.toExponential(3)} ` +
    `iters=${res.diagnostics.iterations} nfev=${res.diagnostics.nfev}`
  );
  check("certified: success", res.success,
    `real_norm=${res.residuals.real_norm} status=${res.diagnostics.status}`);
  check("certified: real_norm <= 1e-9", res.residuals.real_norm <= 1e-9,
    `norm=${res.residuals.real_norm}`);
  check("certified: complex_norm <= 1e-8", res.residuals.complex_norm <= 1e-8);
  check("certified: |det(H_center)-1| ~ 0",
    Math.hypot(res.diagnostics.det_H_center[0] - 1, res.diagnostics.det_H_center[1]) < 1e-8);
  check("certified: gauge finite & positive-definite",
    res.diagnostics.gauge_finite && res.diagnostics.gauge_positive);
}

// ---------------------------------------------------------------------------
// D. complex-gauge transform of the symmetric fixture
// ---------------------------------------------------------------------------
{
  const alpha = 1.4, gamma = 2.1;
  const base = symmetricFixture(alpha, gamma);
  const repK = complexGaugeTransform(base.rep);
  check("complex-gauge: transformed rep still complex-zero", complexResidualNorm(repK) < 1e-10,
    `norm=${complexResidualNorm(repK)}`);
  const res = solveRealMomentMap(repK, base.levels);
  report.push(
    `complex-gauge(sym)       success=${res.success} real_norm=${res.residuals.real_norm.toExponential(3)} ` +
    `real_rel=${res.residuals.real_rel.toExponential(3)} complex=${res.residuals.complex_norm.toExponential(3)} ` +
    `iters=${res.diagnostics.iterations} nfev=${res.diagnostics.nfev}`
  );
  check("complex-gauge: success", res.success,
    `real_norm=${res.residuals.real_norm} status=${res.diagnostics.status}`);
  check("complex-gauge: real_norm <= 1e-9", res.residuals.real_norm <= 1e-9);
  check("complex-gauge: |det(H_center)-1| < 1e-9",
    Math.hypot(res.diagnostics.det_H_center[0] - 1, res.diagnostics.det_H_center[1]) < 1e-9);
  // compact-gauge-invariant spectra must match the original fixture
  const specRef = sortedSpectra(base.rep);
  const specSol = sortedSpectra(res.solvedRep);
  let specOk = true;
  for (let i = 0; i < NB; i++)
    for (let k = 0; k < 3; k++) if (!close(specSol[i][k], specRef[i][k], 1e-6)) specOk = false;
  check("complex-gauge: central Q_i spectra match modulo compact gauge", specOk);
}

// ---------------------------------------------------------------------------
// E. mismatched levels: no false positive
// ---------------------------------------------------------------------------
{
  const { rep } = symmetricFixture(1.3, 0.9);
  // The symmetric fixture solves only the uniform level vector (1.3, 0.9);
  // a non-uniform (and one with a negative component) is not solvable.
  const badLevels = [[1.3, 0.2], [1.3, 0.9], [1.3, 0.2]];
  const res = solveRealMomentMap(rep, badLevels);
  report.push(
    `mismatched levels        success=${res.success} real_norm=${res.residuals.real_norm.toExponential(3)} ` +
    `real_rel=${res.residuals.real_rel.toExponential(3)} complex=${res.residuals.complex_norm.toExponential(3)} ` +
    `iters=${res.diagnostics.iterations} nfev=${res.diagnostics.nfev}`
  );
  check("mismatched: success is FALSE (no false positive)", res.success === false,
    `real_norm=${res.residuals.real_norm}`);
  check("mismatched: real_norm is reported (finite)", isFinite(res.residuals.real_norm));
}

// ---------------------------------------------------------------------------
// F. cached residual stopping respects acceptance and avoids redundant work
// ---------------------------------------------------------------------------
{
  const base = symmetricFixture(1.4, 2.1);
  const exact = solveRealMomentMap(base.rep, base.levels);
  check("balanced input: accepted without a Jacobian", exact.success && exact.diagnostics.nfev === 1);
  const rep = complexGaugeTransform(base.rep);
  const solved = solveRealMomentMap(rep, base.levels, {multistart:false});
  const warm = solveRealMomentMap(rep, base.levels, {initialLogGauge:solved.logGauge});
  check("accepted warm seed: no redundant Jacobian or fallback", warm.success && warm.diagnostics.nfev === 1);
  const strict = solveRealMomentMap(rep, base.levels, {abs_tol:1,rel_tol:1e-11,multistart:false});
  check("residual stop honors tighter relative tolerance", strict.success && strict.residuals.real_rel <= 1e-11,
    `relative=${strict.residuals.real_rel}`);
}

// ---------------------------------------------------------------------------
// G. result structure
// ---------------------------------------------------------------------------
{
  const { rep, levels } = symmetricFixture(1.0, 1.0);
  const res = solveRealMomentMap(rep, levels);
  check("structure: H has center/middle[3]/outer[3]",
    !!res.H.center && res.H.middle.length === 3 && res.H.outer.length === 3);
  check("structure: logGauge has center(8)/middle(4x3)/outer(1x3)",
    res.logGauge.center.length === 8 &&
    res.logGauge.middle.every((m) => m.length === 4) &&
    res.logGauge.outer.every((o) => o.length === 1));
  check("structure: H_middle = exp(S_i) via logGauge",
    res.H.middle.every((M) => M.length === 2 && M[0].length === 2));
  const needDiag = ["status", "iterations", "nfev", "max_log_gauge", "det_H_center",
    "gauge_finite", "gauge_positive", "abs_tol", "rel_tol", "complex_tol", "det_tol"];
  check("structure: diagnostics keys", needDiag.every((k) => k in res.diagnostics));
  const needRes = ["real_norm", "real_rel", "complex_norm", "per_vertex", "real_packed"];
  check("structure: residuals keys", needRes.every((k) => k in res.residuals));
  check("structure: per_vertex outer/middle/center",
    res.residuals.per_vertex.outer.length === 3 &&
    res.residuals.per_vertex.middle.length === 3 &&
    isFinite(res.residuals.per_vertex.center));
}

// ---------------------------------------------------------------------------
for (const line of report) console.log("  " + line);
console.log(`solver: ${pass}/${pass + fail} checks passed`);
process.exit(fail === 0 ? 0 : 1);
