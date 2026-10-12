// E_k Nakajima quiver data: the affine ADE quivers whose dimension vector
// v = the marks = the null root delta give 4-dimensional Nakajima quiver
// varieties, i.e. the ALE gravitational instantons of the corresponding
// type. Node labels follow the reference figure
// `assets/pdf/Star-Shaped_Quiver_Slides.pdf` page 29.
//
// Conventions:
//   marks[i]   = delta_i, the coefficient of the null root (affine Cartan
//                condition 2*delta_i = sum_{j~i} delta_j, multiplicities
//                counted). Mandatory and machine-checked in
//                `validateQuiver`.
//   edges      = undirected edges [i, j]; a repeated pair is a multi-edge.
//   junction   = the (unique) node of maximal mark; its mark is r_star,
//                the "central gauge rank" of the star-shaped presentation.
//   affineNode = the extra (mark-1) node of the affine diagram; deleting
//                it recovers the finite Dynkin diagram whose nodes are
//                the exceptional P^1's of the ALE core. The choice is
//                only canonical up to Dynkin-diagram automorphisms (for
//                D4 any leaf; recorded as the last leaf).
//   framing    = every mark-1 node is an admissible 1-dimensional framing
//                node (dim_H M = delta_j = 1 there).
//   coreSpheres = number of exceptional P^1's in the ALE core = nodes - 1
//                (all nodes but one affine; the affine node is the
//                noncompact end).

export const AFFINE_ADE = {
  D4: {
    name: "D4",
    nodes: 5,
    edges: [[0, 1], [0, 2], [0, 3], [0, 4]],
    marks: [2, 1, 1, 1, 1],
    junction: 0,
    rStar: 2,
    affineNode: 4,
    coreSpheres: 4,
  },
  E6: {
    name: "E6",
    nodes: 7,
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]],
    marks: [1, 2, 3, 2, 1, 2, 1],
    junction: 2,
    rStar: 3,
    affineNode: 6,
    coreSpheres: 6,
  },
  E7: {
    name: "E7",
    nodes: 8,
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [3, 7]],
    marks: [1, 2, 3, 4, 3, 2, 1, 2],
    junction: 3,
    rStar: 4,
    affineNode: 0,
    coreSpheres: 7,
  },
  E8: {
    name: "E8",
    nodes: 9,
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [5, 8]],
    marks: [1, 2, 3, 4, 5, 6, 4, 2, 3],
    junction: 5,
    rStar: 6,
    affineNode: 0,
    coreSpheres: 8,
  },
};

// Affine A type: A-hat_n has n+1 nodes, all marks 1. n >= 2 is a cycle;
// n = 1 is the two-node double bond.
export function affineA(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("affineA: n must be a positive integer");
  }
  const edges = [];
  if (n === 1) {
    edges.push([0, 1], [0, 1]);
  } else {
    for (let i = 0; i < n; i++) edges.push([i, i + 1]);
    edges.push([n, 0]);
  }
  return {
    name: "A" + n,
    nodes: n + 1,
    edges,
    marks: new Array(n + 1).fill(1),
    junction: null,
    rStar: 1,
    affineNode: 0,
    coreSpheres: n,
  };
}

// Finite Dynkin tree of the ALE core: drop the affine node and relabel
// the remaining nodes in order. Its nodes are the exceptional P^1's.
export function finiteTree(q) {
  const a = q.affineNode;
  const keep = [];
  for (let i = 0; i < q.nodes; i++) if (i !== a) keep.push(i);
  const relabel = {};
  keep.forEach((old, idx) => {
    relabel[old] = idx;
  });
  const edges = [];
  for (const [u, v] of q.edges) {
    if (u === a || v === a) continue;
    edges.push([relabel[u], relabel[v]]);
  }
  return {
    name: q.name + "-core",
    nodes: keep.length,
    edges,
    marks: keep.map((old) => q.marks[old]),
    coreSpheres: keep.length,
  };
}

export function neighborMarks(q, i) {
  let s = 0;
  for (const [a, b] of q.edges) {
    if (a === i) s += q.marks[b];
    if (b === i) s += q.marks[a];
  }
  return s;
}

// Affine Cartan / null-root residual: 2*delta_i - sum_{j~i} delta_j, the
// i-th component of the affine Cartan matrix acting on delta. All zero
// iff delta spans the kernel, i.e. v = delta is the null root.
export function nullRootResidual(q) {
  return q.marks.map((m, i) => 2 * m - neighborMarks(q, i));
}

export function maxMark(q) {
  return Math.max.apply(null, q.marks);
}

export function junctionNodes(q) {
  const r = maxMark(q);
  const out = [];
  for (let i = 0; i < q.marks.length; i++) if (q.marks[i] === r) out.push(i);
  return out;
}

function isConnected(n, edges) {
  if (n <= 1) return true;
  const adj = [];
  for (let i = 0; i < n; i++) adj.push([]);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
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

export function framingNodes(q) {
  const out = [];
  for (let i = 0; i < q.marks.length; i++) if (q.marks[i] === 1) out.push(i);
  return out;
}

// dim_H M(v = marks, w) = sum_i delta_i w_i. The 4D framing w = e_j at a
// mark-1 node gives 1.
export function dimH(q, w) {
  let s = 0;
  for (let i = 0; i < q.marks.length; i++) s += q.marks[i] * (w[i] || 0);
  return s;
}

// Machine checks for a single quiver. Returns { ok, errors }.
export function validateQuiver(q) {
  const errors = [];
  if (q.nodes !== q.marks.length) {
    errors.push("nodes != marks.length");
  }
  for (let i = 0; i < q.marks.length; i++) {
    const m = q.marks[i];
    if (!Number.isInteger(m) || m < 1) errors.push("mark " + i + " not a positive integer");
  }
  for (const [a, b] of q.edges) {
    if (!(a >= 0 && a < q.nodes) || !(b >= 0 && b < q.nodes)) {
      errors.push("edge [" + a + "," + b + "] out of range");
    }
    if (a === b) errors.push("self-loop at " + a);
  }
  const res = nullRootResidual(q);
  for (let i = 0; i < res.length; i++) {
    if (res[i] !== 0) errors.push("null-root residual at " + i + ": " + res[i]);
  }
  const js = junctionNodes(q);
  if (js.length === 1) {
    if (js[0] !== q.junction) {
      errors.push("junction " + q.junction + " is not the unique max-mark node " + JSON.stringify(js));
    }
  } else if (q.junction !== null) {
    errors.push("junction must be null when the max mark is not unique, got " + q.junction);
  }
  if (q.rStar !== maxMark(q)) {
    errors.push("rStar " + q.rStar + " != max mark " + maxMark(q));
  }
  if (q.coreSpheres !== q.nodes - 1) {
    errors.push("coreSpheres " + q.coreSpheres + " != nodes-1 " + (q.nodes - 1));
  }
  if (!(Number.isInteger(q.affineNode) && q.affineNode >= 0 && q.affineNode < q.nodes)) {
    errors.push("affineNode out of range");
  } else if (q.marks[q.affineNode] !== 1) {
    errors.push("affineNode " + q.affineNode + " mark != 1");
  } else {
    const ft = finiteTree(q);
    if (ft.nodes !== q.nodes - 1) errors.push("finite tree node count");
    if (ft.edges.length !== ft.nodes - 1) errors.push("finite tree not a tree (edge count)");
    if (!isConnected(ft.nodes, ft.edges)) errors.push("finite tree not connected");
  }
  // every framing candidate must give dim_H M = 1
  for (const j of framingNodes(q)) {
    const w = new Array(q.nodes).fill(0);
    w[j] = 1;
    if (dimH(q, w) !== 1) errors.push("framing at " + j + " gives dim_H " + dimH(q, w));
  }
  return { ok: errors.length === 0, errors };
}
