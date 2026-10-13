// validate-screen.mjs — Node battery for assets/js/ek-nakajima/element-screen.js,
// the PURE orthographic camera/projection used by the single-element renderer.
//
// Run from tests/ after the modules are copied next to this file (see run.sh):
//   node validate-screen.mjs
//
// Checks:
//   A. viewBasis is orthonormal for every camera;
//   B. orthographic behaviour: an offset along `right`/`up` maps to a
//      proportional screen offset, an offset along `view` maps to ~0;
//   C. origin maps near the canvas centre under a symmetric fit;
//   D. the auto-fit keeps every triangle vertex inside the canvas;
//   E. degenerate / zero-extent geometry yields no NaN;
//   F. the marker screen points equal the projected marker 3-D points.
import { makeRep } from "./core-math.js";
import { elementView } from "./element-view.js";
import { viewBasis, projectPoint, projectDepth, fitCamera, elementScreen } from "./element-screen.js";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  FAIL: ${name}${detail ? " :: " + detail : ""}`);
  }
}
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const isFin = (v) => v.every((x) => Number.isFinite(x));
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

const Z = (rows) => rows.map((r) => r.map((e) => (Array.isArray(e) ? e : [e, 0])));

// Exact symmetric y=0 fixture (identical to validate-element.mjs).
function symmetricFixture(alpha, gamma) {
  const sq = Math.sqrt;
  const a = [Z([[sq(alpha)], [0]]), Z([[sq(alpha)], [0]]), Z([[sq(alpha)], [0]])];
  const A1 = Z([[sq(gamma + alpha), 0], [0, sq(gamma)], [0, 0]]);
  const A2 = Z([[0, 0], [sq(gamma + alpha), 0], [0, sq(gamma)]]);
  const A3 = Z([[0, sq(gamma)], [0, 0], [sq(gamma + alpha), 0]]);
  const b = [Z([[0, 0]]), Z([[0, 0]]), Z([[0, 0]])];
  const B = [Z([[0, 0, 0], [0, 0, 0]]), Z([[0, 0, 0], [0, 0, 0]]), Z([[0, 0, 0], [0, 0, 0]])];
  return { rep: makeRep(a, [A1, A2, A3], b, B), levels: [[alpha, gamma], [alpha, gamma], [alpha, gamma]] };
}

const fixture = symmetricFixture(1.3, 0.9);
const view = elementView(fixture.rep, fixture.levels);

// ---------------------------------------------------------------------------
// A. viewBasis orthonormal for every camera
// ---------------------------------------------------------------------------
{
  const cams = [
    { azimuth: 0, elevation: 0 },
    { azimuth: 0.6, elevation: 0.35 },
    { azimuth: -2.1, elevation: -1.1 },
    { azimuth: 3.0, elevation: 1.4 },
  ];
  let ok = true;
  let detail = "";
  for (const cam of cams) {
    const b = viewBasis(cam);
    for (const v of [b.right, b.up, b.view]) if (!close(dot(v, v), 1, 1e-12)) { ok = false; detail = "nonunit"; }
    if (!close(dot(b.right, b.up), 0, 1e-12)) { ok = false; detail = "right.up"; }
    if (!close(dot(b.right, b.view), 0, 1e-12)) { ok = false; detail = "right.view"; }
    if (!close(dot(b.up, b.view), 0, 1e-12)) { ok = false; detail = "up.view"; }
    // right lies in the xy-plane.
    if (!close(b.right[1], 0, 1e-12)) { ok = false; detail = "right not in xy-plane"; }
  }
  check("viewBasis orthonormal (right in xy-plane) for all cameras", ok, detail);
}

// ---------------------------------------------------------------------------
// B. orthographic behaviour
// ---------------------------------------------------------------------------
{
  const cam = { azimuth: 0.6, elevation: 0.35 };
  const b = viewBasis(cam);
  const p0 = [0, 0, 0];
  const s0 = projectPoint(p0, cam);
  const t = 1.7;
  const off = (dir) => {
    const p = p0.map((x, i) => x + t * dir[i]);
    const s = projectPoint(p, cam);
    return [s[0] - s0[0], s[1] - s0[1]];
  };
  const oR = off(b.right);
  const oU = off(b.up);
  const oV = off(b.view);
  check("offset along right -> proportional screen x", close(oR[0], t, 1e-12) && close(oR[1], 0, 1e-12),
    JSON.stringify(oR));
  check("offset along up -> proportional screen y", close(oU[0], 0, 1e-12) && close(oU[1], -t, 1e-12),
    JSON.stringify(oU));
  check("offset along view -> ~0 screen offset", Math.hypot(oV[0], oV[1]) < 1e-12,
    JSON.stringify(oV));
  // Depth is the projection on view.
  check("projectDepth(offset along view) = t", close(projectDepth(p0.map((x, i) => x + t * b.view[i]), cam), t, 1e-12));
  check("projectPoint of origin is [0,0]", isFin(s0) && close(s0[0], 0, 1e-12) && close(s0[1], 0, 1e-12));
}

// ---------------------------------------------------------------------------
// C. origin maps near the canvas centre under a symmetric fit
// ---------------------------------------------------------------------------
{
  const pts = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const size = { width: 400, height: 300 };
  const fit = fitCamera(pts, size, 0.1);
  const s = [fit.scale * projectPoint([0, 0, 0], null)[0] + fit.cx,
             fit.scale * projectPoint([0, 0, 0], null)[1] + fit.cy];
  check("symmetric fit: origin maps to canvas centre", close(s[0], 200, 1e-9) && close(s[1], 150, 1e-9),
    JSON.stringify([s[0], s[1]]));
  check("fitCamera returns finite scale/cx/cy", isFin([fit.scale, fit.cx, fit.cy]));
}

// ---------------------------------------------------------------------------
// D. auto-fit keeps every vertex inside the canvas
// ---------------------------------------------------------------------------
{
  const size = { width: 400, height: 300 };
  const cam = { azimuth: 0.6, elevation: 0.35, zoom: 1 };
  const scr = elementScreen(view, cam, size);
  let ok = true;
  let detail = "";
  for (const v of scr.vertices) {
    if (!isFin(v)) { ok = false; detail = "NaN"; break; }
    if (v[0] < -1e-6 || v[0] > size.width + 1e-6 || v[1] < -1e-6 || v[1] > size.height + 1e-6) {
      ok = false; detail = JSON.stringify(v);
    }
  }
  check("auto-fit keeps all vertices inside the canvas", ok, detail);

  // No NaN anywhere in the screen data.
  const all = [];
  for (const fam of [scr.vertices, scr.midpoints, scr.markersLine, scr.markersPlane]) {
    for (const p of fam) all.push(p);
  }
  for (const e of scr.edges) { all.push(e[0]); all.push(e[1]); }
  check("elementScreen: no NaN in any screen point", all.every(isFin));
  check("elementScreen: finite scale/cx/cy", isFin([scr.scale, scr.cx, scr.cy]));

  // Zoom is applied as a scale multiplier.
  const scrZ = elementScreen(view, { azimuth: 0.6, elevation: 0.35, zoom: 2 }, size);
  check("zoom multiplies the fit scale", close(scrZ.scale, 2 * scr.scale, 1e-9),
    `${scrZ.scale} vs ${2 * scr.scale}`);
}

// ---------------------------------------------------------------------------
// E. degenerate / zero-extent geometry yields no NaN
// ---------------------------------------------------------------------------
{
  const P = [0, 0, 0];
  const degenerate = {
    vertices: [P.slice(), P.slice(), P.slice()],
    edges: [[P.slice(), P.slice()], [P.slice(), P.slice()], [P.slice(), P.slice()]],
    midpoints: [P.slice(), P.slice(), P.slice()],
    markers: { line: [P.slice(), P.slice(), P.slice()], plane: [P.slice(), P.slice(), P.slice()] },
    notes: {},
  };
  const scr = elementScreen(degenerate, { azimuth: 0.3, elevation: 0.2 }, { width: 400, height: 300 });
  const all = [];
  for (const fam of [scr.vertices, scr.midpoints, scr.markersLine, scr.markersPlane]) {
    for (const p of fam) all.push(p);
  }
  check("degenerate geometry: no NaN", all.every(isFin) && isFin([scr.scale, scr.cx, scr.cy]));
  check("degenerate geometry: finite scale", Number.isFinite(scr.scale) && scr.scale > 0);

  const fit = fitCamera([P.slice(), P.slice()], { width: 100, height: 100 }, 0.1);
  check("fitCamera(degenerate) finite and positive", isFin([fit.scale, fit.cx, fit.cy]) && fit.scale > 0);

  // Empty / null view must not throw.
  let threw = false;
  try { elementScreen(null, { azimuth: 0, elevation: 0 }, { width: 100, height: 100 }); }
  catch (e) { threw = true; }
  check("elementScreen(null view) does not throw", !threw);
}

// ---------------------------------------------------------------------------
// F. marker screen points equal the projected marker 3-D points
// ---------------------------------------------------------------------------
{
  const size = { width: 400, height: 300 };
  const cam = { azimuth: 0.6, elevation: 0.35 };
  const scr = elementScreen(view, cam, size);
  const proj = (p) => {
    const s = projectPoint(p, cam);
    return [scr.scale * s[0] + scr.cx, scr.scale * s[1] + scr.cy];
  };
  let okL = true;
  let okP = true;
  for (let i = 0; i < view.markers.line.length; i++) {
    const q = proj(view.markers.line[i]);
    if (!close(q[0], scr.markersLine[i][0], 1e-9) || !close(q[1], scr.markersLine[i][1], 1e-9)) okL = false;
  }
  for (let i = 0; i < view.markers.plane.length; i++) {
    const q = proj(view.markers.plane[i]);
    if (!close(q[0], scr.markersPlane[i][0], 1e-9) || !close(q[1], scr.markersPlane[i][1], 1e-9)) okP = false;
  }
  check("line marker screen points = projected 3-D markers", okL);
  check("plane marker screen points = projected 3-D markers", okP);
}

// ---------------------------------------------------------------------------
console.log(`element-screen: ${pass}/${pass + fail} checks passed`);
process.exit(fail === 0 ? 0 : 1);
