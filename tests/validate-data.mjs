// Node validation for the E_k Nakajima quiver data table (task 3).
// Mirrors the hyperpolygon harness style: no dependencies, .mjs, exit 1
// on failure. `run-validation.sh` copies the live module in as
// quiver-data.mjs; running this file directly works if that copy exists.
//
// Checks:
//   [A] every named ADE quiver validates (null-root, marks, junction,
//       core count, framing dim_H = 1)
//   [B] marks equal the known reference values from slide 29
//   [C] affine A_n validates for n = 1..12 (cycle / double bond)
//   [D] r_star = max mark equals junction mark, and matches the known
//       values D4 2, E6 3, E7 4, E8 6
//   [E] null-root sum identity: sum_edges d_i d_j == sum_i d_i^2

import {
  AFFINE_ADE,
  affineA,
  validateQuiver,
  nullRootResidual,
  maxMark,
  framingNodes,
  finiteTree,
  dimH,
} from "./quiver-data.js";

let checks = 0;
let fails = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) {
    fails++;
    console.error("FAIL: " + msg);
  }
}

const REF = {
  D4: { marks: [2, 1, 1, 1, 1], rStar: 2, core: 4 },
  E6: { marks: [1, 2, 3, 2, 1, 2, 1], rStar: 3, core: 6 },
  E7: { marks: [1, 2, 3, 4, 3, 2, 1, 2], rStar: 4, core: 7 },
  E8: { marks: [1, 2, 3, 4, 5, 6, 4, 2, 3], rStar: 6, core: 8 },
};

for (const key of Object.keys(REF)) {
  const q = AFFINE_ADE[key];
  ok(!!q, key + " present");
  if (!q) continue;
  const v = validateQuiver(q);
  ok(v.ok, key + " validateQuiver: " + v.errors.join("; "));
  ok(
    JSON.stringify(q.marks) === JSON.stringify(REF[key].marks),
    key + " marks match reference " + JSON.stringify(REF[key].marks)
  );
  ok(maxMark(q) === REF[key].rStar, key + " r_star = " + REF[key].rStar);
  ok(q.marks[q.junction] === REF[key].rStar, key + " junction mark = r_star");
  ok(q.coreSpheres === REF[key].core, key + " core = " + REF[key].core);

  // [E] null-root sum identity
  let lhs = 0;
  for (const [a, b] of q.edges) lhs += q.marks[a] * q.marks[b];
  let rhs = 0;
  for (const m of q.marks) rhs += m * m;
  ok(lhs === rhs, key + " sum_edges d_i d_j == sum d_i^2 (" + lhs + " vs " + rhs + ")");

  // framing candidates: dim_H = 1 each
  const fr = framingNodes(q);
  ok(fr.length >= 1, key + " has a framing candidate");
  for (const j of fr) {
    const w = new Array(q.nodes).fill(0);
    w[j] = 1;
    ok(dimH(q, w) === 1, key + " framing " + j + " gives dim_H 1");
  }

  const ft = finiteTree(q);
  ok(ft.nodes === REF[key].core, key + " finite tree has core-many nodes");
  ok(ft.edges.length === ft.nodes - 1, key + " finite tree edge count");
  const deg = new Array(ft.nodes).fill(0);
  for (const [a, b] of ft.edges) {
    deg[a]++;
    deg[b]++;
  }
  ok(
    deg.filter((d) => d >= 3).length === (key === "D4" ? 1 : 1),
    key + " finite tree has one branch node"
  );
  ok(Math.max.apply(null, deg) === (key === "D4" ? 3 : 3), key + " finite tree branch degree 3");
}

for (let n = 1; n <= 12; n++) {
  const q = affineA(n);
  const v = validateQuiver(q);
  ok(v.ok, "A" + n + " validateQuiver: " + v.errors.join("; "));
  ok(nullRootResidual(q).every((r) => r === 0), "A" + n + " null root");
  ok(q.nodes === n + 1, "A" + n + " has n+1 nodes");
  ok(q.coreSpheres === n, "A" + n + " core = n");
  ok(q.rStar === 1, "A" + n + " r_star = 1 (abelian gauging)");
  const w = new Array(q.nodes).fill(0);
  w[0] = 1;
  ok(dimH(q, w) === 1, "A" + n + " framed dim_H = 1");
}

ok(fails === 0, "no failures");

console.log("quiver-data: " + (checks - fails) + "/" + checks + " checks passed");
if (fails > 0) {
  process.exit(1);
}
