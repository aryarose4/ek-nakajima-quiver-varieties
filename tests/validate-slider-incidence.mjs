// Test the full raw-slider -> magnetic coordinate -> balanced diagram path.
import assert from 'assert';
import {source,distance,renderedFeatures,arrowFeatures} from './continuity-features.mjs';
(async function(){
 const {magneticValue}=await import(source('slider-magnet.js'));
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
 const levels=[[1.23,.40],[1.64,1.41],[1.06,1.82]].map(row=>row.map(x=>2*x));
 let solves=0,cases=0;
 for(const [key,snaps] of [
  ['r',[{value:0,tol:.005},{value:.5,tol:.02},{value:1,tol:.005}]],
  ['theta',[{value:0,tol:.03*Math.PI}]],
  ['phi',[{value:0,tol:.03*Math.PI}]]
 ])for(const snap of snaps)for(const side of [-1,1])for(const radius of [snap.tol/5,snap.tol]){
  const boundary=snap.value+side*radius;
  if(key==='r'&&(boundary<=0||boundary>=1))continue;
  const sample=raw=>{
   const p={r:.5,theta:0,t:0,phi:0,sphere:0,[key]:magneticValue(raw,snaps)};
   if(key==='phi'){p.r=.3;p.t=.2;}
   const s=solveBalancedAtlas(p,levels);solves++;
   assert(s.success&&s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8,'strict balanced snap sample');
   const d=balancedTensorDiagram(s.solvedRep);assert(d.valid);
   return renderedFeatures(d).concat(arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity));
  };
  const errors=[1e-4,1e-5,1e-6].map(h=>distance(sample(boundary-h),sample(boundary+h)));
  assert(errors.every(Number.isFinite));
  assert(errors[2]<Math.max(2e-6,.25*errors[0]),key+' snap boundary '+boundary+': '+errors);
  cases++;
 }
 console.log(cases+' slider/incidence boundary convergence cases passed ('+solves+' strict solves).');
})().catch(e=>{console.error(e);process.exitCode=1;});
