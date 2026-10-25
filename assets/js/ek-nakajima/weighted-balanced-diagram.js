// Candidate straight-line camera derived from balanced representation tensors.
// A common-phase QR frame replaces the earlier independently phased eigenaxes.
// No incidence fit, animation history, or phase-anchor normalization is used.
// Real projective incidence is preserved in a common real frame; general
// complex cross-incidence is classified by hue and need not survive projection.
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
// One fixed affine scale keeps the default comparison's surviving points in
// view. It is never fitted to the current flags or their visibility weights.
const LIMIT=.9,SCALE=.085;
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
  const baseH=sum(bs.map((b,i)=>matScale(b.H,[1,2,4][i])));
  const T=sum(bs.map((b,i)=>matAdd(matScale(b.J,[3,1,2][i]),
    matAdd(matScale(matAdd(b.K,matAdj(b.K)),[1,3,2][i]),
      matScale(matSub(b.K,matAdj(b.K)),[0,[2,1,3][i]])))));
  // The weighted branch tensor can have crossing eigenvalues on real
  // outgoing strata, exchanging ordered axes at a regular point. Mix in
  // the same fixed Hermitian correlation tensor used below, so its nonzero
  // coupling also resolves that camera crossing. This remains equivariant and
  // stateless; genuine repeated eigenvalues are still reported as defects.
  const H=matAdd(baseH,matScale(T,.125));
  const eigenvalues=eigvalsHermitian3(H),size=Math.max(1,...eigenvalues.map(Math.abs));
  const gap=Math.min(eigenvalues[0]-eigenvalues[1],eigenvalues[1]-eigenvalues[2]);
  if(gap<1e-8*size)return {valid:false,reason:'Tensor camera has a repeated eigenvalue.',cameraDefects:[{kind:'eigenvalue-gap'}]};
  // Spectral projectors are used only to remove H-diagonal correlations.
  // The arbitrary phase of each computational eigenvector cancels there;
  // these eigenvectors do not become the final camera axes.
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
  // Obtain one common reference vector from a spectral correlation tensor.
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

  // q is the leading correlation eigenvector, defined up to one common phase.
  // Hq supplies a second direction even when one spectral anchor vanishes.
  // The independent H/J bridge supplies the missing third direction there.
  // Positive QR norms introduce no independent complex phase choices.
  const R=matAdd(matMul(H,H),matScale(matAdd(matScale(bs[0].H,.3),matScale(bs[1].J,.7)),size));
  const vectors=[q,apply(H,q),apply(R,q)],norms=[];
  for(let i=0;i<3;i++){
    let v=vectors[i];
    for(let j=0;j<i;j++){const z=inner(frame[j],v);v=v.map((x,k)=>cSub(x,cMul(frame[j][k],z)));}
    const length=norm(v);norms.push(length);
    if(length<1e-12)return {valid:false,reason:'Common-phase QR frame loses rank',cameraDefects:[{kind:'qr-rank',norms}]};
    frame[i]=unit(v);
  }
  // All QR columns share q's harmless common phase. The dual transformation
  // uses the adjugate, keeping the same homogeneous projective map for planes.
  const C=frame.map(v=>v.map(cConj));
  const adjCols=[cross(C[1],C[2]),cross(C[2],C[0]),cross(C[0],C[1])];
  const lineCoordinates=n=>adjCols.map(v=>v.reduce((a,z,k)=>cAdd(a,cMul(n[k],z)),[0,0]));
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
  const homogeneousLines=ns.map((n,i)=>linePresent[i]?lineCoordinates(unit(n)):zero());
  const pairing=(p,n)=>abs(p.reduce((s,z,j)=>cAdd(s,cMul(z,n[j])),[0,0]));
  const matrix=f=>[0,1,2].map(i=>[0,1,2].map(j=>f(i,j)));
  const physicalPoints=ps.map((p,i)=>pointPresent[i]?unit(p):zero()),physicalLines=ns.map((n,i)=>linePresent[i]?unit(n):zero());
  const residuals=matrix((i,j)=>pointPresent[i]&&linePresent[j]?pairing(physicalPoints[i],physicalLines[j]):null);
  const data={valid:true,numerical:true,tolerance,pointPresent,linePresent,points:homogeneousPoints,dualLines:homogeneousLines,residuals,
    incident:matrix((i,j)=>residuals[i][j]!==null&&residuals[i][j]<=tolerance),
    pointEqual:matrix((i,j)=>pointPresent[i]&&pointPresent[j]&&norm(cross(physicalPoints[i],physicalPoints[j]))<=tolerance),
    lineEqual:matrix((i,j)=>linePresent[i]&&linePresent[j]&&norm(cross(physicalLines[i],physicalLines[j]))<=tolerance),
    collinear:pointPresent.every(Boolean)&&pairing(physicalPoints[0],cross(physicalPoints[1],physicalPoints[2]))<=tolerance,
    concurrent:linePresent.every(Boolean)&&pairing(physicalLines[0],cross(physicalLines[1],physicalLines[2]))<=tolerance};
  const operators=bs.map(b=>b.K);
  // Fix homogeneous vector phases in the same affine chart as the picture.
  const affinePhase=v=>{const w=v.reduce(cAdd,[0,0]);return abs(w)>1e-10?v.map(z=>cMul(z,cScale(cConj(w),1/abs(w)))):v;};
  const bounded=A=>matScale(A,1/(1+Math.hypot(...A.flat().map(abs))));
  const hh=bs.map(b=>bounded(b.H)),jj=bs.map(b=>bounded(b.J));
  const Y=matScale(matSub(matAdd(hh[0],hh[1]),matScale(hh[2],2)),Math.sqrt(3)/2);
  const reference=matAdd(sum(jj.map((J,i)=>matScale(J,[1,2,4][i]))),matScale(Y,[0,1]));
  const glyphs=bs.map((b,i)=>{
    if(!pointPresent[i]||!linePresent[i])return null;
    const P=matScale(b.J,1/pointWeights[i]),N=matScale(b.plane,1/lineWeights[i]);
    const E=[P,matSub(matSub(eyeZ(3),P),N),N],magnitudes=[],visibility=pointOpacities[i]*lineOpacities[i];
    const coefficients=[[0,1],[0,2],[1,2]].map(([a,c])=>{
      const block=matMul(matMul(E[a],b.K),E[c]);magnitudes.push(visibility*Math.hypot(...block.flat().map(abs)));
      return cScale(matTrace(matMul(block,reference)),visibility);
    });
    return {coefficients,phaseCorrelations:coefficients,magnitudes,projectors:E,reference,kind:'intrinsic-block-contractions'};
  });
  const points=[],rawPoints=[],lines=[],pointMarkers=[],cameraDefects=[],phaseVectors=[];
  for(let i=0;i<3;i++) {
    const p=norm(ps[i])>0?coordinates(frame,unit(ps[i])):null;
    const n=norm(ns[i])>0?lineCoordinates(unit(ns[i])):null;
    let point=[0,0],atInfinity=false;
    if(p) {
      const W=p.reduce(cAdd,[0,0]);
      atInfinity=abs(W)<1e-9;
      if(atInfinity)cameraDefects.push({kind:'affine-infinity',flag:i});
      if(abs(W)>1e-15)point=p.slice(0,2).map(z=>SCALE*divide(z,W)[0]);
    }
    const extent=Math.max(1,...point.map(x=>Math.abs(x)/LIMIT));
    const marker=point.map(x=>x/extent);
    rawPoints.push(point);points.push(marker);pointMarkers.push({point:marker,clipped:extent>1||atInfinity,atInfinity,direction:unitReal(point)});
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
        const correction=atInfinity?0:opacity*residual/(1+(1-opacity)*Math.abs(residual));
        const anchor=normal.map(x=>x*(-offset+correction));
        segment=clip(anchor,[normal[1],-normal[0]]);
        if(!segment){cameraDefects.push({kind:'line-outside-camera',flag:i});segment=[[0,0],[0,0]];}
      }
    }
    // An off-screen point is indicated along a ray from its visible plane,
    // rather than radially from the canvas origin. When the raw point lies on
    // its own line this puts the boundary arrow exactly at that line's exit.
    // The raw projective position and all complex incidence tests are unchanged.
    if(extent>1||atInfinity) {
      const visible=segment&&normRealDifference(segment[0],segment[1])>1e-12;
      const center=visible?segment[0].map((x,j)=>(x+segment[1][j])/2):[0,0];
      const ray=atInfinity&&visible?segment[1].map((x,j)=>x-segment[0][j]):point.map((x,j)=>x-center[j]);
      const direction=unitReal(ray),exits=clip(center,direction);
      if(exits) {
        const distance=normRealDifference(point,center);
        const eta=atInfinity?0:Math.min(1,normRealDifference(exits[1],center)/distance);
        const pair=exits.map((p,k)=>({point:p,direction:direction.map(x=>x*(k?1:-1)),weight:.5*(1+(k?1:-1)*eta)}));
        // Geometric ordering is independent of which affine end contains the point.
        pair.sort((a,b)=>a.point[0]-b.point[0]||a.point[1]-b.point[1]);
        pointMarkers[i].boundaryPair=pair;
        const primary=pair.reduce((a,b)=>a.weight>b.weight?a:b);
        marker.forEach((_,j)=>{marker[j]=primary.point[j];});
        pointMarkers[i].direction=primary.direction;
      }
    }
    lines.push(segment);
    // Restore the signed dual-coordinate correlation used by balancedDiagram.
    // The homogeneous phase cancels; no argument or phase normalization is
    // needed, including when the correlation vanishes. The unitary QR frame
    // keeps 2*|n0*conj(n1)| <= 1. An absent plane has zero visible opacity.
    phaseVectors.push(n?cScale(cMul(n[0],cConj(n[1])),2):[0,0]);
  }
  const colors=incidenceColors({...data,residuals:residuals.map(row=>row.map(r=>r===null?1:r))},phaseVectors);
  colors.pointStrengths=colors.pointStrengths.map((s,i)=>s*[0,1,2].filter(j=>j!==i).reduce((p,j)=>p*lineOpacities[j],1));
  const cotangentTargets=glyphs.map((g,i)=>{
    if(!g)return null;
    // A bounded physical projector contraction places the third arrow on its
    // own line without introducing another phase-fixed flag vector.
    const a0=lines[i][0],b0=lines[i][1],direction=b0.map((v,k)=>v-a0[k]);
    const u=.5+.2*Math.tanh(matTrace(matMul(g.projectors[1],reference))[0]);
    return {point:a0.map((v,k)=>v+u*direction[k]),atInfinity:false,clipped:false};

  });
  // A true complex incidence need not survive this real projection. Show
  // geometric guides only when both classifications and screen equations agree.
  const pairs=[[0,1],[0,2],[1,2]];
  const equations=lines.map(([a,b])=>[b[1]-a[1],a[0]-b[0],b[0]*a[1]-a[0]*b[1]]);
  let concurrencyPoint=null,transversal=null;
  if(data.concurrent)for(const [i,j]of pairs){
    const a=equations[i],b=equations[j],det=a[0]*b[1]-a[1]*b[0];
    if(Math.abs(det)<1e-10)continue;
    const p=[(a[1]*b[2]-a[2]*b[1])/det,(a[2]*b[0]-a[0]*b[2])/det];
    if(p.every(v=>Math.abs(v)<=LIMIT)&&equations.every(e=>Math.hypot(e[0],e[1])>1e-10&&Math.abs(e[0]*p[0]+e[1]*p[1]+e[2])<1e-8))concurrencyPoint=p;
    break;
  }
  if(data.collinear&&!pointMarkers.some(m=>m.clipped)){
    const pair=pairs.reduce((best,p)=>Math.hypot(...rawPoints[p[0]].map((v,j)=>v-rawPoints[p[1]][j]))>Math.hypot(...rawPoints[best[0]].map((v,j)=>v-rawPoints[best[1]][j]))?p:best,pairs[0]);
    const a=rawPoints[pair[0]],d=rawPoints[pair[1]].map((v,j)=>v-a[j]),length=Math.hypot(...d);
    if(length>1e-8&&rawPoints.every(p=>Math.abs(d[0]*(p[1]-a[1])-d[1]*(p[0]-a[0]))<1e-8*length))transversal=clip(a,d);
  }
  return {valid:true,frame,observables,data,glyphs,operators,source:'balanced-weighted-tensors',
    diagnostics:{camera:'common-phase-qr-candidate',qrNorms:norms,eigenvalues,eigenvalueGap:gap,phaseEigenvalues:tv,phaseEigenvalueGap:phaseGap,phaseAnchorMagnitudes:anchors.map(abs)},
    layout:{valid:true,points,rawPoints,lines,pointMarkers,pointOpacities,lineOpacities,pointWeights,lineWeights,
      incidenceColors:colors,phaseVectors,pointPhaseVectors:[[0,0],[0,0],[0,0]],cameraDefects,
      cotangentTargets,transversal,concurrencyPoint,
      reconstruction:{chart:'Candidate common-phase tensor QR frame',camera:frame}}};
}
function unitReal(v){const n=Math.hypot(...v);return n>0?v.map(x=>x/n):[1,0];}
function normRealDifference(a,b){return Math.hypot(...a.map((x,j)=>x-b[j]));}

export const experimentalBalancedDiagram=balancedTensorDiagram;
