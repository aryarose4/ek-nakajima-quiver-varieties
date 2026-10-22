import assert from 'assert';
import { readFileSync } from 'fs';
const uri = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
let instance;
global.Worker = class {
  constructor() { instance = this; this.requests = []; }
  postMessage(request) { this.requests.push(request); }
  terminate() { this.terminated = true; }
  finish(value) { this.onmessage({ data: value }); }
};
global.Blob = class {};
global.URL.createObjectURL = () => 'blob:test';
global.URL.revokeObjectURL = () => {};
const source = readFileSync(new URL('../assets/js/ek-nakajima/balanced-client.js', import.meta.url), 'utf8')
  .replace("'./balanced-worker-source.js'", JSON.stringify(uri('export const BALANCED_WORKER_SOURCE="";')))
  .replace("'./balanced-model.js'", JSON.stringify(uri('export function solveBalancedAtlas(){throw Error("unexpected main-thread solve");}')));
import(uri(source)).then(({createBalancedClient}) => {
  const client = createBalancedClient(), displayed = [];
  client.request({ r: 0 }, result => displayed.push(result));
  client.request({ r: .2 }, result => displayed.push(result));
  client.request({ r: .8 }, result => displayed.push(result));
  assert.strictEqual(instance.requests.length, 1);
  instance.finish({ success: true, value: 'obsolete' });
  assert.deepStrictEqual(displayed, []);
  assert.deepStrictEqual(instance.requests, [{ r: 0 }, { r: .8 }]);
  instance.finish({ success: true, value: 'latest' });
  assert.deepStrictEqual(displayed, [{ success: true, value: 'latest' }]);
  client.request({ r: 1 }, result => displayed.push(result));
  client.invalidate();
  instance.finish({ success: true, value: 'wrong tab' });
  assert.strictEqual(displayed.length, 1);
  client.dispose();
  assert.ok(instance.terminated);
  const previews=[], final=[];
  const streaming=createBalancedClient({onProgress:(result,parameters)=>previews.push({result,parameters})});
  streaming.request({r:.1},r=>final.push(r));
  streaming.request({r:.2},r=>final.push(r));
  instance.finish({success:true,value:'intermediate'});
  assert.strictEqual(previews.length,1);
  assert.deepStrictEqual(previews[0].parameters,{r:.1});
  assert.strictEqual(final.length,0);
  streaming.request({r:.3},r=>final.push(r));
  instance.finish({success:false,value:'failed intermediate'});
  assert.strictEqual(previews.length,1);
  instance.finish({success:true,value:'current'});
  assert.strictEqual(final.length,1);
  streaming.request({r:.4},r=>final.push(r));
  streaming.invalidate();
  streaming.request({r:.5},r=>final.push(r));
  instance.finish({success:true,value:'previous epoch'});
  assert.strictEqual(previews.length,1);
  instance.finish({success:true,value:'new epoch'});
  assert.strictEqual(final.length,2);
  streaming.dispose();
  console.log('Balanced client: latest-request coalescing, stale-result rejection, tab cancellation, and cleanup passed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
