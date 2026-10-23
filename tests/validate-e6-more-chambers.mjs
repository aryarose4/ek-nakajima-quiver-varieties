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
const m=await import(source('e6-parameters.js'));
const {solveBalancedAtlas}=await import(source('balanced-model.js'));
const {e6ReflectLevels}=await import(source('e6-chamber-transport.js'));
const {e6CoreAreas}=await import(source('e6-areas.js'));
const fixtures=[{r:.3,theta:.5,t:.2,phi:.7,sphere:0}];
for(const r of [0,1])for(const sphere of [0,1])for(const t of [0,.5,1])fixtures.push({r,theta:0,t,phi:.4,sphere});
fixtures.push({r:.5,theta:0,t:1,phi:0,sphere:0},{r:.5,theta:0,t:.3,phi:.4,sphere:0,outgoing:true});
const first=m.e6ChamberWallOptions(m.E6_DEFAULT_BETA).filter(w=>w.canCross);
assert.strictEqual(first.length,5);
let solves=0;
for(const wall of first){
 for(const epsilon of [1e-4,1e-6,1e-7]){
  const collar=wall.wallBeta.map((r,i)=>r.map((x,j)=>x+epsilon*(wall.crossing.targetBeta[i][j]-x)));
  const sample=m.e6DisplayBeta(collar,wall.targetChamberId);
  const x=solveBalancedAtlas(fixtures[0],m.betaToLevels(sample),{chamber:wall.targetChamberId});
  assert(x.success,'collar '+epsilon+' '+wall.id+' '+JSON.stringify(x.diagnostics));assert(x.residuals.real_norm<1e-9);assert(x.residuals.complex_norm<1e-8);solves++;
 }

 const beta=wall.crossing.targetBeta,id=wall.targetChamberId;
 assert(m.e6BetaInChamber(beta,id));assert(m.e6BetaInChamber(m.e6SourceBeta(beta,id)));
 assert.deepStrictEqual(e6CoreAreas(beta,id).periods,e6CoreAreas(m.e6SourceBeta(beta,id)).periods);
 const back=m.e6ChamberWallOptions(beta,id).find(w=>w.id===wall.id);
 assert.strictEqual(back.targetChamberId,'default');
 for(const p of fixtures){const x=solveBalancedAtlas(p,m.betaToLevels(beta),{chamber:id});assert(x.success,id+' '+JSON.stringify(p)+' '+JSON.stringify(x.diagnostics));assert(x.residuals.real_norm<1e-9);assert(x.residuals.complex_norm<1e-8);solves++;}
 for(const next of m.e6ChamberWallOptions(beta,id).filter(w=>w.canCross&&w.targetChamberId!=='default')){
  const target=next.crossing.targetBeta,targetId=next.targetChamberId;
  const sourceBeta=m.e6SourceBeta(target,targetId),word=m.e6ChamberWord(targetId);
  const forward=word.reduce((z,v)=>e6ReflectLevels(z,v),sourceBeta);
  forward.flat().forEach((x,i)=>assert(Math.abs(x-target.flat()[i])<1e-12));
  assert(m.e6BetaInChamber(target,targetId));assert(m.e6BetaInChamber(m.e6SourceBeta(target,targetId)));
  const back2=m.e6ChamberWallOptions(target,targetId).find(w=>w.id===next.id);assert.strictEqual(back2.targetChamberId,id);
  const x=solveBalancedAtlas(fixtures[0],m.betaToLevels(target),{chamber:targetId});assert(x.success,targetId+' '+JSON.stringify(x.diagnostics));assert(x.residuals.real_norm<1e-9);solves++;
 }
}
// UI crossings retain physical wall beta. Replanning in its tiny collar must
// never replace the robust chamber reference with a sub-margin target sample.
let pinned=m.E6_DEFAULT_BETA,id='default';
for(let hop=0;hop<8;hop++){
 const options=m.e6ChamberWallOptions(pinned,id).filter(w=>w.canCross);
 const selected=options[hop%options.length];
 pinned=selected.wallBeta;id=selected.targetChamberId;
 const interior=m.e6DisplayBeta(pinned,id);
 assert(m.e6BetaInChamber(interior,id),'pinned UI crossing '+hop);
 m.e6ChamberWallOptions(pinned,id);
}
assert.throws(()=>m.e6DisplayBeta(first[0].crossing.targetBeta,'default'),RangeError);
assert.throws(()=>m.e6ChamberWord('weyl:9'),RangeError);
assert.strictEqual(solveBalancedAtlas(fixtures[0],[[-1,1],[1,1],[1,1]],{chamber:'weyl:4'}).diagnostics.status,'unsupported_chamber_region');
console.log('More E6 chambers: five first-hop facets, multihop/reverse, '+solves+' strict solves passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
