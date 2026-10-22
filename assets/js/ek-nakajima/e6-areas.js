// Symplectic periods of the six compact E6 curves in the regular beta chamber.
// beta[i] = [beta_i^(1), beta_i^(2)]. Period = integral(omega)/(2*pi).
// Finite-tree IDs: central 2; r=0 arm 1,0; r=1 arm 3,4; r=1/2 arm 5.
// Round spheres represent surface area, so 4*pi*radius^2 = integral(omega).
export function e6CoreAreas(beta) {
  if (!Array.isArray(beta) || beta.length !== 3 || beta.some(row =>
    !Array.isArray(row) || row.length !== 2 || !row.every(Number.isFinite))) {
    throw new RangeError('Expected three finite beta pairs.');
  }
  const a = beta.map(row => row[0]), g = beta.map(row => row[1]);
  const sumA = a.reduce((s, v) => s + v, 0), sumG = g.reduce((s, v) => s + v, 0);
  const T = sumA + 2 * sumG;
  const periods = [
    (-2*a[0]+a[1]+a[2]-g[0]+2*g[1]-g[2])/3,
    T/3-a[1]-g[0]-g[1],
    g[0],
    T/3-a[2]-g[0]-g[2],
    (-2*a[0]+a[1]+a[2]-g[0]-g[1]+2*g[2])/3,
    (sumA-sumG)/3,
  ];
  if (periods.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('E6 compact curve periods must be positive in the regular chamber.');
  }
  return { periods, areas: periods.map(value => 2*Math.PI*value), radii: periods.map(value => Math.sqrt(value/2)) };
}
