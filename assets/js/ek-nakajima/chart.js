// chart.js — dependency-free, Node-safe port of the candidate finite
// ``y = 0`` chart from sim/e6sim/charts.py (Milestone 1).
//
// The chart is the conversation's candidate family, with ``z = r exp(i theta)``:
//
//   a_1 = a_2 = a_3 = [[1], [0]]
//
//   A_1 = [[1, 0],        A_2 = [[0, 1],        A_3 = [[0, 1],
//          [0, 1],               [1, 0],               [0, z],
//          [0, 1]]               [0, 1]]               [1, 0]]
//
//   b_i = 0,   B_i = 0.
//
// All ``y`` matrices vanish, so the complex moment-map equations at tau = 0
// hold identically. This says nothing about stability or coverage; those live
// in sim/e6sim/stability.py and sim/e6sim/atlas.py.
//
// Complex numbers are 2-element arrays [re, im]; complex matrices are arrays
// of rows of such pairs (the core-math convention).

import { makeRep } from "./core-math.js";

// Convert a nested array whose leaves are numbers or [re, im] pairs into the
// core-math complex-matrix representation (leaves are always [re, im]).
const Z = (rows) => rows.map((r) => r.map((e) => (Array.isArray(e) ? [e[0], e[1]] : [e, 0])));

// ---------------------------------------------------------------------------
// chart matrices
// ---------------------------------------------------------------------------
// candidateY0Chart(z): z is a complex [re, im]. Returns a core-math rep
// {a, A, b, B} of complex matrices with a_i = [[1],[0]], the three A_i above
// with A_3 carrying z, and b = B = 0.
export function candidateY0Chart(z) {
  const zc = Array.isArray(z) ? [z[0], z[1]] : [z, 0];
  const a = [Z([[1], [0]]), Z([[1], [0]]), Z([[1], [0]])];
  const A = [
    Z([[1, 0], [0, 1], [0, 1]]),
    Z([[0, 1], [1, 0], [0, 1]]),
    Z([[0, 1], [0, zc], [1, 0]]),
  ];
  const b = [Z([[0, 0]]), Z([[0, 0]]), Z([[0, 0]])];
  const B = [
    Z([[0, 0, 0], [0, 0, 0]]),
    Z([[0, 0, 0], [0, 0, 0]]),
    Z([[0, 0, 0], [0, 0, 0]]),
  ];
  return makeRep(a, A, b, B);
}

// ---------------------------------------------------------------------------
// convenience: the chart parameter z = r exp(i theta)
// ---------------------------------------------------------------------------
// chartZ(r, theta) -> the complex [re, im] = r (cos theta, sin theta).
export function chartZ(r, theta) {
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

// chartAt(r, theta) -> the chart rep at z = r exp(i theta).
export function chartAt(r, theta) {
  return candidateY0Chart(chartZ(r, theta));
}
