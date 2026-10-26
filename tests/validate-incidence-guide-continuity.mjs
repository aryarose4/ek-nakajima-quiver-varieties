import assert from 'assert';
import {source,distance,renderedFeatures} from './continuity-features.mjs';
(async function(){
  const {solveBalancedAtlas}=await import(source('balanced-model.js'));
  const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
  const {E6_DEFAULT_BETA,betaToLevels}=await import(source('e6-parameters.js'));
  const sample=p=>{
    const s=solveBalancedAtlas({r:.5,theta:0,t:0,phi:.6,sphere:0,...p},betaToLevels(E6_DEFAULT_BETA));
    assert(s.success&&s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8);
    const d=balancedTensorDiagram(s.solvedRep);assert(d.valid);return d;
  };
  const rows=[];
  for(const fixture of [{label:'real central concurrency',at:{t:0,phi:0},near:h=>({r:.5-h,t:0,phi:0}),kind:'concurrency'},
      {label:'short tip collinearity',at:{t:1},near:h=>({t:1-h}),kind:'transversal'}]){
    const exact=sample(fixture.at),near=[1e-3,1e-4,1e-5].map(h=>sample(fixture.near(h)));
    const errors=near.map(d=>distance(renderedFeatures(d),renderedFeatures(exact)));
    assert(errors[2]<errors[1]/5&&errors[1]<errors[0]/5,fixture.label+': '+errors);
    const key=fixture.kind+'Opacity';
    assert(exact.layout[key]>.9999,'exact guide retains full ink');
    assert(near[2].layout[key]>.9,'near guide fades into exact guide');
    assert.strictEqual(exact.data[fixture.kind==='concurrency'?'concurrent':'collinear'],true);
    assert.strictEqual(near[0].data[fixture.kind==='concurrency'?'concurrent':'collinear'],false,'screen collar does not alter mathematical classification');
    rows.push({label:fixture.label,errors});
  }
  const ordinary=sample({r:.35,theta:.7,t:.3});
  assert.strictEqual(ordinary.layout.concurrencyOpacity,0);
  assert.strictEqual(ordinary.layout.transversalOpacity,0);
  console.log(JSON.stringify({rows}));
})().catch(e=>{console.error(e);process.exitCode=1;});
