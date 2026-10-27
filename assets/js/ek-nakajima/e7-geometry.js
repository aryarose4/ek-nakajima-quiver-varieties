// Projective C4 flags in an affine tetrahedron frame. For complex flags the
// displayed real-coefficient slice is not a faithful projection of CP1/CP2.
import {matMul,cAdd,cSub,cMul,cConj,cScale,cAbs2} from './core-math.js';
import {validateE7Rep} from './e7-core.js';
const sum=v=>v.reduce(cAdd,[0,0]);
const norm=v=>Math.sqrt(v.reduce((s,z)=>s+cAbs2(z),0));
const inner=(u,v)=>u.reduce((s,z,i)=>cAdd(s,cMul(cConj(z),v[i])),[0,0]);
const sub=(u,v)=>u.map((z,i)=>cSub(z,v[i]));
const scale=(v,a)=>v.map(z=>cScale(z,a));
const dot=(u,v)=>u.reduce((s,x,i)=>s+x*v[i],0);
const length=v=>Math.hypot(...v);
const plus=(u,v,a=1)=>u.map((x,i)=>x+a*v[i]);
const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
const spatial=v=>[cSub(cAdd(v[0],v[1]),cAdd(v[2],v[3])),cSub(cAdd(v[0],v[2]),cAdd(v[1],v[3])),cSub(cAdd(v[0],v[3]),cAdd(v[1],v[2]))];
const project=v=>spatial(v).map(z=>z[0]);
function orthonormalColumns(M){
 const basis=[];
 for(let k=0;k<M[0].length;k++){
  let v=M.map(row=>row[k]);const original=norm(v);
  // Reorthogonalize to protect nested-image tests for ill-conditioned gauges.
  for(let pass=0;pass<2;pass++)for(const q of basis)v=sub(v,scale(q,inner(q,v)));
  const n=norm(v);if(!(n>1e-11*Math.max(1,original)))throw new Error('Rank-deficient E7 central image');
  basis.push(scale(v,1/n));
 }
 return basis;
}
export function complexMembershipNorm(v,basis){let r=v;for(const q of basis)r=sub(r,scale(q,inner(q,r)));return norm(r);}
// Numerical complex rank, with pivoted twice-reorthogonalized columns. Inputs
// below are orthonormal image bases; dimensions are invariant under GL gauges.
export function complexIntersectionDimension(U,V,tolerance=1e-9){
 const pending=U.concat(V).map(v=>v.map(z=>z.slice())),basis=[];
 while(pending.length){
  let bestIndex=0,bestNorm=-1;
  pending.forEach((v,i)=>{const n=norm(v);if(n>bestNorm){bestIndex=i;bestNorm=n;}});
  if(bestNorm<=tolerance)break;
  const q=scale(pending.splice(bestIndex,1)[0],1/bestNorm);basis.push(q);
  for(let i=0;i<pending.length;i++)for(let pass=0;pass<2;pass++)pending[i]=sub(pending[i],scale(q,inner(q,pending[i])));
 }
 return U.length+V.length-basis.length;
}
export function clipE7Line(anchor,direction,bound){
 let lo=-Infinity,hi=Infinity;
 for(let i=0;i<3;i++){
  if(Math.abs(direction[i])<1e-12){if(Math.abs(anchor[i])>bound)return null;continue;}
  const a=(-bound-anchor[i])/direction[i],b=(bound-anchor[i])/direction[i];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
 }
 return lo<=hi&&Number.isFinite(lo)&&Number.isFinite(hi)?[plus(anchor,direction,lo),plus(anchor,direction,hi)]:null;
}
function clipPlane(anchor,u,v,bound){
 const normal=cross(u,v),n=length(normal);if(n<1e-10)return [];
 const target=dot(normal,anchor),points=[];
 const add=p=>{if(!points.some(q=>length(plus(p,q,-1))<1e-8))points.push(p);};
 for(let axis=0;axis<3;axis++)for(const a of [-bound,bound])for(const b of [-bound,bound]){
  const others=[0,1,2].filter(i=>i!==axis),p=[0,0,0];p[others[0]]=a;p[others[1]]=b;
  if(Math.abs(normal[axis])>1e-12){p[axis]=(target-dot(normal,p))/normal[axis];if(Math.abs(p[axis])<=bound+1e-9)add(p);}
  else if(Math.abs(target-dot(normal,p))<1e-9){p[axis]=-bound;add(p.slice());p[axis]=bound;add(p.slice());}
 }
 if(points.length<3)return [];
 const center=points.reduce((s,p)=>plus(s,p),[0,0,0]).map(x=>x/points.length);
 return points.sort((a,b)=>Math.atan2(dot(plus(a,center,-1),v),dot(plus(a,center,-1),u))-Math.atan2(dot(plus(b,center,-1),v),dot(plus(b,center,-1),u)));
}
export function e7FlagGeometry(rep,options={}){
 const errors=validateE7Rep(rep);if(errors.length)throw new Error(errors.join('; '));
 const bound=options.bound===undefined?6:options.bound;if(!(bound>0)||!Number.isFinite(bound))throw new Error('Positive finite display bound required');
 const isReal=rep.x.every(arm=>arm.every(M=>M.every(row=>row.every(z=>Math.abs(z[1])<1e-10))));
 const flags=rep.x.map((arm,b)=>{
  const images=[];let product=arm[arm.length-1];images.unshift(product);
  for(let k=arm.length-2;k>=0;k--){product=matMul(product,arm[k]);images.unshift(product);}
  const bases=images.map(orthonormalColumns),dimensions=bases.map(B=>B.length),largest=bases[bases.length-1];
  let anchorVector=bases[0][0];
  // A short line has no marked point: choose its best-conditioned affine anchor.
  if(b===2)anchorVector=largest.reduce((a,v)=>cAbs2(sum(v))>cAbs2(sum(a))?v:a,largest[0]);
  const h=sum(anchorVector),flag={name:['Flag A','Flag B','Short Line'][b],dimensions,bases,anchorComplex:null,directionsComplex:[],point:null,line:null,plane:null,status:'finite',incidenceNorm:0};
  if(Math.sqrt(cAbs2(h))<1e-9){flag.status='at infinity';return flag;}
  const anchor=scale(anchorVector,[h[0]/cAbs2(h),-h[1]/cAbs2(h)]);flag.anchorComplex=anchor;
  const point=project(anchor);if(length(point)>1e6){flag.status='near infinity';return flag;}
  flag.point=point;
  const directions=[],realDirections=[];
  // Build each direction in its nested image. Real phase and Gram-Schmidt
  // changes preserve membership and the already constructed nested slice.
  const stages=b===2?[largest]:bases.slice(1);
  for(const B of stages){
   let selected=null,best=0;
   for(const q of B){
    let d=sub(q,scale(anchor,sum(q)));
    const xyz=spatial(d);let pivot=0;for(let i=1;i<3;i++)if(cAbs2(xyz[i])>cAbs2(xyz[pivot]))pivot=i;
    const a=xyz[pivot],an=Math.sqrt(cAbs2(a));if(an<1e-12)continue;
    d=scale(d,[a[0]/an,-a[1]/an]);let r=project(d);
    realDirections.forEach((u,i)=>{const coefficient=dot(r,u);r=plus(r,u,-coefficient);d=sub(d,scale(directions[i],coefficient));});
    const n=length(r);if(n>best){best=n;selected={d:scale(d,1/n),r:r.map(x=>x/n)};}
   }
   if(!selected||best<1e-10){flag.status='degenerate selected slice';break;}
   directions.push(selected.d);realDirections.push(selected.r);
  }
  flag.directionsComplex=directions;
  const checks=[complexMembershipNorm(anchor,bases[0])];
  directions.forEach((d,k)=>checks.push(complexMembershipNorm(d,b===2?largest:bases[k+1])));
  flag.incidenceNorm=Math.max(...checks);
  if(realDirections[0])flag.line=clipE7Line(point,realDirections[0],bound);
  if(realDirections[1])flag.plane=clipPlane(point,realDirections[0],realDirections[1],bound);
  if(point.some(x=>Math.abs(x)>bound)&&flag.status==='finite')flag.status='anchor outside display box';
  return flag;
 });
 const W=flags[2].bases[0];
 const intersections=[
  {label:'W ∩ H_A',dimension:complexIntersectionDimension(W,flags[0].bases[2])},
  {label:'W ∩ H_B',dimension:complexIntersectionDimension(W,flags[1].bases[2])},
  {label:'W ∩ P_A',dimension:complexIntersectionDimension(W,flags[0].bases[1])},
  {label:'W ∩ P_B',dimension:complexIntersectionDimension(W,flags[1].bases[1])}
 ];
 return {flags,isReal,bound,intersections,maxIncidenceNorm:Math.max(...flags.map(f=>f.incidenceNorm))};
}

