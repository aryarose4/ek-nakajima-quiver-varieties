// Numerical incidence of E6 flags L_i = im(A_i a_i) in P_i = im(A_i).
// Points and dual lines are complex homogeneous vectors. The dual pairing is
// BILINEAR (not Hermitian). This forgets gauge-dependent lengths and angles.
// Unit-norm residuals <= tolerance are classified as zero; this is a numerical
// diagnostic, not an exact certificate. Very ill-conditioned gauges can change
// a tolerance-based classification.
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => [
  sub(mul(a[1], b[2]), mul(a[2], b[1])),
  sub(mul(a[2], b[0]), mul(a[0], b[2])),
  sub(mul(a[0], b[1]), mul(a[1], b[0])),
];
const dot = (a, b) => a.reduce((s, z, i) => add(s, mul(z, b[i])), [0, 0]);
const norm = (v) => Math.hypot(...v.reduce((a, z) => a.concat(z), []));
function unit(v) {
  const scale = Math.max(...v.reduce((a, z) => a.concat(z.map(Math.abs)), []));
  if (!(scale > 0) || !Number.isFinite(scale)) return null;
  const w = v.map((z) => z.map((x) => x / scale));
  const n = norm(w);
  return w.map((z) => z.map((x) => x / n));
}
const matrix = (f) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => f(i, j)));

export function flagIncidence(rep, tolerance = 1e-8) {
  const fail = (reason) => ({ valid: false, reason, tolerance, numerical: true });
  if (!(tolerance > 0 && tolerance < 0.01)) return fail("Invalid incidence tolerance.");
  const points = [], dualLines = [];
  try {
    for (let i = 0; i < 3; i++) {
      const A = rep.A[i], a = rep.a[i];
      if (A.length !== 3 || A.some((r) => r.length !== 2) ||
          a.length !== 2 || a.some((r) => r.length !== 1)) {
        return fail("Incidence requires three flags of dimensions 1 and 2 in C³.");
      }
      const u = unit(A.map((r) => r[0])), v = unit(A.map((r) => r[1]));
      if (!u || !v) return fail(`Flag ${i + 1}: the plane map has rank below two.`);
      const n = cross(u, v);
      if (!(norm(n) > tolerance)) return fail(`Flag ${i + 1}: the plane map is numerically rank deficient.`);
      // Scale the maps before multiplication to avoid overflow/underflow.
      const flatA = unit(A.reduce((out, row) => out.concat(row), []));
      const av = unit(a.map((r) => r[0]));
      if (!flatA || !av) return fail(`Flag ${i + 1}: no projective point is defined.`);
      const p = [0, 1, 2].map((r) => add(mul(flatA[2 * r], av[0]), mul(flatA[2 * r + 1], av[1])));
      if (!(norm(p) > tolerance)) return fail(`Flag ${i + 1}: the point map is numerically zero.`);
      points.push(unit(p));
      dualLines.push(unit(n));
    }
  } catch (_) {
    return fail("The representation does not supply three finite E6 flags.");
  }
  const residuals = matrix((i, j) => norm([dot(dualLines[j], points[i])]));
  return {
    valid: true, numerical: true, tolerance, points, dualLines, residuals,
    incident: matrix((i, j) => residuals[i][j] <= tolerance),
    pointEqual: matrix((i, j) => norm(cross(points[i], points[j])) <= tolerance),
    lineEqual: matrix((i, j) => norm(cross(dualLines[i], dualLines[j])) <= tolerance),
    concurrent: norm([dot(dualLines[0], cross(dualLines[1], dualLines[2]))]) <= tolerance,
    collinear: norm([dot(points[0], cross(points[1], points[2]))]) <= tolerance,
  };
}

// Cyclic triple ratio of three complex flags. Each point/dual-line scale and
// the central complex gauge cancel between numerator and denominator.
// Near-zero denominator pairings are undefined at the incidence tolerance;
// numerator pairings are retained, including an exactly zero ratio.
export function flagTripleRatio(data) {
  const tolerance = data && data.tolerance;
  const fail = (reason) => ({ valid: false, numerical: true, tolerance,
    reason, value: null, magnitude: null, phase: null });
  if (!data || !data.valid) return fail(data && data.reason || "Flag data is unavailable.");
  if (!(tolerance > 0 && tolerance < 0.01)) return fail("Invalid triple-ratio tolerance.");
  try {
    const p = data.points.map(unit), n = data.dualLines.map(unit);
    if (p.length !== 3 || n.length !== 3 || p.concat(n).some((v) => !v || v.length !== 3)) {
      return fail("The triple ratio requires three finite flags.");
    }
    const numerator = [dot(n[0], p[1]), dot(n[1], p[2]), dot(n[2], p[0])];
    const denominator = [dot(n[0], p[2]), dot(n[2], p[1]), dot(n[1], p[0])];
    if (numerator.concat(denominator).some((z) => !z.every(Number.isFinite))) {
      return fail("The triple ratio requires finite pairings.");
    }
    if (denominator.some((z) => Math.hypot(...z) <= tolerance)) {
      return fail("The triple ratio is undefined: a denominator pairing is zero or below the incidence tolerance.");
    }
    const num = numerator.reduce(mul, [1, 0]), den = denominator.reduce(mul, [1, 0]);
    const denNorm2 = den[0] * den[0] + den[1] * den[1];
    const value = [(num[0] * den[0] + num[1] * den[1]) / denNorm2,
      (num[1] * den[0] - num[0] * den[1]) / denNorm2];
    const magnitude = Math.hypot(...value);
    if (!Number.isFinite(magnitude)) return fail("The numerical triple ratio is not finite.");
    return { valid: true, numerical: true, tolerance, value, magnitude,
      phase: magnitude === 0 ? null : Math.atan2(value[1], value[0]) };
  } catch (_) {
    return fail("The triple ratio requires three finite flags.");
  }
}

// A combinatorial REAL diagram, not a real projection of CP² and not a complete
// projective invariant. Preserves the nine incidences, equal points, equal lines,
// and concurrency of the lines. Additional point collinearity is not encoded.
// All coordinates are in [-1,1]. Inconsistent numerical classifications produce
// an explicit unavailable result rather than an inaccurate drawing.
export function incidenceLayout(data) {
  const fail = (reason) => ({ valid: false, reason });
  if (!data || !data.valid) return fail(data && data.reason || "Flag incidence is unavailable.");
  const ids = [], reps = [];
  for (let i = 0; i < 3; i++) {
    let k = reps.findIndex((j) => data.lineEqual[i][j]);
    if (k < 0) { k = reps.length; reps.push(i); }
    ids.push(k);
  }
  const equations = reps.length === 3 && !data.concurrent ?
    [[0, 1, -0.45], [1.5, 1, 0.55], [-1.5, 1, 0.55]] :
    [[0, 1, 0], [-1, 1, 0], [1, 1, 0]];
  function segment(l) {
    const hits = [];
    [-0.92, 0.92].forEach((v) => {
      if (l[1]) hits.push([v, -(l[0] * v + l[2]) / l[1]]);
      if (l[0]) hits.push([-(l[1] * v + l[2]) / l[0], v]);
    });
    const inside = hits.filter((p, i) => p.every((v) => Math.abs(v) <= 0.9200001) &&
      hits.slice(0, i).every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-8));
    return [inside[0], inside[1]];
  }
  const uniqueLines = equations.slice(0, reps.length);
  const lines = ids.map((k) => segment(uniqueLines[k]));
  const points = [];
  const on = (p, l) => Math.abs(l[0] * p[0] + l[1] * p[1] + l[2]) < 1e-7;
  const equal = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-7;
  for (let i = 0; i < 3; i++) {
    const same = points.findIndex((_, j) => data.pointEqual[i][j]);
    if (same >= 0) { points.push(points[same].slice()); continue; }
    const through = uniqueLines.filter((_, k) => data.incident[i][reps[k]]);
    if (!through.length) return fail("The numerical incidence pattern has no containing flag line.");
    let candidates;
    if (through.length > 1) {
      const a = through[0], b = through[1], det = a[0] * b[1] - a[1] * b[0];
      if (Math.abs(det) < 1e-10) return fail("The numerical line classes are inconsistent.");
      candidates = [[(a[1] * b[2] - a[2] * b[1]) / det,
        (a[2] * b[0] - a[0] * b[2]) / det]];
    } else {
      const ends = segment(through[0]);
      candidates = [0.28, 0.68, 0.42, 0.82, 0.15, 0.56].map((t) =>
        ends[0].map((v, k) => v + t * (ends[1][k] - v)));
    }
    const p = candidates.find((p) =>
      ids.every((k, j) => on(p, uniqueLines[k]) === data.incident[i][j]) &&
      points.every((q, j) => equal(p, q) === data.pointEqual[i][j]));
    if (!p) return fail("The numerical incidence pattern cannot be drawn consistently at this tolerance.");
    points.push(p);
  }
  // Validate the entire realization, including equivalence-class transitivity.
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (on(points[i], uniqueLines[ids[j]]) !== data.incident[i][j] ||
        equal(points[i], points[j]) !== data.pointEqual[i][j] ||
        (ids[i] === ids[j]) !== data.lineEqual[i][j]) {
      return fail("The numerical incidence classification is internally inconsistent.");
    }
  }
  return { valid: true, points, lines, schematic: true };
}
