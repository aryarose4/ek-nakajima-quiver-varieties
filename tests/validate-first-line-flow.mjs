import { readFileSync } from 'fs';
import assert from 'assert';
const source = n => readFileSync(new URL('../assets/js/ek-nakajima/' + n, import.meta.url), 'utf8');
const uri = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const core = uri(source('core-math.js'));
const load = n => import(uri(source(n).replace(/(['"])\.\/core-math\.js\1/g, JSON.stringify(core))));
Promise.all([import(core), load('branch-charts.js'), load('flag-incidence.js'), load('flag-diagram.js')]).then(([m, chart, inc, diagram]) => {
  let checks = 0;
  const check = (ok, message) => { checks++; assert.ok(ok, message); };
  const operators = rep => rep.A.map((A, i) => m.matMul(A, rep.B[i]));
  const flat = d => d.lines.reduce((out, line) => out.concat(...line), []);
  const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  const draw = (r, theta, t, phi) => {
    const rep = chart.compactFirstLineChart(r, theta, t, phi), data = inc.flagIncidence(rep);
    const g = diagram.centralDisplayGauge(data, operators(rep), { r, t });
    const d = diagram.flagDiagram(data, { firstLine: true, centralFlow: { r, t } });
    const glyphs = diagram.cotangentGlyphs(g.data, g.operators);
    return { d, glyphs, g };
  };
  for (const t of [0, 0.4, 0.8]) for (const theta of [0, 0.7, -2]) for (const phi of [0, 0.8]) {
    for (const pole of [0, 1]) {
      const end = draw(pole, theta, t, phi), near = draw(pole === 0 ? 1e-8 : 1 - 1e-8, theta, t, phi);
      check(end.d.valid && near.d.valid, 'first-line flow drawn at and near both poles');
      check(distance(flat(end.d), flat(near.d)) < 2e-6, 'line geometry continuous at both radial poles even above zero section');
      for (const view of [end, near]) check(view.glyphs.every(g => g.coefficients.every(z => z.every(Number.isFinite))), 'gauged y glyphs finite');
      const values = view => view.glyphs.reduce((out, g) => out.concat(...g.coefficients), []);
      check(distance(values(end), values(near)) < 2e-6, 'cotangent coefficients also converge continuously at radial endpoints');
      const exact = diagram.flagDiagram(end.g.data, { realFlags: true, firstLine: true });
      check(exact.valid && distance(flat(exact), flat(end.d)) < 1e-12, 'endpoint skeleton equals actual gauged real flags');
    }
  }
  for (const t of [0, 0.4, 0.8]) {
    const at = draw(0.5, 0, t, 0);
    check(at.g.diagonal.every(v => v === 1), 'central display gauge leaves concurrency chart unchanged');
  }
  console.log(`${checks} first-line flow continuity checks passed.`);
}).catch(error => { console.error(error); process.exitCode = 1; });
