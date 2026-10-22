import { readFileSync } from 'fs';
import assert from 'assert';
const source = (n) => readFileSync(new URL('../assets/js/ek-nakajima/' + n, import.meta.url), 'utf8');
const uri = (s) => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const core = uri(source('core-math.js'));
const moduleURI = (n) => uri(source(n).replace('"./core-math.js"', JSON.stringify(core)));
Promise.all([import(core), import(moduleURI('chart.js')), import(moduleURI('limit-chart.js')),
  import(moduleURI('flag-incidence.js')), import(moduleURI('flag-diagram.js'))]).then(([m, chart, limit, incidence, diagram]) => {
  let checks = 0;
  const check = (ok, label) => { checks++; assert.ok(ok, label); };
  const operators = (rep) => rep.A.map((A, i) => m.matMul(A, rep.B[i]));
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const det = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  const crossing = (Math.sqrt(5) - 1) / 2;
  for (const s of Array.from({ length: 201 }, (_, i) => i / 200).concat([crossing, crossing - 1e-10, crossing + 1e-10])) {
    const d = diagram.concurrencyDiagram(s);
    const r = d.reconstruction;
    check(d.valid && d.points.every((p) => p.every(Number.isFinite)), 'finite display through projective infinity');
    check(d.lines.every((line) => line.every((p) => p.every((x) => Number.isFinite(x) && Math.abs(x) < 0.90000001))), 'all lines clipped');
    r.homogeneousLines.forEach((line, i) => {
      check(Math.abs(dot(line, r.homogeneousPoints[i])) < 1e-12, 'true point stays on own line');
      check(Math.abs(dot(line, r.center)) < 1e-12, 'all lines remain truly concurrent');
      d.lines[i].forEach((p) => check(Math.abs(dot(line, p.concat([1]))) < 1e-12, 'screen line represents transformed homogeneous line'));
    });
    if (s < 0.99) check(Math.abs(det(...r.homogeneousPoints)) > 1e-4, 'no premature collinearity');
  }
  const endpoint = diagram.concurrencyDiagram(1);
  check(Math.abs(det(...endpoint.reconstruction.homogeneousPoints)) < 1e-12, 'limit points are collinear');
  check(endpoint.points.every((p) => Math.abs(p[1] - 0.375) < 1e-12), 'finite horizontal limit transversal');
  check(endpoint.pointMarkers.every((p) => !p.clipped), 'all limit points visible');
  check(diagram.concurrencyDiagram(crossing).pointMarkers.filter((p) => p.atInfinity).length === 2, 'two points explicitly marked at infinity');
  const start = chart.compactTransverseChart(0.5, 0, 0, 0);
  const data = incidence.flagIncidence(start);
  check(JSON.stringify(diagram.flagDiagram(data, { compact: true }).points) === JSON.stringify(diagram.flagDiagram(data, { compact: true, concurrencyProgress: 0 }).points), 'camera starts at existing layout');
  for (const phi of [0, 0.7, -2]) {
    const rep = chart.compactTransverseChart(0.5, 0, 1 - 1e-7, phi);
    const final = limit.concurrencyLimitChart(phi);
    const a = diagram.cotangentGlyphs(incidence.flagIncidence(rep), operators(rep), 1 - 1e-7);
    const b = diagram.cotangentGlyphs(incidence.flagIncidence(final), operators(final), 1);
    check(Math.hypot(...a.reduce((out, g, i) => out.concat(...g.coefficients.map((z, j) => z.map((v, k) => v - b[i].coefficients[j][k]))), [])) < 1e-5, 'gauged cotangent coefficients converge including complex phase');
    check(diagram.flagDiagram(incidence.flagIncidence(final), { concurrencyProgress: 1 }).valid, 'actual limit flags accepted');
  }
  check(diagram.cotangentGlyphs(data, operators(start), 0).every((g) => g.coefficients.every((z) => Math.hypot(...z) === 0)), 'zero cotangent decoration absent');
  const wrong = incidence.flagIncidence(chart.compactTransverseChart(0.4, 0, 0));
  check(!diagram.flagDiagram(wrong, { concurrencyProgress: 0.5 }).valid, 'unrelated chart cannot acquire a false degeneration');
  console.log(`${checks} alignment-view checks passed.`);
}).catch((error) => { console.error(error); process.exitCode = 1; });
