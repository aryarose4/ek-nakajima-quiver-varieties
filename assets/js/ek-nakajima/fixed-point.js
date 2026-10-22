// C* fixedness witnesses for E6 representations, independent of stability.
// Convention: g(lambda).rep = (a,A,lambda b,lambda B). In eigenbases of
// g_v(lambda)=S_v diag(lambda^weights_v) S_v^-1, each nonzero arrow entry
// has target weight minus source weight equal to its degree (x:0, y:1).
// This integer grading proves equality for EVERY nonzero complex lambda,
// not only sampled circle phases. Floating-point evaluation below checks
// a supplied algebraic witness; small residuals alone are not exact proofs.
// Common shifts of all vertex weights have no action. GL(3) at the center
// modulo simultaneous scalars gives the same effective complex gauge as
// SL(3); determinant normalization may require a finite covering parameter.
import { eyeZ, zerosZ, matMul, cAdd, cSub, cMul, cAbs2 } from "./core-math.js";

const divide = (a, b) => {
  const d = cAbs2(b);
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const vertices = ['center', 'middle0', 'middle1', 'middle2', 'outer0', 'outer1', 'outer2'];
const dimensions = [3, 2, 2, 2, 1, 1, 1];
function arrows(rep) {
  const result = [];
  for (let i = 0; i < 3; i++) {
    result.push({ name: 'a' + i, source: 'outer' + i, target: 'middle' + i, degree: 0, matrix: rep.a[i] });
    result.push({ name: 'A' + i, source: 'middle' + i, target: 'center', degree: 0, matrix: rep.A[i] });
    result.push({ name: 'b' + i, source: 'middle' + i, target: 'outer' + i, degree: 1, matrix: rep.b[i] });
    result.push({ name: 'B' + i, source: 'center', target: 'middle' + i, degree: 1, matrix: rep.B[i] });
  }
  return result;
}

function inverse(matrix) {
  const n = matrix.length, identity = eyeZ(n);
  const rows = matrix.map((row, i) => row.map(z => z.slice()).concat(identity[i]));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let i = col + 1; i < n; i++) if (cAbs2(rows[i][col]) > cAbs2(rows[pivot][col])) pivot = i;
    if (cAbs2(rows[pivot][col]) < 1e-28) throw new RangeError('Singular grading basis.');
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const value = rows[col][col];
    rows[col] = rows[col].map(z => divide(z, value));
    for (let i = 0; i < n; i++) if (i !== col) {
      const factor = rows[i][col];
      rows[i] = rows[i].map((z, j) => cSub(z, cMul(factor, rows[col][j])));
    }
  }
  return rows.map(row => row.slice(n));
}

export function zeroSectionGrading() {
  const grading = {};
  vertices.forEach((v, i) => { grading[v] = { weights: Array(dimensions[i]).fill(0), basis: eyeZ(dimensions[i]) }; });
  return grading;
}

export function concurrencyGrading() {
  const grading = zeroSectionGrading();
  grading.center = {
    weights: [0, 0, 1],
    basis: [[2 / 3, -1 / 3, 1], [-1 / 3, 2 / 3, 1], [-1 / 3, -1 / 3, 1]].map(row => row.map(x => [x, 0]))
  };
  for (let i = 0; i < 3; i++) grading['middle' + i].weights = [0, 1];
  return grading;
}

export function checkFixedPointGrading(rep, grading, tolerance = 1e-10) {
  if (!(tolerance >= 0) || !Number.isFinite(tolerance)) throw new RangeError('Invalid tolerance.');
  const bases = {}, inverses = {};
  vertices.forEach((v, i) => {
    const spec = grading[v], n = dimensions[i];
    if (!spec || !Array.isArray(spec.weights) || spec.weights.length !== n || !spec.weights.every(Number.isSafeInteger)) {
      throw new RangeError('Expected integer weights at ' + v);
    }
    const basis = spec.basis || eyeZ(n);
    if (basis.length !== n || !basis.every(row => row.length === n && row.every(z => Array.isArray(z) && z.length === 2 && z.every(Number.isFinite)))) {
      throw new RangeError('Invalid grading basis at ' + v);
    }
    bases[v] = basis;
    inverses[v] = inverse(basis);
  });
  let residualSquared = 0, scaleSquared = 0;
  const arrowResiduals = {};
  for (const arrow of arrows(rep)) {
    const transformed = matMul(matMul(inverses[arrow.target], arrow.matrix), bases[arrow.source]);
    let squared = 0;
    transformed.forEach((row, i) => row.forEach((value, j) => {
      const mismatch = grading[arrow.target].weights[i] - grading[arrow.source].weights[j] - arrow.degree;
      squared += mismatch * mismatch * cAbs2(value);
      scaleSquared += cAbs2(value);
    }));
    arrowResiduals[arrow.name] = Math.sqrt(squared);
    residualSquared += squared;
  }
  const residual = Math.sqrt(residualSquared), relativeResidual = residual / Math.max(1, Math.sqrt(scaleSquared));
  return { passes: Number.isFinite(relativeResidual) && relativeResidual <= tolerance, residual, relativeResidual, arrowResiduals };
}

// Necessary condition, not a sufficient certificate: differentiation at 1
// gives H_target M - M H_source = degree*M. Inconsistency rules out even
// an arbitrary non-diagonal compensating gauge. Consistency need not supply
// semisimple integral generators and is deliberately NOT called fixedness.
export function fixedPointInfinitesimalTest(rep, tolerance = 1e-10) {
  if (!(tolerance > 0) || !Number.isFinite(tolerance)) throw new RangeError('Invalid tolerance.');
  const offsets = {}, dims = {};
  let count = 0;
  vertices.forEach((v, i) => { offsets[v] = count; dims[v] = dimensions[i]; count += dimensions[i] ** 2; });
  const equations = [];
  for (const arrow of arrows(rep)) {
    const M = arrow.matrix, nt = dims[arrow.target], ns = dims[arrow.source];
    for (let i = 0; i < nt; i++) for (let j = 0; j < ns; j++) {
      const row = zerosZ(1, count + 1)[0];
      for (let k = 0; k < nt; k++) {
        const index = offsets[arrow.target] + i * nt + k;
        row[index] = cAdd(row[index], M[k][j]);
      }
      for (let k = 0; k < ns; k++) {
        const index = offsets[arrow.source] + k * ns + j;
        row[index] = cSub(row[index], M[i][k]);
      }
      row[count] = arrow.degree ? M[i][j].slice() : [0, 0];
      const norm = Math.sqrt(row.reduce((s, z) => s + cAbs2(z), 0));
      equations.push(norm > 0 ? row.map(z => [z[0] / norm, z[1] / norm]) : row);
    }
  }
  let rank = 0;
  for (let col = 0; col < count; col++) {
    let pivot = rank;
    for (let i = rank; i < equations.length; i++) if (cAbs2(equations[i][col]) > cAbs2(equations[pivot][col])) pivot = i;
    if (Math.sqrt(cAbs2(equations[pivot][col])) <= tolerance) continue;
    [equations[rank], equations[pivot]] = [equations[pivot], equations[rank]];
    const value = equations[rank][col];
    equations[rank] = equations[rank].map(z => divide(z, value));
    for (let i = rank + 1; i < equations.length; i++) {
      const factor = equations[i][col];
      equations[i] = equations[i].map((z, j) => cSub(z, cMul(factor, equations[rank][j])));
    }
    rank++;
  }
  const obstruction = equations.slice(rank).reduce((max, row) => Math.max(max, Math.sqrt(cAbs2(row[count]))), 0);
  return { consistent: Number.isFinite(obstruction) && obstruction <= tolerance, rank, obstruction };
}
