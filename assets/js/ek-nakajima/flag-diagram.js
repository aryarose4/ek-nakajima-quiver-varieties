// Phase-decorated real skeleton of the E6 candidate flag chart.
// Homogeneous points are e1,e2,e3 and dual lines are
// (0,-1,1), (1,0,-1), (-z,1,0). Replacing z by |z| gives the
// real skeleton; the phase on line 3 recovers the original complex flag.
// This is a chart-specific encoding, not a projection of arbitrary CP2 flags.
const SCALE = 1.125;
const LIMIT = 0.9;
const CHART_TOLERANCE = 1e-9;
const abs = (z) => Math.hypot(z[0], z[1]);
const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
function unit(v) {
  if (!Array.isArray(v) || v.length !== 3 || v.some((z) =>
    !Array.isArray(z) || z.length !== 2 || !z.every(Number.isFinite))) return null;
  const scale = Math.max(...v.map(abs));
  if (!(scale > 0)) return null;
  const scaled = v.map((z) => z.map((x) => x / scale));
  const length = Math.hypot(...scaled.map(abs));
  return scaled.map((z) => z.map((x) => x / length));
}
function projectiveResidual(a, b) {
  let sum = 0;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
    const p = mul(a[i], b[j]), q = mul(a[j], b[i]);
    sum += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
  }
  return Math.sqrt(sum);
}
// Clip an infinite line to the fixed viewport by a continuous parametric
// interval. Endpoint order follows its direction, including at corner hits.
function segment(equation) {
  const [a, b, c] = equation;
  const length = Math.hypot(a, b);
  const normal = [a / length, b / length];
  const anchor = normal.map((v) => -v * c / length);
  const direction = [normal[1], -normal[0]];
  let low = -Infinity, high = Infinity;
  for (let k = 0; k < 2; k++) {
    if (direction[k] === 0) {
      if (Math.abs(anchor[k]) > LIMIT) return null;
    } else {
      const first = (-LIMIT - anchor[k]) / direction[k];
      const second = (LIMIT - anchor[k]) / direction[k];
      low = Math.max(low, Math.min(first, second));
      high = Math.min(high, Math.max(first, second));
    }
  }
  if (!(low <= high && Number.isFinite(low) && Number.isFinite(high))) return null;
  return [low, high].map((t) => anchor.map((v, k) => v + t * direction[k]));
}

export function flagDiagram(data, options = {}) {
  const fail = (reason) => ({ valid: false, reason });
  if (!data || !data.valid) return fail(data && data.reason || "Flag data is unavailable.");
  if (!Array.isArray(data.points) || !Array.isArray(data.dualLines) ||
      data.points.length !== 3 || data.dualLines.length !== 3) {
    return fail("The decorated diagram requires three finite flags.");
  }
  const points = data.points.map(unit), normals = data.dualLines.map(unit);
  if (points.concat(normals).some((v) => !v)) return fail("The decorated diagram requires finite nonzero homogeneous coordinates.");
  const denominator = normals[2][1];
  const den = denominator[0] ** 2 + denominator[1] ** 2;
  const numerator = normals[2][0];
  const atInfinity = !(den > 0);
  if (atInfinity && !options.compact) return fail("These flags are outside the supported E6 candidate chart.");
  const homogeneousSize = abs(numerator) + abs(denominator);
  if (!(homogeneousSize > 0)) return fail("The third line is outside the candidate chart.");
  const compactRadius = abs(numerator) / homogeneousSize;
  const z = atInfinity ? null :
    [-(numerator[0] * denominator[0] + numerator[1] * denominator[1]) / den,
      -(numerator[1] * denominator[0] - numerator[0] * denominator[1]) / den];
  const magnitude = atInfinity ? Infinity : abs(z);
  if (!atInfinity && !Number.isFinite(magnitude)) return fail("The candidate chart coordinate is not finite.");
  const expectedPoints = [0, 1, 2].map((i) => [0, 1, 2].map((j) => [i === j ? 1 : 0, 0]));
  const expectedNormals = [
    [[0, 0], [-1, 0], [1, 0]],
    [[1, 0], [0, 0], [-1, 0]],
    [numerator, denominator, [0, 0]],
  ].map(unit);
  const maxChartResidual = Math.max(...points.map((p, i) => projectiveResidual(p, expectedPoints[i])),
    ...normals.map((n, i) => projectiveResidual(n, expectedNormals[i])));
  if (maxChartResidual > CHART_TOLERANCE) return fail("These flags are outside the supported E6 candidate chart; no chart change has been applied.");
  // In x+y+w=1 use (X,Y)=(y,w). With compact radial coordinate r,
  // the third real line is X+rY=r, including both projective endpoints.
  const size = Math.max(1, magnitude);
  const affineLineEquations = [[-1, 1, 0], [1, 2, -1],
    options.compact ? [1, compactRadius, -compactRadius] :
      [1 / size + magnitude / size, magnitude / size, -magnitude / size]];
  const lines = affineLineEquations.map(([a, b, c]) => segment([a, b, SCALE * (0.5 * a + 0.5 * b + c)]));
  if (lines.some((line) => !line)) return fail("The chart lines cannot be clipped to the viewport.");
  const phase = magnitude === 0 || atInfinity ? null : Math.atan2(z[1], z[0]);
  return {
    valid: true,
    points: [[0, 0], [1, 0], [0, 1]].map((p) => p.map((x) => SCALE * (x - 0.5))),
    lines, linePhases: [0, 0, phase], pointPhases: [0, 0, 0],
    phaseVectors: [[1, 0], [1, 0], options.compact ?
      (phase === null ? [0, 0] : [4 * compactRadius * (1 - compactRadius) * Math.cos(phase),
        4 * compactRadius * (1 - compactRadius) * Math.sin(phase)]) : z.slice()],
    phaseRadii: [1, 1, options.compact ? 4 * compactRadius * (1 - compactRadius) : magnitude],
    parameter: z, magnitude, compactRadius, atInfinity,
    homogeneousParameter: [[-numerator[0], -numerator[1]], denominator.slice()],
    phaseMatchedConcurrency: data.concurrent === true,
    reconstruction: {
      chart: "E6 candidate: p=e1,e2,e3; n=(0,-1,1),(1,0,-1),(-z,1,0)",
      affineViewport: [-0.3, 1.3], coordinateScale: SCALE,
      affineLineEquations, maxChartResidual, chartTolerance: CHART_TOLERANCE,
      // For the third equation ax+by+c=0, r=b/(a-b), then z=r exp(i phase).
      magnitudeFromLine: options.compact ? "b/(a-b); compact r=b/a" : "b/(a-b)",
      recoveredParameter: atInfinity ? null : phase === null ? [0, 0] :
        [magnitude * Math.cos(phase), magnitude * Math.sin(phase)],
    },
  };
}
