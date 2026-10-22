import { E6_REGULAR_LEVELS, e6BoundedRealRoots } from './e6-levels.js';

export const E6_DEFAULT_BETA = E6_REGULAR_LEVELS.map(row => row.map(value => value / 2));
export const E6_BETA_DISPLAY_MAX = 3;
const MARGIN = 1e-7;
const coefficients = e6BoundedRealRoots().map(root => root.outer.reduce((out, value, i) =>
  out.concat([value - root.center / 3, root.middle[i] - 2 * root.center / 3]), []));
function flat(beta) {
  if (!Array.isArray(beta) || beta.length !== 3 || beta.some(row =>
    !Array.isArray(row) || row.length !== 2 || !row.every(Number.isFinite))) {
    throw new RangeError('Expected three finite beta pairs.');
  }
  return [].concat(...beta);
}
function weight(c, values) { return c.reduce((sum, value, i) => sum + value * values[i], 0); }
const signs = coefficients.map(c => Math.sign(weight(c, flat(E6_DEFAULT_BETA))));
export function betaToLevels(beta) { flat(beta); return beta.map(row => row.map(value => 2 * value)); }
export function e6BetaInChamber(beta) {
  const values = flat(beta);
  return values.every(value => value > 0) && coefficients.every((c, i) => signs[i] * weight(c, values) > 0);
}
// Physical walls are separate from the small interior margin used by drags.
export function e6BetaInterval(beta, index) {
  const values = flat(beta);
  if (!Number.isInteger(index) || index < 0 || index >= 6) throw new RangeError('Invalid beta index.');
  let lo = 0, hi = Infinity, safeLo = MARGIN, safeHi = Infinity;
  coefficients.forEach((c, i) => {
    const a = signs[i] * c[index];
    if (Math.abs(a) < 1e-14) return;
    let b = 0;
    c.forEach((value, j) => { if (j !== index) b += signs[i] * value * values[j]; });
    const wall = -b / a;
    const interior = (MARGIN - b) / a;
    if (a > 0) { lo = Math.max(lo, wall); safeLo = Math.max(safeLo, interior); }
    else { hi = Math.min(hi, wall); safeHi = Math.min(safeHi, interior); }
  });
  return { lo, hi, safeLo, safeHi };
}
export function constrainE6Beta(beta, index, requested) {
  const copy = beta.map(row => row.slice());
  const iv = e6BetaInterval(beta, index);
  if (!Number.isFinite(requested) || iv.safeLo > iv.safeHi) return copy;
  const value = Math.max(iv.safeLo, Math.min(iv.safeHi, requested));
  copy[Math.floor(index / 2)][index % 2] = value;
  return e6BetaInChamber(copy) ? copy : beta.map(row => row.slice());
}
