import assert from 'assert';
import {source,distance,renderedFeatures,arrowFeatures} from './continuity-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram:diagram}=await import(source('weighted-balanced-diagram.js'));
 const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {eyeZ}=await import(source('core-math.js'));
 const {flagIncidence}=await import(source('flag-incidence.js'));
 const levels=[[2.46,.8],[3.28,2.82],[2.12,3.64]],rows=[];
 const gauge=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
 const phase=[Math.cos(.3),Math.sin(.3)],minimumNorms=[Infinity,Infinity,Infinity];
 const sites=[...Array.from({length:11},(_,i)=>({r:i/10,t:0,sphere:0})),...[1].flatMap(sphere=>[0,1].flatMap(r=>[0,.4,1].map(t=>({sphere,r,t}))))];
 for(const siteLevels of [levels,[[3,1],[3,2.1],[3,3]]])for(const site of sites){
  const solved=solveBalancedAtlas({theta:0,phi:.6,...site},siteLevels);assert(solved.success,JSON.stringify(site));
  const d=diagram(solved.solvedRep);assert(d.valid,'sampled QR camera exists');
  d.diagnostics.qrNorms.forEach((n,i)=>{assert(n>1e-8,'positive QR residual');minimumNorms[i]=Math.min(minimumNorms[i],n);});
  for(let i=0;i<3;i++)if(d.layout.lineOpacities[i]>.9)assert(distance(...d.layout.lines[i])>1e-7,'full physical plane has a visible segment');
  const incidence=flagIncidence(solved.solvedRep);
  for(const key of ['incident','pointEqual','lineEqual','concurrent','collinear'])assert.deepStrictEqual(d.data[key],incidence[key],'classification uses source flags');
  const moved=diagram(applyComplexGauge(solved.solvedRep,gauge,[eyeZ(2),eyeZ(2),eyeZ(2)],[phase,phase,phase]));
  assert(moved.valid);assert(distance(renderedFeatures(d),renderedFeatures(moved))<1e-7,'unitary gauge preserves geometry');
  assert(distance(arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity),arrowFeatures(moved,cotangentArrowGeometry,cotangentArrowOpacity))<1e-7,'unitary gauge preserves arrows');
 }

 function sample(r){
  const solved=solveBalancedAtlas({r,theta:0,t:0,phi:0,sphere:0},levels);
  assert(solved.success);const d=diagram(solved.solvedRep);assert(d.valid);
  const f=renderedFeatures(d).concat(arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity));
  assert(f.every(Number.isFinite));return f;
 }
 for(const r of [.46671975,.5748772323,.780388087,.08739584396954322]){
  const errors=[1e-5,1e-6,1e-7].map(h=>distance(sample(r-h),sample(r+h)));
  assert(errors[1]<.15*errors[0]&&errors[2]<.15*errors[1],`phase-anchor continuity at ${r}: ${errors}`);
  rows.push({r,errors});
 }
 // This is a local regression, not a global camera theorem. Spectral collisions,
 // affine infinity and zero projected normals remain separate failure modes.
 console.log(JSON.stringify({cases:rows.length,sites:sites.length*2,levelFixtures:2,minimumNorms,rows}));
})().catch(error=>{console.error(error);process.exitCode=1;});


