import assert from 'assert';
import {source,distance,renderedFeatures,glyphFeatures,invariantFeatures,arrowFeatures} from './continuity-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {balancedObservables}=await import(source('balanced-observables.js'));
 const {eigvalsHermitian3}=await import(source('element-view.js'));
 const {matAdd,matScale}=await import(source('core-math.js'));
 const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
 // Rounded screenshot beta, independently reconstructed physical chamber.
 const beta=[[1.338,2.225],[1.550,.557],[.792,1.362]];
 const chamber='weyl:2.5.0.3.2.0.1.4.1.0.2.3.0.5.2.5.1.4.3.2.0.1.4.1.0.2.3.4.1.2.0.1.4.1.4.1.4.1.0.2.1.0.3.2.0.1.4.1.0.2.3.0.1.5.3.0.1.4.1.0.3.2.0.1.4.1.0.2.3.2.0.1.4.1.4.1.4.1.0.2.3';
 let solves=0;
 function sample(p={},b=beta){
  const s=solveBalancedAtlas({r:1,theta:0,phi:0,sphere:1,outgoing:true,t:.534,...p},b.map(r=>r.map(x=>2*x)),{chamber});solves++;
  assert(s.success,'strict transported solve '+JSON.stringify({p,diagnostics:s.diagnostics}));assert(s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8,'moment residual');
  const o=balancedObservables(s.solvedRep),d=balancedTensorDiagram(s.solvedRep);assert(d.valid,d.reason);
  const old=eigvalsHermitian3(o.branches.map((b,i)=>matScale(b.H,[1,2,4][i])).reduce(matAdd));
  const features=[invariantFeatures(o),renderedFeatures(d),glyphFeatures(d),arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity)];assert(features.every(f=>f.every(Number.isFinite)));
  return {features,gap:old[0]-old[1]};
 }
 // Locate the actual ordered-eigenaxis collision, rather than assuming t=.5.
 let lo=.51,hi=.55;for(let i=0;i<32;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(sample({t:a}).gap<sample({t:b}).gap)hi=b;else lo=a;}
 const collision=(lo+hi)/2;assert(sample({t:collision}).gap<2e-6,'fixture exposes former camera degeneracy');
 const rows=[];
 function convergence(label,pair){const errors=[1e-3,1e-4,1e-5].map(h=>{const ab=pair(h).map(x=>sample(x.p,x.beta));return ab[0].features.map((f,k)=>distance(f,ab[1].features[k]));});for(let k=0;k<4;k++)assert(errors[2][k]<Math.max(2e-6,.6*errors[0][k])&&errors[2][k]<Math.max(2e-6,.8*errors[1][k]),label+' '+JSON.stringify(errors));rows.push({label,errors});}
 for(const t of [.495,collision,.55]){
  for(const phi of [0,.3])convergence('t '+t+' phi '+phi,h=>[-1,1].map(s=>({p:{t:t+s*h,phi}})));

  for(const key of ['phi'])convergence(key+' '+t,h=>[-1,1].map(s=>({p:{t,[key]:s*h}})));
  for(let j=0;j<6;j++)convergence('beta '+j+' t '+t,h=>[-1,1].map(s=>({p:{t},beta:beta.map((r,i)=>r.map((v,k)=>v+(2*i+k===j?s*h:0)))})));
 }
 // Sweep outgoing t as well, so a replacement cannot just move the jump.
 for(let i=1;i<40;i++)convergence('outgoing sweep '+i,h=>[-1,1].map(s=>({p:{t:i/40+s*h}})));
 console.log(JSON.stringify({collision,physicalT:collision/(1-collision),solves,cases:rows.length,rows}));
})().catch(e=>{console.error(e);process.exitCode=1;});


