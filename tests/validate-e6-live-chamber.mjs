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
const {solveBalancedAtlas}=await import(source('balanced-model.js'));
const {e6ReflectLevels,E6_ADJACENT_WORD}=await import(source('e6-chamber-transport.js'));
const {E6_REGULAR_LEVELS}=await import(source('e6-levels.js'));
const target=E6_ADJACENT_WORD.reduce((z,v)=>e6ReflectLevels(z,v),E6_REGULAR_LEVELS);
const fixtures=[{r:.3,theta:.5,t:.2,phi:.7,sphere:0,outgoing:false}];
for(const r of [0,1])for(const sphere of [0,1])for(const t of [0,.3,.7,1])fixtures.push({r,theta:0,t,phi:.4,sphere,outgoing:false});
for(const t of [0,.5,1])for(const outgoing of [false,true])if(!(outgoing&&t===1))fixtures.push({r:.5,theta:0,t,phi:.3,sphere:0,outgoing});
for(const r of [0,1])for(const sphere of [1])fixtures.push({r,theta:0,t:.3,phi:.3,sphere,outgoing:true});
assert.strictEqual(solveBalancedAtlas(fixtures[0],E6_REGULAR_LEVELS,{chamber:'side-zero-second'}).diagnostics.status,'chamber_mismatch');
for(const p of fixtures){const result=solveBalancedAtlas(p,target,{chamber:'side-zero-second'});assert(result.success,JSON.stringify(p)+' '+JSON.stringify(result.diagnostics));assert(result.residuals.real_norm<1e-7);}
const collarLevels=[[1.0504833333333334,.5],[1.01715,1.0166666666666666],[.9838166666666665,1.5333333333333334]].map(r=>r.map(x=>2*x));
const collar=solveBalancedAtlas({r:.35,theta:.7,t:0,phi:.6,sphere:0},collarLevels,{chamber:'side-zero-second'});
assert(collar.success);assert(collar.residuals.real_norm<1e-9);
const {frob2,extractGeometry,matMul,matAdj,matTrace}=await import(source('core-math.js'));
const F=rep=>rep.b.concat(rep.B).reduce((sum,m)=>sum+frob2(m),0)/2;
for(const epsilon of [1e-3,1e-4,1e-5,1e-6,1e-7]) {
const low=E6_REGULAR_LEVELS.map((r,i)=>r.map((x,j)=>(x+target[i][j])/2+epsilon*(x-target[i][j])));
const high=E6_ADJACENT_WORD.reduce((z,v)=>e6ReflectLevels(z,v),low);
let worst=0,failures=0;
for(const p of [fixtures[0],{r:0,theta:0,t:.3,phi:.4,sphere:1,outgoing:false},{r:0,theta:0,t:1,phi:0,sphere:1,outgoing:false},{r:0,theta:0,t:0,phi:0,sphere:0,outgoing:false}]) {
const a=solveBalancedAtlas(p,low),b=solveBalancedAtlas(p,high,{chamber:'side-zero-second'});
assert(a.success && b.success,'nearwall '+epsilon+' '+JSON.stringify(p)+' '+a.diagnostics.status+' '+b.diagnostics.status);
assert(a.residuals.real_norm<1e-9 && b.residuals.real_norm<1e-9);
assert(Math.abs(F(a.solvedRep)-F(b.solvedRep))<1e-7);
worst=Math.max(worst,Math.abs(F(a.solvedRep)-F(b.solvedRep)));
const ga=extractGeometry(a.solvedRep,low),gb=extractGeometry(b.solvedRep,high);
const invariants=g=>g.pairwise.flat().concat(g.K.map(k=>g.K.map(l=>matTrace(matMul(k,matAdj(l))))).flat(2));
const ia=invariants(ga),ib=invariants(gb);
const geometryDifference=Math.max(...ia.map((x,i)=>Math.abs(x-ib[i])));
assert(geometryDifference<100*epsilon+1e-7,'wall geometry continuity '+geometryDifference);
}
console.log('nearwall',epsilon,'F difference',worst,'failures',failures);
}
console.log('Live adjacent solver: '+fixtures.length+' chart configurations passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});


