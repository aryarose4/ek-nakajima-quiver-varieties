import { E6_REGULAR_LEVELS, e6BoundedRealRoots } from './e6-levels.js';

export const E6_DEFAULT_BETA = E6_REGULAR_LEVELS.map(row => row.map(value => value / 2));
export const E6_BETA_DISPLAY_MAX = 3;
const MARGIN = 1e-7;
export const E6_DEFAULT_CHAMBER = 'default';
export const E6_ADJACENT_CHAMBER = 'side-zero-second';
export const E6_CROSSING_WORD = [4,1,0,3,0,1,4];
const crossed = [-2/3,-1/3,1/3,2/3,1/3,-1/3];
export function e6CrossedPeriod(beta) { return weight(crossed, flat(beta)); }
function chamberSigns(chamberId) {
  if (chamberId !== undefined && chamberId !== E6_DEFAULT_CHAMBER && chamberId !== E6_ADJACENT_CHAMBER) throw new RangeError('Unsupported E6 chamber.');
  return signs.map((sign,i) => chamberId === E6_ADJACENT_CHAMBER &&
    (coefficients[i].every((v,j) => Math.abs(v-crossed[j]) < 1e-12) ||
     coefficients[i].every((v,j) => Math.abs(v+crossed[j]) < 1e-12)) ? -sign : sign);
}
// A pinned beta retains its wall value; the representation is sampled at
// explicitly reported regular levels inside the selected chamber.
export function e6DisplayBeta(beta, chamberId = E6_DEFAULT_CHAMBER) {
  chamberSigns(chamberId);
  const copy = beta.map(row => row.slice());
  const sign = chamberId === E6_ADJACENT_CHAMBER ? -1 : 1;
  const period = e6CrossedPeriod(beta);
  if (sign*period >= MARGIN) return copy;
  const norm = crossed.reduce((sum,v) => sum+v*v,0);
  crossed.forEach((v,i) => { copy[Math.floor(i/2)][i%2] += v*(sign*MARGIN-period)/norm; });
  return copy;
}
export function e6AtCrossingWall(beta) {
  return Math.abs(e6CrossedPeriod(beta)) <= 2e-7 &&
    e6BetaInChamber(e6DisplayBeta(beta), E6_DEFAULT_CHAMBER) &&
    e6BetaInChamber(e6DisplayBeta(beta, E6_ADJACENT_CHAMBER), E6_ADJACENT_CHAMBER);
}
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
export function e6BetaInChamber(beta, chamberId) {
  const signs = chamberSigns(chamberId);
  const values = flat(beta);
  return values.every(value => value > 0) && coefficients.every((c, i) => signs[i] * weight(c, values) > 0);
}
// Physical walls are separate from the small interior margin used by drags.
export function e6BetaInterval(beta, index, chamberId) {
  const signs = chamberSigns(chamberId);
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
export function constrainE6Beta(beta, index, requested, chamberId) {
  const copy = beta.map(row => row.slice());
  const iv = e6BetaInterval(beta, index, chamberId);
  if (!Number.isFinite(requested) || iv.safeLo > iv.safeHi) return copy;
  const value = Math.max(iv.safeLo, Math.min(iv.safeHi, requested));
  copy[Math.floor(index / 2)][index % 2] = value;
  return e6BetaInChamber(copy, chamberId) ? copy : beta.map(row => row.slice());
}
