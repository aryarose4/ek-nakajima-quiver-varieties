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

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Homogeneous normal normalization may reverse a line at a chart change.
// Keep its label at the same end while retaining the exact same segment.
function firstLineOrientation(diagram) {
  if (!diagram.valid) return diagram;
  const directions = [[1, 1], [2, -1], [1, -2]];
  return { ...diagram, lines: diagram.lines.map((line, i) => {
    const d = directions[i];
    return (line[1][0] - line[0][0]) * d[0] + (line[1][1] - line[0][1]) * d[1] < 0 ? [line[1], line[0]] : line;
  }) };
}

// The compact transverse chart uses w=t/[4(1-t)] at r=1/2.
// Thus G=I-s P_L with s=w/(1+w) has a unit-normalized finite limit.
export const concurrencyGaugeProgress = (t) => t / (4 - 3 * t);

function centralDiagonal(options) {
  const { r, t } = options;
  if (![r, t].every(Number.isFinite) || r < 0 || r > 1 || t < 0 || t >= 1) throw new RangeError('Finite central display coordinates required');
  return [1, Math.pow(1 - t, Math.max(0, 1 - 2 * r)), Math.pow(1 - t, Math.max(0, 2 * r - 1))];
}

// Extend the endpoint gauges continuously over the central chart. The same
// positive central gauge acts on the flags and their cotangent operators.
export function centralDisplayGauge(data, operators, options) {
  const d = centralDiagonal(options);
  return { data: { ...data,
    points: data.points.map(p => p.map((z, j) => z.map(v => v * d[j]))),
    dualLines: data.dualLines.map(p => p.map((z, j) => z.map(v => v / d[j]))),
  }, operators: operators && operators.map(K => K.map((row, j) => row.map((z, k) => z.map(v => v * d[j] / d[k])))), diagonal: d };
}

// The exact overlap gauges of the long-arm atlas, softened at zero so that
// each animation starts in its current chart. Points and cotangent operators
// undergo the same central change of basis.
export function branchDisplayGauge(data, operators, options) {
  if (!options) return { data, operators };
  const m = options.magnitude;
  if (!(Number.isFinite(m) && m >= 0)) throw new RangeError('Finite branch magnitude required');
  const d = options.firstLine ? (options.stage === 0 ? [1, 1 / (1 + m), 1] : [1 / (1 + m), 1, 1]) :
    (options.stage === 0 ? [1 / (1 + m), 1 / (1 + m), 1] : [1 + m, 1, 1]);
  if (options.side === 'infinity' || options.side === 1) {
    if (options.firstLine) [d[1], d[2]] = [d[2], d[1]];
    else [d[0], d[1]] = [d[1], d[0]];
  }
  return {
    data: { ...data,
      points: data.points.map((p) => p.map((z, j) => z.map((v) => v * d[j]))),
      dualLines: data.dualLines.map((p) => p.map((z, j) => z.map((v) => v / d[j]))),
    },
    operators: operators && operators.map((K) => K.map((row, j) => row.map((z, k) => z.map((v) => v * d[j] / d[k])))),
    diagonal: d,
  };
}

// Project actual real projective flags in the same affine camera used by the
// central chart. No modulus substitution is made: non-real flags are rejected.
export function realFlagDiagram(data) {
  function real(v) {
    const u = unit(v);
    if (!u) return null;
    let pivot = 0;
    for (let i = 1; i < 3; i++) if (abs(u[i]) > abs(u[pivot])) pivot = i;
    const phase = [u[pivot][0] / abs(u[pivot]), -u[pivot][1] / abs(u[pivot])];
    const rotated = u.map((z) => mul(z, phase));
    return rotated.every((z) => Math.abs(z[1]) < CHART_TOLERANCE) ? rotated.map((z) => z[0]) : null;
  }
  const points = data.points.map(real), dual = data.dualLines.map(real);
  if (points.concat(dual).some((p) => !p)) return { valid: false, reason: 'Real incidence camera requires real projective flags.' };
  const homogeneousPoints = points.map((p) => {
    const sum = p[0] + p[1] + p[2];
    return [SCALE * (p[1] - sum / 2), SCALE * (p[2] - sum / 2), sum];
  });
  const homogeneousLines = dual.map(([a, b, c]) => [b - a, c - a, SCALE * (b + c) / 2]);
  const lines = homogeneousLines.map(segment);
  if (lines.some((line) => !line) || homogeneousPoints.some((p) => Math.abs(p[2]) < 1e-12)) {
    return { valid: false, reason: 'Flags are outside this affine camera.' };
  }
  const affine = homogeneousPoints.map((p) => p.slice(0, 2).map((v) => v / p[2]));
  if (affine.some((p) => p.some((v) => Math.abs(v) > LIMIT))) return { valid: false, reason: 'Flag point is outside this affine camera.' };
  return { valid: true, points: affine, lines, compactRadius: 0.5,
    linePhases: [0, 0, 0], pointPhases: [0, 0, 0], phaseMatchedConcurrency: data.concurrent,
    reconstruction: { homogeneousPoints, homogeneousLines, chart: 'Actual real flags; X=S(y-sum/2), Y=S(z-sum/2), W=sum' } };
}

// A continuous projective camera for the concurrency degeneration. Its
// determinant is SCALE^2 (1+t), so it never collapses an incidence. Two
// points genuinely pass through infinity; boundary markers retain their
// identity rather than moving them through the concurrency point.
export function concurrencyDiagram(progress) {
  const t = Math.max(0, Math.min(1, progress));
  function camera(p) {
    const sum = p[0] + p[1] + p[2];
    return [SCALE * (p[1] - sum / 2), SCALE * (p[2] - sum / 2), sum + 3 * t * p[2]];
  }
  const homogeneousPoints = [0, 1, 2].map((i) => camera([0, 1, 2].map((j) => (i === j ? 1 : 0) - t / 3)));
  const center = camera([1, 1, 1]);
  const equations = homogeneousPoints.map((p) => cross(p, center));
  const centerPoint = center.slice(0, 2).map((v) => v / center[2]);
  const pointMarkers = homogeneousPoints.map((p, i) => {
    const finite = Math.abs(p[2]) > 1e-12;
    const q = finite ? p.slice(0, 2).map((v) => v / p[2]) : null;
    if (q && q.every((v) => Math.abs(v) <= LIMIT)) return { point: q, clipped: false };
    // Choose the boundary intersection on the correct affine ray. Exactly
    // at infinity either antipodal boundary endpoint represents the point.
    const direction = [p[0] * center[2] - center[0] * p[2], p[1] * center[2] - center[1] * p[2]];
    const sign = p[2] < 0 ? -1 : 1;
    const ray = direction.map((v) => v * sign);
    const endpoints = segment(equations[i]);
    const scores = endpoints.map((v) => (v[0] - centerPoint[0]) * ray[0] + (v[1] - centerPoint[1]) * ray[1]);
    const point = endpoints[scores[0] > scores[1] ? 0 : 1];
    const norm = Math.hypot(...ray);
    return { point, clipped: true, direction: ray.map((v) => v / norm), atInfinity: !finite };
  });
  return {
    valid: true, points: pointMarkers.map((p) => p.point), pointMarkers,
    lines: equations.map(segment), linePhases: [0, 0, 0], pointPhases: [0, 0, 0],
    compactRadius: 0.5, phaseMatchedConcurrency: true, concurrencyProgress: t,
    transversal: t === 1 ? segment([0, 1, -SCALE / 3]) : null,
    reconstruction: { homogeneousPoints, homogeneousLines: equations, center,
      chart: "p_i=e_i-t(1,1,1)/3; X=S(y-sum/2), Y=S(z-sum/2), W=sum+3tz" },
  };
}

// Three complex cotangent coefficients in a deterministic orthonormal flag
// basis. This is a display gauge, not three complex-gauge invariants.
export function cotangentGlyphs(data, operators, progress) {
  if (!data || !data.valid || !Array.isArray(operators)) return [];
  const conj = (z) => [z[0], -z[1]];
  const inner = (a, b) => a.reduce((sum, v, i) => {
    const z = mul(conj(v), b[i]); return [sum[0] + z[0], sum[1] + z[1]];
  }, [0, 0]);
  return operators.map((K, i) => {
    const incoming = Number.isFinite(progress) && progress < 1;
    const s = incoming ? concurrencyGaugeProgress(progress) : 0;
    const point = incoming ? [0, 1, 2].map((j) => [(i === j ? 1 : 0) - s / 3, 0]) : data.points[i];
    // At this exact attachment K is a multiple of L ell_i, ell_i(L)=0.
    // Conjugation by G therefore multiplies K by 1-s, without cancellation.
    const operator = incoming ? K.map((row) => row.map((z) => z.map((v) => v * (1 - s)))) : K;
    const e1 = unit(point);
    const e3 = unit(data.dualLines[i].map(conj));
    if (!e1 || !e3) return null;
    // A conjugated cross product avoids switching a Gram-Schmidt seed
    // when a line approaches a coordinate plane at a fixed point.
    const e2 = unit([0, 1, 2].map(j => {
      const a = mul(e3[(j + 1) % 3], e1[(j + 2) % 3]);
      const b = mul(e3[(j + 2) % 3], e1[(j + 1) % 3]);
      return conj([a[0] - b[0], a[1] - b[1]]);
    }));
    if (!e2) return null;
    const action = (v) => operator.map((row) => row.reduce((sum, z, j) => {
      const w = mul(z, v[j]); return [sum[0] + w[0], sum[1] + w[1]];
    }, [0, 0]));
    const coefficients = [inner(e1, action(e2)), inner(e1, action(e3)), inner(e2, action(e3))];
    return { coefficients, basis: [e1, e2, e3] };
  });
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
  if (options.firstLine && !options.realFlags && !Number.isFinite(options.concurrencyProgress)) {
    // The chamber chart has l1=(0,-z,1), l2=(1,0,-1),
    // l3=(-1,1,0). Work homogeneously so both radial poles are
    // genuine finite flag configurations, independent of theta.
    const numerator = normals[0][1], denominator = normals[0][2];
    const size = abs(numerator) + abs(denominator);
    if (!(size > 0)) return fail('The first line is outside the chamber chart.');
    const expectedPoints = [0, 1, 2].map(i => [0, 1, 2].map(j => [i === j ? 1 : 0, 0]));
    const expectedNormals = [
      [[0, 0], numerator, denominator],
      [[1, 0], [0, 0], [-1, 0]],
      [[-1, 0], [1, 0], [0, 0]],
    ].map(unit);
    const residual = Math.max(...points.map((p, i) => projectiveResidual(p, expectedPoints[i])),
      ...normals.map((p, i) => projectiveResidual(p, expectedNormals[i])));
    if (residual > CHART_TOLERANCE) return fail('These flags are outside the first-line chamber chart.');
    const r = abs(numerator) / size;
    const phaseProduct = mul([-numerator[0], -numerator[1]], [denominator[0], -denominator[1]]);
    const phase = r === 0 || r === 1 ? null : Math.atan2(phaseProduct[1], phaseProduct[0]);
    const diagonal = options.centralFlow ? centralDiagonal(options.centralFlow) : [1, 1, 1];
    const equations = [[0, -r, 1 - r], [-1, 0, 1], [-1, 1, 0]].map(n => {
      const [a, b, c] = n.map((v, j) => v / diagonal[j]);
      return [b - a, c - a, SCALE * (b + c) / 2];
    });
    const lines = equations.map(segment);
    if (lines.some(line => !line)) return fail('The chamber lines cannot be clipped to the viewport.');
    return firstLineOrientation({ valid: true, points: [[0, 0], [1, 0], [0, 1]].map(p => p.map(x => SCALE * (x - 0.5))),
      lines, compactRadius: r, linePhases: [phase, 0, 0], pointPhases: [0, 0, 0],
      phaseMatchedConcurrency: data.concurrent === true,
      phaseRadii: [4 * r * (1 - r), 1, 1],
      phaseVectors: [phase === null ? [0, 0] : [4 * r * (1 - r) * Math.cos(phase), 4 * r * (1 - r) * Math.sin(phase)], [1, 0], [1, 0]],
      reconstruction: { homogeneousPoints: expectedPoints.map(p => { const s = p.reduce((v, z) => v + z[0], 0); return [SCALE * (p[1][0] - s / 2), SCALE * (p[2][0] - s / 2), s]; }),
        homogeneousLines: equations, maxChartResidual: residual, chart: 'E6 first-line chamber: p=e1,e2,e3; n=(0,-z,1),(1,0,-1),(-1,1,0)' } });
  }
  if (options.realFlags) {
    const diagram = realFlagDiagram(data);
    return options.firstLine ? firstLineOrientation(diagram) : diagram;
  }
  if (Number.isFinite(options.concurrencyProgress)) {
    const t = Math.max(0, Math.min(1, options.concurrencyProgress));
    const expected = [0, 1, 2].map((i) => unit([0, 1, 2].map((j) => [
      (i === j ? 1 : 0) - (t === 1 ? 1 / 3 : 0), 0])));
    const dual = [[[0, 0], [-1, 0], [1, 0]], [[1, 0], [0, 0], [-1, 0]], [[-1, 0], [1, 0], [0, 0]]].map(unit);
    const residual = Math.max(...points.map((p, i) => projectiveResidual(p, expected[i])),
      ...normals.map((p, i) => projectiveResidual(p, dual[i])));
    if (residual > CHART_TOLERANCE) return fail("These flags are outside the concurrency chart.");
    const diagram = concurrencyDiagram(concurrencyGaugeProgress(t));
    return options.firstLine ? firstLineOrientation(diagram) : diagram;
  }
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
