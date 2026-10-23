// Experimental partial-flag picture. One fixed tensor camera for every input,
// never a beta-dependent reference switch. This is NOT a complete invariant.
// Real flags retain affine incidence. Complex flags use projected normals and
// a marked-point anchor; their cross-incidences are encoded by hue, not claimed
// as literal Euclidean incidences. The eigenframe can have genuine defects.
import { matMul,matAdj,matTrace,matAdd,matSub,matScale,eyeZ,cAdd,cSub,cMul,cConj,cScale } from './core-math.js';
import { eigvalsHermitian3 } from './element-view.js';
import { balancedObservables } from './balanced-observables.js';
import { incidenceColors } from './balanced-diagram.js';

const abs=z=>Math.hypot(...z), norm=v=>Math.hypot(...v.map(abs));
const inner=(u,v)=>u.reduce((s,z,i)=>cAdd(s,cMul(cConj(z),v[i])),[0,0]);
const unit=v=>v.map(z=>cScale(z,1/norm(v)));
const cross=(u,v)=>[0,1,2].map(i=>cSub(cMul(u[(i+1)%3],v[(i+2)%3]),cMul(u[(i+2)%3],v[(i+1)%3])));
const divide=(a,b)=>cScale(cMul(a,cConj(b)),1/abs(b)**2);
const sum=matrices=>matrices.reduce(matAdd);
const coordinates=(frame,v)=>frame.map(e=>inner(e,v));
const apply=(A,v)=>A.map(row=>row.reduce((s,z,j)=>cAdd(s,cMul(z,v[j])),[0,0]));
const LIMIT=.9,SCALE=.65;
function clip(anchor,direction) {
  let lo=-Infinity,hi=Infinity;
  for(let j=0;j<2;j++) {
    if(Math.abs(direction[j])<1e-14) {if(Math.abs(anchor[j])>LIMIT)return null;}
    else {const a=(-LIMIT-anchor[j])/direction[j],b=(LIMIT-anchor[j])/direction[j];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
  }
  return lo<=hi&&Number.isFinite(lo)&&Number.isFinite(hi)?[lo,hi].map(t=>anchor.map((x,j)=>x+t*direction[j])):null;
}

export function experimentalBalancedDiagram(rep) {
  const observables=balancedObservables(rep),bs=observables.branches;
  const H=sum(bs.map((b,i)=>matScale(b.H,[1,2,4][i])));
  const T=sum(bs.map((b,i)=>matAdd(matScale(b.J,[3,1,2][i]),
    matAdd(matScale(matAdd(b.K,matAdj(b.K)),[1,3,2][i]),
      matScale(matSub(b.K,matAdj(b.K)),[0,[2,1,3][i]])))));
  const eigenvalues=eigvalsHermitian3(H),size=Math.max(1,...eigenvalues.map(Math.abs));
  const gap=Math.min(eigenvalues[0]-eigenvalues[1],eigenvalues[1]-eigenvalues[2]);
  if(gap<1e-8*size)return {valid:false,reason:'Tensor camera has a repeated eigenvalue.',cameraDefects:[{kind:'eigenvalue-gap'}]};
  // Polynomial spectral projectors determine each axis up to phase. Choosing
  // a largest column only computes that axis; the following phase correlations
  // remove this arbitrary coordinate-dependent column choice.
  const frame=eigenvalues.map((value,i)=>{
    const others=[0,1,2].filter(j=>j!==i);
    const P=matScale(matMul(...others.map(j=>matSub(H,matScale(eyeZ(3),eigenvalues[j])))),
      1/others.reduce((p,j)=>p*(value-eigenvalues[j]),1));
    const columns=[0,1,2].map(j=>P.map(row=>row[j]));
    return unit(columns.reduce((a,b)=>norm(a)>norm(b)?a:b));
  });
  const anchors=[inner(frame[0],apply(T,frame[1])),inner(frame[1],apply(T,frame[2]))];
  const tSize=Math.max(1,Math.abs(matTrace(T)[0]));
  if(anchors.some(z=>abs(z)<1e-9*tSize))return {valid:false,reason:'Tensor camera phase correlation vanishes.',cameraDefects:[{kind:'phase-anchor'}]};
  const phases=[[1,0],cScale(cConj(anchors[0]),1/abs(anchors[0]))];
  phases.push(cMul(phases[1],cScale(cConj(anchors[1]),1/abs(anchors[1]))));
  frame.forEach((v,i)=>{frame[i]=v.map(z=>cMul(z,phases[i]));});
  // Contrast cutoffs are fixed display units, not beta/rank classifications.
  // Full strength above cutoff retains the ordinary default appearance.
  const pointWeights=bs.map(b=>matTrace(b.J)[0]);
  const lineWeights=bs.map(b=>b.planeWeight);
  const pointOpacities=pointWeights.map(w=>Math.min(1,Math.max(0,w)/.15));
  const lineOpacities=lineWeights.map(w=>Math.min(1,Math.max(0,w)/.15));
  const ps=rep.A.map((A,i)=>matMul(A,rep.a[i]).map(row=>row[0]));
  const ns=rep.A.map(A=>cross(A.map(row=>row[0]),A.map(row=>row[1])));
  const data={valid:true,tolerance:1e-8,residuals:ps.map(p=>ns.map(n=>norm(p)>0&&norm(n)>0?
    abs(n.reduce((s,z,j)=>cAdd(s,cMul(z,p[j])),[0,0]))/(norm(n)*norm(p)):0))};
  const points=[],rawPoints=[],lines=[],pointMarkers=[],cameraDefects=[],phaseVectors=[];
  for(let i=0;i<3;i++) {
    const p=norm(ps[i])>0?coordinates(frame,unit(ps[i])):null;
    const n=norm(ns[i])>0?coordinates(frame,unit(ns[i]).map(cConj)).map(cConj):null;
    let point=[0,0],atInfinity=false;
    if(p) {
      const W=p.reduce(cAdd,[0,0]);
      atInfinity=abs(W)<1e-9;
      if(atInfinity)cameraDefects.push({kind:'affine-infinity',flag:i});
      else point=p.slice(0,2).map(z=>SCALE*divide(z,W)[0]);
    }
    const extent=Math.max(1,...point.map(x=>Math.abs(x)/LIMIT));
    const marker=point.map(x=>x/extent);
    rawPoints.push(point);points.push(marker);pointMarkers.push({point:marker,clipped:extent>1||atInfinity,atInfinity,direction:unitReal(point)});
    let segment=[[0,0],[0,0]];
    if(n) {
      const a=cSub(n[0],n[2]),b=cSub(n[1],n[2]);
      const square=cAdd(cMul(a,a),cMul(b,b)),angle=.5*Math.atan2(square[1],square[0]);
      const rotate=[Math.cos(angle),-Math.sin(angle)];
      let normal=[cMul(a,rotate)[0],cMul(b,rotate)[0]];
      const length=Math.hypot(...normal);
      if(length<1e-12||abs(square)<1e-10*(abs(a)**2+abs(b)**2))cameraDefects.push({kind:'isotropic-projected-normal',flag:i});
      if(length>1e-12) {
        normal=normal.map(x=>x/length);
        const offset=SCALE*cMul(n[2],rotate)[0]/length;
        // A point with vanishing weight stops steering its surviving plane.
        // A disappearing plane never changes its surviving marked point.
        const residual=normal[0]*point[0]+normal[1]*point[1]+offset;
        // Uniformly remove point steering at point loss, even if its affine
        // coordinate simultaneously escapes to infinity. At full visibility
        // this equals the ordinary marked-point anchor; at true real incidence
        // the correction is zero for every weight.
        const opacity=pointOpacities[i];
        const correction=opacity*residual/(1+(1-opacity)*Math.abs(residual));
        const anchor=normal.map(x=>x*(-offset+correction));
        segment=clip(anchor,[normal[1],-normal[0]]);
        if(!segment){cameraDefects.push({kind:'line-outside-camera',flag:i});segment=[[0,0],[0,0]];}
      }
    }
    lines.push(segment);
    // Signed complex polynomial trace, compressed without phase normalization.
    const z=observables.cyclic[i];
    phaseVectors.push(cScale(z,1/Math.hypot(...z,1)));
  }
  const colors=incidenceColors(data,phaseVectors);
  colors.pointStrengths=colors.pointStrengths.map((s,i)=>s*[0,1,2].filter(j=>j!==i).reduce((p,j)=>p*lineOpacities[j],1));
  return {valid:true,frame,observables,data,glyphs:[],operators:bs.map(b=>b.K),source:'experimental-weighted-tensors',
    diagnostics:{eigenvalues,eigenvalueGap:gap,phaseAnchorMagnitudes:anchors.map(abs)},
    layout:{valid:true,points,rawPoints,lines,pointMarkers,pointOpacities,lineOpacities,pointWeights,lineWeights,
      incidenceColors:colors,phaseVectors,pointPhaseVectors:[[0,0],[0,0],[0,0]],cameraDefects,
      cotangentTargets:[null,null,null],transversal:null,concurrencyPoint:null,
      reconstruction:{chart:'Experimental fixed tensor eigenframe; partial flags',camera:frame}}};
}
function unitReal(v){const n=Math.hypot(...v);return n>0?v.map(x=>x/n):[1,0];}
