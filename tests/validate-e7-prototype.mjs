// Browser-independent worker protocol and prototype wiring smoke check.
import fs from 'fs';import os from 'os';import path from 'path';import {pathToFileURL} from 'url';import assert from 'assert';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'e7-prototype-'));fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
for(const name of ['core-math','solver','e7-core','e7-solver','e7-worker'])fs.copyFileSync(new URL('../assets/js/ek-nakajima/'+name+'.js',import.meta.url),path.join(temp,name+'.js'));
async function main(){
 const C=await import(pathToFileURL(path.join(temp,'e7-core.js')).href);
 let response;global.self={postMessage:data=>{response=data;}};
 await import(pathToFileURL(path.join(temp,'e7-worker.js')).href);
 self.onmessage({data:{id:19,z:[2,0],p:[0,0],beta:C.E7_DEFAULT_BETA}});
 assert.strictEqual(response.id,19);assert(response.result.success);assert.deepStrictEqual(response.levels,C.E7_DEFAULT_LEVELS);
 self.onmessage({data:{id:20,z:[1,0],p:[0,0],beta:C.E7_DEFAULT_BETA}});assert.strictEqual(response.id,20);assert(response.error);assert(!response.result);
 const html=fs.readFileSync(new URL('../e7-prototype.html',import.meta.url),'utf8');
 for(const id of ['scene','status','balance','reset','projection-note','geometry-status','z-re','z-im','p-re','p-im'].concat(Array.from({length:7},(_,i)=>'beta-'+i)))assert(html.includes('id="'+id+'"'));
 for(let i=0;i<7;i++){const tag=html.match(new RegExp('<input id="beta-'+i+'"[^>]+>'))[0];assert(tag.includes('value="'+C.E7_DEFAULT_BETA[i]+'"'));}
 const source=fs.readFileSync(new URL('../assets/js/ek-nakajima/e7-prototype.js',import.meta.url),'utf8');assert(source.includes('event.data.id!==requestId'));assert(source.includes("currentState='stale'"));
 console.log('E7 worker protocol and prototype wiring passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
