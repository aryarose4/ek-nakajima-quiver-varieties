// A positional magnet, applied to the native thumb coordinate exactly once.
// The inner fifth is exact; a monotone cubic shoulder joins identity with
// matching first derivatives. Keeping the thumb raw lets keyboard steps escape.
export function magneticValue(raw, snaps) {
  for (const snap of snaps || []) {
    const delta = raw - snap.value, distance = Math.abs(delta);
    const outer = snap.tol, inner = outer / 5;
    if (distance >= outer) continue;
    if (distance <= inner) return snap.value;
    const s = (distance - inner) / (outer - inner);
    const mapped = s * s * ((2 * outer + inner) - (outer + inner) * s);
    return snap.value + Math.sign(delta) * mapped;
  }
  return raw;
}
