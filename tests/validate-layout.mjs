// Node validation for the E_k core-tree layout (task 4 geometry layer).
// Run via run-validation.sh (copies the live modules in as .mjs).

import { AFFINE_ADE, affineA } from "./quiver-data.js";
import { orientCore, layoutCore, validateLayout } from "./core-layout.js";

let checks = 0;
let fails = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) {
    fails++;
    console.error("FAIL: " + msg);
  }
}

function checkPacking(name, q, radii) {
  const lay = layoutCore(q, radii);
  const v = validateLayout(lay);
  ok(v.ok, name + " layout: " + v.errors.slice(0, 4).join("; "));
  ok(lay.centers.length === q.coreSpheres, name + " one sphere per core node");
  ok(lay.edges.length === q.coreSpheres - 1, name + " core tree has n-1 edges");
  for (let i = 0; i < lay.centers.length; i++) {
    ok(Number.isFinite(lay.centers[i][0]) && Number.isFinite(lay.centers[i][1]), name + " center " + i + " finite");
  }
  // neighbor directions unit + distinct per node
  for (let i = 0; i < lay.nodeNeighbors.length; i++) {
    const ns = lay.nodeNeighbors[i];
    const dirs = [];
    for (const nb of ns) {
      const L = Math.hypot(nb.dir[0], nb.dir[1]);
      ok(Math.abs(L - 1) < 1e-9, name + " neighbor dir unit at " + i);
      for (const d of dirs) {
        const dot = d[0] * nb.dir[0] + d[1] * nb.dir[1];
        ok(dot < 1 - 1e-9, name + " distinct neighbor dirs at " + i);
      }
      dirs.push(nb.dir);
    }
  }
  return lay;
}

for (const key of Object.keys(AFFINE_ADE)) {
  const q = AFFINE_ADE[key];
  // [A] uniform radii
  const lay = checkPacking(key + " uniform", q, null);
  // [B] root is the junction (unique max-mark node of the core tree)
  const oriented = orientCore(q);
  let maxIdx = 0;
  for (let i = 0; i < oriented.tree.marks.length; i++) {
    if (oriented.tree.marks[i] > oriented.tree.marks[maxIdx]) maxIdx = i;
  }
  ok(oriented.root === maxIdx, key + " rooted at junction");
  // [C] D4 core is the hyperpolygon star: junction with 3 leaves
  if (key === "D4") {
    const deg = lay.nodeNeighbors.map((ns) => ns.length);
    ok(deg[lay.root] === 3, "D4 core junction degree 3");
    ok(deg.filter((d) => d === 1).length === 3, "D4 core has 3 leaves");
    ok(lay.centers.length === 4, "D4 core has 4 spheres");
  }
  // [D] varied radii still pack
  const n = q.coreSpheres;
  const rr = new Array(n).fill(0);
  for (let i = 0; i < n; i++) rr[i] = 0.5 + 0.5 * ((i * 7) % 5);
  checkPacking(key + " varied", q, rr);
}

// [E] A-type cores are paths; affine A_n has core n
for (let n = 1; n <= 8; n++) {
  const q = affineA(n);
  const lay = checkPacking("A" + n, q, null);
  ok(lay.centers.length === n, "A" + n + " core has n spheres");
  const deg = lay.nodeNeighbors.map((ns) => ns.length);
  ok(Math.max.apply(null, deg) <= 2, "A" + n + " core is a path");
  // n = 1: single sphere, no edges
  if (n === 1) ok(lay.edges.length === 0 && lay.centers.length === 1, "A1 core is one sphere");
}

// [F] malformed radii are rejected
let threw = false;
try {
  layoutCore(AFFINE_ADE.D4, [1, 1, 1]);
} catch (e) {
  threw = true;
}
ok(threw, "layoutCore rejects wrong-length radii");
threw = false;
try {
  layoutCore(AFFINE_ADE.D4, [1, 1, 1, 1, -1]);
} catch (e) {
  threw = true;
}
ok(threw, "layoutCore rejects non-positive radii");

ok(fails === 0, "no failures");
console.log("core-layout: " + (checks - fails) + "/" + checks + " checks passed");
if (fails > 0) process.exit(1);
