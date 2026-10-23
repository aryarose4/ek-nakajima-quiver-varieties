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
  // Registry supplies the actual inequalities and chamber identity. The compact
  // adapter exposes every supported wall with one persistent action.
  const widget = readFileSync(new URL('../assets/js/ek-nakajima/widget.js', import.meta.url), 'utf8');
  assert(widget.includes('getOptions: beta => e6ChamberWallOptions(beta, chamberId)'));
  assert(widget.includes('chamberId = wall.targetChamberId'));
  assert(widget.includes('word: e6ChamberWord(chamberId)'));
  assert(widget.includes('chamberEpoch++'));
  assert(widget.includes('balancedClient.invalidate(); balancedFrame = null; lastBalancedKey = null'));
  const compactHost = element('div');
  let chamber = 'default', selectedCalls = [], release;
  let reached = null;
  const descriptions = () => ['first','second','third'].map((id,index) => ({
    id, label: 'period ' + index + ' > 0', canCross:true, atWall:id===reached,
    targetChamberId: chamber === 'default' ? id : 'default'
  }));
  const compact = createParametersPanel(compactHost,{wallActions:{compact:true,
    getOptions:descriptions,
    onCross(wall) {
      selectedCalls.push(wall.id); chamber=wall.targetChamberId;
      return new Promise(resolve => {release=resolve;});
    }
  }});
  const descendants = node => [node].concat(...node.children.map(descendants));
  const selector = () => descendants(compactHost).find(node => node.tag==='select');
  assert.strictEqual(selector().children.length,3,'all supported inequalities accessible');
  assert.strictEqual(buttons(compactHost).length,1,'only one compact action');
  assert(buttons(compactHost)[0].disabled,'initially disabled off wall');
  selector().value='third'; selector().handlers.change();
  compact.refresh(); assert.strictEqual(selector().value,'third','manual selection survives refresh');
  reached='second'; compact.refresh();
  assert.strictEqual(selector().value,'second','newly reached wall auto-selected');
  const staleSelect=selector(), staleButton=buttons(compactHost)[0];
  const pinned=compact.getBeta(); staleButton.handlers.click();
  assert.deepStrictEqual(selectedCalls,['second']); assert.strictEqual(chamber,'second');
  assert(buttons(compactHost)[0].disabled,'persistent action disabled while pending');
  assert(selector().disabled,'selector disabled while pending');
  staleButton.handlers.click(); staleSelect.value='first'; staleSelect.handlers.change();
  assert.strictEqual(selector().value,'second','detached selector is inert');
  assert.strictEqual(selectedCalls.length,1,'pending double-click inert');
  release(); await Promise.resolve();
  assert.deepStrictEqual(compact.getBeta(),pinned,'crossings preserve requested beta');
  buttons(compactHost)[0].handlers.click();
  assert.strictEqual(chamber,'default','descriptor supports return crossing');
  release(); await Promise.resolve();
  reached='third'; compact.refresh(); buttons(compactHost)[0].handlers.click();
  assert.strictEqual(chamber,'third','another wall can be crossed');
  release(); await Promise.resolve();
  const missingCallback = element('div');
  createParametersPanel(missingCallback, {wallActions: {getOptions: () => [{...descriptor, alwaysVisible: true}]}});
  assert.strictEqual(buttons(missingCallback).length, 0, 'persistent control still requires callback');
  console.log('Parameters wall actions: capability gates, stale handlers, pending actions and beta isolation pass.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
