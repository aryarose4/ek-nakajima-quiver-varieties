import fs from 'fs';
import os from 'os';
import path from 'path';
import {pathToFileURL} from 'url';
import assert from 'assert';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'e7-atlas-'));
fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
for(const name of ['core-math','solver','e7-core','e7-solver','e7-atlas'])fs.copyFileSync(new URL('../assets/js/ek-nakajima/'+name+'.js',import.meta.url),path.join(temp,name+'.js'));
async function main(){
 const load=name=>import(pathToFileURL(path.join(temp,name+'.js')).href);
 const A=await load('e7-atlas'),C=await load('e7-core'),M=await load('core-math'),S=await load('e7-solver');
 let maxMoment=0,maxTransition=0;
 for(const chart of ['north','south'])for(const z of [0,1,[2,.3],[-.4,.7],[.00001,-.00002]])for(const p of [0,[.13,-.08],[-2,3]]){
  const rep=A.makeE7AtlasChart(chart,z,p);assert.deepStrictEqual(C.validateE7Rep(rep),[]);
  const err=C.complexResidualNormE7(rep);maxMoment=Math.max(maxMoment,err);assert(err<1e-11);
  // Exact polynomial cotangent normalization: the varying W entry pairs to p.
  assert.deepStrictEqual(rep.y[2][0][0][chart==='north'?2:3],typeof p==='number'?[p,0]:p);
 }
 for(const z of [[2,.3],[-.4,.7],[1,0],[.03,.02]]){
  const p=[.13,-.08],t=A.transitionE7NorthToSouth(z,p);
  const mapped=C.gaugeActionE7(A.makeE7AtlasChart('north',z,p),t.gauge,t.inverse),south=A.makeE7AtlasChart('south',t.base,t.fiber);
  for(const name of ['x','y'])mapped[name].forEach((arm,b)=>arm.forEach((m,k)=>{const err=M.frobNorm(M.matSub(m,south[name][b][k]));maxTransition=Math.max(maxTransition,err);assert(err<1e-10);}));
  const mult=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
  const det=t.gauge.center.reduce((v,row,i)=>mult(v,row[i]),[1,0]);assert(Math.hypot(det[0]-1,det[1])<1e-12);
  // pS dw/dz = pN, with dw/dz=-w^2.
  const canonical=mult(t.fiber,mult([-t.base[0],-t.base[1]],t.base));assert(Math.hypot(canonical[0]-p[0],canonical[1]-p[1])<1e-12);
 }
 console.log(JSON.stringify({maxMoment,maxTransition}));
 // Test-only raw representatives: production open-chart endpoint exclusion remains intact.
 function rawEndpoint(infinity,p){
  const R=a=>a.map(row=>row.map(n=>[n,0]));
  const W=R(infinity?[[1,0],[0,1],[1,0],[1,1]]:[[1,0],[0,1],[1,1],[1,0]]);
  const T=R(infinity?[[0,0],[1,0]]:[[0,0],[0,1]]);
  const N=W.slice(2).map((row,i)=>row.map(v=>[-v[0],0]).concat(M.eyeZ(2)[i]));
  const K=M.matMul(M.matMul(W,T),N),rep=A.makeE7AtlasChart('north',0,p);
  rep.x[2][0]=W;rep.y[2][0]=M.matScale(M.matMul(T,N),p);
  for(let b=0;b<2;b++)for(let k=1;k<=3;k++){
   const rev=M.zerosZ(k,k+1);
   for(let i=0;i<k;i++)for(let j=0;j<k+1;j++){
    const r=b?3-i:i,c=b?3-j:j;
    if((b===0&&r<c)||(b===1&&r>c))rev[i][j]=[-K[r][c][0],-K[r][c][1]];
   }
   rep.y[b][k-1]=M.matScale(k===3&&b?rev.map(row=>row.slice().reverse()):rev,p);
  }
  return rep;
 }
 for(const infinity of [false,true]){
  for(const p of [0,[.02,.01],[-2,3]]){
   const rep=rawEndpoint(infinity,p),central=infinity?[1,3]:[1,2];
   assert(C.complexResidualNormE7(rep)<1e-12);
   // Maximal induced coordinate subspaces, including short span(e2).
   const spaces=[ [1,2,3].map(k=>central.filter(i=>i<k)),[1,2,3].map(k=>central.map(i=>3-i).filter(i=>i<k)),[[1]] ];
   for(const name of ['x','y'])rep[name].forEach((arm,b)=>arm.forEach((mat,k)=>{
    let source=spaces[b][k],target=k===arm.length-1?central:spaces[b][k+1];
    if(name==='y'){const hold=source;source=target;target=hold;}
    for(const j of source)for(let i=0;i<mat.length;i++)if(!target.includes(i))assert.deepStrictEqual(mat[i][j].map(v=>v===0?0:v),[0,0]);
   }));
  }
  const result=S.solveE7(rawEndpoint(infinity,[.02,.01]),C.E7_DEFAULT_LEVELS,{maxIterations:20});
  console.log(JSON.stringify({rawEndpoint:infinity?'infinity':'zero',success:result.success,realNorm:result.realNorm,complexNorm:result.complexNorm,iterations:result.iterations,reason:result.reason}));
  assert(!result.success); // Instability is proved by King weights, not this failure.
 }
 for(const fixture of [['north',0],['north',1],['south',0]]){
  let warm;
  for(const z of [fixture[1],[fixture[1]+.002,.001]]){
   const r=S.solveE7(A.makeE7AtlasChart(fixture[0],z,[.02,.01]),C.E7_DEFAULT_LEVELS,{warmStart:warm,tolerance:1e-9,maxIterations:60});
   console.log(JSON.stringify({chart:fixture[0],base:z,success:r.success,realNorm:r.realNorm,complexNorm:r.complexNorm,iterations:r.iterations,reason:r.reason}));assert(r.success);warm=r.coords;
  }
 }
 const overlap=A.transitionE7NorthToSouth([2,.3],[.02,.01]);
 const balanced=[S.solveE7(A.makeE7AtlasChart('north',[2,.3],[.02,.01]),C.E7_DEFAULT_LEVELS),S.solveE7(A.makeE7AtlasChart('south',overlap.base,overlap.fiber),C.E7_DEFAULT_LEVELS)];
 assert(balanced.every(r=>r.success));
 let maxBalancedNormDifference=0;
 for(let b=0;b<3;b++){
  const norms=balanced.map(result=>{const arm=result.rep.x[b],last=arm.length-1;return M.frobNorm(M.matMul(arm[last],result.rep.y[b][last]));});
  const difference=Math.abs(norms[0]-norms[1]);maxBalancedNormDifference=Math.max(maxBalancedNormDifference,difference);assert(difference<1e-7);
 }
 console.log(JSON.stringify({overlapRealNorms:balanced.map(r=>r.realNorm),maxBalancedNormDifference}));
 console.log('E7 atlas chart and numerical endpoint validation passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
