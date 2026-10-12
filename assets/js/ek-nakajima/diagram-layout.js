// Affine ADE quiver-diagram layout for the E_k Nakajima widget (task 6,
// pure geometry layer). Node-safe: no THREE, no browser globals.
//
// The "quiver view" draws the FULL affine diagram `Q_hat` — every node of
// `quiver-data.js` including the affine (framing) node — as labelled
// vertices joined by edges. Node labels are the marks (the null root
// coefficients delta). The ALE core tree (the affine diagram minus the
// affine node) is a separate, already-settled picture and lives in
// `core-layout.js`.
//
// Layout:
//   D4/E6/E7/E8  the underlying graph is a tree; root it at the junction
//                (unique max-mark node) and use a radial tidy-tree
//                embedding — each child sits one EDGE_LEN from its parent,
//                its angular window split among siblings by subtree leaf
//                count, so arms stay straight and subtrees never cross.
//   A_n          the underlying graph is the n-cycle (A1 the double bond);
//                place the n+1 nodes on the unit circle at equal angles
//                (A1 gives the two opposed end points).
//
// `edges` are returned in `quiver-data.js` order (a repeated pair is a
// multi-edge); `affineEdges` are the edges incident to the affine node and
// `coreEdges` the rest (the finite ALE core tree).

import { buildAdj, pickRoot, orientTree, leafCounts, radialEmbed, TAU } from "./tree-embed.js";

// The A-type members are the only cyclic ones (no unique max-mark node,
// r_star = 1, actually n edges). A1's double bond is laid out as the
// opposed pair of a 2-gon.
export function isCyclic(q) {
  return q.junction === null && q.rStar === 1 && q.edges.length >= q.nodes && q.nodes >= 2;
}

// Root the affine tree at the junction (D/E) or the max-mark / highest-
// degree node (fallback). Returns parent/children/order.
export function orientDiagram(q) {
  const adj = buildAdj(q.nodes, q.edges);
  const root = q.junction != null ? q.junction : pickRoot(q.marks, adj);
  const o = orientTree(q.nodes, q.edges, root, true);
  return { adj, root, parent: o.parent, children: o.children, order: o.order };
}

// Positions of every node (including the affine node); 2D [x, y] centres.
// `opts.edgeLen` scales the tree edge length (default 1); the cyclic A
// layout always uses the unit circle.
export function diagramLayout(q, opts) {
  opts = opts || {};
  const edgeLen = opts.edgeLen === undefined ? 1 : opts.edgeLen;
  if (!(Number.isFinite(edgeLen) && edgeLen > 0)) {
    throw new Error("diagramLayout: edgeLen must be positive");
  }
  const cyclic = isCyclic(q);
  const positions = new Array(q.nodes).fill(null);
  let root = 0;
  let oriented = null;

  if (cyclic) {
    const n = q.nodes;
    for (let i = 0; i < n; i++) {
      const a = TAU * (i / n);
      positions[i] = [Math.cos(a), Math.sin(a)];
    }
  } else {
    oriented = orientDiagram(q);
    root = oriented.root;
    const counts = leafCounts(q.nodes, oriented.order, oriented.children);
    const emb = radialEmbed(root, oriented.children, counts, function () {
      return edgeLen;
    });
    for (let i = 0; i < q.nodes; i++) positions[i] = emb.positions[i];
  }

  const coreEdges = [];
  const affineEdges = [];
  for (const [a, b] of q.edges) {
    if (a === q.affineNode || b === q.affineNode) affineEdges.push([a, b]);
    else coreEdges.push([a, b]);
  }

  return {
    name: q.name,
    nodes: q.nodes,
    marks: q.marks,
    root,
    junction: q.junction,
    affineNode: q.affineNode,
    cyclic,
    edgeLen,
    positions,
    edges: q.edges,
    coreEdges,
    affineEdges,
  };
}

function dist(p, r) {
  return Math.hypot(p[0] - r[0], p[1] - r[1]);
}

function connected(n, edges) {
  if (n <= 1) return true;
  const adj = buildAdj(n, edges);
  const seen = new Array(n).fill(false);
  const stack = [0];
  seen[0] = true;
  let count = 1;
  while (stack.length) {
    const u = stack.pop();
    for (const v of adj[u]) {
      if (!seen[v]) {
        seen[v] = true;
        count++;
        stack.push(v);
      }
    }
  }
  return count === n;
}

// Geometry invariants: finite positions, in-range edges, connected graph,
// the finite core is a tree with coreSpheres - 1 edges, the affine node is
// the expected mark-1 noncompact end, and (tree layouts) no two
// non-adjacent nodes collide. Returns { ok, errors }.
export function validateDiagram(lay, tol) {
  const t = tol === undefined ? 1e-9 : tol;
  const errors = [];
  const n = lay.nodes;
  if (lay.positions.length !== n) errors.push("positions length mismatch");
  for (let i = 0; i < n; i++) {
    const p = lay.positions[i];
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      errors.push("position " + i + " not finite");
    }
  }
  for (const [a, b] of lay.edges) {
    if (!(a >= 0 && a < n) || !(b >= 0 && b < n)) errors.push("edge [" + a + "," + b + "] out of range");
    if (a === b) errors.push("self-loop at " + a);
    if (lay.positions[a] && lay.positions[b] && dist(lay.positions[a], lay.positions[b]) <= t) {
      errors.push("degenerate edge " + a + "-" + b);
    }
  }
  if (!connected(n, lay.edges)) errors.push("graph not connected");
  // the finite core (affine node deleted) is a tree on the remaining nodes
  const coreNodes = n - 1;
  if (lay.coreEdges.length !== coreNodes - 1) {
    errors.push("core is not a tree: " + lay.coreEdges.length + " edges on " + coreNodes + " nodes");
  } else {
    const relabel = new Array(n).fill(-1);
    let k = 0;
    for (let i = 0; i < n; i++) if (i !== lay.affineNode) relabel[i] = k++;
    const coreEdges = lay.coreEdges.map(function (e) {
      return [relabel[e[0]], relabel[e[1]]];
    });
    if (!connected(coreNodes, coreEdges)) errors.push("core not connected");
  }
  if (lay.affineNode < 0 || lay.affineNode >= n) errors.push("affine node out of range");
  else if (lay.marks[lay.affineNode] !== 1) errors.push("affine node mark != 1");
  if (lay.cyclic) {
    // every node on the unit circle at the equal-angle spacing
    const r = dist(lay.positions[0], [0, 0]);
    if (Math.abs(r - 1) > 1e-9) errors.push("cyclic radius != 1");
    for (let i = 0; i < n; i++) {
      if (Math.abs(dist(lay.positions[i], [0, 0]) - 1) > 1e-9) errors.push("node " + i + " off the circle");
    }
    const step = dist(lay.positions[0], lay.positions[1]);
    for (let i = 0; i < n; i++) {
      const got = dist(lay.positions[i], lay.positions[(i + 1) % n]);
      if (Math.abs(got - step) > t) errors.push("uneven cycle spacing at " + i);
    }
  } else {
    // tree: every edge has the common length; non-adjacent nodes stay apart
    const adjacent = new Set();
    for (const [a, b] of lay.edges) {
      adjacent.add(a + "," + b);
      adjacent.add(b + "," + a);
    }
    for (const [a, b] of lay.edges) {
      const got = dist(lay.positions[a], lay.positions[b]);
      if (Math.abs(got - lay.edgeLen) > t) errors.push("edge " + a + "-" + b + " length " + got + " != " + lay.edgeLen);
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (adjacent.has(i + "," + j)) continue;
        const gap = dist(lay.positions[i], lay.positions[j]);
        if (gap < 0.3) errors.push("nodes " + i + "," + j + " too close: " + gap);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
