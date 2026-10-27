import fs from 'fs';
import os from 'os';
import path from 'path';
import {pathToFileURL} from 'url';
import assert from 'assert';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'e7-core-'));
fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
for(const name of ['core-math','solver','e7-core','e7-solver'])fs.copyFileSync(new URL('../assets/js/ek-nakajima/'+name+'.js',import.meta.url),path.join(temp,name+'.js'));
async function main(){
const C=await import(pathToFileURL(path.join(temp,'e7-core.js')).href),S=await import(pathToFileURL(path.join(temp,'e7-solver.js')).href),M=await import(pathToFileURL(path.join(temp,'solver.js')).href);
const A=await import(pathToFileURL(path.join(temp,'core-math.js')).href);
const levels=[1,1,1,1,1,1,.5];
assert.deepStrictEqual(C.betaToE7Levels([.5,.5,.5,.5,.5,.5,.25]),levels);
for(const z of [0,1,[NaN,0],[1,Infinity]])assert.throws(()=>C.makeE7Chart(z));
for(const b of [[],[1,2],Array(7).fill(NaN)])assert.throws(()=>C.betaToE7Levels(b));
for(const z of [[2,.3],[-.4,.7],[.5,-.2]])for(const p of [[.2,.1],[-.3,.25]]){
const rep=C.makeE7Chart(z,p);assert(C.complexResidualNormE7(rep)<1e-13);assert.deepStrictEqual(C.validateE7Rep(rep),[]);
const coords=Array.from({length:47},(_,i)=>.1*Math.sin(i*1.7)),g=C.positiveE7Gauge(coords,M.expmHermitian),r=C.gaugeActionE7(rep,g.gauge,g.inverse);
assert(C.complexResidualNormE7(r)<1e-11);
// Off the zero set, check full complex-map covariance, not only zero preservation.
const perturbed=JSON.parse(JSON.stringify(rep));perturbed.y[0][2][0][3][1]+=.037;
const expectedCenter=A.traceless(perturbed.x.reduce((sum,arm,b)=>A.matSub(sum,A.matMul(arm[arm.length-1],perturbed.y[b][arm.length-1])),A.zerosZ(4,4)));
const before=C.complexResidualE7(perturbed);assert(A.frobNorm(A.matSub(before.center,expectedCenter))<1e-14);const after=C.complexResidualE7(C.gaugeActionE7(perturbed,g.gauge,g.inverse));
assert(A.frobNorm(A.matSub(after.center,A.matMul(A.matMul(g.gauge.center,before.center),g.inverse.center)))<1e-11);
before.branches.forEach((arm,b)=>arm.forEach((Q,k)=>assert(A.frobNorm(A.matSub(after.branches[b][k],A.matMul(A.matMul(g.gauge.branches[b][k],Q),g.inverse.branches[b][k])))<1e-11)));
assert.strictEqual(C.packRealResidualE7(r,levels).length,47);
}
assert(C.validateE7Rep({}).length>0);
let warm;
for(const test of [[2,0],[[2,.12],[.02,.01]],[[1.9,-.08],[-.03,.015]]]){
const rep=C.makeE7Chart(...test),result=S.solveE7(rep,levels,{warmStart:warm,tolerance:1e-9});
console.log(JSON.stringify({z:test[0],p:test[1],success:result.success,realNorm:result.realNorm,complexNorm:result.complexNorm,iterations:result.iterations,rank:result.jacobianRank,reason:result.reason}));
assert(result.success);assert(result.realNorm<1e-7);assert.strictEqual(result.jacobianRank,47);warm=result.coords;
}
const fail=S.solveE7(C.makeE7Chart(2),levels,{maxIterations:0});assert(!fail.success);assert.strictEqual(fail.reason,'iteration limit');
const cold=S.solveE7(C.makeE7Chart([2,.12],[.02,.01]),levels);assert(cold.success);console.log('Cold complex solve:',cold.realNorm,cold.iterations);
assert.throws(()=>S.solveE7(C.makeE7Chart(2),levels,{warmStart:[0]}));
console.log('E7 core and balancing validation passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});



