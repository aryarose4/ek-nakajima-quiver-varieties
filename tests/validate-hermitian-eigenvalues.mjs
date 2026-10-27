// Independent spectral fixtures and the real balanced chamber-201 regression.
import assert from 'assert';
import {source} from './continuity-features.mjs';

(async function () {
  const {eigvalsHermitian3} = await import(source('element-view.js'));
  const {matMul, matAdj, matAdd, matScale, eyeZ} = await import(source('core-math.js'));
  const diagonal = (values) => values.map((v, i) => values.map((_, j) => [i === j ? v : 0, 0]));
  let checks = 0;
  function checkSpectrum(label, H, expected, tolerance = 3e-15) {
    const saved = JSON.stringify(H), actual = eigvalsHermitian3(H);
    const scale = Math.max(...expected.map(Math.abs)) || 1;
    assert(actual.every(Number.isFinite), label + ': finite');
    assert(actual[0] >= actual[1] && actual[1] >= actual[2], label + ': descending');
    expected.slice().sort((a, b) => b - a).forEach((v, i) =>
      assert(Math.abs(actual[i] / scale - v / scale) <= tolerance,
        label + ': spectrum ' + JSON.stringify({actual, expected})));
    assert.strictEqual(JSON.stringify(H), saved, label + ': input unchanged');
    // Independently accumulated trace and Frobenius norm, after scaling to
    // avoid test overflow/underflow. Neither uses the production algorithm.
    let trace = 0, norm2 = 0;
    for (let i = 0; i < 3; i++) {
      trace += H[i][i][0] / scale;
      for (let j = 0; j < 3; j++) norm2 += (H[i][j][0] / scale) ** 2 + (H[i][j][1] / scale) ** 2;
    }
    assert(Math.abs(actual.reduce((s, v) => s + v / scale, 0) - trace) < 12 * tolerance, label + ': trace');
    assert(Math.abs(actual.reduce((s, v) => s + (v / scale) ** 2, 0) - norm2) < 24 * tolerance, label + ': Frobenius');
    checks++;
    return actual;
  }
  function rotation(p, q, angle, phase) {
    const U = eyeZ(3), c = Math.cos(angle), s = Math.sin(angle);
    U[p][p] = U[q][q] = [c, 0];
    U[p][q] = [s * Math.cos(phase), s * Math.sin(phase)];
    U[q][p] = [-s * Math.cos(phase), s * Math.sin(phase)];
    return U;
  }
  function conjugate(values, seed) {
    const U = matMul(matMul(rotation(0, 1, .43 + seed, .7), rotation(1, 2, .83, 1.1 + seed)), rotation(0, 2, -.31, -.6));
    return matMul(matMul(U, diagonal(values)), matAdj(U));
  }
  checkSpectrum('zero', diagonal([0, 0, 0]), [0, 0, 0]);
  checkSpectrum('diagonal order', diagonal([-7, 4, 1]), [4, 1, -7]);
  checkSpectrum('scalar', diagonal([13, 13, 13]), [13, 13, 13]);
  for (let i = 0; i < 80; i++) {
    const spectra = [[7, 2, -4], [7, 2 + 1e-7, 2], [7, 2, 2], [2, 2, 2],
      [2 + 2e-12, 2 + 1e-12, 2], [3, 0, -3]];
    const spectrum = spectra[i % spectra.length];
    checkSpectrum('complex unitary ' + i, conjugate(spectrum, i * .19), spectrum);
  }
  for (const scale of [1e-310, 1e-250, 1e-80, 1, 1e80, 1e250]) {
    const values = [7, 2 + 1e-7, 2].map((v) => scale * v);
    checkSpectrum('scale ' + scale, matScale(conjugate([7, 2 + 1e-7, 2], .4), scale), values,
      scale < 1e-300 ? 1e-13 : 3e-15);
  }
  const clustered = matAdd(matScale(eyeZ(3), 1e12), conjugate([.03, .002, -.02], .7));
  checkSpectrum('large common diagonal', clustered, [1e12 + .03, 1e12 + .002, 1e12 - .02], 8e-16);
  checkSpectrum('opposite extreme diagonals', diagonal([-1e308, 1e308, 0]), [1e308, 0, -1e308]);
  const extreme = diagonal([-1e308, 0, 0]);
  extreme[0][1] = extreme[1][0] = [1e308, 0];
  checkSpectrum('extreme shifted restoration', extreme, [(Math.sqrt(5) - 1) * 5e307, 0, -(Math.sqrt(5) + 1) * 5e307]);

  // Separate real 6x6 embedding: every complex Hermitian eigenvalue occurs
  // twice. Real symmetric rotations provide an independent complex-phase
  // check and do not share production arithmetic or convergence thresholds.
  function realEmbeddingSpectrum(H) {
    const A = Array.from({length: 6}, (_, i) => Array.from({length: 6}, (_, j) =>
      i < 3 ? (j < 3 ? H[i][j][0] : -H[i][j - 3][1]) :
        (j < 3 ? H[i - 3][j][1] : H[i - 3][j - 3][0])));
    for (let iteration = 0; iteration < 2000; iteration++) {
      let p = 0, q = 1, off = 0;
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
        if (Math.abs(A[i][j]) > off) { off = Math.abs(A[i][j]); p = i; q = j; }
      }
      if (off < 1e-14) break;
      const b = A[p][q], tau = (A[q][q] - A[p][p]) / (2 * b);
      const t = (tau < 0 ? -1 : 1) / (Math.abs(tau) + Math.hypot(1, tau));
      const c = 1 / Math.hypot(1, t), s = t * c;
      A[p][p] -= t * b; A[q][q] += t * b; A[p][q] = A[q][p] = 0;
      for (let k = 0; k < 6; k++) if (k !== p && k !== q) {
        const x = A[k][p], y = A[k][q];
        A[k][p] = A[p][k] = c * x - s * y;
        A[k][q] = A[q][k] = s * x + c * y;
      }
    }
    const values = A.map((row, i) => row[i]).sort((a, b) => b - a);
    for (const i of [0, 2, 4]) assert(Math.abs(values[i] - values[i + 1]) < 5e-13, 'real embedding multiplicity');
    return [0, 2, 4].map((i) => (values[i] + values[i + 1]) / 2);
  }
  const {solveBalancedAtlas} = await import(source('balanced-model.js'));
  const {balancedObservables} = await import(source('balanced-observables.js'));
  const {balancedTensorDiagram} = await import(source('weighted-balanced-diagram.js'));
  const {betaToLevels} = await import(source('e6-parameters.js'));
  const beta = [[.24705882352941175, .6705882352941176], [3.8823529411764706, .1764705882352941], [.5647058823529412, .4588235294117647]];
  const chamberId = 'weyl:5.2.0.1.4.1.4.1.4.1.0.2.1.0.3.2.0.1.4.1.0.2.3.0.1.2.0.1.4.0.1.4.1.0.4.1.0.2.5.3.2.0.1.4.1.0.2.3.5.0.3.2.0.1.4.1.0.2.3.0.5.2.5.0.3.2.0.1.4.1.4.1.4.1.0.2.3.0.5.2.5.0.3.2.0.1.4.1.4.1.4.1.0.2.3.0.5';
  const rows = [];
  for (const [r, theta] of [[.1634437, 0], [.3783127, 1e-5]]) {
    const solved = solveBalancedAtlas({r, theta, t: 0, phi: 0, sphere: 0}, betaToLevels(beta), {chamber: {id: chamberId}});
    assert(solved.success, 'actual chamber-201 solve');
    assert(solved.residuals.real_norm < 1e-9 && solved.residuals.complex_norm < 1e-9, 'moment residuals');
    const observables = balancedObservables(solved.solvedRep);
    const H = observables.branches.map((branch, i) => matScale(branch.H, [1, 2, 4][i])).reduce(matAdd);
    const reference = realEmbeddingSpectrum(H);
    const actual = checkSpectrum('balanced chamber-201 ' + r, H, reference);
    const gap = Math.min(actual[0] - actual[1], actual[1] - actual[2]);
    const expectedGap = Math.min(reference[0] - reference[1], reference[1] - reference[2]);
    assert(Math.abs(gap - expectedGap) < 5e-13, 'near-collision gap retained');
    assert(gap > 1e-8 * Math.max(1, ...actual.map(Math.abs)), 'existing camera gap threshold clears');
    const diagram = balancedTensorDiagram(solved.solvedRep);
    assert(diagram.valid, 'camera available above existing threshold: ' + diagram.reason);
    rows.push({r, theta, gap, referenceGap: expectedGap, cameraValid: diagram.valid});
  }
  const benchmark = conjugate([7, 2 + 1e-7, 2], .31), start = Date.now();
  for (let i = 0; i < 20000; i++) eigvalsHermitian3(benchmark);
  console.log(JSON.stringify({spectralFixtures: checks, regressions: rows, microsecondsPerCall: (Date.now() - start) * 1000 / 20000}));
})().catch((error) => { console.error(error); process.exitCode = 1; });
