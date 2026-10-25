import assert from 'assert';
import {source,distance,renderedFeatures,glyphFeatures,arrowFeatures} from './continuity-features.mjs';

// This battery tests observable behavior, without naming a camera construction.
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram:diagram}=await import(source('weighted-balanced-diagram.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {balancedObservables}=await import(source('balanced-observables.js'));
 const {flagIncidence}=await import(source('flag-incidence.js'));
 const {cotangentArrowGeometry:geometry,cotangentArrowOpacity:opacity}=await import(source('element-render.js'));
 const {matMul,matAdj,matAdd,matSub,matScale,matTrace,eyeZ,cAdd,cMul,cConj,cScale}=await import(source('core-math.js'));
 let state=0x6e624a,checks=0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const check=(ok,label)=>{checks++;assert(ok,label);};
 const inner=(u,v)=>u.reduce((s,z,i)=>cAdd(s,cMul(cConj(z),v[i])),[0,0]);
 function unitary(n){
  const cols=[];
  for(let k=0;k<n;k++){
   let v=Array.from({length:n},()=>[2*random()-1,2*random()-1]);
   // Two passes suppress loss of orthogonality in rare near-dependent draws.
   for(let pass=0;pass<2;pass++)for(const q of cols){const z=inner(q,v);v=v.map((x,i)=>cAdd(x,cScale(cMul(q[i],z),-1)));}
   const norm=Math.hypot(...v.flat());check(norm>1e-8,'independent random gauge column');cols.push(v.map(z=>cScale(z,1/norm)));
  }
  const U=Array.from({length:n},(_,i)=>cols.map(v=>v[i]));
  check(distance(matMul(matAdj(U),U).flat(2),eyeZ(n).flat(2))<1e-12,'independent gauge is unitary');return U;
 }
 const features=d=>[renderedFeatures(d),glyphFeatures(d),arrowFeatures(d,geometry,opacity)];
 const betas=[[[1.5,.5],[1.5,1.05],[1.5,1.5]],[[1.23,.4],[1.64,1.41],[1.06,1.82]]];
 const params=[{r:.35,theta:.7,t:.3,phi:.6,sphere:0},{r:.78,theta:0,t:0,phi:0,sphere:0},{r:0,theta:0,t:.4,phi:.7,sphere:1},{r:1,theta:0,t:1,phi:.3,sphere:1}];
 const reps=[];
 for(const beta of betas)for(const p of params){const s=solveBalancedAtlas(p,beta.map(row=>row.map(x=>2*x)));check(s.success,'strict fixture solve');reps.push(s.solvedRep);}
 const snapshots=reps.map(rep=>{const d=diagram(rep);check(d.valid,'direct camera available');const f=features(d);check(f.every(v=>v.every(Number.isFinite)),'finite visible features');return f;});
 for(let i=0;i<betas.length;i++)for(const key of ['theta','phi']){
  const p={...params[0],[key]:params[0][key]+2*Math.PI};
  const s=solveBalancedAtlas(p,betas[i].map(row=>row.map(x=>2*x)));check(s.success,'periodic phase fixture solves');
  features(diagram(s.solvedRep)).forEach((v,k)=>check(distance(v,snapshots[i*params.length][k])<2e-7,'full-turn phase closes rendered geometry and hue '+key+' '+k));
 }
 for(let j=0;j<reps.length;j++){
  const rep=reps[j],d=diagram(rep),observables=balancedObservables(rep);
  const incidence=flagIncidence(rep);check(incidence.valid,'independent complex flag classification available');
  for(const key of ['incident','pointEqual','lineEqual','concurrent','collinear']){
   check(JSON.stringify(d.data[key])===JSON.stringify(incidence[key]),'physical complex classification '+key);
  }
  check(d.layout.pointOpacities.concat(d.layout.lineOpacities).every(x=>x===1),'full-rank fixtures retain every object');
  const bounded=A=>matScale(A,1/(1+Math.hypot(...A.flat(2))));
  const h=observables.branches.map(b=>bounded(b.H));
  const Y=matScale(matSub(matAdd(h[0],h[1]),matScale(h[2],2)),Math.sqrt(3)/2);
  const C=matAdd(observables.branches.map((b,i)=>matScale(bounded(b.J),[1,2,4][i])).reduce(matAdd),matScale(Y,[0,1]));
  // Derive every block from physical A B and independently reconstructed
  // projectors/reference, rather than trusting exported glyph metadata.
  for(let i=0;i<3;i++){
   const b=observables.branches[i],g=d.glyphs[i],P=matScale(b.J,1/matTrace(b.J)[0]),N=matScale(b.plane,1/b.planeWeight);
   const E=[P,matSub(matSub(eyeZ(3),P),N),N],visibility=d.layout.pointOpacities[i]*d.layout.lineOpacities[i];
   check(g.kind==='intrinsic-block-contractions','declared intrinsic glyph contract');
   check(distance(g.reference.flat(2),C.flat(2))<1e-10,'reference tensor unchanged');
   const expectedMagnitudes=[];
   [[0,1],[0,2],[1,2]].forEach(([a,c],k)=>{
    const block=matMul(matMul(E[a],b.K),E[c]),magnitude=visibility*Math.hypot(...block.flat(2));
    const seed=d.frame[0].map((_,j)=>d.frame.reduce((sum,f)=>cAdd(sum,cScale(f[j],1/Math.sqrt(3))),[0,0]));
    const apply=(M,v)=>M.map(row=>row.reduce((sum,z,j)=>cAdd(sum,cMul(z,v[j])),[0,0]));
    const u=apply(E[a],seed),v=apply(E[c],seed),product=Math.hypot(...u.flat())*Math.hypot(...v.flat());
    const correlation=product?cScale(inner(u,apply(b.K,v)),1/product):[0,0];expectedMagnitudes.push(magnitude);
    check(Math.abs(g.magnitudes[k]-magnitude)<1e-8*Math.max(1,magnitude),'physical block magnitude');
    check(distance(g.phaseCorrelations[k],correlation)<1e-8*Math.max(1,...correlation.map(Math.abs)),'normalized camera-projection phase');
   });
   const expected=Math.hypot(...b.K.flat(2))*visibility;
   check(Math.abs(Math.hypot(...expectedMagnitudes)-expected)<1e-7*Math.max(1,expected),'blocks retain physical cotangent norm');
  }
  for(let trial=0;trial<6;trial++){
   const moved=diagram(applyComplexGauge(rep,unitary(3),[unitary(2),unitary(2),unitary(2)],Array.from({length:3},()=>{const a=6.28*random();return [Math.cos(a),Math.sin(a)];})));
   check(moved.valid,'random gauge camera available');
   features(moved).forEach((v,k)=>check(distance(v,snapshots[j][k])<2e-6,'random unitary preserves visible feature '+k));
  }
 }
 // Direct calls before/after arbitrary visits model forward, backward and click
 // navigation; deep copies also prohibit object-identity-based camera memory.
 for(const order of [reps.map((_,i)=>i),reps.map((_,i)=>reps.length-1-i),[3,0,6,1,7,2,5,4,0]])for(const j of order){
  const rep=JSON.parse(JSON.stringify(reps[j])),before=JSON.stringify(rep),d=diagram(rep);
  check(d.valid,'replay camera available');features(d).forEach((v,k)=>check(distance(v,snapshots[j][k])<1e-10,'visit order independent '+k));
  check(JSON.stringify(rep)===before,'renderer does not mutate representation');
 }
 // Generic configurations must have actual geometry; endpoints may coincide.
 for(const j of [0,1,4,5]){
  const l=diagram(reps[j]).layout;
  check(l.lines.every(ab=>distance(ab[0],ab[1])>.01),'generic full flags have visible line segments');
  check(Math.max(...l.points.flatMap(a=>l.points.map(b=>distance(a,b))))>.001,'generic points have meaningful spread');
 }
 check(distance(snapshots[0][0],snapshots[1][0])>.001,'different elements change visible geometry');
 // Renderer contract applies to consistent partial flags without requiring a
 // moment-map solve. These exact real configurations exercise equality and
 // incidence strata nonvacuously; they are not claimed as balanced solutions.
 const e1=[1,0,0],e2=[0,1,0],e3=[0,0,1],e12=[1,1,0],e23=[0,1,1];
 const configurations=[
  {label:'orthonormal equal planes distinct collinear points',planes:[[e1,e2],[e1,e2],[e1,e2]],pointCoordinates:[[1,0],[0,1],[Math.SQRT1_2,Math.SQRT1_2]],concurrent:true,collinear:true,separation:.03},
  {label:'two equal planes distinct collinear points',planes:[[e1,e2],[e1,e2],[[Math.SQRT1_2,Math.SQRT1_2,0],e3]],pointCoordinates:[[1,0],[0,1],[1,0]],concurrent:true,collinear:true,separation:.01},
  {label:'equal planes and collinear points',planes:[[e1,e2],[e2,e1],[e12,e2]],concurrent:true,collinear:true},
  {label:'equal point distinct planes',planes:[[e1,e2],[e1,e3],[e1,e23]],concurrent:true,collinear:true},
  {label:'equal planes unequal visibility',planes:[[e1,e2],[e2,e1],[e12,e2]],concurrent:true,collinear:true,dimPlane:true},
  {label:'equal point unequal visibility',planes:[[e1,e2],[e1,e3],[e1,e23]],concurrent:true,collinear:true,dimPoint:true},
  {label:'distinct concurrent planes',planes:[[e2,e1],[e3,e1],[[1,1,1],e1]],concurrent:true,collinear:false}
 ];
 let equalPointPairs=0,equalPlanePairs=0;
 const equation=([a,b])=>[b[1]-a[1],a[0]-b[0],b[0]*a[1]-a[0]*b[1]];
 for(const fixture of configurations){
  const rep={A:fixture.planes.map(([p,q])=>p.map((v,i)=>[[v,0],[q[i],0]])),a:Array.from({length:3},()=>[[[1,0]],[[0,0]]]),B:Array.from({length:3},()=>Array.from({length:2},()=>Array.from({length:3},()=>[0,0]))),b:Array.from({length:3},()=>[[[0,0],[0,0]]])};
  if(fixture.pointCoordinates)rep.a=fixture.pointCoordinates.map(v=>v.map(x=>[[x,0]]));
  if(fixture.dimPlane){
   const factor=Math.pow(.075,.25);rep.A[0]=rep.A[0].map(row=>row.map(z=>z.map(v=>factor*v)));
   rep.a[0][0][0]=[1/factor,0]; // preserve full point visibility independently.
  }
  if(fixture.dimPoint)rep.a[0][0][0]=[Math.sqrt(.075),0];
  const actual=flagIncidence(rep),d=diagram(rep);check(actual.valid&&d.valid,'synthetic flags available '+fixture.label);
  if(fixture.dimPlane)check(Math.abs(d.layout.lineOpacities[0]-.5)<1e-12&&d.layout.lineOpacities[1]===1,'equal planes have unequal physical visibility');
  if(fixture.dimPoint)check(Math.abs(d.layout.pointOpacities[0]-.5)<1e-12&&d.layout.pointOpacities[1]===1,'equal points have unequal physical visibility');
  check(actual.concurrent===fixture.concurrent&&actual.collinear===fixture.collinear,'nonvacuous synthetic classification '+fixture.label);
  const l=d.layout,eq=l.lines.map(equation);
  if(fixture.label==='two equal planes distinct collinear points')check(distance(l.points[0],l.points[1])>.05,'distinct marked points on repeated plane retain visible separation');
  for(let i=0;i<3;i++)for(let k=0;k<3;k++){
   check(d.data.incident[i][k]===actual.incident[i][k],'synthetic complex incidence retained');
   if(actual.incident[i][k])check(Math.abs(eq[k][0]*l.points[i][0]+eq[k][1]*l.points[i][1]+eq[k][2])/Math.hypot(eq[k][0],eq[k][1])<1e-6,'true incidence fits below .001px');
   const equalityTolerance=fixture.dimPoint||fixture.dimPlane?1e-6:1e-7;
   if(i<k&&actual.pointEqual[i][k]){equalPointPairs++;check(distance(l.points[i],l.points[k])<equalityTolerance,'equal source points coincide below .001px '+fixture.label);}
   if(i<k&&actual.lineEqual[i][k]){equalPlanePairs++;check(Math.min(distance(l.lines[i].flat(),l.lines[k].flat()),distance(l.lines[i].flat(),l.lines[k].slice().reverse().flat()))<equalityTolerance,'equal source planes coincide below .001px '+fixture.label);}
   // This lower bound applies only to these concrete, well-separated source
   // points; the schematic is not claimed to be universally injective.
   if(i<k&&fixture.separation&&!actual.pointEqual[i][k])check(distance(l.points[i],l.points[k])>fixture.separation,'distinct fixture points remain separated '+fixture.label);
  }
  if(actual.concurrent)check(eq.every(e=>Math.abs(e[0]*l.concurrencyPoint[0]+e[1]*l.concurrencyPoint[1]+e[2])/Math.hypot(e[0],e[1])<1e-6),'true concurrency guide fits all lines');
 }
 check(equalPointPairs>0&&equalPlanePairs>0,'both equality contracts actually exercised');
 console.log(JSON.stringify({checks,fixtures:reps.length,randomGaugeTrials:reps.length*6,syntheticConfigurations:configurations.length,equalPointPairs,equalPlanePairs}));
})().catch(e=>{console.error(e);process.exitCode=1;});
