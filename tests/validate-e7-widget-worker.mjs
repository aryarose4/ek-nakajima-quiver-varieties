// Exercise the exact generated offline worker used by both page variants.
import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
const text=fs.readFileSync(new URL('../assets/js/ek-nakajima/e7-worker-source.js',import.meta.url),'utf8');
const source=JSON.parse(text.slice(text.indexOf(' = ')+3).trim().replace(/;$/,''));
let response;
const context={self:{postMessage(value){response=value;}},console};
vm.runInNewContext(source,context);
const beta=[.50005,.5001,.5002,.5004,.5008,.5016,.2532];
let id=0;
function solve(chart,r,theta=0){
 const radius=chart==='north'?r/(1-r):(1-r)/r,angle=chart==='north'?theta:-theta;
 context.self.onmessage({data:{id:++id,chart,base:[radius*Math.cos(angle),radius*Math.sin(angle)],beta,parameters:{r,theta,t:0,phi:0}}});
 assert.strictEqual(response.id,id);assert(!response.error,response.error);assert(response.result.success,response.result.reason);
 assert(response.result.realNorm<=1e-9);assert(response.result.complexNorm<=1e-8);
 assert(response.result.frameMatchingError<1e-6);
 assert.strictEqual(JSON.stringify(response.levels),JSON.stringify(beta.map(x=>2*x)));
 return response.result;
}
solve('north',.25);solve('north',.599,.3);solve('south',.601,.3);
solve('south',1);solve('north',0);solve('north',.3,-.4);
context.self.onmessage({data:{id:++id,chart:'north',base:[0,0],beta:[NaN],parameters:{r:0,theta:0}}});
assert(response.error);assert(!response.result);
console.log('E7 generated worker: central sphere, both poles, exact chart transport, flat levels and invalid-level failure pass.');
