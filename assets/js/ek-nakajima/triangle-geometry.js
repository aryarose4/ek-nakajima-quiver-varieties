// E6 triangle geometry — pure, dependency-free, Node-safe.
//
// The geometry comes from a SOLVED, at-level representative bundle
// (`assets/data/e6-triangle-solved.json`, schema `e6-triangle-solved/1`),
// written by the solver track.  Those points balance the real moment map, so
// the three traceless Hermitian central moment maps Q_i close
// (sum_i Q_i ~ 0) and the triangle is the physical one; its shape is fixed by
// the levels up to Euclidean rotation.
//
// The previous chart-flag construction was removed: the orthogonal projector
// is NOT equivariant under the solver's non-unitary complex gauge, so the
// chart's flags are not the physical flags at the given levels (they neither
// close nor give the correct pairwise traces).  Nothing in this module
// computes chart geometry.
//
// DATA SHAPES (all real numbers):
//   view_frame : 3x8, rows [e1, e2, e3] orthonormal in R^8 (the space of
//                traceless Hermitian 3x3 matrices); e1,e2 span the triangle
//                plane, e3 is its orthogonal complement.
//   q          : 3x8, the q_i edge vectors (coordinates of Q_i).
//   vertices   : 3x3, projections of 0, q_0, q_0 + q_1.
//   markers    : { line: 3x3, plane: 3x3 } absolute 3D marker positions.
//   line_dir / plane_dir : 3x8 directions d_i = [Pi_Li - I3/3],
//                E_i = [Pi_Pi - 2 I3/3].
//
//   projection p(v) = [v.e1, v.e2, v.e3].

// ---------------------------------------------------------------------------
// small real-vector helpers
// ---------------------------------------------------------------------------
export function vdot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function vadd(a, b) {
  const o = new Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] + b[i];
  return o;
}

function vsub(a, b) {
  const o = new Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] - b[i];
  return o;
}

function vscale(a, s) {
  const o = new Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] * s;
  return o;
}

function vnorm(a) {
  return Math.sqrt(vdot(a, a));
}

function isFiniteVec(v) {
  if (!Array.isArray(v)) return false;
  for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) return false;
  return true;
}

// ---------------------------------------------------------------------------
// projection and triangle construction
// ---------------------------------------------------------------------------
// frame is 3x8 (rows e1,e2,e3).  p(v) = [v.e1, v.e2, v.e3].
export function project(v, frame) {
  return [vdot(v, frame[0]), vdot(v, frame[1]), vdot(v, frame[2])];
}

// The three projected vertices: 0, p(q_0), p(q_0 + q_1).
export function verticesFromQ(q, frame) {
  const z8 = new Array(q[0].length).fill(0);
  return [project(z8, frame), project(q[0], frame), project(vadd(q[0], q[1]), frame)];
}

// The three edge vectors of the closed triangle: v1-v0, v2-v1, v0-v2.
export function edgeVectors(vertices) {
  return [
    vsub(vertices[1], vertices[0]),
    vsub(vertices[2], vertices[1]),
    vsub(vertices[0], vertices[2]),
  ];
}

// Flag markers: midpoint(edge_i) + cL * p(line_dir_i) and
// midpoint(edge_i) + cP * p(plane_dir_i).  Returns { line, plane } (absolute
// 3D positions); the midpoints are not included.
export function markersFromDirs(q, line_dir, plane_dir, frame, cL, cP) {
  const a = cL === undefined ? 1 : cL;
  const b = cP === undefined ? 1 : cP;
  const v = verticesFromQ(q, frame);
  const mids = [
    vscale(vadd(v[0], v[1]), 0.5),
    vscale(vadd(v[1], v[2]), 0.5),
    vscale(vadd(v[2], v[0]), 0.5),
  ];
  const line = [];
  const plane = [];
  for (let i = 0; i < 3; i++) {
    line.push(vadd(mids[i], vscale(project(line_dir[i], frame), a)));
    plane.push(vadd(mids[i], vscale(project(plane_dir[i], frame), b)));
  }
  return { line: line, plane: plane };
}

// ---------------------------------------------------------------------------
// bundle loading and validation
// ---------------------------------------------------------------------------
const SCHEMA = "e6-triangle-solved/1";

function isMat(x, rows, cols, finite) {
  if (!Array.isArray(x) || x.length !== rows) return false;
  for (let i = 0; i < rows; i++) {
    if (!Array.isArray(x[i]) || x[i].length !== cols) return false;
    if (finite) for (let j = 0; j < cols; j++) if (!Number.isFinite(x[i][j])) return false;
  }
  return true;
}

// Shape/finiteness check for one bundle point (sweep or preset).
export function isValidPoint(point) {
  if (!point || typeof point !== "object") return false;
  if (typeof point.z_re !== "number" || typeof point.z_im !== "number") return false;
  if (!isMat(point.levels, 3, 2, true)) return false;
  if (!isMat(point.q, 3, 8, true)) return false;
  if (!isMat(point.view_frame, 3, 8, true)) return false;
  if (!isMat(point.vertices, 3, 3, true)) return false;
  if (!point.markers || !isMat(point.markers.line, 3, 3, true) || !isMat(point.markers.plane, 3, 3, true)) return false;
  if (!Array.isArray(point.edge_norms_sq) || point.edge_norms_sq.length !== 3) return false;
  if (typeof point.closure_error !== "number") return false;
  if (typeof point.stable !== "boolean") return false;
  return true;
}

// Fetch and parse the solved bundle (browser).  Node has no global fetch, so
// this throws a clear error there; Node tests read the JSON with fs instead.
export async function loadBundle(url) {
  if (typeof fetch !== "function") {
    throw new Error("loadBundle requires fetch (run in a browser, or use fs in Node)");
  }
  const res = await fetch(url);
  if (!res || !res.ok) throw new Error("HTTP " + (res && res.status) + " fetching " + url);
  const data = await res.json();
  if (!data || data.schema !== SCHEMA) {
    throw new Error("unexpected bundle schema: " + (data && data.schema));
  }
  return data;
}

export { vadd, vsub, vscale, vnorm, isFiniteVec };
