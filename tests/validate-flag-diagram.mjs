// Standalone, dependency-free and Node 12 compatible.
import { readFileSync } from "fs";
import assert from "assert";
const load = (name) => import("data:text/javascript;base64," + Buffer.from(readFileSync(
  new URL("../assets/js/ek-nakajima/" + name, import.meta.url), "utf8")).toString("base64"));
const Z = (x) => [x, 0];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const chart = (z) => ({
  a: [0, 1, 2].map(() => [[Z(1)], [Z(0)]]),
  A: [
    [[Z(1), Z(0)], [Z(0), Z(1)], [Z(0), Z(1)]],
    [[Z(0), Z(1)], [Z(1), Z(0)], [Z(0), Z(1)]],
    [[Z(0), Z(1)], [Z(0), z], [Z(1), Z(0)]],
  ],
});
function main([{ flagIncidence }, { flagDiagram }]) {
  let checks = 0;
  const check = (ok, label) => { checks++; assert.ok(ok, label); };
  const close = (a, b, tolerance = 1e-10) => Math.hypot(...a.map((v, k) => v - b[k])) < tolerance;
  const diagram = (z) => flagDiagram(flagIncidence(chart(z)));
  const flattened = (d) => d.lines.reduce((out, line) => out.concat(...line), []);
  function reconstruct(d) {
    // Recover r from the actual drawn line direction, independently of metadata.
    const [p, q] = d.lines[2];
    const a = p[1] - q[1], b = q[0] - p[0];
    const r = b / (a - b);
    const phase = d.linePhases[2];
    return r === 0 ? [0, 0] : [r * Math.cos(phase), r * Math.sin(phase)];
  }
  for (let ir = 0; ir <= 50; ir++) for (let it = 0; it <= 40; it++) {
    const r = ir / 10, theta = -Math.PI + it * Math.PI / 20;
    const z = [r * Math.cos(theta), r * Math.sin(theta)];
    const data = flagIncidence(chart(z)), d = flagDiagram(data);
    check(d.valid, "candidate chart accepted");
    check(close(d.parameter, z), "coordinate extracted from actual dual line");
    check(close(reconstruct(d), z), "drawn geometry and line phase reconstruct complex coordinate");
    check(d.lines.every((line) => line.every((p) => p.every((v) => Math.abs(v) < 0.900000001))), "lines clipped");
    check(d.phaseMatchedConcurrency === data.concurrent, "actual complex concurrency retained");
    check(close(d.phaseVectors[2], z), "weighted phase glyph is complex coordinate");
    const scaled = { ...data,
      points: data.points.map((p, i) => p.map((v) => mul(v, [[2, 1], [-1, 2], [0.1, -3]][i]))),
      dualLines: data.dualLines.map((n, i) => n.map((v) => mul(v, [[-1, -1], [2, 3], [0, 0.5]][i]))),
    };
    check(close(flagDiagram(scaled).parameter, z), "independent complex homogeneous scaling accepted");
    d.points.forEach((p, i) => {
      const [a, b] = d.lines[i];
      check(Math.abs((p[0] - a[0]) * (b[1] - a[1]) -
        (p[1] - a[1]) * (b[0] - a[0])) < 1e-10, "marked point remains on its skeleton line");
    });
  }
  check(!close(flattened(diagram([0.5, 0])), flattened(diagram([0.6, 0]))), "line moves with magnitude");
  [0, 0.4, 1, 1.3, 4].forEach((r) => {
    const at = flattened(diagram([r, 0]));
    [-1, 1].forEach((sign) => {
      const near = flattened(diagram([Math.max(0, r + sign * 1e-8), 0]));
      check(close(at, near, 1e-6), "geometry continuous at ordinary, zero and concurrency values");
    });
  });
  const a = diagram([-1, 1e-9]), b = diagram([-1, -1e-9]);
  check(close(a.phaseVectors[2], b.phaseVectors[2], 1e-8), "phase glyph continuous across branch cut");
  check(diagram([0, 0]).linePhases[2] === null && diagram([0, 0]).phaseRadii[2] === 0,
    "undefined phase disappears continuously at zero");
  check(diagram([1, 0]).phaseMatchedConcurrency, "positive real unit gives actual concurrency");
  check(!diagram([-1, 0]).phaseMatchedConcurrency, "unit magnitude alone is not complex concurrency");
  check(close(flattened(diagram([1, 0])), flattened(diagram([-1, 0]))), "phase distinguishes identical unit skeletons");
  [null, { valid: false }, { valid: true }, { valid: true, points: [], dualLines: [] }].forEach((d) =>
    check(!flagDiagram(d).valid, "invalid data rejected"));
  const base = flagIncidence(chart([0.3, 0.4]));
  ["points", "dualLines"].forEach((key) => {
    const changed = JSON.parse(JSON.stringify(base));
    changed[key][0][key === "points" ? 1 : 0] = [0.2, 0.1];
    check(!flagDiagram(changed).valid, "arbitrary flag is not silently canonicalized");
    changed[key][0][0] = [NaN, 0];
    check(!flagDiagram(changed).valid, "nonfinite homogeneous vector rejected");
  });
  const outside = JSON.parse(JSON.stringify(base));
  outside.dualLines[2][1] = [0, 0];
  check(!flagDiagram(outside).valid, "infinite chart coordinate rejected");
  console.log(`${checks} decorated flag-diagram checks passed.`);
}
Promise.all([load("flag-incidence.js"), load("flag-diagram.js")])
  .then(main).catch((error) => { console.error(error); process.exitCode = 1; });
