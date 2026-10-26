import assert from 'assert';
import {source,distance,renderedFeatures} from './continuity-features.mjs';
import {structuralDefects} from './structural-screen-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram:diagram}=await import(source('weighted-balanced-diagram.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {eyeZ}=await import(source('core-math.js'));
 const beta=[[.751,2.225],[2.793,.602],[.938,.702]];
 const chamber={id:'weyl:2.5.0.3.2.0.1.4.1.0.2.3.0.5.2.5.2.0.1.4.1.4.1.4.1.0.2.1.0.3.2.0.1.4.1.0.2.3.0.1.5'};
 const root=.08739584396954322,rows=[];
 function rep(r,theta){const s=solveBalancedAtlas({r,theta,t:0,phi:0,sphere:0},beta.map(row=>row.map(x=>2*x)),{chamber});assert(s.success&&s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8);return s.solvedRep;}
 function trace(steps,theta,reverse){
  let previous,previousGauged,last,maxStep=0,maxGauge=0;
  for(let k=0;k<=steps;k++){
   const r=root+(reverse?1:-1)*(.003-.006*k/steps),R=rep(r,theta),d=diagram(R,{previous});
   assert(d.valid,d.reason);assert.deepStrictEqual(structuralDefects(d),[]);
   const angle=.3+.71*k,c=Math.cos(angle),s=Math.sin(angle),U=[[[c,0],[0,s],[0,0]],[[0,s],[c,0],[0,0]],[[0,0],[0,0],[Math.cos(.2*k),Math.sin(.2*k)]]];
   const V=[[[c,0],[0,s]],[[0,s],[c,0]]];
   const gauged=diagram(applyComplexGauge(R,U,[V,eyeZ(2),V],[1,1,1]),{previous:previousGauged});assert(gauged.valid);
   const features=renderedFeatures(d);assert(features.every(Number.isFinite));
   maxGauge=Math.max(maxGauge,distance(features,renderedFeatures(gauged)));
   if(last)maxStep=Math.max(maxStep,distance(features,last));
   last=features;previous=d.continuation;previousGauged=gauged.continuation;
  }
  assert(maxGauge<1e-6,'independent gauge on every sample: '+maxGauge);
  return {maxStep,maxGauge};
 }
 for(const theta of [0,-1e-5,1e-5])for(const reverse of [false,true]){
  const coarse=trace(20,theta,reverse),fine=trace(40,theta,reverse);
  assert(fine.maxStep<.6*coarse.maxStep,'warm trace converges through phase root');rows.push({theta,reverse,coarse,fine});
 }
 const R=rep(.35,.7),cold=diagram(R);
 for(const previous of [null,{}, {tensorDescriptors:[]},{tensorDescriptors:Array(9).fill(null)}])assert.deepStrictEqual(renderedFeatures(diagram(R,{previous})),renderedFeatures(cold),'missing/invalid continuation falls back to cold camera');
 const invalid={...R,A:R.A.map(A=>A.map(row=>row.map(()=>[0,0])))};
 assert.strictEqual(diagram(invalid,{previous:cold.continuation}).valid,false);
 assert(distance(renderedFeatures(diagram(R,{previous:cold.continuation})),renderedFeatures(cold))<1e-6,'last valid token recovers after a rejected frame');
 console.log(JSON.stringify({rows}));
})().catch(e=>{console.error(e);process.exitCode=1;});
