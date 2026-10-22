// Direct source imports, dependency-free and Node 12 compatible.
import { readFileSync } from "fs";
import assert from "assert";
const source = name => readFileSync(new URL("../assets/js/ek-nakajima/" + name, import.meta.url), "utf8");
const uri = text => "data:text/javascript;base64," + Buffer.from(text).toString("base64");
const coreURI = uri(source("core-math.js"));
const chartURI = uri(source("chart.js").replace('"./core-math.js"', JSON.stringify(coreURI)));
function main([chart, core]) {
  let checks = 0;
  const check = (condition, label) => { checks++; assert.ok(condition, label); };
  const flat = value => Array.isArray(value) ? value.reduce((a, b) => a.concat(flat(b)), []) : [value];
  const distance = (a, b) => Math.max(...flat(a).map((x, i) => Math.abs(x - flat(b)[i])));
  for (const r of [0, 0.001, 0.25, 0.5, 2/3, 0.99, 1]) {
    for (const theta of [0, 0.7, Math.PI]) for (const t of [0, 0.1, 0.7, 0.99]) for (const phi of [0, 1.2]) {
      const rep = chart.compactTransverseChart(r, theta, t, phi);
      check(["a", "A", "b", "B"].every(key => flat(rep[key]).every(Number.isFinite)), "finite endpoint maps");
      check(core.complexResidualNorm(rep) < 1e-10, "complex equations including nonzero reverse arrows");
      if (t === 0) check(distance(rep.B, chart.compactChart(r, theta).B) === 0, "zero section preserved");
      if (r < 1) {
        const s = 1-r, eta = chart.chartZ(t/(1-t), phi);
        const original = chart.transverseChart(chart.chartZ(r/s, theta), core.cScale(eta, s*s));
        const g = core.eyeZ(2), gi = core.eyeZ(2);
        g[1][1] = [1/s, 0]; gi[1][1] = [s, 0];
        original.A[2] = core.matMul(original.A[2], gi);
        original.b[2] = core.matMul(original.b[2], gi);
        original.B[2] = core.matMul(g, original.B[2]);
        check(["a", "A", "b", "B"].every(key => distance(rep[key], original[key]) < 1e-10), "explicit complex gauge transport from normalized M5 kernel");
      }
    }
  }
  for (const z of [[0,0], [1,0], [2,0], [0.3,-0.8], [100,3]]) {
    const rep = chart.transverseChart(z);
    check(core.complexResidualNorm(rep) < 1e-9, "normalized affine kernel equations");
    check(distance(rep.B[2][1][1], [1,0]) === 0, "cotangent trace normalization");
  }
  const a = chart.compactTransverseChart(0.6,0.4,0.3,0);
  const b = chart.compactTransverseChart(0.6,0.4,0.3,Math.PI/2);
  check(distance(b.B, a.B.map(m => core.matScale(m,[0,1]))) < 1e-12, "phi rotates reverse arrows");
  for (const bad of [-1,1,Infinity,NaN]) assert.throws(() => chart.compactTransverseChart(0.5,0,bad,0), RangeError);
  console.log(`${checks} transverse-chart checks passed.`);
}
Promise.all([import(chartURI),import(coreURI)]).then(main).catch(error => { console.error(error); process.exitCode=1; });
