// A unitary viewing frame and phase-decorated affine camera for balanced flags.
// The caller must supply a converged real-moment-map representative. This module
// never applies a positive/nonunitary display gauge or reconstructs chart data.
// A second unitary camera puts a genuine intersection at the affine origin.
// Lines are projected as equations, never independently anchored at real-part
// points: concurrency is therefore retained even after complex phase histories.
// Affine infinity and isotropic projected normals remain camera defects,
// explicitly recorded below, not mathematical singularities of the moduli space.
import { cAdd, cSub, cMul, cConj, cScale, matMul, matAdj } from './core-math.js';
import { flagIncidence } from './flag-incidence.js';
import { cotangentGlyphs } from './flag-diagram.js';

const abs = z => Math.hypot(z[0], z[1]);
const norm = v => Math.hypot(...v.map(abs));
const unit = v => { const n = norm(v); return v.map(z => cScale(z, 1 / n)); };
const inner = (u,v) => u.reduce((s,z,i) => cAdd(s,cMul(cConj(z),v[i])),[0,0]);
const cross = (u,v) => [0,1,2].map(i => cSub(cMul(u[(i+1)%3],v[(i+2)%3]),cMul(u[(i+2)%3],v[(i+1)%3])));
const projector = v => v.map(a => v.map(b => cMul(a,cConj(b))));
const coordinates = (frame,v) => frame.map(e => inner(e,v));
const matrixOf = columns => [0,1,2].map(i => columns.map(v => v[i]));
const divide = (a,b) => cScale(cMul(a,cConj(b)),1 / (abs(b)*abs(b)));
const LIMIT = .9, SCALE = 1.125;

// A homogeneous-scale-invariant signed phase moves each line within its own
// hue band. The bands stay separated, so incidence retains its color meaning.
// The two other line hues span a minor arc excluding the own-line hue.
// Opposite residual weights reach an endpoint precisely when that pairing
// vanishes. At simultaneous incidence there is no unique hue: fade to neutral.
export function incidenceColors(data, phaseVectors = []) {
  // Smooth contrast adjustment, not an incidence tolerance: weak phase
  // correlations fade to the band center instead of acquiring arbitrary hue.
  const phaseColors=phaseVectors.map(v=>cScale(v,1/Math.hypot(v[0],v[1],.04)));
  const lineHues = [210, 330, 90].map((h,i)=>
    h+20*(phaseColors[i]?phaseColors[i][1]:0));
  const lineStrengths=[0,1,2].map(i=>phaseColors[i]?
    .75+.2*phaseColors[i][0]:1);
  const pointHues = [], pointStrengths = [], ambiguous = [];
  for (let i = 0; i < 3; i++) {
    const others = [0, 1, 2].filter(j => j !== i);
    const residuals = others.map(j => data.residuals[i][j]);
    const angles = others.map(j => lineHues[j] * Math.PI / 180);
    const x = residuals[1] * Math.cos(angles[0]) + residuals[0] * Math.cos(angles[1]);
    const y = residuals[1] * Math.sin(angles[0]) + residuals[0] * Math.sin(angles[1]);
    const strength = Math.hypot(x, y);
    pointHues.push(strength > 0 ? (Math.atan2(y, x) * 180 / Math.PI + 360) % 360 : null);
    const total=residuals[0]+residuals[1];
    const saturation=total>0?(residuals[1]*lineStrengths[others[0]]+residuals[0]*lineStrengths[others[1]])/total:0;
    pointStrengths.push(saturation*Math.min(1, strength / .03));
    ambiguous.push(residuals.every(r => r <= data.tolerance));
  }
  return { lineHues, lineStrengths, pointHues, pointStrengths, ambiguous, tolerance: data.tolerance };
}
function vectorPhase(v, previous) {
  let z=previous&&inner(previous,v);
  if(!z||abs(z)<1e-10) z=v.reduce((a,b)=>abs(a)>=abs(b)?a:b);
  return v.map(x=>cMul(x,cScale(cConj(z),1/abs(z))));
}

function descriptors(data, operators) {
  return data.points.map(projector).concat(data.dualLines.map(n => projector(n.map(cConj))),operators);
}

// Only residual diagonal U(1) phases remain after matching the first flag.
// Correlating homogeneous projectors avoids all arbitrary vector phases. The
// maximum spanning tree recovers an exact diagonal gauge on a connected graph;
// coordinate ascent then improves the approximate match during actual motion.
export function alignPhases(current, previous) {
  if (!previous) return [[1,0],[1,0],[1,0]];
  const C = [0,1,2].map(j => [0,1,2].map(k => current.reduce((s,M,i) =>
    cAdd(s,cMul(M[j][k],cConj(previous[i][j][k]))),[0,0])));
  const d = [[1,0],[1,0],[1,0]], visited = [true,false,false];
  for (let count=0;count<2;count++) {
    let best = null;
    for (let j=0;j<3;j++) for(let k=0;k<3;k++) if(visited[j]&&!visited[k]&&(!best||abs(C[j][k])>best.w)) best={j,k,w:abs(C[j][k])};
    if (!best || best.w < 1e-14) break;
    d[best.k]=cMul(cConj(cScale(C[best.j][best.k],1/best.w)),d[best.j]); visited[best.k]=true;
  }
  for(let pass=0;pass<30;pass++) for(let j=1;j<3;j++) {
    const z=[0,1,2].filter(k=>k!==j).reduce((s,k)=>cAdd(s,cMul(C[j][k],d[k])),[0,0]);
    if(abs(z)>1e-14) d[j]=cScale(z,1/abs(z));
  }
  return d;
}

function clip(anchor, direction) {
  let lo=-Infinity,hi=Infinity;
  for(let j=0;j<2;j++) {
    if(Math.abs(direction[j])<1e-14) { if(Math.abs(anchor[j])>LIMIT+1e-10) return null; }
    else { const a=(-LIMIT-anchor[j])/direction[j],b=(LIMIT-anchor[j])/direction[j]; lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b)); }
  }
  return lo<=hi&&Number.isFinite(lo)&&Number.isFinite(hi) ? [lo,hi].map(t=>anchor.map((x,j)=>x+t*direction[j])) : null;
}

export function balancedDiagram(rep, options = {}) {
  const source=flagIncidence(rep);
  if(!source.valid) return {valid:false,reason:source.reason};
  // Transport the internal frame only. The final projective camera and glyph
  // phases below cancel this choice, so slider history cannot change the view.
  const previous=options.previous && (options.previous.continuation || options.previous);
  const e1=source.points[0],e3=source.dualLines[0].map(cConj),e2=unit(cross(e3,e1).map(cConj));
  let frame=[e1,e2,e3];
  const rawOperators=rep.A.map((A,i)=>matMul(A,rep.B[i]));
  function transformed() {
    const F=matrixOf(frame),FH=matAdj(F);
    const data={...source, points:source.points.map(p=>coordinates(frame,p)),dualLines:source.dualLines.map(n=>coordinates(frame,n.map(cConj)).map(cConj))};
    const operators=rawOperators.map(K=>matMul(matMul(FH,K),F));
    return {data,operators};
  }
  let current=transformed();
  const phases=alignPhases(descriptors(current.data,current.operators),previous&&previous.descriptors);
  frame=frame.map((v,j)=>v.map(z=>cMul(z,phases[j])));
  current=transformed();
  const {data,operators}=current;
  data.points=data.points.map((p,i)=>vectorPhase(p,previous&&previous.points&&previous.points[i]));
  data.dualLines=data.dualLines.map((p,i)=>vectorPhase(p,previous&&previous.dualLines&&previous.dualLines[i]));
  const pairs=[[0,1],[0,2],[1,2]];
  let pair=[0,1];
  let intersection=cross(data.dualLines[pair[0]],data.dualLines[pair[1]]);
  if(norm(intersection)<1e-6) {
    pair=pairs.reduce((best,p)=>norm(cross(data.dualLines[p[0]],data.dualLines[p[1]]))>
      norm(cross(data.dualLines[best[0]],data.dualLines[best[1]]))?p:best,pairs[0]);
    intersection=cross(data.dualLines[pair[0]],data.dualLines[pair[1]]);
  }
  const uniqueIntersection=norm(intersection)>1e-10;
  // The all-coincident case has no distinguished intersection; retain a
  // direction in the common plane, without displaying a spurious unique dot.
  if(!uniqueIntersection) intersection=data.points[pair[0]];
  let z=vectorPhase(unit(intersection),null);
  let x=vectorPhase(data.dualLines[pair[0]].map(cConj),null);
  const y=vectorPhase(unit(cross(z,x).map(cConj)),null);
  // Full complex phasors cancel the arbitrary phases of x and z relative to
  // y. Blending an unwrapped angle would turn its winding into screen motion.
  const normal=coordinates([x,y,z],data.dualLines[pair[1]].map(cConj)).map(cConj);
  const point=coordinates([x,y,z],data.points[pair[0]]);
  const phasor=value=>abs(value)>1e-10?cScale(value,1/abs(value)):[1,0];
  // At the right arm's first fixed point the two plane normals are
  // orthogonal. K_1 still couples the x/y directions there, so it supplies
  // the missing phase without switching camera conventions at the endpoint.
  const operatorAlpha=cConj(inner(y,operators[0].map(row=>row.reduce((s,v,j)=>cAdd(s,cMul(v,x[j])),[0,0]))));
  const alphaAnchor=cAdd(cConj(cMul(normal[0],cConj(normal[1]))),cMul([0,1],operatorAlpha));
  const alpha=phasor(alphaAnchor);
  // One point correlation vanishes inside a perfectly regular radial path.
  // Two independent point references avoid that real-axis sign flip; K_2
  // supplies a reference at the short tip where both point correlations vanish.
  // Every summand has the same covariance under the remaining y/z phases.
  const point1=coordinates([x,y,z],data.points[1]);
  const q0=cMul(point[2],cConj(point[1]));
  const q1=cMul(point1[2],cConj(point1[1]));
  const k=inner(z,operators[1].map(row=>row.reduce((s,v,j)=>cAdd(s,cMul(v,y[j])),[0,0])));
  // The same fixed point has zero direct y/z references. Link the nonzero
  // point z/x correlation through K_1's x/y correlation instead. This product
  // has exactly the same phase covariance as q0, q1 and k.
  const linked=cMul(operatorAlpha,cMul(point1[2],cConj(point1[0])));
  const betaAnchor=cAdd(cMul([0,1],linked),cAdd(k,cAdd(q0,cMul([0,1],q1))));
  const beta=phasor(betaAnchor);
  x=x.map(v=>cMul(v,alpha));z=z.map(v=>cMul(v,beta));
  const camera=[x,y,z];
  // Coefficient colors also use the current camera, rather than a transported
  // flag basis whose phases can wind after a closed slider loop.
  function affinePhase(v) {
    const w=v.reduce(cAdd,[0,0]);
    return abs(w)>1e-10?v.map(z=>cMul(z,cScale(cConj(w),1/abs(w)))):vectorPhase(v,null);
  }
  const C=matrixOf(camera),CH=matAdj(C);
  const glyphData={...data,points:data.points.map(p=>affinePhase(coordinates(camera,p))),
    dualLines:data.dualLines.map(n=>affinePhase(coordinates(camera,n.map(cConj)).map(cConj)))};
  const glyphs=cotangentGlyphs(glyphData,operators.map(K=>matMul(matMul(CH,K),C)));
  glyphs.forEach(g=>{g.basis=g.basis.map(v=>[0,1,2].map(j=>camera.reduce((s,e,k)=>cAdd(s,cMul(e[j],v[k])),[0,0])));});
  const rawPoints=[],lineGeometry=[];
  const points=[],lines=[],pointMarkers=[],linePhases=[],phaseVectors=[],pointPhases=[],pointPhaseVectors=[],projectionResiduals=[],cameraDefects=[];
  if(abs(alphaAnchor)<=1e-10*Math.max(1,abs(operatorAlpha)))cameraDefects.push({kind:'camera-phase-anchor-vanishing',axis:'x'});
  if(abs(betaAnchor)<=1e-10*Math.max(1,abs(k),abs(q0),abs(q1),abs(linked)))cameraDefects.push({kind:'camera-phase-anchor-vanishing',axis:'z'});
  for(let i=0;i<3;i++) {
    const p=coordinates(camera,data.points[i]);
    const n=coordinates(camera,data.dualLines[i].map(cConj)).map(cConj);
    const W=p.reduce(cAdd,[0,0]);
    const h=[cScale(p[0],SCALE),cScale(p[1],SCALE),W];
    let point,atInfinity=abs(W)<1e-10;
    if(!atInfinity) point=h.slice(0,2).map(z=>divide(z,W)[0]);
    else {
      const pivot=abs(h[0])>=abs(h[1])?h[0]:h[1];
      const phase=abs(pivot)>0?cScale(cConj(pivot),1/abs(pivot)):[1,0];
      point=h.slice(0,2).map(z=>cMul(z,phase)[0]);
      const m=Math.max(...point.map(Math.abs),1e-12); point=point.map(x=>LIMIT*x/m);
      cameraDefects.push({flag:i,kind:'affine-infinity'});
    }
    const a=cSub(n[0],n[2]),b=cSub(n[1],n[2]);
    // Principal real normal of the complex line. A sign change does not alter
    // the geometric line; endpoint order is separately matched to the last view.
    const squared=cAdd(cMul(a,a),cMul(b,b));
    const psi=.5*Math.atan2(squared[1],squared[0]);
    const rotate=[Math.cos(psi),-Math.sin(psi)];
    let normal=[cMul(a,rotate)[0],cMul(b,rotate)[0]];
    if(abs(squared)<1e-10*(abs(a)**2+abs(b)**2)) cameraDefects.push({flag:i,kind:'isotropic-complex-normal'});
    if(Math.hypot(...normal)<1e-12) normal=[1,0];
    const length=Math.hypot(...normal);normal=normal.map(x=>x/length);
    const direction=[normal[1],-normal[0]];
    const constant=cScale(n[2],SCALE);
    const offset=cMul(constant,rotate)[0]/length;
    const anchor=normal.map(x=>-x*offset);
    // Keep the marked point on its actual projected line. This orthogonal
    // screen projection is not a gauge transformation of the balanced data.
    const pointResidual=normal[0]*point[0]+normal[1]*point[1]+offset;
    point=point.map((value,j)=>value-pointResidual*normal[j]);
    rawPoints.push(point.slice());lineGeometry.push({anchor,direction});
    let segment=clip(anchor,direction);
    const magnitude=Math.max(...point.map(Math.abs));
    const clipped=magnitude>LIMIT;
    let marker=clipped?point.map(x=>x*LIMIT/magnitude):point;
    if(segment&&(clipped||atInfinity)) {
      const scores=segment.map(q=>atInfinity?q[0]*point[0]+q[1]*point[1]:-Math.hypot(q[0]-point[0],q[1]-point[1]));
      marker=segment[scores[0]>scores[1]?0:1].slice();
    }
    // A line completely outside the camera has no honest viewport segment.
    if(!segment) { cameraDefects.push({flag:i,kind:'line-outside-camera'}); segment=[marker.slice(),marker.slice()]; }
    const old=previous&&previous.lines&&previous.lines[i];
    if(old&&(segment[1][0]-segment[0][0])*(old[1][0]-old[0][0])+(segment[1][1]-segment[0][1])*(old[1][1]-old[0][1])<0) segment.reverse();
    const phase=cMul(p[0],cConj(p[1]));
    const linePhase=cMul(n[0],cConj(n[1]));
    const directionNorm=Math.hypot(...point)||1;
    points.push(marker);lines.push(segment);pointMarkers.push({point:marker,clipped:clipped||atInfinity,atInfinity,direction:point.map(x=>x/directionNorm)});
    pointPhases.push(abs(phase)>1e-12?Math.atan2(phase[1],phase[0]):null);
    pointPhaseVectors.push(cScale(phase,2));
    linePhases.push(abs(linePhase)>1e-12?Math.atan2(linePhase[1],linePhase[0]):null);
    phaseVectors.push(cScale(linePhase,2));
    projectionResiduals.push(atInfinity?null:Math.hypot(...h.slice(0,2).map(z=>divide(z,W)[1])));
  }
  // One camera zoom for the whole configuration preserves incidence. Clipping
  // each marked point separately can otherwise conceal collinearity at a tip.
  const extent=Math.max(1,...rawPoints.flat().map(Math.abs));
  const zoom=Math.min(1,.76/extent);
  for(let i=0;i<3;i++) {
    const point=rawPoints[i].map(v=>v*zoom);
    let segment=clip(lineGeometry[i].anchor.map(v=>v*zoom),lineGeometry[i].direction);
    if(!segment) continue;
    const old=previous&&previous.lines&&previous.lines[i];
    if(old&&(segment[1][0]-segment[0][0])*(old[1][0]-old[0][0])+(segment[1][1]-segment[0][1])*(old[1][1]-old[0][1])<0) segment.reverse();
    lines[i]=segment;points[i]=point;pointMarkers[i].point=point;
    pointMarkers[i].clipped=pointMarkers[i].atInfinity;
  }
  // Use the second column of balanced A as a seed for the distinguished
  // projective direction in the flag plane perpendicular to its marked point.
  // Its projective direction also agrees with the camera's coefficient basis.
  const cotangentTargets=rep.A.map((A,i)=>{
    const e1=data.points[i];
    function perpendicularColumn(j) {
      const column=coordinates(frame,A.map(row=>row[j]));
      const projection=inner(e1,column);
      return {column,vector:column.map((v,k)=>cSub(v,cMul(e1[k],projection)))};
    }
    let seed=perpendicularColumn(1);
    if(norm(seed.vector)<1e-10*norm(seed.column)) seed=perpendicularColumn(0);
    if(!(norm(seed.vector)>1e-14)) return null;
    const homogeneous=unit(seed.vector),v=coordinates(camera,homogeneous),W=v.reduce(cAdd,[0,0]);
    const atInfinity=abs(W)<1e-10;
    if(atInfinity) return {point:null,homogeneous,atInfinity:true,clipped:false};
    let target=v.slice(0,2).map(z=>SCALE*divide(z,W)[0]*zoom);
    const segment=lines[i],a=segment[0],d=segment[1].map((x,j)=>x-a[j]);
    const length2=d.reduce((s,x)=>s+x*x,0);
    if(length2<1e-20) return {point:null,homogeneous,atInfinity:false,clipped:true};
    const t=target.reduce((s,x,j)=>s+(x-a[j])*d[j],0)/length2;
    const clipped=t<0||t>1;
    // A target beyond the viewport is not replaced by a different finite point.
    target=clipped?null:a.map((x,j)=>x+t*d[j]);
    return {point:target,homogeneous,atInfinity:false,clipped};
  });
  let transversal=null;
  if(data.collinear) {
    const [a,b,c]=points;
    const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const pair=pairs.reduce((best,p)=>Math.hypot(...points[p[0]].map((v,j)=>v-points[p[1]][j]))>
      Math.hypot(...points[best[0]].map((v,j)=>v-points[best[1]][j]))?p:best,pairs[0]);
    const direction=points[pair[1]].map((v,j)=>v-points[pair[0]][j]);
    if(Math.abs(area)<1e-7&&Math.hypot(...direction)>1e-8) transversal=clip(points[pair[0]],direction);
  }
  const layout={valid:true,points,lines,pointMarkers,linePhases,pointPhases,pointPhaseVectors,phaseVectors,phaseRadii:phaseVectors.map(abs),compactRadius:.5,incidenceColors:incidenceColors(data,phaseVectors),
    transversal,cotangentTargets,
    concurrencyPoint:data.concurrent&&uniqueIntersection?[0,0]:null,
    phaseMatchedConcurrency:data.concurrent,projectionResiduals,cameraDefects,
    reconstruction:{chart:'Unitary intersection camera; projected line equations',homogeneousPoints:data.points,homogeneousLines:data.dualLines,camera}};
  return {valid:true,data,layout,glyphs,operators,frame,
    continuation:{descriptors:descriptors(data,operators),lines,points:data.points,dualLines:data.dualLines},source:'balanced-representation'};
}
