// Standalone: node tests/validate-triple-ratio.mjs (no generated module copies).
import { readFileSync } from "fs";
import assert from "assert";
const source = readFileSync(new URL("../assets/js/ek-nakajima/flag-incidence.js", import.meta.url), "utf8");
const Z = (x) => [x, 0];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
function main({ flagIncidence, flagTripleRatio }) {
  let checks = 0;
  const check = (ok, label) => { checks++; assert.ok(ok, label); };
  // The candidate chart's matrices, without requiring the core-math module.
  const chart = (z) => ({
    a: [0, 1, 2].map(() => [[Z(1)], [Z(0)]]),
    A: [
      [[Z(1), Z(0)], [Z(0), Z(1)], [Z(0), Z(1)]],
      [[Z(0), Z(1)], [Z(1), Z(0)], [Z(0), Z(1)]],
      [[Z(0), Z(1)], [Z(0), z], [Z(1), Z(0)]],
    ],
  });
  const G = [
    [[1, 1], [2, 0], [0, 0]],
    [[0, 0], [1, -1], [1, 0.5]],
    [[0, 0], [0, 0], [2, 1]],
  ];
  const gauge = (rep) => ({ a: rep.a,
    A: rep.A.map((A) => G.map((row) => [0, 1].map((c) =>
      row.reduce((sum, g, k) => add(sum, mul(g, A[k][c])), [0, 0])))),
  });
  const close = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-10 * Math.max(1, Math.hypot(...b));
  const values = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, -3], [1e-12, -1e-12]];
  for (let k = 1; k <= 40; k++) values.push([k / 8 * Math.cos(k), k / 8 * Math.sin(k)]);
  values.forEach((z) => {
    const rep = chart(z), base = flagIncidence(rep);
    const scaled = { ...base,
      points: base.points.map((p, i) => p.map((v) => mul(v, [[2, 1], [-1, 2], [0.1, -3]][i]))),
      dualLines: base.dualLines.map((n, i) => n.map((v) => mul(v, [[-1, -1], [2, 3], [0, 0.5]][i]))),
    };
    [base, flagIncidence(gauge(rep)), scaled].forEach((data, i) => {
      const ratio = flagTripleRatio(data);
      check(ratio.valid, "finite chart ratio " + i);
      check(close(ratio.value, [-z[0], -z[1]]), "T = -z, including complex gauge and flag scales");
      check(Math.abs(ratio.magnitude - Math.hypot(...z)) < 1e-9, "magnitude");
      if (Math.hypot(...z) > 0) {
        check(close([Math.cos(ratio.phase), Math.sin(ratio.phase)],
          [-z[0] / Math.hypot(...z), -z[1] / Math.hypot(...z)]), "phase");
      } else {
        check(ratio.phase === null && ratio.magnitude === 0, "zero retains undefined phase");
      }
    });
  });
  // Replace n1 with a line whose p3 pairing vanishes or falls below tolerance.
  const base = flagIncidence(chart([2, 1]));
  [0, 0.5e-8].forEach((epsilon) => {
    const data = { ...base, dualLines: base.dualLines.slice() };
    data.dualLines[0] = [[0, 0], [-1, 0], [epsilon, 0]];
    const ratio = flagTripleRatio(data);
    check(!ratio.valid && ratio.value === null, "zero/near denominator explicitly undefined");
    check(/denominator.*tolerance/.test(ratio.reason), "undefined reason explains tolerance");
  });
  const near = { ...base, dualLines: base.dualLines.slice() };
  near.dualLines[0] = [[0, 0], [-1, 0], [2e-8, 0]];
  check(flagTripleRatio(near).valid, "denominator above tolerance remains finite");
  check(flagTripleRatio(flagIncidence(chart([1e-12, 0]))).magnitude > 0,
    "tiny numerator is not snapped to zero");
  [null, { valid: false, reason: "unavailable" }, { valid: true, tolerance: 1e-8 },
    { ...base, tolerance: 0 }].forEach((data) => check(!flagTripleRatio(data).valid, "invalid data rejected"));
  console.log(`${checks} triple-ratio checks passed.`);
}
import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))
  .then(main).catch((error) => { console.error(error); process.exitCode = 1; });
