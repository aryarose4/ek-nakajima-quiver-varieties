// Search actual balanced paths for endpoint-order flips. An unoriented line
// can stay continuous while the renderer's tangent and normal arrows reverse.
import assert from 'assert';
import {source,distance,renderedFeatures,invariantFeatures,arrowFeatures} from './continuity-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {balancedObservables}=await import(source('balanced-observables.js'));
 const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
 const {E6_DEFAULT_BETA,betaToLevels}=await import(source('e6-parameters.js'));
 const levels=betaToLevels(E6_DEFAULT_BETA);let solves=0;const flips=[];
 if(process.argv.includes('--gauge')){
  const {applyComplexGauge}=await import(source('solver.js'));
  const {matMul}=await import(source('core-math.js'));
  const rows=[];
  for(const p of [{r:.35,theta:.7,t:.3,phi:.6,sphere:0},{r:.78,theta:0,t:.3,phi:.6,sphere:0},{r:0,theta:0,t:.4,phi:.7,sphere:1},{r:1,theta:0,t:.4,phi:.7,sphere:1}]){
   const solved=solveBalancedAtlas(p,levels);assert(solved.success);const a=balancedTensorDiagram(solved.solvedRep);
   for(let trial=0;trial<12;trial++){
    const x=.13+trial*.23,c=Math.cos(x),s=Math.sin(x),U=matMul([[[c,0],[0,s],[0,0]],[[0,s],[c,0],[0,0]],[[0,0],[0,0],[Math.cos(2*x),Math.sin(2*x)]]],[[[1,0],[0,0],[0,0]],[[0,0],[c,0],[s,0]],[[0,0],[-s,0],[c,0]]]);
    const V=[[[c,0],[0,s]],[[0,s],[c,0]]],phase=[Math.cos(x),Math.sin(x)];
    const b=balancedTensorDiagram(applyComplexGauge(solved.solvedRep,U,[V,V,V],[phase,phase,phase]));assert(b.valid);
    rows.push({p,trial,geometry:distance(renderedFeatures(a),renderedFeatures(b)),arrows:distance(arrowFeatures(a,cotangentArrowGeometry,cotangentArrowOpacity),arrowFeatures(b,cotangentArrowGeometry,cotangentArrowOpacity))});
   }
  }
  console.log(JSON.stringify({gaugeCases:rows.length,maxGeometryDelta:Math.max(...rows.map(x=>x.geometry)),maxArrowDelta:Math.max(...rows.map(x=>x.arrows)),failures:rows.filter(x=>x.geometry>2e-6||x.arrows>2e-6)}));return;
 }
 function sample(p){const s=solveBalancedAtlas({r:.35,theta:0,phi:0,t:0,sphere:0,...p},levels);solves++;assert(s.success,'strict solve');const d=balancedTensorDiagram(s.solvedRep);assert(d.valid,d.reason);return {d,geometry:renderedFeatures(d),invariant:invariantFeatures(balancedObservables(s.solvedRep)),arrows:arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity)};}
 const direction=(s,k)=>s.d.layout.lines[k][1].map((v,i)=>v-s.d.layout.lines[k][0][i]);
 const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
 for(const [label,at]of [['r theta0',r=>({r})],['r theta.7 t.3',r=>({r,theta:.7,t:.3,phi:.6})],['theta r.78 t.3',x=>({r:.78,t:.3,phi:.6,theta:2*Math.PI*x-Math.PI})],['outgoing0',t=>({r:0,sphere:1,t,phi:.7})],['outgoing1',t=>({r:1,sphere:1,t,phi:.7})]]){
  let a=sample(at(0));
  for(let i=1;i<=48;i++){
   const b=sample(at(i/48));
   for(let k=0;k<3;k++)if(dot(direction(a,k),direction(b,k))<0){
    let lo=(i-1)/48,hi=i/48,l=a,r=b;
    for(let j=0;j<18;j++){const mid=(lo+hi)/2,m=sample(at(mid));if(dot(direction(l,k),direction(m,k))<0){hi=mid;r=m;}else{lo=mid;l=m;}}
    flips.push({label,k,lo,hi,p:at((lo+hi)/2),invariantDelta:distance(l.invariant,r.invariant),geometryDelta:distance(l.geometry,r.geometry),arrowDelta:distance(l.arrows,r.arrows),directions:[direction(l,k),direction(r,k)],magnitudes:[l.d.glyphs[k]&&l.d.glyphs[k].magnitudes,r.d.glyphs[k]&&r.d.glyphs[k].magnitudes]});
   }
   a=b;
  }
 }
 console.log(JSON.stringify({solves,flips}));
})().catch(e=>{console.error(e);process.exitCode=1;});

