// Direct source imports, no generated copies or dependencies; Node 12 safe.
import { readFileSync } from "fs";
import assert from "assert";
const source = (name) => readFileSync(new URL("../assets/js/ek-nakajima/" + name, import.meta.url), "utf8");
const uri = (text) => "data:text/javascript;base64," + Buffer.from(text).toString("base64");
const coreURI = uri(source("core-math.js"));
const chartURI = uri(source("chart.js").replace('"./core-math.js"', JSON.stringify(coreURI)));
function main([{ compactChart, chartAt }, { flagIncidence }, { flagDiagram }, core]) {
  let checks = 0;
  const check = (ok, label) => { checks++; assert.ok(ok, label); };
  const near = (a, b, tolerance = 1e-10) => Math.hypot(...a.map((x, i) => x - b[i])) < tolerance;
  const values = (nested) => Array.isArray(nested) ? nested.reduce((out, x) => out.concat(values(x)), []) : [nested];
  const diagram = (r, theta) => flagDiagram(flagIncidence(compactChart(r, theta)), { compact: true });
  const positions = (d) => values(d.lines);
  for (let i = 0; i <= 100; i++) for (let j = 0; j <= 24; j++) {
    const r = i / 100, theta = -Math.PI + j * Math.PI / 12;
    const rep = compactChart(r, theta), flags = flagIncidence(rep), d = diagram(r, theta);
    check(["a", "A", "b", "B"].every((key) => values(rep[key]).every(Number.isFinite)), "all maps finite including endpoints");
    check(core.complexResidualNorm(rep) === 0, "complex moment map is zero");
    check(flags.valid && d.valid, "three rank-two flags and supported diagram");
    check(near([d.compactRadius], [r]), "homogeneous dual-line extraction recovers compact r");
    check(values(d.points).concat(positions(d)).every(Number.isFinite), "all geometry finite");
    const [p, q] = d.lines[2];
    const a = p[1] - q[1], b = q[0] - p[0];
    check(near([b / a], [r]), "actual drawn line recovers compact r");
    if (r > 0 && r < 1) {
      check(near([Math.cos(d.linePhases[2]), Math.sin(d.linePhases[2])], [Math.cos(theta), Math.sin(theta)]),
        "line phase recovers theta");
      const old = flagIncidence(chartAt(r / (1 - r), theta));
      check(near(values(old.points), values(flags.points)) && near(values(old.dualLines), values(flags.dualLines)),
        "finite compact representatives have the same flags as the original chart");
      const scale = 1 - r;
      const original = chartAt(r / scale, theta);
      const h = core.eyeZ(2), inverseH = core.eyeZ(2);
      // h_3^{-1}=diag(1,1-r): A_3 -> A_3 h_3^{-1}, a_3 -> h_3 a_3.
      h[1][1] = [1 / scale, 0];
      inverseH[1][1] = [scale, 0];
      check(near(values(core.matMul(original.A[2], inverseH)), values(rep.A[2])) &&
        near(values(core.matMul(h, original.a[2])), values(rep.a[2])),
        "compact maps are an explicit middle-vertex gauge transform");
    } else {
      check(d.linePhases[2] === null && d.phaseRadii[2] === 0, "phase collapses at projective endpoints");
      check(d.atInfinity === (r === 1), "exact projective endpoint");
    }
  }
  [0, 0.5, 1].forEach((r) => [0, 0.8, Math.PI].forEach((theta) => {
    const here = diagram(r, theta);
    [-1, 1].forEach((sign) => {
      const nearby = diagram(Math.max(0, Math.min(1, r + sign * 1e-8)), theta);
      check(near(positions(here), positions(nearby), 1e-6), "continuous geometry at endpoints and concurrence");
    });
  }));
  check(diagram(0.5, 0).phaseMatchedConcurrency, "concurrence at compact r=1/2, theta=0");
  check(!diagram(0.5, Math.PI).phaseMatchedConcurrency, "phase affects complex concurrence");
  [0, 1].forEach((r) => {
    const first = diagram(r, 0), second = diagram(r, 2);
    check(near(positions(first), positions(second)) && near(first.phaseVectors[2], second.phaseVectors[2]),
      "same endpoint diagram for all theta");
  });
  [-0.1, 1.1, NaN, Infinity].forEach((r) => assert.throws(() => compactChart(r, 0), RangeError));
  console.log(`${checks} compact-chart checks passed.`);
}
Promise.all([import(chartURI), import(uri(source("flag-incidence.js"))), import(uri(source("flag-diagram.js"))), import(coreURI)])
  .then(main).catch((error) => { console.error(error); process.exitCode = 1; });
