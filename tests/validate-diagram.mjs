// Node validation for the E_k affine quiver-diagram layout (task 6
// geometry layer). Run via run-validation.sh (copies the live modules in).

import { AFFINE_ADE, affineA, finiteTree } from "./quiver-data.js";
import { diagramLayout, orientDiagram, validateDiagram, isCyclic } from "./diagram-layout.js";

let checks = 0;
let fails = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) {
    fails++;
    console.error("FAIL: " + msg);
  }
}

function check(name, q) {
  const lay = diagramLayout(q);
  const v = validateDiagram(lay);
  ok(v.ok, name + " diagram: " + v.errors.slice(0, 4).join("; "));
  ok(lay.positions.length === q.nodes, name + " one position per node");
  ok(lay.coreEdges.length + lay.affineEdges.length === q.edges.length, name + " edge partition");
  ok(lay.coreEdges.length === finiteTree(q).edges.length, name + " core edges match finiteTree");
  ok(lay.coreEdges.length === q.coreSpheres - 1, name + " core is a tree with coreSpheres-1 edges");
  for (let i = 0; i < lay.positions.length; i++) {
    ok(Number.isFinite(lay.positions[i][0]) && Number.isFinite(lay.positions[i][1]), name + " position " + i + " finite");
  }
  return lay;
}

// [A] every affine ADE type
for (const key of Object.keys(AFFINE_ADE)) {
  const q = AFFINE_ADE[key];
  const lay = check(key, q);
  ok(!lay.cyclic, key + " laid out as a tree");
  ok(lay.root === q.junction, key + " rooted at the junction");
  ok(lay.affineEdges.length === 1, key + " one affine (framing) edge");
  // D4 full diagram is the star: junction degree 4
  if (key === "D4") {
    const deg = new Array(q.nodes).fill(0);
    for (const [a, b] of q.edges) {
      deg[a]++;
      deg[b]++;
    }
    ok(deg[lay.junction] === 4, "D4 quiver junction degree 4");
    ok(deg.filter((d) => d === 1).length === 4, "D4 quiver has 4 leaves");
  }
}

// [B] A-type members are the cyclic/two-node diagrams
for (let n = 1; n <= 8; n++) {
  const q = affineA(n);
  const lay = check("A" + n, q);
  ok(lay.cyclic, "A" + n + " is cyclic");
  ok(lay.nodes === n + 1, "A" + n + " has n+1 nodes");
  ok(lay.affineEdges.length === 2, "A" + n + " two affine edges");
  if (n >= 2) {
    ok(Math.abs(lay.positions[0][0] - 1) < 1e-12, "A" + n + " node 0 on the +x axis");
  }
}

// [C] an injected edge length scales every tree edge
{
  const q = AFFINE_ADE.E6;
  const lay = diagramLayout(q, { edgeLen: 2 });
  const v = validateDiagram(lay);
  ok(v.ok, "E6 edgeLen 2 valid: " + v.errors.slice(0, 3).join("; "));
  for (const [a, b] of lay.edges) {
    const L = Math.hypot(lay.positions[a][0] - lay.positions[b][0], lay.positions[a][1] - lay.positions[b][1]);
    ok(Math.abs(L - 2) < 1e-9, "E6 edgeLen 2 edge " + a + "-" + b);
  }
}

// [D] orientDiagram roots at the junction and reaches every node
{
  const q = AFFINE_ADE.E8;
  const o = orientDiagram(q);
  ok(o.root === q.junction, "E8 orient root = junction");
  ok(o.order.length === q.nodes, "E8 orient visits every node");
  let roots = 0;
  for (let i = 0; i < q.nodes; i++) if (o.parent[i] === -1) roots++;
  ok(roots === 1, "E8 orient has exactly one root");
}

// [E] isCyclic classification
for (const key of Object.keys(AFFINE_ADE)) ok(!isCyclic(AFFINE_ADE[key]), key + " not cyclic");
for (let n = 1; n <= 5; n++) ok(isCyclic(affineA(n)), "A" + n + " cyclic");

// [F] malformed edge length rejected
let threw = false;
try {
  diagramLayout(AFFINE_ADE.D4, { edgeLen: 0 });
} catch (e) {
  threw = true;
}
ok(threw, "diagramLayout rejects edgeLen 0");
threw = false;
try {
  diagramLayout(AFFINE_ADE.D4, { edgeLen: -1 });
} catch (e) {
  threw = true;
}
ok(threw, "diagramLayout rejects negative edgeLen");

ok(fails === 0, "no failures");
console.log("diagram-layout: " + (checks - fails) + "/" + checks + " checks passed");
if (fails > 0) process.exit(1);
