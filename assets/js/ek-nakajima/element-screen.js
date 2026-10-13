// element-screen.js — PURE, dependency-free, Node-safe orthographic camera and
// projection used by the browser-only single-element renderer.
//
// The renderer draws the V2 "su(3) triangle + flag markers" display data
// (element-view.js) with a simple orthographic camera you can orbit and zoom.
// Keeping this layer pure (no DOM, no THREE, no canvas) means it can be unit
// tested in Node; the DOM/canvas work lives in element-render.js.
//
// Camera convention (cam = { azimuth, elevation, zoom }):
//   azimuth   rotates about the world +y axis;
//   elevation tilts the camera up/down;
//   right     lies in the world xy-plane (azimuth only);
//   up        is tilted by elevation;
//   view      points from the scene toward the camera (the "depth" axis).
// A point's screen x is its projection on `right`, screen y is MINUS its
// projection on `up` (canvas y grows downward); depth is its projection on
// `view`. All vectors are unit length.

const EPS = 1e-12;

function camOf(cam) {
  cam = cam || {};
  const azimuth = Number.isFinite(cam.azimuth) ? cam.azimuth : 0;
  const elevation = Number.isFinite(cam.elevation) ? cam.elevation : 0;
  return { azimuth: azimuth, elevation: elevation };
}

// Unit camera basis. Orthonormal for every (azimuth, elevation); never divides
// by zero because `right` and `up` are written in closed form.
export function viewBasis(cam) {
  const { azimuth, elevation } = camOf(cam);
  const ca = Math.cos(azimuth);
  const sa = Math.sin(azimuth);
  const ce = Math.cos(elevation);
  const se = Math.sin(elevation);

  // right in the xy-plane, orthonormal to view by construction.
  const right = [ca, 0, -sa];
  const view = [ce * sa, se, ce * ca];
  const up = [-se * sa, ce, -se * ca];
  return { right: right, up: up, view: view };
}

// Unscaled screen coordinates [sx, sy] (sy is screen-down).
export function projectPoint(p, cam) {
  const b = viewBasis(cam);
  const x = Number.isFinite(p[0]) ? p[0] : 0;
  const y = Number.isFinite(p[1]) ? p[1] : 0;
  const z = Number.isFinite(p[2]) ? p[2] : 0;
  return [
    x * b.right[0] + y * b.right[1] + z * b.right[2],
    -(x * b.up[0] + y * b.up[1] + z * b.up[2]),
  ];
}

// Depth along the view axis (larger = nearer the camera).
export function projectDepth(p, cam) {
  const b = viewBasis(cam);
  const x = Number.isFinite(p[0]) ? p[0] : 0;
  const y = Number.isFinite(p[1]) ? p[1] : 0;
  const z = Number.isFinite(p[2]) ? p[2] : 0;
  return x * b.view[0] + y * b.view[1] + z * b.view[2];
}

function normSize(size) {
  if (typeof size === "number") return { width: size, height: size };
  size = size || {};
  const w = Number.isFinite(size.width) ? size.width : 0;
  const h = Number.isFinite(size.height) ? size.height : 0;
  return { width: w, height: h };
}

// fitCamera(points3, size, margin[, cam]): the scale and translation that map
// the unscaled projections of `points3` into a w x h canvas with a fractional
// margin. Degenerate/zero-extent point sets fall back to a centred unit scale
// (no division by zero). Returns { scale, cx, cy }.
export function fitCamera(points3, size, margin, cam) {
  const { width: w, height: h } = normSize(size);
  const m = Number.isFinite(margin) ? Math.max(0, margin) : 0.08;
  const innerW = Math.max(w * (1 - 2 * m), EPS);
  const innerH = Math.max(h * (1 - 2 * m), EPS);

  const pts = Array.isArray(points3) ? points3 : [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const p of pts) {
    if (!p) continue;
    const s = projectPoint(p, cam);
    if (!Number.isFinite(s[0]) || !Number.isFinite(s[1])) continue;
    any = true;
    if (s[0] < minX) minX = s[0];
    if (s[0] > maxX) maxX = s[0];
    if (s[1] < minY) minY = s[1];
    if (s[1] > maxY) maxY = s[1];
  }

  if (!any) {
    const scale0 = Math.min(w, h) > 0 ? Math.min(w, h) * 0.4 : 1;
    return { scale: scale0, cx: w / 2, cy: h / 2 };
  }

  const extX = maxX - minX;
  const extY = maxY - minY;
  const sx = extX > EPS ? innerW / extX : Infinity;
  const sy = extY > EPS ? innerH / extY : Infinity;
  let scale = Math.min(sx, sy);
  if (!Number.isFinite(scale) || scale <= 0) {
    scale = Math.min(w, h) > 0 ? Math.min(w, h) * 0.4 : 1;
  }
  const bboxCx = (minX + maxX) / 2;
  const bboxCy = (minY + maxY) / 2;
  return {
    scale: scale,
    cx: w / 2 - scale * bboxCx,
    cy: h / 2 - scale * bboxCy,
  };
}

function toScreen(sp, fit) {
  return [fit.scale * sp[0] + fit.cx, fit.scale * sp[1] + fit.cy];
}

function screenAll(points3, fit) {
  const out = [];
  for (const p of points3 || []) {
    out.push(toScreen(projectPoint(p, fit.cam), fit));
  }
  return out;
}

// elementScreen(view, cam, size): the full 2D screen data for one element view.
// Projects the vertices, edges, midpoints and both marker families, fitting all
// of them into the canvas (with cam.zoom as a scale multiplier) and returning
// the per-family depths. Handles a null/empty view and degenerate geometry
// without throwing and without producing NaN.
export function elementScreen(view, cam, size) {
  const { width: w, height: h } = normSize(size);
  const zoom = cam && Number.isFinite(cam.zoom) && cam.zoom > 0 ? cam.zoom : 1;
  const fit = { scale: 0, cx: w / 2, cy: h / 2, cam: cam };

  const empty = {
    scale: 0,
    cx: w / 2,
    cy: h / 2,
    vertices: [],
    edges: [],
    midpoints: [],
    markersLine: [],
    markersPlane: [],
    depths: { vertices: [], midpoints: [], markersLine: [], markersPlane: [] },
  };
  if (!view || !Array.isArray(view.vertices)) return empty;

  const verts = view.vertices;
  const mids = Array.isArray(view.midpoints) ? view.midpoints : [];
  const mL = view.markers && Array.isArray(view.markers.line) ? view.markers.line : [];
  const mP = view.markers && Array.isArray(view.markers.plane) ? view.markers.plane : [];

  // Fit to every displayed point so nothing spills outside the frame.
  const fitPts = [];
  for (const p of verts) fitPts.push(p);
  for (const p of mids) fitPts.push(p);
  for (const p of mL) fitPts.push(p);
  for (const p of mP) fitPts.push(p);

  const f = fitCamera(fitPts, size, 0.1, cam);
  const scale = f.scale * zoom;
  const zf = f.scale > 0 ? f.scale : 1;
  fit.scale = scale;
  fit.cx = w / 2 + (scale / zf) * (f.cx - w / 2);
  fit.cy = h / 2 + (scale / zf) * (f.cy - h / 2);

  const vertices = screenAll(verts, fit);
  const midpoints = screenAll(mids, fit);
  const markersLine = screenAll(mL, fit);
  const markersPlane = screenAll(mP, fit);

  const edges = [];
  for (const e of view.edges || []) {
    if (!e || e.length < 2) continue;
    edges.push([
      toScreen(projectPoint(e[0], cam), fit),
      toScreen(projectPoint(e[1], cam), fit),
    ]);
  }

  const dV = verts.map((p) => projectDepth(p, cam));
  const dM = mids.map((p) => projectDepth(p, cam));
  const dL = mL.map((p) => projectDepth(p, cam));
  const dP = mP.map((p) => projectDepth(p, cam));

  return {
    scale: scale,
    cx: fit.cx,
    cy: fit.cy,
    vertices: vertices,
    edges: edges,
    midpoints: midpoints,
    markersLine: markersLine,
    markersPlane: markersPlane,
    depths: { vertices: dV, midpoints: dM, markersLine: dL, markersPlane: dP },
  };
}
