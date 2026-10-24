// Native range inputs use exact snap values. Keyboard steps bypass attraction so
// an arrow key can always leave a snapped value.
export function magneticValue(raw, snaps) {
  for (const snap of snaps || []) {
    if (Math.abs(raw - snap.value) <= snap.tol) return snap.value;
  }
  return raw;
}

export function snapSliderInput(input, snaps) {
  let keyboard = false;
  input.addEventListener('keydown', function (event) {
    keyboard = /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|PageUp|PageDown|Home|End)$/.test(event.key);
  });
  input.addEventListener('keyup', function () { keyboard = false; });
  input.addEventListener('blur', function () { keyboard = false; });
  input.addEventListener('pointerdown', function () { keyboard = false; });
  return function () {
    const raw = Number(input.value);
    const value = keyboard ? raw : magneticValue(raw, snaps);
    const changed = value !== raw;
    input.value = String(value);
    return changed;
  };
}
