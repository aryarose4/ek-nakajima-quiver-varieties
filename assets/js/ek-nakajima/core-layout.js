// Core-tree geometry for the E_k Nakajima side view (task 4, pure layer).
//
// The ALE core is a tree of exceptional P^1's (one per finite Dynkin
// node); adjacent P^1's meet in a point. The side view draws each node as
// a 2-sphere and each edge as an attachment (tangency) point, so this
// module produces a non-overlapping externally-tangent sphere packing of
// the core tree in the plane. It is the direct generalization of the
// hyperpolygon's "central + three exterior spheres" portrait (which is
// exactly the D4 core, `finiteTree(AFFINE_ADE.D4)`); see
// `assets/js/hyperpolygon/sideview.js`.
//
// Dependency-free ES module. Node-safe: no THREE, no browser globals.
// Nothing here depends on the still-open single-element view (task 1); it
// is the space-view geometry the display will consume later.
//
// Layout: radial tidy-tree embedding, rooted at the junction (max-mark
// node; an end node for the A paths). Each node's angular window is split
// among its children in proportion to their leaf counts, and a child is
// placed along its window's bisector at distance r_parent + r_child, so
// every core edge is a tangency. A chain node (one child) inherits its
// parent's window, so arms stay straight.

import { finiteTree } from "./quiver-data.js";
import { buildAdj, pickRoot, orientTree, leafCounts, radialEmbed } from "./tree-embed.js";

// Root the core tree: the unique max-mark node when there is one
// (junction), else the highest-degree node (A paths: an end).
export function orientCore(q) {
  const tree = finiteTree(q);
  const adj = buildAdj(tree.nodes, tree.edges);
  const root = pickRoot(tree.marks, adj);
  const o = orientTree(tree.nodes, tree.edges, root, false);
  return { tree, root, parent: o.parent, children: o.children, order: o.order };
}

export function defaultRadii(tree, r0) {
  const r = r0 === undefined ? 1 : r0;
  return new Array(tree.nodes).fill(r);
}

// Externally-tangent radial packing of the core tree. `radii` defaults to
// a uniform packing at r0 (default 1). Returns centers (2D), the per-edge
// attachment (tangency) point, and per-node outward directions to its
// neighbors. Throws on a bad radii vector.
export function layoutCore(q, radii) {
  const oriented = orientCore(q);
  const tree = oriented.tree;
  const r = radii ? radii.slice() : defaultRadii(tree);
  if (r.length !== tree.nodes) throw new Error("layoutCore: radii length mismatch");
  for (let i = 0; i < r.length; i++) {
    if (!Number.isFinite(r[i]) || r[i] <= 0) throw new Error("layoutCore: radius " + i + " not positive");
  }

  const counts = leafCounts(tree.nodes, oriented.order, oriented.children);
  const emb = radialEmbed(oriented.root, oriented.children, counts, function (u, c) {
    return r[u] + r[c];
  });
  const centers = emb.positions;
  const angles = emb.angles;

  const attachments = tree.edges.map(([a, b]) => {
    const ca = centers[a];
    const cb = centers[b];
    let dx = cb[0] - ca[0];
    let dy = cb[1] - ca[1];
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!(d > 0)) throw new Error("layoutCore: coincident centers " + a + "," + b);
    dx /= d;
    dy /= d;
    return {
      edge: [a, b],
      point: [ca[0] + r[a] * dx, ca[1] + r[a] * dy],
      dirFromA: [dx, dy],
      dirFromB: [-dx, -dy],
    };
  });

  const nodeNeighbors = [];
  for (let i = 0; i < tree.nodes; i++) nodeNeighbors.push([]);
  attachments.forEach((att, e) => {
    const [a, b] = att.edge;
    nodeNeighbors[a].push({ edge: e, other: b, point: att.point, dir: att.dirFromA });
    nodeNeighbors[b].push({ edge: e, other: a, point: att.point, dir: att.dirFromB });
  });

  return {
    name: tree.name,
    tree,
    root: oriented.root,
    radii: r,
    centers,
    angles,
    edges: tree.edges,
    attachments,
    nodeNeighbors,
    parent: oriented.parent,
    children: oriented.children,
  };
}

// Geometry invariants of a packing: every edge tangent, no pair of spheres
// overlapping. Returns { ok, errors }. `tol` is an absolute distance slack.
export function validateLayout(lay, tol) {
  const t = tol === undefined ? 1e-9 : tol;
  const errors = [];
  const n = lay.centers.length;
  const dist = (i, j) => {
    const dx = lay.centers[i][0] - lay.centers[j][0];
    const dy = lay.centers[i][1] - lay.centers[j][1];
    return Math.sqrt(dx * dx + dy * dy);
  };
  const adjacent = new Set();
  for (const [a, b] of lay.edges) adjacent.add(a + "," + b);
  for (let i = 0; i < n; i++) {
    if (!lay.centers[i]) errors.push("missing center " + i);
  }
  for (const [a, b] of lay.edges) {
    const want = lay.radii[a] + lay.radii[b];
    const got = dist(a, b);
    if (Math.abs(got - want) > t) errors.push("edge " + a + "-" + b + " not tangent: " + got + " vs " + want);
    const p = lay.attachments.find((x) => x.edge[0] === a && x.edge[1] === b) || lay.attachments.find((x) => x.edge[0] === b && x.edge[1] === a);
    if (!p) {
      errors.push("no attachment for edge " + a + "-" + b);
      continue;
    }
    const da = Math.hypot(p.point[0] - lay.centers[a][0], p.point[1] - lay.centers[a][1]);
    const db = Math.hypot(p.point[0] - lay.centers[b][0], p.point[1] - lay.centers[b][1]);
    if (Math.abs(da - lay.radii[a]) > t) errors.push("attachment off sphere " + a);
    if (Math.abs(db - lay.radii[b]) > t) errors.push("attachment off sphere " + b);
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (adjacent.has(i + "," + j) || adjacent.has(j + "," + i)) continue;
      const overlap = lay.radii[i] + lay.radii[j] - dist(i, j);
      if (overlap > t) errors.push("spheres " + i + "," + j + " overlap by " + overlap);
    }
  }
  return { ok: errors.length === 0, errors };
}
