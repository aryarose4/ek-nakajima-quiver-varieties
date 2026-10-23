import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima');
const cache={};
function source(name) {
  if(cache[name])return cache[name];
  const text=fs.readFileSync(path.join(base,name),'utf8').replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
  return cache[name]='data:text/javascript;base64,'+Buffer.from(text).toString('base64');
}
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {betaToLevels,constrainE6Beta}=await import(source('e6-parameters.js'));
 const interior=[[1.23,.4],[1.64,1.41],[1.06,1.82]];
 let checks=0,worst=0,residual=0,recovered=0;
 function good(beta,p){
   const start=Date.now(),out=solveBalancedAtlas(p,betaToLevels(beta));worst=Math.max(worst,Date.now()-start);
   assert(out.success,JSON.stringify({beta,p,diagnostics:out.diagnostics,residuals:out.residuals}));
   assert(out.residuals.real_norm<=1e-9);assert(out.residuals.complex_norm<=1e-8);assert(out.diagnostics.gauge_positive);
   residual=Math.max(residual,out.residuals.real_norm);checks++;if(out.diagnostics.levelContinuation){recovered++;assert(out.diagnostics.rebased);assert.strictEqual(out.diagnostics.levelContinuationSteps,7);}return out;
 }
 const p={r:.5,theta:0,t:.3,phi:.7,sphere:0};
 for(const gap of [3e-3,3e-5,3e-7])good([[.93+gap,.4],[1.64,1.41],[1.06,1.82]],p);
 assert(good([[.9300003000000007,.4],[1.64,1.41],[1.06,1.82]],p).diagnostics.levelContinuation);
 for(let index=0;index<6;index++)for(const endpoint of [0,3]) {
   const beta=constrainE6Beta(interior,index,endpoint);
   for(const r of [0,.5,1])for(const t of [.3,1])good(beta,{...p,r,t,theta:r===.5?0:.8});
   for(const r of [0,.5,1])good(beta,{...p,r,t:.4,sphere:r===.5?0:1,outgoing:true});
 }
 console.log(`Cold collars: ${checks} strict solves, ${recovered} rebased recoveries; worst ${worst} ms, real ${residual}`);
})().catch(e=>{console.error(e);process.exitCode=1;});