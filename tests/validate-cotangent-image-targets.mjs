import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
function source(name){if(cache[name])return cache[name];let code=fs.readFileSync(path.join(base,name),'utf8');code=code.replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');}
(async function(){
 const {balancedTensorDiagram:diagram,projectTensorPoint:project}=await import(source('weighted-balanced-diagram.js'));
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {eyeZ,matMul,matAdj,matTrace,cMul,cConj}=await import(source('core-math.js'));
 const projector=v=>v.map(x=>v.map(y=>cMul(x,cConj(y))));
 const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
 const I=eyeZ(3),v=[[1,2],[3,-1],[2,.4]],S=projector(v);
 const p=project(S,I),phase=v.map(z=>cMul(z,[Math.cos(.7),Math.sin(.7)]));
 assert(distance(p.point,project(projector(phase),I).point)<1e-12,'vector phase cancels');
 assert.strictEqual(project(eyeZ(3).map(row=>row.map(()=>[0,0])),I),null,'zero image has no target');
 const infinity=project(projector([[1,0],[-1,0],[0,0]]),I);
 assert(infinity.atInfinity&&infinity.point===null,'undefined affine point never targets origin');
 const edge=project(projector([[1,0],[-.999,0],[0,0]]),I);
 assert(edge.clipped&&!edge.atInfinity&&Math.abs(Math.max(...edge.point.map(Math.abs))-.9)<1e-12,'escaping point clips to camera edge');
 // A complex unitary change of both the world point and camera must
 // preserve exact infinity; summing a projector's entries is unstable here.
 const V=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
 const worldInfinity=matMul(matMul(V,projector([[1,0],[-1,0],[0,0]])),matAdj(V));
 const camera=[0,1,2].map(j=>V.map(row=>row[j]));
 const rotatedInfinity=project(worldInfinity,camera);
 assert(rotatedInfinity.atInfinity&&rotatedInfinity.point===null,'complex rotated exact infinity remains hidden');
 const K=[[[0,0],[2,0],[3,1]],[[0,0],[0,0],[4,-2]],[[0,0],[0,0],[0,0]]],N=projector([[0,0],[0,0],[1,0]]);
 const image=matMul(matMul(K,N),matAdj(K));
 assert(distance(project(image,I).point,project(projector(K.map(row=>row[2])),I).point)<1e-12,'rank-two K uses K e3 rather than its full image');
 const beta=[[1.004,.400],[2.753,1.315],[1.686,1.163]],levels=beta.map(row=>row.map(x=>2*x));
 const chamber='weyl:5.2.0.1.4.1.4.1.0.1.4.1.0.4.1.0.2.5';
 const U=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
 for(const params of [{r:0,theta:0},{r:.5,theta:0},{r:1,theta:0},{r:.37,theta:.83},{r:.3,theta:.7,t:.2,phi:.4}]){
  const solved=solveBalancedAtlas({t:0,phi:0,sphere:0,...params},levels,{chamber});assert(solved.success);
  const d=diagram(solved.solvedRep);assert(d.valid);
  const moved=diagram(applyComplexGauge(solved.solvedRep,U,[eyeZ(2),eyeZ(2),eyeZ(2)],[1,1,1]));assert(moved.valid);
  d.glyphs.forEach((g,i)=>{
   const target=d.layout.cotangentTargets[i];
   if(!target){assert.strictEqual(moved.layout.cotangentTargets[i],null);return;}
   const expected=project(matMul(matMul(d.operators[i],g.projectors[2]),matAdj(d.operators[i])),d.frame);
   assert(distance(target.point,expected.point)<1e-12,'target is intrinsic K N K* image');
   assert(distance(target.point,moved.layout.cotangentTargets[i].point)<1e-7,'target is unitary gauge invariant');
  });
  const target=d.layout.cotangentTargets[0];
  if(params.r===0||params.r===1)assert(distance(target.point,d.layout.points[params.r===0?0:2])<1e-8,'special image equals marked point');
  if(params.r===.5)assert(distance(target.point,d.layout.concurrencyPoint)<1e-8,'middle image equals common plane intersection');
  if(params.r===0)assert(d.glyphs[0].magnitudes[2]<1e-10,'zero c23 remains invisible even when image target exists');
 }
 console.log('Cotangent image targets: phase/unitary invariance, special incidences, generic complex flags, rank-two K, zero image, clipping and infinity passed.');
})().catch(e=>{console.error(e);process.exit(1);});
