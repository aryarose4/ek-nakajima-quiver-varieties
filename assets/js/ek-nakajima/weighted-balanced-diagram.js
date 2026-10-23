// Global, stateless schematic of the balanced partial flags.
// Bounded trace contractions replace a projective camera: there is no ordered
// eigenframe, phase choice, affine division, or normalized screen direction.
// Incidences are fitted continuously; exact complex classifications use hue.
// This projection is deliberately not a complete invariant or an affine chart.
import {matMul,matTrace,matAdd,matSub,matScale,eyeZ,cAdd,cSub,cMul,cScale} from './core-math.js';
import {balancedObservables} from './balanced-observables.js';
import {incidenceColors} from './balanced-diagram.js';

const abs=z=>Math.hypot(...z),norm=v=>Math.hypot(...v.map(abs));
const cross=(u,v)=>[0,1,2].map(i=>cSub(cMul(u[(i+1)%3],v[(i+2)%3]),cMul(u[(i+2)%3],v[(i+1)%3])));
const unit=v=>v.map(z=>cScale(z,1/norm(v)));
const sum=ms=>ms.reduce(matAdd),tr=A=>matTrace(A)[0];
const pair=(A,B)=>matTrace(matMul(A,B));
const present=w=>w>1e-24;
const opacity=w=>Math.min(1,Math.max(0,w)/.15);
const normalized=(A,w)=>present(w)?matScale(A,1/w):matScale(A,0);
const bounded=A=>matScale(A,1/(1+Math.hypot(...A.flat().map(abs))));

export function balancedTensorDiagram(rep) {
  const observables=balancedObservables(rep),bs=observables.branches;
  const pointWeights=bs.map(b=>tr(b.J)),lineWeights=bs.map(b=>b.planeWeight);
  const pointPresent=pointWeights.map(present),linePresent=lineWeights.map(present);
  const pointOpacities=pointWeights.map(opacity),lineOpacities=lineWeights.map(opacity);
  // These central Hermitian tensors transform by conjugation. Fixed scalar
  // coefficients select a projection, not a reference flag or a spectral axis.
  const h=bs.map(b=>bounded(b.H)),j=bs.map(b=>bounded(b.J));
  const X=matScale(matSub(h[0],h[1]),1.5);
  const Y=matScale(matSub(matAdd(h[0],h[1]),matScale(h[2],2)),Math.sqrt(3)/2);
  const D=sum(h.map((H,i)=>matScale(H,[1,2,-3][i])));
  // A complex reference records the signed phase of each intrinsic K block.
  // No division by a reference correlation: a zero simply has zero contrast.
  const C=matAdd(sum(j.map((J,i)=>matScale(J,[1,2,4][i]))),matScale(Y,[0,1]));
  const project=P=>[.65*Math.tanh(pair(P,X)[0]),.65*Math.tanh(pair(P,Y)[0])];
  const E=bs.map((b,i)=>{
    const P=normalized(b.J,pointWeights[i]),N=normalized(b.plane,lineWeights[i]);
    return [P,matSub(matSub(eyeZ(3),P),N),N];
  });
  const ps=rep.A.map((A,i)=>matMul(A,rep.a[i]).map(row=>row[0]));
  const ns=rep.A.map(A=>cross(A.map(row=>row[0]),A.map(row=>row[1])));
  const zero=()=>[[0,0],[0,0],[0,0]];
  const hp=ps.map((p,i)=>pointPresent[i]?unit(p):zero());
  const hn=ns.map((n,i)=>linePresent[i]?unit(n):zero());
  const pairing=(p,n)=>abs(p.reduce((s,z,k)=>cAdd(s,cMul(z,n[k])),[0,0]));
  const matrix=f=>[0,1,2].map(i=>[0,1,2].map(k=>f(i,k)));
  const tolerance=1e-8;
  const residuals=matrix((i,k)=>pointPresent[i]&&linePresent[k]?pairing(hp[i],hn[k]):null);
  const data={valid:true,numerical:true,tolerance,pointPresent,linePresent,points:hp,dualLines:hn,residuals,
    incident:matrix((i,k)=>residuals[i][k]!==null&&residuals[i][k]<=tolerance),
    pointEqual:matrix((i,k)=>pointPresent[i]&&pointPresent[k]&&norm(cross(hp[i],hp[k]))<=tolerance),
    lineEqual:matrix((i,k)=>linePresent[i]&&linePresent[k]&&norm(cross(hn[i],hn[k]))<=tolerance),
    collinear:pointPresent.every(Boolean)&&pairing(hp[0],cross(hp[1],hp[2]))<=tolerance,
    concurrent:linePresent.every(Boolean)&&pairing(hn[0],cross(hn[1],hn[2]))<=tolerance};
  // Symmetric, strictly convex incidence fit: equal source objects have
  // identical targets and constraints at full visibility, hence identical
  // fitted geometry. Agreement penalties also align unequal visible weights.
  const normals=E.map(e=>{const a=Math.PI*Math.tanh(pair(e[2],D)[0]);return [Math.cos(a),Math.sin(a)];});
  const targets=E.flatMap((e,i)=>project(e[0]).map(v=>pointOpacities[i]*v));
  targets.push(...E.map((e,i)=>.35*lineOpacities[i]*Math.tanh(pair(e[2],matAdd(X,Y))[0])));
  targets.push(0,0,0);
  const psum=sum(E.map(e=>e[0])),psum2=matMul(psum,psum),pt=tr(psum);
  const carrier=bounded(matAdd(matSub(psum2,matScale(psum,pt)),matScale(eyeZ(3),.5*(pt*pt-tr(psum2)))));
  const ca=Math.PI*Math.tanh(pair(carrier,D)[0]),cn=[Math.cos(ca),Math.sin(ca)];
  const cweight=incidenceWeight(pairing(hn[0],cross(hn[1],hn[2])))*Math.pow(lineOpacities.reduce((a,b)=>a*b,1),2);
  const pweight=incidenceWeight(pairing(hp[0],cross(hp[1],hp[2])))*Math.pow(pointOpacities.reduce((a,b)=>a*b,1),2);
  const fit=fitIncidences(targets,normals,residuals,pointOpacities,lineOpacities,cn,cweight,pweight,E);
  // Common smooth scale preserves incidence and guarantees line anchors lie
  // strictly inside the clipping square. There is no viewport-fit switch.
  const scale=.8/Math.sqrt(1+fit.reduce((s,v)=>s+v*v,0));
  const points=[0,1,2].map(i=>[scale*fit[2*i],scale*fit[2*i+1]]);
  const offsets=fit.slice(6,9).map(v=>scale*v);
  const phaseVectors=observables.cyclic.map(z=>cScale(z,1/Math.hypot(...z,1)));
  const colors=incidenceColors({...data,residuals:residuals.map(row=>row.map(r=>r===null?1:r))},phaseVectors);
  colors.pointStrengths=colors.pointStrengths.map((s,i)=>s*[0,1,2].filter(k=>k!==i).reduce((p,k)=>p*lineOpacities[k],1));
  const lines=[],glyphs=[],cotangentTargets=[];
  for(let i=0;i<3;i++) {
    const e=E[i],weight=pointOpacities[i];
    const normal=normals[i],tangent=[-normal[1],normal[0]];
    const anchor=normal.map(v=>-offsets[i]*v);
    lines.push(clipLine(anchor,tangent));
    if(!pointPresent[i]||!linePresent[i]){glyphs.push(null);cotangentTargets.push(null);continue;}
    const pairs=[[0,1],[0,2],[1,2]];
    const magnitudes=[];
    const coefficients=pairs.map(([a,b])=>{
      const block=matMul(matMul(e[a],bs[i].K),e[b]);
      const visibility=pointOpacities[i]*lineOpacities[i];
      magnitudes.push(visibility*Math.hypot(...block.flat().map(abs)));
      return cScale(pair(block,C),visibility);
    });
    glyphs.push({coefficients,phaseCorrelations:coefficients,magnitudes,projectors:e,reference:C,kind:'intrinsic-block-contractions'});
    // The orthogonal flag direction supplies a bounded displacement along the
    // same plane segment. It remains present and continuous at target crossings.
    const other=project(e[1]);
    const displacement=.3*Math.tanh(other.reduce((s,v,k)=>s+(v-anchor[k])*tangent[k],0));
    cotangentTargets.push({point:anchor.map((v,k)=>v+weight*displacement*tangent[k]),atInfinity:false,clipped:false});
  }
  return {valid:true,observables,data,glyphs,operators:bs.map(b=>b.K),source:'balanced-weighted-tensors',
    diagnostics:{camera:'bounded-invariant-incidence-fit',global:true,incidenceResiduals:matrix((i,k)=>normals[k][0]*points[i][0]+normals[k][1]*points[i][1]+offsets[k])},
    layout:{valid:true,points,rawPoints:points,lines,pointMarkers:points.map(point=>({point,clipped:false,atInfinity:false,direction:[1,0]})),
      pointOpacities,lineOpacities,pointWeights,lineWeights,incidenceColors:colors,phaseVectors,
      pointPhaseVectors:[[0,0],[0,0],[0,0]],cameraDefects:[],cotangentTargets,
      transversal:clipLine(cn.map(v=>-scale*fit[11]*v),[-cn[1],cn[0]]),concurrencyPoint:fit.slice(9,11).map(v=>scale*v),
      transversalOpacity:pweight,concurrencyOpacity:cweight,
      reconstruction:{chart:'Continuous balanced tensor schematic; cross-incidence uses hue'}}};
}
export const experimentalBalancedDiagram=balancedTensorDiagram;

// Finite smooth weights, never Boolean incidence tests. True incidence has a
// large finite penalty, so the schematic is visually aligned, not an exact
// embedding of complex projective geometry in the Euclidean screen.
const incidenceWeight=r=>1/(1+Math.pow(r/.01,8));
function fitIncidences(targets,normals,residuals,pw,lw,cn,cw,pcw,projectors) {
  const n=targets.length,M=targets.map((_,i)=>targets.map((__,j)=>i===j?1:0));
  function constraint(indices,v,w) {
    w*=1e6;
    for(let a=0;a<indices.length;a++)for(let b=0;b<indices.length;b++)M[indices[a]][indices[b]]+=w*v[a]*v[b];
  }
  for(let i=0;i<3;i++)for(let j=0;j<3;j++) {
    const r=residuals[i][j];
    if(r!==null)constraint([2*i,2*i+1,6+j],normals[j].concat(1),Math.pow(pw[i]*lw[j],2)*incidenceWeight(r));
  }
  for(let i=0;i<3;i++) {
    constraint([9,10,6+i],normals[i].concat(1),cw);
    constraint([2*i,2*i+1,11],cn.concat(1),pcw);
  }
  // Equal objects at unequal visibility need explicit agreement terms: the
  // visibility-weighted priors alone are not permutation-symmetric then.
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++) {
    const pd=Math.hypot(...matSub(projectors[i][0],projectors[j][0]).flat().map(abs));
    const nd=Math.hypot(...matSub(projectors[i][2],projectors[j][2]).flat().map(abs));
    const wp=Math.pow(pw[i]*pw[j],2)*incidenceWeight(pd);
    const wn=Math.pow(lw[i]*lw[j],2)*incidenceWeight(nd);
    constraint([2*i,2*j],[1,-1],wp);
    constraint([2*i+1,2*j+1],[1,-1],wp);
    constraint([6+i,6+j],[1,-1],wn);
  }
  // The identity term keeps the Cholesky factor nonsingular at every stratum.
  const L=M.map(row=>row.map(()=>0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++) {
    let v=M[i][j];for(let k=0;k<j;k++)v-=L[i][k]*L[j][k];
    L[i][j]=i===j?Math.sqrt(v):v/L[j][j];
  }
  const y=[],x=Array(n).fill(0);
  for(let i=0;i<n;i++){let v=targets[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];y.push(v/L[i][i]);}
  for(let i=n-1;i>=0;i--){let v=y[i];for(let j=i+1;j<n;j++)v-=L[j][i]*x[j];x[i]=v/L[i][i];}
  return x;
}
function clipLine(anchor,direction) {
  let lo=-Infinity,hi=Infinity;
  for(let k=0;k<2;k++)if(Math.abs(direction[k])>1e-15) {
    const a=(-.9-anchor[k])/direction[k],b=(.9-anchor[k])/direction[k];
    lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
  }
  return [lo,hi].map(t=>anchor.map((v,k)=>v+t*direction[k]));
}
