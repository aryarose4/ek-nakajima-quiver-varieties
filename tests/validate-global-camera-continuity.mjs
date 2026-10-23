import assert from 'assert';
import {source,distance,renderedFeatures,arrowFeatures} from './continuity-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
 const beta=[[1.23,.40],[1.64,1.41],[1.06,1.82]],levels=beta.map(row=>row.map(x=>2*x));
 let solves=0;
 const sample=p=>{
  const s=solveBalancedAtlas({r:.78,theta:0,t:0,phi:0,sphere:0,...p},levels);solves++;
  assert(s.success&&s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8,'strict balanced representative');
  const d=balancedTensorDiagram(s.solvedRep),l=d.layout;
  assert(d.valid);assert.deepStrictEqual(l.cameraDefects,[]);
  assert.strictEqual(d.diagnostics.camera,'bounded-invariant-incidence-fit');
  const features=renderedFeatures(d).concat(arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity),
   d.glyphs.flatMap(g=>g?g.coefficients.flat().concat(g.magnitudes):Array(9).fill(0)),
   [l.concurrencyOpacity,...l.concurrencyPoint.map(x=>x*l.concurrencyOpacity),l.transversalOpacity,...l.transversal.flat().map(x=>x*l.transversalOpacity)]);
  assert(features.every(Number.isFinite));
  return features;
 };
 const rows=[];
 // Actual failures found by adaptive scans of the previous production camera:
 // phase-anchor zeros at both .574877 and the user's .780388 reproduction.
 for(const r of [.57487723,.780388087,.19669953])for(const key of ['r','theta','phi']){
  const errors=[1e-3,1e-4,1e-5].map(h=>distance(...[-1,1].map(sign=>sample({r,[key]:(key==='r'?r:0)+sign*h}))));
  assert(errors[2]<Math.max(2e-6,.6*errors[0])&&errors[2]<Math.max(2e-6,.8*errors[1]),key+' '+r+': '+errors);
  rows.push({r,key,errors});
 }
 const direct=sample({r:.780388087,theta:.7,t:.4,phi:.9});
 for(const p of [{r:.2,theta:-Math.PI},{r:.9,theta:Math.PI},{r:1,sphere:1,t:.5}])sample(p);
 assert.deepStrictEqual(sample({r:.780388087,theta:.7,t:.4,phi:.9}),direct,'direct clicks and arbitrary replay give identical output');
 assert(distance(sample({theta:-Math.PI,t:.3}),sample({theta:Math.PI,t:.3}))<1e-7,'phase seam closes');
 console.log(JSON.stringify({solves,cases:rows.length,rows}));
})().catch(e=>{console.error(e);process.exitCode=1;});
