import { readFileSync } from 'fs';
import assert from 'assert';
const source = n => readFileSync(new URL('../assets/js/ek-nakajima/' + n, import.meta.url), 'utf8');
const uri = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const core = uri(source('core-math.js'));
const moduleURI = n => uri(source(n).replace('"./core-math.js"', JSON.stringify(core)));
Promise.all([import(core), import(moduleURI('chart.js')), import(moduleURI('limit-chart.js')), import(moduleURI('fixed-point.js'))]).then(([m, chart, limit, fixed]) => {
  let checks = 0;
  const check = (ok, label) => { checks++; assert.ok(ok, label); };
  for (const r of [0, 0.2, 0.5, 0.8, 1]) for (const theta of [0, 0.7]) {
    const rep = chart.compactChart(r, theta);
    check(fixed.checkFixedPointGrading(rep, fixed.zeroSectionGrading()).passes, 'all y=0 reps fixed independently of stability');
    check(fixed.fixedPointInfinitesimalTest(rep).consistent, 'zero generator satisfies necessary condition');
  }
  for (const phi of [0, 0.7, 2.1]) {
    const rep = limit.concurrencyLimitChart(phi);
    const grading = fixed.concurrencyGrading();
    check(fixed.checkFixedPointGrading(rep, grading).passes, 'concurrency fixed for arbitrary phase');
    check(fixed.fixedPointInfinitesimalTest(rep).consistent, 'concurrency has infinitesimal generator');
    Object.keys(grading).forEach(v => { grading[v].weights = grading[v].weights.map(w => w + 7); });
    check(fixed.checkFixedPointGrading(rep, grading).passes, 'common scalar weight is ineffective');
    check(!fixed.checkFixedPointGrading(rep, fixed.zeroSectionGrading()).passes, 'nonzero reverse arrows require nontrivial grading');
    const wrong = fixed.concurrencyGrading();
    wrong.center.basis = m.eyeZ(3);
    check(!fixed.checkFixedPointGrading(rep, wrong).passes, 'non-diagonal center basis is essential');
  }
  for (const z of [[2, 0], [0.3, 0.8], [-1, 0]]) {
    const rep = chart.transverseChart(z, [0.5, 0.2]);
    check(!fixed.fixedPointInfinitesimalTest(rep).consistent, 'generic nonzero cotangent point is not fixed under any complex gauge');
  }
  for (const coordinate of [[1, 0], [0, 1], [-0.3, 0.7]]) {
    const rep = limit.concurrencyLimitChart(0.4, coordinate);
    check(!fixed.checkFixedPointGrading(rep, fixed.concurrencyGrading()).passes, 'outgoing nonzero coordinate fails endpoint grading');
    check(!fixed.fixedPointInfinitesimalTest(rep).consistent, 'outgoing nonzero coordinate has no infinitesimal compensating gauge');
  }
  const rep = limit.concurrencyLimitChart();
  const g = m.eyeZ(3), gi = m.eyeZ(3), h = m.eyeZ(2), hi = m.eyeZ(2);
  g[0][1] = [0.4, 0.7]; gi[0][1] = [-0.4, -0.7];
  h[0][1] = [-0.2, 0.6]; hi[0][1] = [0.2, -0.6];
  const conjugated = m.makeRep(rep.a.map(a => m.matMul(h, a)),
    rep.A.map(A => m.matMul(m.matMul(g, A), hi)),
    rep.b.map(b => m.matMul(b, hi)), rep.B.map(B => m.matMul(m.matMul(h, B), gi)));
  const transported = fixed.concurrencyGrading();
  transported.center.basis = m.matMul(g, transported.center.basis);
  for (let i = 0; i < 3; i++) transported['middle' + i].basis = h;
  check(fixed.checkFixedPointGrading(conjugated, transported).passes, 'witness transports through nonunitary complex changes of basis');
  check(fixed.fixedPointInfinitesimalTest(conjugated).consistent, 'necessary condition is invariant under nonunitary complex changes of basis');
  for (const family of ['a', 'A', 'b', 'B']) {
    const changed = JSON.parse(JSON.stringify(rep));
    // Perturb a degree-forbidden entry, including otherwise zero arrows.
    const entries = { a: [1, 0], A: [0, 1], b: [0, 0], B: [0, 0] };
    const [i, j] = entries[family];
    changed[family][0][i][j][0] += 0.2;
    check(!fixed.checkFixedPointGrading(changed, fixed.concurrencyGrading()).passes, 'checks ' + family + ' arrows');
  }
  const fractional = fixed.concurrencyGrading();
  fractional.center.weights[2] = 0.5;
  assert.throws(() => fixed.checkFixedPointGrading(rep, fractional), RangeError);
  const singular = fixed.concurrencyGrading();
  singular.center.basis = m.zerosZ(3, 3);
  assert.throws(() => fixed.checkFixedPointGrading(rep, singular), RangeError);
  console.log(checks + ' fixed-point checks passed.');
}).catch(e => { console.error(e); process.exitCode = 1; });
