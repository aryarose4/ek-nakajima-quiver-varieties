import { readFileSync } from 'fs';
import assert from 'assert';
const source = readFileSync(new URL('../assets/js/ek-nakajima/flag-diagram.js', import.meta.url), 'utf8');
import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')).then(({ flagDiagram }) => {
  let checks = 0;
  const check = (ok, message) => { checks++; assert.ok(ok, message); };
  const Z = x => [x, 0];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const data = (r, phase) => ({ valid: true,
    points: [0, 1, 2].map(i => [0, 1, 2].map(j => Z(i === j ? 1 : 0))),
    dualLines: [[Z(0), [-r * Math.cos(phase), -r * Math.sin(phase)], Z(1 - r)],
      [Z(1), Z(0), Z(-1)], [Z(-1), Z(1), Z(0)]],
  });
  const diagram = (r, phase) => flagDiagram(data(r, phase), { firstLine: true });
  const flat = d => d.lines.reduce((out, line) => out.concat(...line), []);
  const difference = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  const fixed = diagram(0.5, 0).lines.slice(1);
  for (let i = 0; i <= 100; i++) for (const theta of [0, 0.6, -2, Math.PI]) {
    const r = i / 100, d = diagram(r, theta);
    check(d.valid, 'full closed radial interval has a chamber drawing');
    check(JSON.stringify(d.lines.slice(1)) === JSON.stringify(fixed), 'lines two and three remain anchored');
    check(Math.abs(d.compactRadius - r) < 1e-14, 'homogeneous coordinate is preserved');
    d.points.forEach((p, j) => {
      const [a, b] = d.lines[j];
      check(Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) < 1e-12,
        'each moving line continues to contain its marked point');
    });
    const scaled = data(r, theta);
    scaled.points = scaled.points.map((p, j) => p.map(z => mul(z, [[2, 1], [-3, 2], [1, -2]][j])));
    scaled.dualLines = scaled.dualLines.map((p, j) => p.map(z => mul(z, [[-1, 2], [3, 1], [1, -1]][j])));
    const q = flagDiagram(scaled, { firstLine: true });
    check(q.valid && difference(flat(q), flat(d)) < 1e-12, 'independent complex homogeneous scales do not change geometry');
    check(difference(q.phaseVectors[0], d.phaseVectors[0]) < 1e-12, 'phase is also invariant under homogeneous rescaling');
  }
  for (const pole of [0, 1]) for (const theta of [0, 1, 2, -2]) {
    const end = diagram(pole, theta), near = diagram(pole === 0 ? 1e-9 : 1 - 1e-9, theta);
    check(difference(flat(end), flat(near)) < 1e-7, 'geometry converges at both stable radial endpoints');
    check(difference(flat(end), flat(diagram(pole, 0))) === 0, 'endpoint geometry is independent of phase');
    check(end.linePhases[0] === null && end.phaseRadii[0] === 0, 'undefined endpoint phase disappears');
    if (theta === 0) {
      const exact = flagDiagram(data(pole, theta), { firstLine: true, realFlags: true });
      check(exact.valid && difference(flat(end), flat(exact)) < 1e-12, 'real endpoint camera preserves geometry and label endpoint order');
    }
  }
  const center = flagDiagram(data(0.5, 0), { firstLine: true, concurrencyProgress: 0 });
  check(center.valid && difference(flat(center), flat(diagram(0.5, 0))) < 1e-12,
    'concurrency animation begins in the same frame including label endpoint order');
  console.log(`${checks} first-line chamber diagram checks passed.`);
}).catch(error => { console.error(error); process.exitCode = 1; });
