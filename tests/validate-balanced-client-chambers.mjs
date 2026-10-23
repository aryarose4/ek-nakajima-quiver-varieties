import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
// Source imports work on Node 12 without generated copies or dependencies.
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
function source(name) {
  if(cache[name])return cache[name];
  let code=fs.readFileSync(path.join(base,name),'utf8');
  code=code.replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
  return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
(async function(){
let worker;
globalThis.Worker=class {constructor(){worker=this;this.messages=[];}postMessage(m){this.messages.push(m);}terminate(){}};
const {createBalancedClient}=await import(source('balanced-client.js'));
let deliveries=0,progress=0;const client=createBalancedClient({onProgress:()=>progress++});
const p={r:.3,theta:.4,t:0,phi:0};
client.request(p,()=>deliveries++,undefined,'default');
const descriptor={id:'side-zero-second',word:[4,1,0,3,0,1,4]};
client.request(p,()=>deliveries++,undefined,descriptor);
descriptor.id='default';descriptor.word[0]=0;
worker.onmessage({data:{success:true}});
assert.strictEqual(deliveries,0);assert.strictEqual(progress,0);
assert.strictEqual(worker.messages[1].chamber.id,'side-zero-second');
assert.strictEqual(worker.messages[1].chamber.word[0],4);
assert.notStrictEqual(worker.messages[0].epoch,worker.messages[1].epoch);
client.invalidate();worker.onmessage({data:{success:true}});
assert.strictEqual(deliveries,0);assert.strictEqual(progress,0);
client.request(p,()=>deliveries++,undefined,'default');worker.onmessage({data:{success:true}});
assert.strictEqual(deliveries,1);client.dispose();
console.log('Balanced client: queued descriptors copied; chamber epochs suppress stale deliveries/progress.');
})().catch(error=>{console.error(error);process.exitCode=1;});
