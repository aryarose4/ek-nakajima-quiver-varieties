// Node battery for the E6 triangle geometry module (visualizer milestones
// V0-V2), driven by the SOLVED, at-level bundle
// assets/data/e6-triangle-solved.json (schema e6-triangle-solved/1).
//
// Run via run.sh (which copies the live module next to this file as
// triangle-geometry.js).  Node ESM, no dependencies, no fetch: the bundle is
// read with fs.  The old chart-flag / triangle_reference.json comparison was
// removed -- the chart is not the physical representative.

import fs from "fs";
import {
  project,
  verticesFromQ,
  edgeVectors,
  isValidPoint,
  vdot,
} from "./triangle-geometry.js";

let checks = 0;
let fails = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) {
    fails++;
    console.error("FAIL: " + msg);
  }
}
function close(a, b, tol, msg) {
  ok(Math.abs(a - b) <= tol, msg + " (|" + a + " - " + b + "| = " + Math.abs(a - b) + ")");
}
function relTol(b) { return 1e-9 * Math.max(1, Math.abs(b)); }

// ---------------------------------------------------------------------------
// load bundle
// ---------------------------------------------------------------------------
const bundleUrl = new URL("../assets/data/e6-triangle-solved.json", import.meta.url);
let bundle = null;
try {
  bundle = JSON.parse(fs.readFileSync(bundleUrl, "utf8"));
} catch (e) {
  console.error("FAIL: could not read " + bundleUrl.pathname + ": " + (e && e.message));
  fails++;
  checks++;
}

if (bundle) {
  ok(bundle.schema === "e6-triangle-solved/1", "bundle schema is e6-triangle-solved/1");
  const sweep = bundle.sweep || [];
  const presets = bundle.presets || [];
  ok(Array.isArray(bundle.skipped), "bundle has a skipped array");
  ok(sweep.length === 21, "bundle sweep has 21 points (got " + sweep.length + ")");
  ok(presets.length === 2, "bundle has 2 presets (got " + presets.length + ")");
  ok(Array.isArray(bundle.levels_options) && bundle.levels_options.length >= 1, "bundle has levels_options");

  const points = sweep.concat(presets);
  let closedMax = 0;
  let vertexMax = 0;
  let edgeMax = 0;

  for (let pi = 0; pi < points.length; pi++) {
    const p = points[pi];
    const tag = "point" + pi + " (" + (p.label || (p.z_re + "," + p.z_im)) + ")";

    ok(isValidPoint(p), tag + " isValidPoint");

    // stable + closure diagnostics recorded by the solver
    ok(p.stable === true, tag + " stable");
    ok(Number.isFinite(p.closure_error), tag + " closure_error finite");
    ok(p.closure_error < 1e-9, tag + " closure_error < 1e-9 (" + p.closure_error + ")");

    const fr = p.view_frame;
    const q = p.q;

    // view_frame orthonormal (rows in R^8)
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        close(vdot(fr[a], fr[b]), a === b ? 1 : 0, 1e-9, tag + " view_frame e" + a + ".e" + b);
      }
    }
    // e3 orthogonal to the triangle plane (spanned by q0,q1); q2 = -(q0+q1)
    for (let i = 0; i < 3; i++) {
      close(vdot(fr[2], q[i]), 0, 1e-9 * Math.max(1, Math.sqrt(p.edge_norms_sq[i])), tag + " e3 orthogonal to q" + i);
    }

    // JS projection reproduces Python's stored vertices
    const verts = verticesFromQ(q, fr);
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 3; k++) {
        const d = Math.abs(verts[i][k] - p.vertices[i][k]);
        if (d > vertexMax) vertexMax = d;
        ok(d <= relTol(p.vertices[i][k]), tag + " reproject vertices[" + i + "][" + k + "]");
      }
    }

    // triangle edge lengths equal sqrt(edge_norms_sq)
    const edges = edgeVectors(verts);
    for (let i = 0; i < 3; i++) {
      let n = 0;
      for (let k = 0; k < 3; k++) n += edges[i][k] * edges[i][k];
      const len = Math.sqrt(n);
      const want = Math.sqrt(Math.max(0, p.edge_norms_sq[i]));
      const d = Math.abs(len - want);
      if (d > edgeMax) edgeMax = d;
      ok(d <= relTol(want), tag + " edge " + i + " length == sqrt(edge_norms_sq)");
    }

    // closure via the triangle: the three edge vectors sum to ~0
    for (let k = 0; k < 3; k++) {
      const sum = edges[0][k] + edges[1][k] + edges[2][k];
      if (Math.abs(sum) > closedMax) closedMax = Math.abs(sum);
      ok(Math.abs(sum) < 1e-9, tag + " edge vectors sum to 0[" + k + "]");
    }

    // stored vertices and markers finite
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 3; k++) {
        ok(Number.isFinite(p.vertices[i][k]), tag + " vertices finite " + i + k);
        ok(Number.isFinite(p.markers.line[i][k]), tag + " markers.line finite " + i + k);
        ok(Number.isFinite(p.markers.plane[i][k]), tag + " markers.plane finite " + i + k);
      }
    }
  }

  console.log("bundle points compared: " + points.length +
    " (max reproject vertex diff " + vertexMax.toExponential(2) +
    ", max edge-length diff " + edgeMax.toExponential(2) +
    ", max edge-sum " + closedMax.toExponential(2) + ")");
}

ok(fails === 0, "no failures");
console.log("triangle-geometry: " + (checks - fails) + "/" + checks + " checks passed");
if (fails > 0) process.exit(1);
