// The frozen solver fixture and the nearby regular chamber are deliberately
// separate. A zero complex moment map or a fixed grading does not imply stability.
export const E6_FIXTURE_LEVELS = [[3, 1], [3, 2], [3, 3]];
export const E6_REGULAR_LEVEL_NUMERATORS = [[30, 10], [30, 21], [30, 30]];
export const E6_REGULAR_LEVEL_DENOMINATOR = 10;
export const E6_REGULAR_LEVELS = E6_REGULAR_LEVEL_NUMERATORS.map(row => row.map(value => value / E6_REGULAR_LEVEL_DENOMINATOR));

// Positive real roots d bounded by the affine null root (3;2,2,2;1,1,1).
// q(d)=1 is the simply-laced real-root condition here. The 72 roots occur in
// complementary pairs d,delta-d, describing 36 finite E6 root hyperplanes.
export function e6BoundedRealRoots() {
  const roots = [];
  for (let center = 0; center <= 3; center++) {
    for (let bits = 0; bits < 8; bits++) for (let ternary = 0; ternary < 27; ternary++) {
      const outer = [bits & 1, (bits >> 1) & 1, (bits >> 2) & 1];
      const middle = [ternary % 3, Math.floor(ternary / 3) % 3, Math.floor(ternary / 9)];
      let q = center * center;
      for (let i = 0; i < 3; i++) q += outer[i] ** 2 + middle[i] ** 2 - middle[i] * (outer[i] + center);
      if (q === 1) roots.push({ center, middle, outer });
    }
  }
  return roots;
}

export function e6RootWallAudit(levels, tolerance = 1e-10) {
  if (!Array.isArray(levels) || levels.length !== 3 || levels.some(row =>
    !Array.isArray(row) || row.length !== 2 || !row.every(Number.isFinite)) ||
    !Number.isFinite(tolerance) || tolerance < 0) throw new RangeError('Expected three finite outer/middle levels and a nonnegative tolerance.');
  const total = levels.reduce((s, row) => s + row[0] + 2 * row[1], 0);
  const roots = e6BoundedRealRoots().map(root => {
    const weight = levels.reduce((s, row, i) => s + row[0] * root.outer[i] + row[1] * root.middle[i], -total * root.center / 3);
    return { center: root.center, middle: root.middle, outer: root.outer, weight };
  });
  const walls = roots.filter(root => Math.abs(root.weight) <= tolerance);
  return { roots, walls, regular: walls.length === 0, minAbsWeight: Math.min(...roots.map(root => Math.abs(root.weight))) };
}
