import assert from 'assert';
import { readFileSync } from 'fs';
import { createParametersPanel } from './parameters-panel.js';
import { E6_DEFAULT_BETA, e6ChamberWallOptions } from './e6-parameters.js';
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
  assert.strictEqual(plain.children[0].children.length, 3, 'default has slice row and no wall row');
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
  // Registry supplies the actual inequalities and chamber identity. Each
  // inequality has a permanent row and action.
  const widget = readFileSync(new URL('../assets/js/ek-nakajima/widget.js', import.meta.url), 'utf8');
  assert(widget.includes('getOptions: beta => e6ChamberWallOptions(beta, chamberId)'));
  assert(widget.includes('chamberId = wall.targetChamberId'));
  assert(widget.includes('word: e6ChamberWord(chamberId)'));
  assert(widget.includes('chamberEpoch++'));
  assert(widget.includes('rows: true'));
  assert(!widget.includes('compact: true'));
  const liveHost=element('div');
  const liveOptions=e6ChamberWallOptions(E6_DEFAULT_BETA,'default');
  createParametersPanel(liveHost,{wallActions:{rows:true,getOptions:()=>liveOptions,onCross(){}}});
  assert.strictEqual(buttons(liveHost).length,6,'all six chamber inequalities have buttons');
  assert(buttons(liveHost).every(button=>button.disabled),'interior buttons are disabled');
  assert(widget.includes('balancedClient.invalidate(); balancedFrame = null; lastBalancedKey = null'));
  const rowsHost = element('div');
  let chamber = 'default', selectedCalls = [], release;
  let reached = null;
  const descriptions = () => ['first','second','third','coordinate-zero'].map((id,index) => ({
    id, label: '\u03b2\u2081\u207d\u00b9\u207e > ' + index, canCross:id!=='coordinate-zero', atWall:id===reached,
    targetChamberId: chamber === 'default' ? id : 'default'
  }));
  const rows = createParametersPanel(rowsHost,{wallActions:{rows:true,
    getOptions:descriptions,
    onCross(wall) {
      selectedCalls.push(wall.id); chamber=wall.targetChamberId;
      return new Promise(resolve => {release=resolve;});
    }
  }});
  const descendants = node => [node].concat(...node.children.map(descendants));
  assert(!descendants(rowsHost).some(node => node.tag==='select'),'no wall selector');
  assert.strictEqual(buttons(rowsHost).length,4,'each inequality has a persistent action');
  assert(buttons(rowsHost).every(button=>button.disabled),'initially disabled off wall');
  const wallRows=()=>descendants(rowsHost).filter(node=>node.className==='ek-wall-action-row');
  assert.strictEqual(wallRows().length,4,'each inequality has its own row');
  wallRows().forEach((row,index)=>{
    assert.strictEqual(row.children[0].textContent,descriptions()[index].label,'glyph inequality shown');
    assert(!/border|padding|background/.test(row.style.cssText),'no outer button box');
    assert.strictEqual(row.children[1].textContent,'Cross Wall');
  });
  reached='second'; rows.refresh();
  assert.deepStrictEqual(buttons(rowsHost).map(button=>button.disabled),[true,false,true,true]);
  const staleButton=buttons(rowsHost)[1], pinned=rows.getBeta(); staleButton.handlers.click();
  assert.deepStrictEqual(selectedCalls,['second']); assert.strictEqual(chamber,'second');
  assert(buttons(rowsHost).every(button=>button.disabled),'all actions disabled while pending');
  staleButton.handlers.click(); buttons(rowsHost)[1].handlers.click();
  assert.strictEqual(selectedCalls.length,1,'pending and detached double-click inert');
  release(); await Promise.resolve();
  assert.deepStrictEqual(rows.getBeta(),pinned,'crossings preserve requested beta');
  buttons(rowsHost)[1].handlers.click();
  assert.strictEqual(chamber,'default','descriptor supports return crossing');
  release(); await Promise.resolve();
  reached='third'; rows.refresh(); buttons(rowsHost)[2].handlers.click();
  assert.strictEqual(chamber,'third','another row crosses its own wall');
  release(); await Promise.resolve();
  reached='coordinate-zero'; rows.refresh(); buttons(rowsHost)[3].handlers.click();
  assert.strictEqual(selectedCalls.length,3,'coordinate-zero stays locked even at its wall');
  const missingCallback = element('div');
  createParametersPanel(missingCallback, {wallActions: {getOptions: () => [{...descriptor, alwaysVisible: true}]}});
  assert.strictEqual(buttons(missingCallback).length, 0, 'persistent control still requires callback');
  console.log('Parameters wall actions: capability gates, stale handlers, pending actions and beta isolation pass.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
