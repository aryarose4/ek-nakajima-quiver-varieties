// Small camera audit, reporting evidence without imposing a camera architecture.
// EK_CAMERA_SOURCE_FILE selects a historical/candidate camera with current deps.
import assert from 'assert';
import {source,distance,renderedFeatures,invariantFeatures,arrowFeatures} from './continuity-features.mjs';
import {structuralDefects} from './structural-screen-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {balancedObservables}=await import(source('balanced-observables.js'));
 const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
 const {E6_DEFAULT_BETA,betaToLevels}=await import(source('e6-parameters.js'));
 const fixtures=[.35,.46671975,.5748772323131561,.7803880870342255].map(r=>({label:'default '+r,p:{r},beta:E6_DEFAULT_BETA}));
 fixtures.push({label:'central phase anchor',p:{r:.08739584396954322},beta:[[.751,2.225],[2.793,.602],[.938,.702]],chamber:'weyl:2.5.0.3.2.0.1.4.1.0.2.3.0.5.2.5.2.0.1.4.1.4.1.4.1.0.2.1.0.3.2.0.1.4.1.0.2.3.0.1.5'});
 function sample(f,h){
  const s=solveBalancedAtlas({theta:0,phi:0,t:0,sphere:0,...f.p,r:f.p.r+h},betaToLevels(f.beta),{chamber:f.chamber});
  assert(s.success&&s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8,'strict solve');
  const d=balancedTensorDiagram(s.solvedRep);
  if(!d.valid)return {valid:false,reason:d.reason};
  const arrows=arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity);
  const rawDefects=structuralDefects({...d,layout:{...d.layout,points:d.layout.rawPoints||d.layout.points}});
  return {valid:true,currentGlyphContract:d.glyphs.every(g=>!g||Array.isArray(g.magnitudes)),arrowNorm:Math.hypot(...arrows),lines:d.layout.lines,lineWeights:d.layout.lineWeights,classification:{pointEqual:d.data.pointEqual,lineEqual:d.data.lineEqual,collinear:d.data.collinear,concurrent:d.data.concurrent},features:[invariantFeatures(balancedObservables(s.solvedRep)),renderedFeatures(d),arrows],diagnostics:d.diagnostics,defects:structuralDefects(d),rawDefects,cameraDefects:d.layout.cameraDefects,points:d.layout.rawPoints||d.layout.points};
 }
 if(process.argv.includes('--branches')){
  const rows=[];
  for(const r of [0,.5,1])for(const sphere of(r===.5?[0]:[0,1]))for(const t of [0,.3,.8,1])for(const phi of [0,.6,1.5]){
   const p={r,sphere,t,phi},s=sample({p,beta:E6_DEFAULT_BETA},0);const {features,...evidence}=s;rows.push({p,...evidence});
  }
  console.log(JSON.stringify({rows}));return;
 }
 console.log(JSON.stringify({featureOrder:['source invariants','screen flags','current renderer arrows'],rows:fixtures.map(f=>({label:f.label,pairs:[1e-3,1e-4,1e-5,1e-6].map(h=>{const a=sample(f,-h),b=sample(f,h);return {h,deltas:a.valid&&b.valid?a.features.map((x,k)=>distance(x,b.features[k])):null,samples:[a,b].map(({features,...x})=>x)};})}))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
