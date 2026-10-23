// Numerical motion diagnostic, deliberately independent of the projection formula.
// Compare screen travel with balanced Gram/cyclic invariant travel. Neither a
// small jump nor a large raw slider speed alone establishes natural motion.
import assert from 'assert';
import {source,distance,renderedFeatures,invariantFeatures} from './continuity-features.mjs';
import {structuralDefects} from './structural-screen-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {balancedObservables}=await import(source('balanced-observables.js'));
 const {E6_DEFAULT_BETA,betaToLevels}=await import(source('e6-parameters.js'));
 const levels=betaToLevels(E6_DEFAULT_BETA);
 let solves=0;
 function sample(p){
  const s=solveBalancedAtlas({theta:0,phi:0,t:0,sphere:0,...p},levels);
  solves++;assert(s.success,'strict solve '+JSON.stringify(p));
  assert(s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8,'moment residual');
  const d=balancedTensorDiagram(s.solvedRep);assert(d.valid,d.reason);
  const defects=structuralDefects(d);
  // Visibility inspection reports failures as evidence; normal motion scans
  // retain strict structural assertions and never turn missing ink into a pass.
  if(!process.argv.includes('--visibility'))assert.deepStrictEqual(defects,[],'structural fidelity '+JSON.stringify(p));
  // Geometric positions and unoriented segment moments; omit hue and guide
  // opacity, which can change quickly without moving a point or physical line.
  const features=renderedFeatures(d);
  return {screen:[0,1,2].flatMap(i=>features.slice(13*i,13*i+9)),invariant:invariantFeatures(balancedObservables(s.solvedRep)),visibility:{pointWeights:d.layout.pointWeights,lineWeights:d.layout.lineWeights,pointOpacities:d.layout.pointOpacities,lineOpacities:d.layout.lineOpacities,cameraOpacity:d.layout.cameraOpacity,diagnostics:d.diagnostics,defects}};
 }
 const rows=[];
 if(process.argv.includes('--visibility')){
  for(const r of [0,.5,1])for(const sphere of(r===.5?[0]:[0,1]))for(const t of [0,.4,1])rows.push({p:{r,sphere,t},...sample({r,sphere,t}).visibility});
  for(const r of [.2,.35,.78])rows.push({p:{r},...sample({r}).visibility});
  console.log(JSON.stringify({solves,rows}));return;
 }
 function scan(label,at,lo,hi,n){
  const h=(hi-lo)/n,a=Array.from({length:n+1},(_,i)=>sample(at(lo+i*h)));
  const screen=[],physical=[],gain=[],curvature=[],sourceCurvature=[];
  for(let i=1;i<=n;i++){
   screen.push(distance(a[i].screen,a[i-1].screen)/h);
   physical.push(distance(a[i].invariant,a[i-1].invariant)/h);
   gain.push(screen[i-1]/Math.max(1e-14,physical[i-1]));
   if(i<n){
    curvature.push(Math.hypot(...a[i].screen.map((v,j)=>(a[i+1].screen[j]-2*v+a[i-1].screen[j])/(h*h))));
    sourceCurvature.push(Math.hypot(...a[i].invariant.map((v,j)=>(a[i+1].invariant[j]-2*v+a[i-1].invariant[j])/(h*h))));
   }
  }
  // Differentiate with respect to source arc length too. This removes speedup
  // already present in compact chart coordinates. Omit effectively stationary
  // source intervals, where dividing solver noise has no geometric meaning.
  const sourceMedian=physical.slice().sort((x,y)=>x-y)[Math.floor(n/2)],arcAcceleration=[];
  for(let i=1;i<n;i++)if(Math.min(physical[i-1],physical[i])>Math.max(1e-6,sourceMedian*1e-4)){
   const dl=physical[i-1]*h,dr=physical[i]*h;
   arcAcceleration.push(Math.hypot(...a[i].screen.map((v,j)=>2*((a[i+1].screen[j]-v)/dr-(v-a[i-1].screen[j])/dl)/(dl+dr))));
  }
  const maxIndex=gain.indexOf(Math.max(...gain));
  const sorted=gain.slice().sort((x,y)=>x-y),q=x=>sorted[Math.floor(x*(sorted.length-1))];
  const row={label,lo,hi,n,h,screenSpeed:[Math.min(...screen),Math.max(...screen)],invariantSpeed:[Math.min(...physical),Math.max(...physical)],gainQuantiles:[q(0),q(.1),q(.5),q(.9),q(1)],maxGainAt:lo+(maxIndex+.5)*h,maxScreenAcceleration:Math.max(...curvature),maxInvariantAcceleration:Math.max(...sourceCurvature),maxSourceArcAcceleration:arcAcceleration.length?Math.max(...arcAcceleration):null,sourceArcDerivativeSamples:arcAcceleration.length,peakNeighborhood:Array.from({length:7},(_,k)=>maxIndex+k-3).filter(i=>i>=0&&i<n).map(i=>({x:lo+(i+.5)*h,screen:screen[i],invariant:physical[i],gain:gain[i]}))};
  rows.push(row);
  if(process.argv.includes('--progress'))console.log(JSON.stringify(row));
 }
 // Endpoints are one-sided: r is a compact coordinate, so a divergent source
 // derivative here must not be attributed to the projection. Nested intervals
 // distinguish a resolved sharp shoulder from a genuine discontinuity.
 const quick=process.argv.includes('--quick');
 for(const [lo,hi]of (quick?[[.49,.51],[.025,.05]]:[[0,.1],[.4,.6],[.9,1],[.74,.82]]))scan('central r',r=>({r}),lo,hi,quick?40:160);
 if(!quick)
 for(const r of [0,1]){
  scan('branch incoming '+r,t=>({r,t,sphere:0}),.9,1,80);
  scan('branch outgoing '+r,t=>({r,t,sphere:1}),0,.1,80);
  const overlap=[1e-3,1e-4,1e-5].map(h=>{const a=sample({r,t:1-h,sphere:0}),b=sample({r,t:h,sphere:1});return {h,screen:distance(a.screen,b.screen),invariant:distance(a.invariant,b.invariant)};});
  rows.push({label:'branch overlap '+r,overlap});
 }
 console.log(JSON.stringify({solves,rows}));
})().catch(e=>{console.error(e);process.exitCode=1;});
