// E7 open cotangent chart. No framing: central SL(4), seven noncentral GL nodes.
import {zerosZ,eyeZ,matMul,matAdd,matSub,matScale,matAdj,traceless,frob2,hermitianBasis,tracelessHermitianBasis,packHermitian,unpackHermitian} from './core-math.js';
export const E7_BRANCH_DIMS=[[1,2,3],[1,2,3],[2]];
export const E7_GAUGE_DIM=47;
const bases=[tracelessHermitianBasis(4)].concat([1,2,3,1,2,3,2].map(hermitianBasis));
const scalar=v=>typeof v==='number'?[v,0]:v;
const finitePair=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite);
export function validateE7Levels(v){if(!Array.isArray(v)||v.length!==7||!v.every(Number.isFinite))throw new Error('E7 levels must contain seven finite numbers');return v.slice();}
export function betaToE7Levels(beta){return validateE7Levels(beta).map(v=>2*v);}
const slice=(M,r,c)=>M.slice(0,r).map(row=>row.slice(0,c));
export function makeE7Chart(z,p=0){
 z=scalar(z);p=scalar(p);
 if(!finitePair(z)||!finitePair(p))throw new Error('E7 z and p must be finite complex scalars');
 if(Math.hypot(z[0],z[1])<1e-10||Math.hypot(z[0]-1,z[1])<1e-10)throw new Error('E7 open chart excludes z=0 and z=1');
 const R=a=>a.map(row=>row.map(scalar));
 const W=R([[1,0],[0,1],[1,1],[1,z]]), N=R([[-1,-1,1,0],[-1,[-z[0],-z[1]],0,1]]);
 const T=R([[z,[-z[0],-z[1]]],[[-z[0],-z[1]],1]]), K=matMul(matMul(W,T),N);
 const upper=zerosZ(4,4),lower=zerosZ(4,4);
 for(let i=0;i<4;i++)for(let j=0;j<4;j++){if(i<j)upper[i][j]=K[i][j];if(i>j)lower[i][j]=K[i][j];}
 const F=zerosZ(4,4);for(let i=0;i<4;i++)F[i][3-i]=[1,0];
 const x=[],y=[];
 [eyeZ(4),F].forEach((frame,b)=>{
  const C=matMul(matMul(matAdj(frame),matScale(b===0?upper:lower,-1)),frame);
  x[b]=[];y[b]=[];
  for(let k=1;k<=3;k++){
   const J=slice(eyeZ(k+1),k+1,k);
   x[b].push(k===3?matMul(frame,J):J);
   let rev=slice(C,k,k+1);if(k===3)rev=matMul(rev,matAdj(frame));
   y[b].push(matScale(rev,p));
  }
 });
 x.push([W]);y.push([matScale(matMul(T,N),p)]);
 return {x,y};
}
export function identityE7Gauge(){return {center:eyeZ(4),branches:E7_BRANCH_DIMS.map(ds=>ds.map(eyeZ))};}
export function positiveE7Gauge(coords,expm){
 if(!Array.isArray(coords)||coords.length!==47||!coords.every(Number.isFinite))throw new Error('E7 gauge coordinates must contain 47 finite numbers');
 let offset=0;const gs=[],inv=[];
 bases.forEach(B=>{const S=unpackHermitian(coords.slice(offset,offset+B.length),B);offset+=B.length;gs.push(expm(matScale(S,.5)));inv.push(expm(matScale(S,-.5)));});
 const group=a=>({center:a[0],branches:[a.slice(1,4),a.slice(4,7),a.slice(7,8)]});
 return {gauge:group(gs),inverse:group(inv)};
}
export function gaugeActionE7(rep,gauge,inverse){
 const x=[],y=[];
 E7_BRANCH_DIMS.forEach((ds,b)=>{x[b]=[];y[b]=[];ds.forEach((d,k)=>{
 const s=gauge.branches[b][k],si=inverse.branches[b][k];
 const t=k+1===ds.length?gauge.center:gauge.branches[b][k+1],ti=k+1===ds.length?inverse.center:inverse.branches[b][k+1];
 x[b].push(matMul(matMul(t,rep.x[b][k]),si));y[b].push(matMul(matMul(s,rep.y[b][k]),ti));
 });});return {x,y};
}
export function complexResidualE7(rep){
 let center=zerosZ(4,4);const branches=E7_BRANCH_DIMS.map((ds,b)=>ds.map((d,k)=>{
 let m=matMul(rep.y[b][k],rep.x[b][k]);if(k)m=matSub(m,matMul(rep.x[b][k-1],rep.y[b][k-1]));
 if(k===ds.length-1)center=matSub(center,matMul(rep.x[b][k],rep.y[b][k]));return m;
 }));return {center:traceless(center),branches};
}
export function complexResidualNormE7(rep){const m=complexResidualE7(rep);return Math.sqrt(frob2(m.center)+m.branches.reduce((s,arm)=>s+arm.reduce((t,M)=>t+frob2(M),0),0));}
export function realResidualE7(rep,levels){
 validateE7Levels(levels);let center=zerosZ(4,4),index=0;
 const branches=E7_BRANCH_DIMS.map((ds,b)=>ds.map((d,k)=>{
 const X=rep.x[b][k],Y=rep.y[b][k];let m=matSub(matMul(matAdj(X),X),matMul(Y,matAdj(Y)));
 if(k){const A=rep.x[b][k-1],B=rep.y[b][k-1];m=matAdd(matSub(m,matMul(A,matAdj(A))),matMul(matAdj(B),B));}
 if(k===ds.length-1)center=matAdd(center,matSub(matMul(matAdj(Y),Y),matMul(X,matAdj(X))));
 return matSub(m,matScale(eyeZ(d),levels[index++]));
 }));return {center:traceless(center),branches};
}
export function packRealResidualE7(rep,levels){const m=realResidualE7(rep,levels),matrices=[m.center].concat(...m.branches);return [].concat(...matrices.map((M,i)=>packHermitian(M,bases[i])));}
export function validateE7Rep(rep){
 const errors=[];
 for(const name of ['x','y']){
  if(!rep||!Array.isArray(rep[name])||rep[name].length!==3){errors.push(name+' must have three arms');continue;}
  E7_BRANCH_DIMS.forEach((ds,b)=>{
   if(!Array.isArray(rep[name][b])||rep[name][b].length!==ds.length){errors.push(name+' arm '+b+' length');return;}
   ds.forEach((d,k)=>{
    const t=k+1===ds.length?4:ds[k+1],rows=name==='x'?t:d,cols=name==='x'?d:t,M=rep[name][b][k];
    if(!Array.isArray(M)||M.length!==rows||!M.every(row=>Array.isArray(row)&&row.length===cols&&row.every(finitePair)))errors.push(name+'['+b+']['+k+'] shape or finite entries');
   });
  });
 }
 return errors;
}

