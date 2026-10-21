// Standalone (no copied modules or dependencies): node tests/validate-incidence.mjs
import { readFileSync } from "fs";
import assert from "assert";
const source = readFileSync(new URL("../assets/js/ek-nakajima/flag-incidence.js", import.meta.url), "utf8");
const Z = (x) => [x, 0];
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
function main({ flagIncidence, incidenceLayout }) {
  let checks = 0;
  const check = (ok, label) => { checks++; assert.ok(ok, label); };
  function repFrom(flags) {
    return {
      a: flags.map(() => [[Z(1)], [Z(0)]]),
      A: flags.map(([p, q]) => p.map((v, k) => [Z(v), Z(q[k])])),
    };
  }
  function verify(data, label) {
    check(data.valid, label + " valid flags");
    const lay = incidenceLayout(data);
    check(lay.valid, label + ": " + lay.reason);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const p = lay.points[i], a = lay.lines[j][0], b = lay.lines[j][1];
      const det = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]);
      check((Math.abs(det) < 1e-7) === data.incident[i][j], label + " preserves incidence");
      const q = lay.points[j];
      check((Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-7) === data.pointEqual[i][j],
        label + " preserves point equality");
      const own = lay.lines[i];
      const distance = (r) => Math.abs((r[0] - a[0]) * (b[1] - a[1]) -
        (r[1] - a[1]) * (b[0] - a[0]));
      check((distance(own[0]) < 1e-7 && distance(own[1]) < 1e-7) === data.lineEqual[i][j],
        label + " preserves line equality");
    }
    return lay;
  }
  // Each line has several allowed points, including intersections and shared
  // points. Enumerate their product to cover all marked-point coincidences.
  const triangle = [
    [[1, 0, 0], [0, 1, 0], [1, 2, 0], [2, 1, 0]],
    [[0, 1, 0], [0, 0, 1], [0, 1, 2], [0, 2, 1]],
    [[0, 0, 1], [1, 0, 0], [1, 0, 2], [2, 0, 1]],
  ];
  const pencil = [
    [[0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 0, 1]],
    [[0, 0, 1], [0, 1, 1], [0, 2, 1], [0, 3, 1]],
    [[0, 0, 1], [1, 1, 1], [2, 2, 1], [3, 3, 1]],
  ];
  const G = [
    [[1, 1], [2, 0], [0, 0]],
    [[0, 0], [1, -1], [1, 0.5]],
    [[0, 0], [0, 0], [2, 1]],
  ];
  const gauge = (rep) => ({
    a: rep.a,
    A: rep.A.map((A) => G.map((row) => [0, 1].map((c) =>
      row.reduce((sum, g, k) => add(sum, mul(g, A[k][c])), [0, 0])))),
  });
  [triangle, pencil, [pencil[0], pencil[0], pencil[1]],
    [pencil[0], pencil[0], pencil[0]]].forEach((family, fi) => {
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
      const flags = [a, b, c].map((n, i) => [family[i][n], family[i][(n + 1) % 4]]);
      const rep = repFrom(flags), data = flagIncidence(rep);
      verify(data, `arrangement ${fi}/${a}${b}${c}`);
      const changed = flagIncidence(gauge(rep));
      ["incident", "pointEqual", "lineEqual", "concurrent", "collinear"].forEach((key) =>
        check(JSON.stringify(data[key]) === JSON.stringify(changed[key]), "complex gauge invariance: " + key));
      verify(changed, "complex-gauged flags");
    }
  });
  const rep = repFrom(triangle.map((line) => [line[0], line[1]]));
  const zero = JSON.parse(JSON.stringify(rep));
  zero.a[0] = [[Z(0)], [Z(0)]];
  check(!flagIncidence(zero).valid, "zero point rejected");
  const rankOne = JSON.parse(JSON.stringify(rep));
  rankOne.A[0] = rankOne.A[0].map((row) => [row[0], row[0]]);
  check(!flagIncidence(rankOne).valid, "rank-one plane rejected");
  check(!flagIncidence(null).valid, "missing data rejected");
  check(!incidenceLayout(null).valid, "missing incidence rejected");
  const nonFinite = JSON.parse(JSON.stringify(rep));
  nonFinite.A[0][0][0] = [NaN, 0];
  check(!flagIncidence(nonFinite).valid, "nonfinite data rejected");
  const inconsistent = flagIncidence(rep);
  inconsistent.pointEqual[0][1] = true;
  check(!incidenceLayout(inconsistent).valid, "inconsistent tolerance classes rejected");
  const scaled = JSON.parse(JSON.stringify(rep));
  scaled.A = scaled.A.map((A) => A.map((row) => row.map((z) => z.map((x) => x * 1e-180))));
  check(flagIncidence(scaled).valid, "tiny homogeneous scale supported");
  // Independent nonunitary middle changes A -> A H^-1, a -> H a.
  // H = [[1,i],[0,1]], so column 2 changes by -i column 1.
  const middle = {
    A: rep.A.map((A) => A.map((r) => [r[0], add(r[1], mul([0, -1], r[0]))])),
    a: rep.a.map((a) => [[add(a[0][0], mul([0, 1], a[1][0]))], [a[1][0]]]),
  };
  check(JSON.stringify(flagIncidence(middle).incident) === JSON.stringify(flagIncidence(rep).incident),
    "complex middle gauge invariance");
  console.log(`${checks} incidence checks passed.`);
}
import("data:text/javascript;base64," + Buffer.from(source).toString("base64"))
  .then(main).catch((error) => { console.error(error); process.exitCode = 1; });
