import assert from 'assert';
import { readFileSync } from 'fs';
import { createParametersPanel } from './parameters-panel.js';
function element(tag) {
  return {tag, children: [], handlers: {}, style: {setProperty() {}},
    appendChild(child) {this.children.push(child);},
    set textContent(value) {this.text = value; this.children = [];},
    get textContent() {return this.text;},
    addEventListener(name, callback) {this.handlers[name] = callback;}};
}
globalThis.document = {createElement: element};
function buttons(node) {
  return (node.tag === 'button' ? [node] : []).concat(...node.children.map(buttons));
}
async function main() {
  const plain = element('div'); createParametersPanel(plain);
  assert.strictEqual(buttons(plain).length, 0);
  assert.strictEqual(plain.children[0].children.length, 2, 'default has no wall row');
  const host = element('div');
  let descriptor = {id: 'facet', label: 'period > 0', canCross: true, atWall: false};
  let calls = 0, finish;
  const panel = createParametersPanel(host, {wallActions: {
    getOptions(beta) {beta[0][0] = -1; return [descriptor];},
    onCross(wall, beta) {calls++; beta[0][0] = -1; return new Promise(resolve => {finish = resolve;});}
  }});
  assert.strictEqual(buttons(host).length, 0, 'cross unavailable off wall');
  descriptor = {...descriptor, atWall: true}; panel.refreshWallActions();
  const stale = buttons(host)[0];
  descriptor = {...descriptor, canCross: false}; stale.handlers.click();
  assert.strictEqual(calls, 0, 'capability rechecked on click');
  assert.strictEqual(buttons(host).length, 0);
  descriptor = {...descriptor, canCross: true}; panel.refreshWallActions();
  stale.handlers.click(); assert.strictEqual(calls, 0, 'detached handler inert');
  const active = buttons(host)[0]; active.handlers.click(); active.handlers.click();
  assert.strictEqual(calls, 1, 'only one action in flight');
  assert.strictEqual(buttons(host).length, 0);
  assert(panel.getBeta()[0][0] > 0, 'adapter receives defensive beta copies');
  finish(); await Promise.resolve();
  assert.strictEqual(buttons(host).length, 1);
  panel.setEnabled(false); assert.strictEqual(buttons(host).length, 0);
  panel.setEnabled(true); assert.strictEqual(buttons(host).length, 1);
  const unsupported = element('div');
  createParametersPanel(unsupported, {wallActions: {getOptions: () => [descriptor]}});
  assert.strictEqual(buttons(unsupported).length, 0, 'callback required');
  let approached = 0;
  const approachHost = element('div');
  createParametersPanel(approachHost, {wallActions: {
    getOptions: () => [{id: 'safe', canApproach: true}], onApproach() {approached++;}
  }});
  assert.strictEqual(buttons(approachHost)[0].textContent, 'Approach Wall');
  buttons(approachHost)[0].handlers.click(); assert.strictEqual(approached, 1);
  // Exercise the production host descriptor, including its chamber inequality.
  const widget = readFileSync(new URL('../assets/js/ek-nakajima/widget.js', import.meta.url), 'utf8');
  const descriptorSource = widget.match(/getOptions: beta => (\[\{[\s\S]*?\}\]),/)[1];
  const describe = new Function('beta', 'chamberId', 'e6AtCrossingWall', 'return ' + descriptorSource);
  let chamber = 'default', atWall = false, persistentCalls = 0;
  const persistentHost = element('div');
  const persistentPanel = createParametersPanel(persistentHost, {wallActions: {
    getOptions: beta => describe(beta, chamber, () => atWall),
    onCross() {persistentCalls++; chamber = chamber === 'default' ? 'side-zero-second' : 'default';}
  }});
  const wallBox = () => persistentHost.children[0].children[2].children[0];
  const originalLabel = wallBox().children[0].textContent;
  assert(originalLabel.includes('<') && originalLabel.includes('\u03b2\u2081\u207d\u00b9\u207e'));
  assert.strictEqual(buttons(persistentHost).length, 1, 'supported control remains visible off wall');
  assert.strictEqual(buttons(persistentHost)[0].disabled, true);
  buttons(persistentHost)[0].handlers.click();
  assert.strictEqual(persistentCalls, 0, 'visible disabled control cannot dispatch');
  atWall = true; persistentPanel.refreshWallActions();
  assert.strictEqual(buttons(persistentHost)[0].disabled, false);
  buttons(persistentHost)[0].handlers.click();
  assert.strictEqual(persistentCalls, 1);
  assert.strictEqual(wallBox().children[0].textContent, originalLabel.replace('<', '>'), 'inequality reverses after crossing');
  atWall = false; persistentPanel.refreshWallActions();
  assert.strictEqual(buttons(persistentHost)[0].disabled, true);
  assert.strictEqual(buttons(persistentHost).length, 1, 'row remains after leaving wall');
  const missingCallback = element('div');
  createParametersPanel(missingCallback, {wallActions: {getOptions: () => [{...descriptor, alwaysVisible: true}]}});
  assert.strictEqual(buttons(missingCallback).length, 0, 'persistent control still requires callback');
  console.log('Parameters wall actions: capability gates, stale handlers, pending actions and beta isolation pass.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
