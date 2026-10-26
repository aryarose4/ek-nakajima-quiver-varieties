// Camera and line/dot positioning restored from e8abe7e (one-crossing era).
// Current intrinsic y glyphs, signed hue cues, and chamber solvers are retained.
// Weighted partial-flag picture. One fixed tensor camera for every input,
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
// Rank-one image incidences in C^3, independent of the tensor camera.
// A plane containing the entire operator image is a projective incidence;
// the operator's own plane and equal copies do not define new events.
export function cotangentImageIncidences(rep, tolerance=1e-8) {
  const points=rep.A.map((A,i)=>matMul(A,rep.a[i]).map(row=>row[0]));
  const normals=rep.A.map(A=>cross(A.map(row=>row[0]),A.map(row=>row[1])));
  return rep.A.map((A,i)=>{
    const K=matMul(A,rep.B[i]),columns=[0,1,2].map(j=>K.map(row=>row[j]));
    const lengths=columns.map(norm),size=Math.hypot(...lengths);
    if(size<=1e-12)return null;
    const q=unit(columns[lengths.indexOf(Math.max(...lengths))]);
    if(columns.some(v=>norm(cross(q,v))>tolerance*size))return null;
    return {points:points.map(p=>norm(p)>1e-12&&norm(cross(q,unit(p)))<=tolerance),
      planes:normals.map((n,j)=>j!==i&&norm(n)>1e-12&&norm(normals[i])>1e-12&&
        norm(cross(unit(n),unit(normals[i])))>tolerance&&
        abs(n.reduce((s,z,k)=>cAdd(s,cMul(z,q[k])),[0,0]))<=tolerance*norm(n))};
  });
}
// The camera's common phase cancels between the two normalized projections.
// Confidence is a smooth display regularizer, never a mathematical rank test.
export function projectedBlockPhases(E,K,seed) {
  const u=E.map(P=>apply(P,seed)),lengths=u.map(norm);
  const phaseConfidence=[];
  const coefficients=[[0,1],[0,2],[1,2]].map(([a,b])=>{
    const product=lengths[a]*lengths[b];
    phaseConfidence.push(product/Math.hypot(product,.001));
    return product>0?cScale(inner(u[a],apply(K,u[b])),1/product):[0,0];
  });
  return {coefficients,phaseConfidence};
}
// One fixed affine scale keeps the default comparison's surviving points in
// view. It is never fitted to the current flags or their visibility weights.
const LIMIT=.9,SCALE=.085;
// Positive rank-one matrices represent points without choosing vector phases.
// Marked points and cotangent images share this affine camera and clipping.
export function projectTensorPoint(S,frame) {
  const weight=matTrace(S)[0];
  if(!(weight>0))return null;
  // Any nonzero column factors a rank-one projector. Its arbitrary phase
  // cancels in p_j / sum(p), so no eigenvector phase convention is needed.
  // Factor before dividing to avoid cancellation in the quadratic denominator near infinity.
  const columns=[0,1,2].map(j=>S.map(row=>row[j]));
  const column=columns.reduce((a,b)=>norm(a)>norm(b)?a:b);
  const p=coordinates(frame,unit(column)),W=p.reduce(cAdd,[0,0]);
  if(abs(W)<1e-9)return {point:null,rawPoint:null,atInfinity:true,clipped:true,undefined:true};
  const rawPoint=p.slice(0,2).map(z=>SCALE*divide(z,W)[0]);
  const extent=Math.max(1,...rawPoint.map(x=>Math.abs(x)/LIMIT));
  return {point:rawPoint.map(x=>x/extent),rawPoint,atInfinity:false,clipped:extent>1,direction:unitReal(rawPoint)};
}
function clip(anchor,direction) {
  let lo=-Infinity,hi=Infinity;
  for(let j=0;j<2;j++) {
    if(Math.abs(direction[j])<1e-14) {if(Math.abs(anchor[j])>LIMIT)return null;}
    else {const a=(-LIMIT-anchor[j])/direction[j],b=(LIMIT-anchor[j])/direction[j];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
  }
  return lo<=hi&&Number.isFinite(lo)&&Number.isFinite(hi)?[lo,hi].map(t=>anchor.map((x,j)=>x+t*direction[j])):null;
}

export function balancedTensorDiagram(rep) {
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
  // A fixed polynomial includes two-step correlations. Direct correlations
  // vanish at regular tips even though the tensor coupling graph is connected.
  // Each summand has the same phase covariance; there is no endpoint switch.
  const tSize=Math.max(1,Math.hypot(...T.flat().map(abs)));
  const phaseTensor=matAdd(T,matScale(matMul(T,T),.1/tSize));
  // Synchronize all eigenaxis phases through one spectral correlation tensor.
  // Its H-diagonal is removed: a large uncoupled diagonal entry must not
  // dominate phase selection. A prescribed chain of two correlations fails
  // when its middle axis decouples while the outer two remain coupled.
  // The leading projector uses every edge, with no chamber or edge switch.
  const correlation=matSub(phaseTensor,sum(frame.map(v=>matScale(v.map(x=>v.map(y=>cMul(x,cConj(y)))),inner(v,apply(phaseTensor,v))))));
  const tv=eigvalsHermitian3(correlation);
  const phaseGap=tv[0]-tv[1];
  if(phaseGap<1e-11*tSize)return {valid:false,reason:'Tensor phase synchronizer has a repeated leading eigenvalue.',cameraDefects:[{kind:'phase-eigenvalue-gap'}]};
  const Q=matScale(matMul(matSub(correlation,matScale(eyeZ(3),tv[1])),matSub(correlation,matScale(eyeZ(3),tv[2]))),1/((tv[0]-tv[1])*(tv[0]-tv[2])));
  const cols=[0,1,2].map(j=>Q.map(row=>row[j]));
  const q=unit(cols.reduce((a,b)=>norm(a)>norm(b)?a:b));
  const anchors=frame.map(v=>inner(v,q));
  if(anchors.some(z=>abs(z)<1e-12))return {valid:false,reason:'Tensor camera phase correlation vanishes.',cameraDefects:[{kind:'phase-anchor'}]};
  frame.forEach((v,i)=>{frame[i]=v.map(z=>cMul(z,cScale(anchors[i],1/abs(anchors[i]))));});
  // Contrast cutoffs are fixed display units, not beta/rank classifications.
  // Full strength above cutoff retains the ordinary default appearance.
  const pointWeights=bs.map(b=>matTrace(b.J)[0]);
  const lineWeights=bs.map(b=>b.planeWeight);
  const pointOpacities=pointWeights.map(w=>Math.min(1,Math.max(0,w)/.15));
  const lineOpacities=lineWeights.map(w=>Math.min(1,Math.max(0,w)/.15));
  const ps=rep.A.map((A,i)=>matMul(A,rep.a[i]).map(row=>row[0]));
  const ns=rep.A.map(A=>cross(A.map(row=>row[0]),A.map(row=>row[1])));
  const tolerance=1e-8;
  const pointPresent=pointWeights.map(w=>w>1e-24),linePresent=lineWeights.map(w=>w>1e-24);
  const zero=()=>[[0,0],[0,0],[0,0]];
  const homogeneousPoints=ps.map((p,i)=>pointPresent[i]?coordinates(frame,unit(p)):zero());
  const homogeneousLines=ns.map((n,i)=>linePresent[i]?coordinates(frame,unit(n).map(cConj)).map(cConj):zero());
  const pairing=(p,n)=>abs(p.reduce((s,z,j)=>cAdd(s,cMul(z,n[j])),[0,0]));
  const matrix=f=>[0,1,2].map(i=>[0,1,2].map(j=>f(i,j)));
  const residuals=matrix((i,j)=>pointPresent[i]&&linePresent[j]?pairing(homogeneousPoints[i],homogeneousLines[j]):null);
  const data={valid:true,numerical:true,tolerance,pointPresent,linePresent,points:homogeneousPoints,dualLines:homogeneousLines,residuals,
    incident:matrix((i,j)=>residuals[i][j]!==null&&residuals[i][j]<=tolerance),
    pointEqual:matrix((i,j)=>pointPresent[i]&&pointPresent[j]&&norm(cross(homogeneousPoints[i],homogeneousPoints[j]))<=tolerance),
    lineEqual:matrix((i,j)=>linePresent[i]&&linePresent[j]&&norm(cross(homogeneousLines[i],homogeneousLines[j]))<=tolerance),
    collinear:pointPresent.every(Boolean)&&pairing(homogeneousPoints[0],cross(homogeneousPoints[1],homogeneousPoints[2]))<=tolerance,
    concurrent:linePresent.every(Boolean)&&pairing(homogeneousLines[0],cross(homogeneousLines[1],homogeneousLines[2]))<=tolerance};
  data.cotangentIncidences=cotangentImageIncidences(rep);
  const operators=bs.map(b=>b.K);
  // The historical affine phase also orients each projected line.
  const affinePhase=v=>{const w=v.reduce(cAdd,[0,0]);return abs(w)>1e-10?v.map(z=>cMul(z,cScale(cConj(w),1/abs(w)))):v;};
  const bounded=A=>matScale(A,1/(1+Math.hypot(...A.flat().map(abs))));
  const hh=bs.map(b=>bounded(b.H)),jj=bs.map(b=>bounded(b.J));
  const Y=matScale(matSub(matAdd(hh[0],hh[1]),matScale(hh[2],2)),Math.sqrt(3)/2);
  const reference=matAdd(sum(jj.map((J,i)=>matScale(J,[1,2,4][i]))),matScale(Y,[0,1]));
  const phaseSeed=frame.reduce((v,f)=>v.map((z,j)=>cAdd(z,cScale(f[j],1/Math.sqrt(3)))) ,[[0,0],[0,0],[0,0]]);
  const glyphs=bs.map((b,i)=>{
    if(!pointPresent[i]||!linePresent[i])return null;
    const P=matScale(b.J,1/pointWeights[i]),N=matScale(b.plane,1/lineWeights[i]);
    const E=[P,matSub(matSub(eyeZ(3),P),N),N],magnitudes=[],visibility=pointOpacities[i]*lineOpacities[i];
    [[0,1],[0,2],[1,2]].forEach(([a,c])=>{
      const block=matMul(matMul(E[a],b.K),E[c]);magnitudes.push(visibility*Math.hypot(...block.flat().map(abs)));
    });
    const {coefficients,phaseConfidence}=projectedBlockPhases(E,b.K,phaseSeed);
    return {coefficients,phaseCorrelations:coefficients,phaseConfidence,magnitudes,projectors:E,reference,kind:'intrinsic-block-contractions'};
  });
  const points=[],rawPoints=[],lines=[],pointMarkers=[],cameraDefects=[],phaseVectors=[];
  for(let i=0;i<3;i++) {
    const p=norm(ps[i])>0?coordinates(frame,unit(ps[i])):null;
    const n=norm(ns[i])>0?coordinates(frame,unit(ns[i]).map(cConj)).map(cConj):null;
    const projection=p?projectTensorPoint(ps[i].map(x=>ps[i].map(y=>cMul(x,cConj(y)))),frame):null;
    const atInfinity=!!(projection&&projection.atInfinity);
    if(atInfinity)cameraDefects.push({kind:'affine-infinity',flag:i});
    const point=projection&&projection.rawPoint||[0,0];
    const marker=projection&&projection.point||[0,0];
    rawPoints.push(point);points.push(marker);pointMarkers.push(projection&&projection.point?projection:
      {point:marker,clipped:atInfinity,atInfinity,direction:unitReal(point)});
    let segment=[[0,0],[0,0]];
    if(n) {
      // The dual affine gauge gives an oriented real equation. Unlike the
      // square root of a quadratic normal, it has no hidden +/- branch cut.
      // It remains only a real projection of a complex plane; its genuine
      // chart/normal defects are exposed below.
      const dualSum=n.reduce(cAdd,[0,0]);
      const oriented=affinePhase(n);
      const a=cSub(oriented[0],oriented[2]),b=cSub(oriented[1],oriented[2]);
      let normal=[a[0],b[0]];
      const length=Math.hypot(...normal);
      if(abs(dualSum)<=1e-10)cameraDefects.push({kind:'dual-affine-phase',flag:i});
      if(length<1e-12)cameraDefects.push({kind:'oriented-projected-normal',flag:i});
      if(length>1e-12) {
        normal=normal.map(x=>x/length);
        const offset=SCALE*oriented[2][0]/length;
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
    // Keep the signed hue cue while restoring the e8abe7e camera geometry.
    phaseVectors.push(n?cScale(cMul(n[0],cConj(n[1])),2):[0,0]);
  }
  const colors=incidenceColors({...data,residuals:residuals.map(row=>row.map(r=>r===null?1:r))},phaseVectors);
  colors.pointStrengths=colors.pointStrengths.map((s,i)=>s*[0,1,2].filter(j=>j!==i).reduce((p,j)=>p*lineOpacities[j],1));
  const cotangentTargets=glyphs.map((g,i)=>{
    if(!g)return null;
    // q_i = [K_i e3], where e3 spans the plane's orthogonal complement.
    // This remains the intended point when K has rank two.
    const S=matMul(matMul(bs[i].K,g.projectors[2]),matAdj(bs[i].K));
    const size=Math.hypot(...bs[i].K.flat().map(abs));
    if(matTrace(S)[0]<=1e-24*Math.max(1,size*size))return null;
    const target=projectTensorPoint(S,frame);
    if(target&&target.atInfinity)cameraDefects.push({kind:'cotangent-affine-infinity',flag:i});
    return target;

  });
  // Guides indicate approximate screen incidence in a narrow, fixed collar.
  // Their opacity reaches one at exact incidence and zero at the collar edge;
  // the numerical mathematical classifications above are left unchanged.
  // Gating full-strength ink on a tolerance boolean made a guide pop at a tip.
  const equations=lines.map(([a,b])=>{
    const e=[b[1]-a[1],a[0]-b[0],b[0]*a[1]-a[0]*b[1]],n=Math.hypot(e[0],e[1]);
    return n>1e-12?e.map(v=>v/n):null;
  });
  const collar=(residual,width)=>{const u=residual/width;return u<1?(1-u*u)**2:0;};
  let concurrencyPoint=null,transversal=null,concurrencyOpacity=0,transversalOpacity=0;
  if(linePresent.every(Boolean)&&equations.every(Boolean)){
    // The least-squares intersection uses all lines without selecting a pair.
    const aa=equations.reduce((s,e)=>s+e[0]*e[0],0),ab=equations.reduce((s,e)=>s+e[0]*e[1],0),bb=equations.reduce((s,e)=>s+e[1]*e[1],0);
    const ac=equations.reduce((s,e)=>s+e[0]*e[2],0),bc=equations.reduce((s,e)=>s+e[1]*e[2],0),det=aa*bb-ab*ab;
    if(det>1e-12){
      const p=[(ab*bc-bb*ac)/det,(ab*ac-aa*bc)/det];
      const screen=Math.hypot(...equations.map(e=>e[0]*p[0]+e[1]*p[1]+e[2]));
      const complex=pairing(homogeneousLines[0],cross(homogeneousLines[1],homogeneousLines[2]));
      const edge=Math.max(0,...p.map(v=>Math.abs(v)-.85));
      concurrencyOpacity=collar(screen,.01)*collar(complex,.01)*collar(edge,.05)*collar(1e-8/det,1)*lineOpacities.reduce((a,b)=>a*b,1);
      if(concurrencyOpacity>0)concurrencyPoint=p;
    }
  }
  if(pointPresent.every(Boolean)){
    const center=[0,1].map(j=>rawPoints.reduce((s,p)=>s+p[j]/3,0));
    const deviations=rawPoints.map(p=>p.map((v,j)=>v-center[j]));
    const xx=deviations.reduce((s,p)=>s+p[0]*p[0],0),xy=deviations.reduce((s,p)=>s+p[0]*p[1],0),yy=deviations.reduce((s,p)=>s+p[1]*p[1],0);
    const separation=Math.hypot(xx-yy,2*xy);
    if(separation>1e-12){
      const angle=.5*Math.atan2(2*xy,xx-yy),direction=[Math.cos(angle),Math.sin(angle)];
      const screen=Math.hypot(...deviations.map(p=>direction[0]*p[1]-direction[1]*p[0]));
      const complex=pairing(homogeneousPoints[0],cross(homogeneousPoints[1],homogeneousPoints[2]));
      const edge=Math.max(0,...rawPoints.flat().map(v=>Math.abs(v)-.85));
      transversalOpacity=collar(screen,.01)*collar(complex,.01)*collar(edge,.05)*collar(1e-8/separation,1)*pointOpacities.reduce((a,b)=>a*b,1);
      if(transversalOpacity>0)transversal=clip(center,direction);
      if(!transversal)transversalOpacity=0;
    }
  }
  return {valid:true,frame,observables,data,glyphs,operators,source:'balanced-weighted-tensors',
    diagnostics:{eigenvalues,eigenvalueGap:gap,phaseEigenvalues:tv,phaseEigenvalueGap:phaseGap,phaseAnchorMagnitudes:anchors.map(abs)},
    layout:{valid:true,points,rawPoints,lines,pointMarkers,pointOpacities,lineOpacities,pointWeights,lineWeights,
      incidenceColors:colors,phaseVectors,pointPhaseVectors:[[0,0],[0,0],[0,0]],cameraDefects,
      cotangentTargets,transversal,concurrencyPoint,transversalOpacity,concurrencyOpacity,
      reconstruction:{chart:'Fixed tensor eigenframe; partial flags',camera:frame}}};
}
function unitReal(v){const n=Math.hypot(...v);return n>0?v.map(x=>x/n):[1,0];}

export const experimentalBalancedDiagram=balancedTensorDiagram;
