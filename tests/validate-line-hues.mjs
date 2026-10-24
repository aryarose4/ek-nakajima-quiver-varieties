import assert from 'assert';
import {source,distance} from './continuity-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram:diagram}=await import(source('weighted-balanced-diagram.js'));
 const {incidenceColors}=await import(source('balanced-diagram.js'));
 const {E6_DEFAULT_BETA,betaToLevels}=await import(source('e6-parameters.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {eyeZ}=await import(source('core-math.js'));
 const solve=p=>{const s=solveBalancedAtlas({r:.35,theta:0,t:0,phi:0,sphere:0,...p},betaToLevels(E6_DEFAULT_BETA));assert(s.success);return s.solvedRep;};
 const hues=rep=>{const d=diagram(rep);assert(d.valid);assert(d.layout.phaseVectors.flat().every(Number.isFinite));assert(d.layout.phaseVectors.every(z=>Math.hypot(...z)<=1+1e-10));return d.layout.incidenceColors.lineHues;};
 const plus=hues(solve({theta:.7})),minus=hues(solve({theta:-.7}));
 assert(distance(plus,minus)>5,'central signed phase must visibly change hue');
 plus.forEach((h,i)=>assert(Math.abs(h+minus[i]-2*[210,330,90][i])<1e-7,'conjugation reverses hue displacement'));
 assert(distance(plus,hues(solve({r:.78,theta:.7})))>1,'r moves hue on a complex slice');
 assert(distance(hues(solve({r:1,t:.4,phi:.7})),hues(solve({r:1,t:.4,phi:-.7})))>1,'cotangent phase changes hue');
 assert(distance(hues(solve({r:1,t:.2,phi:.7})),hues(solve({r:1,t:.4,phi:.7})))>.01,'cotangent height changes hue');
 const rep=solve({theta:.7,t:.3,phi:.6});
 const U=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
 const V=[[[.6,0],[0,.8]],[[0,.8],[.6,0]]];
 assert(distance(hues(rep),hues(applyComplexGauge(rep,U,[V,V,V],[1,1,1])))<1e-6,'unitary central and branch gauges preserve hue');
 // Unit scalar branch gauges rephase both homogeneous point/plane vectors.
 const W=eyeZ(2).map(row=>row.map(z=>[z[0]*Math.cos(.63),z[0]*Math.sin(.63)]));
 assert(distance(hues(rep),hues(applyComplexGauge(rep,eyeZ(3),[W,W,W],[1,1,1])))<1e-6,'homogeneous rephasing preserves hue');
 // No arg() discontinuity or normalization of a vanishing contraction.
 const data={residuals:[[0,1,1],[1,0,1],[1,1,0]],tolerance:1e-7};
 const colors=z=>incidenceColors(data,[z,z,z]).lineHues;
 for(const anchor of [[0,0],[-.5,0]]){
  const errors=[1e-3,1e-4,1e-5].map(h=>distance(colors([anchor[0],h]),colors([anchor[0],-h])));
  assert(errors[2]<errors[1]/5&&errors[1]<errors[0]/5,'smooth through zero and negative-real phase wrap');
 }
 const seam=[-Math.PI,Math.PI].map(theta=>hues(solve({theta,t:.3})));
 assert(distance(...seam)<1e-7,'phase seam closes');
 console.log(JSON.stringify({centralPlus:plus,centralMinus:minus,seamError:distance(...seam)}));
})().catch(e=>{console.error(e);process.exitCode=1;});
