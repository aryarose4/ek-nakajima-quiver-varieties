import { readFileSync } from 'fs';
import assert from 'assert';
const source = (n) => readFileSync(new URL('../assets/js/ek-nakajima/' + n, import.meta.url), 'utf8');
const uri = (s) => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const core = uri(source('core-math.js'));
const moduleURI = (n) => uri(source(n).replace('"./core-math.js"', JSON.stringify(core)));
Promise.all([import(core), import(moduleURI('chart.js')), import(moduleURI('limit-chart.js'))]).then(([m, chart, limit]) => {
  let checks = 0;
  const check = (ok, label) => { checks++; assert.ok(ok, label); };
  const Z = (rows) => rows.map((row) => row.map((x) => [x, 0]));
  const distance = (a, b) => Math.sqrt(['a', 'A', 'b', 'B'].reduce((sum, key) => sum + a[key].reduce((s, x, i) => s + m.frob2(m.matSub(x, b[key][i])), 0), 0));
  for (const v of [[0, 0], [1, 0], [-2, 3]]) for (const phi of [0, 0.7, 3]) {
    const target = limit.concurrencyLimitChart(phi, v);
    check(m.complexResidualNorm(target) < 1e-12, 'limit family satisfies complex moment maps');
    let previous = Infinity;
    for (const lambda of [10, 100, 1000]) {
      const phase = [Math.cos(phi), Math.sin(phi)];
      const rep = chart.transverseChart([1 + v[0] / lambda ** 2, v[1] / lambda ** 2], [lambda * phase[0], lambda * phase[1]]);
      const g = Z([0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + (1 / lambda - 1) / 3)));
      const inverseG = Z([0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + (lambda - 1) / 3)));
      const h = Z([[1, -1], [0, 1 / lambda]]), inverseH = Z([[1, lambda], [0, lambda]]);
      const gauged = m.makeRep(rep.a.map((a) => m.matMul(h, a)), rep.A.map((A) => m.matMul(m.matMul(g, A), inverseH)), rep.b.map((b) => m.matMul(b, inverseH)), rep.B.map((B) => m.matMul(m.matMul(h, B), inverseG)));
      const error = distance(gauged, target);
      check(error < previous / 5, 'actual complex gauges converge at least linearly');
      previous = error;
    }
    check(previous < 0.03, 'finite lambda is close to claimed limit');
  }
  const rep = chart.transverseChart(2, 3);
  // The new coordinate has C* weight two, including its circle phase.
  for (const kappa of [[2, 0], [0, 1], [0.7, -0.4]]) {
    const v = [0.3, 0.8];
    const family = limit.concurrencyLimitChart(0, v);
    const modulus2 = kappa[0] ** 2 + kappa[1] ** 2;
    const inverse = [kappa[0] / modulus2, -kappa[1] / modulus2];
    const g = [0, 1, 2].map(i => [0, 1, 2].map(j => [(i === j ? 1 : 0) + (inverse[0] - 1) / 3, inverse[1] / 3]));
    const inverseG = [0, 1, 2].map(i => [0, 1, 2].map(j => [(i === j ? 1 : 0) + (kappa[0] - 1) / 3, kappa[1] / 3]));
    const h = [[[1, 0], [0, 0]], [[0, 0], inverse]];
    const inverseH = [[[1, 0], [0, 0]], [[0, 0], kappa]];
    const transformed = m.makeRep(family.a.map(a => m.matMul(h, a)),
      family.A.map(A => m.matMul(m.matMul(g, A), inverseH)),
      family.b.map(b => m.matMul(m.matScale(b, kappa), inverseH)),
      family.B.map(B => m.matMul(m.matMul(h, m.matScale(B, kappa)), inverseG)));
    check(distance(transformed, limit.concurrencyLimitChart(0, m.cMul(m.cMul(kappa, kappa), v))) < 1e-12,
      'outgoing C* action has weight two');
  }
  const K = rep.A.map((A, i) => m.matMul(A, rep.B[i]));
  const invariant = m.matTrace(m.matMul(m.matMul(K[0], K[0]), K[1]));
  check(Math.abs(invariant[0] + 108) < 1e-10 && Math.abs(invariant[1]) < 1e-10, 'generic invariant -w^3 z^2(z-1)^2 obstructs finite infinity limits');
  assert.throws(() => limit.concurrencyLimitChart(NaN), RangeError);
  assert.throws(() => limit.concurrencyLimitChart(0, [Infinity, 0]), RangeError);
  console.log(checks + ' limit-chart checks passed.');
}).catch((e) => { console.error(e); process.exitCode = 1; });
