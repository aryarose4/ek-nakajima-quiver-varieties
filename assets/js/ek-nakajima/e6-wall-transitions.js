// Pure root-arrangement planning; this does not transport an atlas or authorize a solve.
import { e6BoundedRealRoots } from './e6-levels.js';
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const key = a => a.join(',');
// Integer coefficients: pairing with beta is THREE times the root period.
const roots = e6BoundedRealRoots().map(r => r.outer.reduce((a, x, i) =>
  a.concat([3*x-r.center, 3*r.middle[i]-2*r.center]), []));
function flatten(beta) {
  if (!Array.isArray(beta) || beta.length !== 3 || beta.some(row =>
    !Array.isArray(row) || row.length !== 2 || !row.every(Number.isFinite)))
    throw new RangeError('Expected three finite beta pairs.');
  return [].concat(...beta);
}
const pairs = a => [a.slice(0,2), a.slice(2,4), a.slice(4,6)];
function solve(matrix, rhs) {
  const a = matrix.map((row, i) => row.concat(rhs[i]));
  for (let j = 0; j < 6; j++) {
    let pivot = j;
    for (let i = j+1; i < 6; i++) if (Math.abs(a[i][j]) > Math.abs(a[pivot][j])) pivot = i;
    if (Math.abs(a[pivot][j]) < 1e-12) throw new Error('Singular simple-root basis.');
    [a[j],a[pivot]] = [a[pivot],a[j]];
    const divisor = a[j][j];
    for (let k = j; k <= 6; k++) a[j][k] /= divisor;
    for (let i = 0; i < 6; i++) if (i !== j) {
      const factor = a[i][j];
      for (let k = j; k <= 6; k++) a[i][k] -= factor*a[j][k];
    }
  }
  return a.map(row => row[6]);
}
// Regular positive-beta inputs only. Boundary UI state must retain the chamber
// selected BEFORE arriving at a wall; a singular beta does not select a side.
export function e6WallTransitionOptions(beta) {
  const values = flatten(beta), scale = Math.max(...values.map(Math.abs));
  const tolerance = 1e-10 * scale;
  const weights = roots.map(r => dot(r, values));
  if (values.some(x => x <= tolerance) || weights.some(x => Math.abs(x) <= tolerance))
    throw new RangeError('Wall planning requires regular, strictly positive beta.');
  const positive = roots.filter((r,i) => weights[i] > 0), set = new Set(positive.map(key));
  const simple = positive.filter(a => !positive.some(b => set.has(key(a.map((x,i) => x-b[i])))));
  if (simple.length !== 6) throw new Error('Expected six E6 chamber facets.');
  return simple.map((root, index) => {
    const period = dot(root, values)/3;
    const nonzero = root.filter(x => x !== 0).length;
    const kind = nonzero === 1 ? 'coordinate-zero' : 'positive-beta';
    const id = 'e6:' + key(root.map(x => root.find(y => y !== 0) < 0 ? -x : x));
    const direction = solve(simple, simple.map((r,i) => i === index ? -dot(root,values) : 0));
    const wall = values.map((x,i) => x+direction[i]);
    const descriptor = { id, coefficients: root.map(x => x/3), period, kind,
      wallBeta: pairs(wall), crossing: null, canCross: false, canApproach: false };
    if (kind === 'coordinate-zero') return descriptor;
    // beta(t)=wall+t*direction; t=0 is the selected facet. Bound every
    // other root and every coordinate, then stop halfway to the first bound.
    let bound = 1;
    roots.forEach(r => {
      if (key(r) === key(root) || key(r) === key(root.map(x => -x))) return;
      const w = dot(r,wall), slope = dot(r,direction);
      if (w*slope < 0) bound = Math.min(bound,-w/slope);
    });
    wall.forEach((x,i) => { if (direction[i] < 0) bound = Math.min(bound,-x/direction[i]); });
    const target = wall.map((x,i) => x+0.5*bound*direction[i]);
    const flipped = roots.map((r,i) => dot(r,target)*weights[i] < 0 ? i : -1).filter(i => i >= 0);
    if (wall.some(x => x <= tolerance) || target.some(x => x <= tolerance) ||
        roots.some(r => Math.abs(dot(r,target)) <= tolerance) || flipped.length !== 2)
      throw new RangeError('Wall transition is too close to another boundary for reliable planning.');
    descriptor.crossing = { targetBeta: pairs(target), flippedRootIndices: flipped };
    return descriptor;
  });
}
