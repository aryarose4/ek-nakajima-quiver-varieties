// An actual E6 gauge-renormalized limit at z=1 (compact r=1/2, theta=0).
// L=(1,1,1), p_i=e_i-L/3. In middle bases (e1,e1+e2),
// g=P_L/lambda+(I-P_L), h=diag(1,1/lambda), q=1 give
// lim lambda->infinity of z=1+v/lambda^2, w=lambda:
// a=e1, A=[p_i,L], b=(0,v), B=[v L*/3; ell_i].
// Multiplying every vertex gauge by lambda^(1/3) makes det(g)=1
// without changing its action. Complex moment maps vanish identically.
// v=0 is the fixed point; v is a new complex one-dimensional stratum
// coordinate. This is one chart, not a global atlas or stability theorem.
import { makeRep, cMul } from "./core-math.js";

export function concurrencyLimitChart(phi = 0, coordinate = [0, 0]) {
  const v = Array.isArray(coordinate) ? coordinate : [coordinate, 0];
  if (!Number.isFinite(phi) || v.length !== 2 || !v.every(Number.isFinite)) {
    throw new RangeError("Expected finite phase and complex stratum coordinate.");
  }
  const phase = [Math.cos(phi), Math.sin(phi)];
  const value = cMul(v, phase);
  const ell = [[0, -1, 1], [1, 0, -1], [-1, 1, 0]];
  const a = ell.map(() => [[[1, 0]], [[0, 0]]]);
  const A = ell.map((_, i) => ell.map((__, j) => [[(i === j ? 1 : 0) - 1 / 3, 0], [1, 0]]));
  const b = ell.map(() => [[[0, 0], value.slice()]]);
  const B = ell.map((row) => [row.map(() => [value[0] / 3, value[1] / 3]), row.map((x) => [x * phase[0], x * phase[1]])]);
  return makeRep(a, A, b, B);
}
