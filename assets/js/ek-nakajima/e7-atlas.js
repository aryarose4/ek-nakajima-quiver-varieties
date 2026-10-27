// Stable cotangent charts on the opposite-full-flag E7 locus; see docs/E7_ENDPOINT_CHARTS.md.
import {zerosZ,eyeZ,matMul,matScale,matAdj} from './core-math.js';
const pair=v=>typeof v==='number'?[v,0]:v;
const neg=v=>[-v[0],-v[1]];
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const inv=a=>{const n=a[0]*a[0]+a[1]*a[1];return [a[0]/n,-a[1]/n];};
const finite=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite);
const R=a=>a.map(row=>row.map(pair));
const slice=(a,r,c)=>a.slice(0,r).map(row=>row.slice(0,c));
export function makeE7AtlasChart(chart,base,fiber=0){
 const z=pair(base),p=pair(fiber);
 if(chart!=='north'&&chart!=='south')throw new Error('E7 atlas chart must be north or south');
 if(!finite(z)||!finite(p))throw new Error('E7 atlas coordinates must be finite complex scalars');
 const M=chart==='north'?R([[z,1],[1,1]]):R([[1,1],[z,1]]);
 const W=R([[1,0],[0,1]]).concat(M),N=M.map((row,i)=>row.map(neg).concat(eyeZ(2)[i]));
 const T=chart==='north'?R([[1,neg(z)],[neg(z),z]]):R([[neg(z),1],[z,neg(z)]]);
 const K=matMul(matMul(W,T),N),parts=[zerosZ(4,4),zerosZ(4,4)];
 for(let i=0;i<4;i++)for(let j=0;j<4;j++)if(i!==j)parts[i<j?0:1][i][j]=neg(K[i][j]);
 const F=zerosZ(4,4);for(let i=0;i<4;i++)F[i][3-i]=[1,0];
 const x=[],y=[];
 [eyeZ(4),F].forEach((frame,b)=>{
  const C=matMul(matMul(matAdj(frame),parts[b]),frame);x[b]=[];y[b]=[];
  for(let k=1;k<=3;k++){
   const J=slice(eyeZ(k+1),k+1,k);x[b].push(k===3?matMul(frame,J):J);
   let rev=slice(C,k,k+1);if(k===3)rev=matMul(rev,matAdj(frame));y[b].push(matScale(rev,p));
  }
 });
 x.push([W]);y.push([matScale(matMul(T,N),p)]);return {x,y};
}
// The principal argument supplies one LOCAL fourth-root branch. Other roots
// differ by the ineffective common scalar kernel; no global root is asserted.
export function transitionE7NorthToSouth(base,fiber=0){
 const z=pair(base),p=pair(fiber);
 if(!finite(z)||!finite(p)||(z[0]===0&&z[1]===0))throw new Error('E7 chart transition requires finite nonzero base and finite fiber');
 const w=inv(z),r=Math.hypot(w[0],w[1]),a=Math.atan2(w[1],w[0]);
 const s=[Math.pow(r,-.75)*Math.cos(-.75*a),Math.pow(r,-.75)*Math.sin(-.75*a)];
 const diag=[[1,0],w,w,w].map(v=>mul(s,v));
 const diagonal=ds=>ds.map((d,i)=>ds.map((_,j)=>i===j?d:[0,0]));
 const group=ds=>({center:diagonal(ds),branches:[ [1,2,3].map(k=>diagonal(ds.slice(0,k))),[1,2,3].map(k=>diagonal(ds.slice().reverse().slice(0,k))),[diagonal(ds.slice(0,2))]]});
 const gauge=group(diag),inverse=group(diag.map(inv));
 return {base:w,fiber:neg(mul(p,mul(z,z))),gauge,inverse};
}
