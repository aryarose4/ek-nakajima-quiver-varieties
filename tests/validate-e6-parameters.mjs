import assert from 'assert';
import { E6_DEFAULT_BETA, betaToLevels, e6BetaInChamber, e6BetaInterval, constrainE6Beta } from './e6-parameters.js';
import { E6_REGULAR_LEVELS, e6RootWallAudit } from './e6-levels.js';
assert.deepStrictEqual(betaToLevels(E6_DEFAULT_BETA), E6_REGULAR_LEVELS);
assert(e6BetaInChamber(E6_DEFAULT_BETA));
const signs = e6RootWallAudit(E6_REGULAR_LEVELS).roots.map(root => Math.sign(root.weight));
let beta = E6_DEFAULT_BETA.map(row => row.slice());
let checks = 0;
for (let iteration = 0; iteration < 500; iteration++) {
  for (let index = 0; index < 6; index++) {
    const iv = e6BetaInterval(beta, index);
    assert(iv.lo < beta[Math.floor(index / 2)][index % 2]);
    assert(iv.hi > beta[Math.floor(index / 2)][index % 2]);
    beta = constrainE6Beta(beta, index, iteration % 2 ? -1e20 : 1e20);
    assert(e6BetaInChamber(beta));
    e6RootWallAudit(betaToLevels(beta)).roots.forEach((root, i) => assert(signs[i] * root.weight > 0));
    checks++;
  }
}
assert.deepStrictEqual(constrainE6Beta(beta, 0, NaN), beta);
assert.throws(() => betaToLevels([[1,2]]), RangeError);
assert.throws(() => e6BetaInterval(beta, 6), RangeError);
console.log('E6 parameters: ' + checks + ' boundary drags preserve all root-wall signs.');

// DOM-level events use the same clamp for pointer, keyboard and programmatic input.
import { createParametersPanel } from './parameters-panel.js';
const inputs = [];
function element(tag) {
  const result = { children: [], style: {setProperty(key, value) {this[key] = value;}}, handlers: {},
    appendChild(child) { this.children.push(child); },
    addEventListener(name, fn) {this.handlers[name] = fn;} };
  if (tag === 'input') inputs.push(result);
  return result;
}
globalThis.document = {createElement: element};
let callbacks = 0;
const panel = createParametersPanel(element('div'), {onChange(next, levels) {
  callbacks++; assert(e6BetaInChamber(next)); assert.deepStrictEqual(betaToLevels(next), levels);
}});
assert.strictEqual(inputs.length, 6);
inputs.forEach((input, index) => {
  input.value = '3'; input.handlers.input();
  assert(e6BetaInChamber(panel.getBeta()));
  assert.strictEqual(Number(input.value), panel.getBeta()[Math.floor(index / 2)][index % 2]);
  input.value = '0'; input.handlers.change();
  assert(e6BetaInChamber(panel.getBeta()));
});
assert(callbacks > 0);
const before = panel.getBeta();
panel.setEnabled(false);
inputs[0].value = '3'; inputs[0].handlers.input();
assert.deepStrictEqual(panel.getBeta(), before);
assert(inputs.every(input => input.disabled));
const detached = panel.getBeta(); detached[0][0] = -100;
assert(e6BetaInChamber(panel.getBeta()));
console.log('E6 parameters panel: six controls, event clamp, levels callback and disabled guard pass.');
