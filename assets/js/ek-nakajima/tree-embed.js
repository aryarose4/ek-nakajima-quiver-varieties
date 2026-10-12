// Shared radial tree embedding for the E_k Nakajima geometry layers
// (core-layout.js and diagram-layout.js). Dependency-free, Node-safe.
//
// Two callers with one algorithm:
//   core-layout  — externally tangent sphere packing of the finite core
//                  tree (child distance = r_parent + r_child).
//   diagram-layout — fixed-edge-length layout of the full affine diagram
//                  (child distance = edgeLen).
// The caller supplies the child distance, so the traversal and angular
// split stay in one place.

export const TAU = 2 * Math.PI;

export function buildAdj(n, edges) {
  const adj = [];
  for (let i = 0; i < n; i++) adj.push([]);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

// Highest mark, then highest degree (a junction for D/E; an end/high-degree
// node for the all-mark-1 A paths).
export function pickRoot(marks, adj) {
  let best = 0;
  let bestKey = [-1, -1];
  for (let i = 0; i < marks.length; i++) {
    const key = [marks[i], adj[i].length];
    if (key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
      best = i;
      bestKey = key;
    }
  }
  return best;
}

// Root a tree at `root`. `reverse` walks each adjacency list backwards; the
// two callers historically did so (core forward, diagram reverse) and the
// resulting sibling order is preserved.
export function orientTree(n, edges, root, reverse) {
  const adj = buildAdj(n, edges);
  const parent = new Array(n).fill(-1);
  const children = [];
  for (let i = 0; i < n; i++) children.push([]);
  const order = [];
  const seen = new Array(n).fill(false);
  const stack = [root];
  seen[root] = true;
  while (stack.length) {
    const u = stack.pop();
    order.push(u);
    const ns = adj[u];
    if (reverse) {
      for (let k = ns.length - 1; k >= 0; k--) {
        const v = ns[k];
        if (seen[v]) continue;
        seen[v] = true;
        parent[v] = u;
        children[u].push(v);
        stack.push(v);
      }
    } else {
      for (const v of ns) {
        if (seen[v]) continue;
        seen[v] = true;
        parent[v] = u;
        children[u].push(v);
        stack.push(v);
      }
    }
  }
  return { adj, parent, children, order };
}

// Leaves per subtree, indexed by node (post-order accumulation over `order`).
export function leafCounts(n, order, children) {
  const counts = new Array(n).fill(0);
  for (let i = order.length - 1; i >= 0; i--) {
    const u = order[i];
    const kids = children[u];
    if (kids.length === 0) counts[u] = 1;
    else {
      let s = 0;
      for (const c of kids) s += counts[c];
      counts[u] = s;
    }
  }
  return counts;
}

// Radial layout: each child sits on its angular window's bisector at the
// distance returned by `distanceFn(u, c)`, so chains stay straight and
// sibling windows never cross. Returns centres and per-node angles.
export function radialEmbed(root, children, counts, distanceFn) {
  const n = children.length;
  const positions = new Array(n).fill(null);
  const angles = new Array(n).fill(0);

  function place(u, lo, hi) {
    const kids = children[u];
    if (kids.length === 0) return;
    let total = 0;
    for (const c of kids) total += counts[c];
    let at = lo;
    for (const c of kids) {
      const width = (hi - lo) * (counts[c] / total);
      const mid = at + width / 2;
      const d = distanceFn(u, c);
      angles[c] = mid;
      positions[c] = [positions[u][0] + d * Math.cos(mid), positions[u][1] + d * Math.sin(mid)];
      place(c, at, at + width);
      at += width;
    }
  }

  positions[root] = [0, 0];
  place(root, 0, TAU);
  return { positions, angles };
}
