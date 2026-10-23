import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {source,distance,renderedFeatures,glyphFeatures,invariantFeatures,arrowFeatures} from './continuity-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {balancedObservables}=await import(source('balanced-observables.js'));
 const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
 // Screenshot beta and independently reconstructed positive-beta chamber.
 const beta=[[.751,2.225],[2.793,.602],[.938,.702]];
 const chamber='weyl:2.5.0.3.2.0.1.4.1.0.2.3.0.5.2.5.2.0.1.4.1.4.1.4.1.0.2.1.0.3.2.0.1.4.1.0.2.3.0.1.5';
 // Keep the historical camera as a negative control: its third phase anchor
 // vanishes although both the camera and synchronizer eigenvalues are simple.
 const filename=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'./fixtures/historical-weighted-camera.js');
 const code=fs.readFileSync(filename,'utf8').replace(/from\s+['"]([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(path.basename(dep))));
 const {balancedTensorDiagram:oldCamera}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 let solves=0;
 function sample(p={},b=beta,old=false){
  const s=solveBalancedAtlas({r:.08739584396954322,theta:0,phi:0,t:0,sphere:0,...p},b.map(row=>row.map(x=>2*x)),{chamber});solves++;
  assert(s.success,'strict central solve '+JSON.stringify({p,diagnostics:s.diagnostics}));
  assert(s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8,'moment residual');
  const d=(old?oldCamera:balancedTensorDiagram)(s.solvedRep);assert(d.valid,d.reason);
  if(!old)assert.deepStrictEqual(d.layout.cameraDefects,[]);
  return {d,features:[invariantFeatures(balancedObservables(s.solvedRep)),renderedFeatures(d),glyphFeatures(d),arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity)]};
 }
 let lo=.081,hi=.096;
 for(let i=0;i<28;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(sample({r:a},beta,true).d.diagnostics.phaseAnchorMagnitudes[2]<sample({r:b},beta,true).d.diagnostics.phaseAnchorMagnitudes[2])hi=b;else lo=a;}
 const collision=(lo+hi)/2,diagnostics=sample({r:collision},beta,true).d.diagnostics;
 assert(diagnostics.phaseAnchorMagnitudes[2]<1e-6,'fixture exposes phase-anchor zero');
 assert(diagnostics.eigenvalueGap>.3&&diagnostics.phaseEigenvalueGap>10,'eigenvalues stay simple');
 const oldJump=distance(...[-1,1].map(sign=>sample({r:collision+sign*1e-6},beta,true).features[1]));assert(oldJump>4,'historical phase jump remains visible');
 const rows=[];
 function convergence(label,pair){const errors=[1e-3,1e-4,1e-5].map(h=>{const ab=pair(h).map(x=>sample(x.p,x.beta));return ab[0].features.map((f,k)=>distance(f,ab[1].features[k]));});for(let k=0;k<4;k++)assert(errors[2][k]<Math.max(2e-6,.6*errors[0][k])&&errors[2][k]<Math.max(2e-6,.8*errors[1][k]),label+' '+JSON.stringify(errors));rows.push({label,errors});}
 for(const r of [.081,collision,.096]){
  for(const key of ['r','theta','phi'])convergence(key+' '+r,h=>[-1,1].map(sign=>({p:{r,[key]:(key==='r'?r:0)+sign*h}})));
  for(let j=0;j<6;j++)convergence('beta '+j+' '+r,h=>[-1,1].map(sign=>({p:{r},beta:beta.map((row,i)=>row.map((v,k)=>v+(2*i+k===j?sign*h:0)))})));
 }
 for(let i=0;i<=10;i++)convergence('local r sweep '+i,h=>[-1,1].map(sign=>({p:{r:.04+i*.01+sign*h}})));
 convergence('one-sided t',h=>[{p:{r:collision,t:0}},{p:{r:collision,t:h}}]);
 for(let i=1;i<20;i++)convergence('central r sweep '+i,h=>[-1,1].map(sign=>({p:{r:i/20+sign*h}})));
 console.log(JSON.stringify({collision,oldJump,oldDiagnostics:diagnostics,solves,cases:rows.length,rows}));
})().catch(e=>{console.error(e);process.exitCode=1;});

