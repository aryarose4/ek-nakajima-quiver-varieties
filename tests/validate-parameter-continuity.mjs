import {source,distance,renderedFeatures,glyphFeatures,invariantFeatures,arrowFeatures} from './continuity-features.mjs';

(async function(){
  const {solveBalancedAtlas}=await import(source('balanced-model.js'));
  const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
  const {balancedObservables}=await import(source('balanced-observables.js'));
  const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
  const {E6_DEFAULT_BETA:defaultBeta,betaToLevels}=await import(source('e6-parameters.js'));
  const {e6WallTransitionOptions}=await import(source('e6-wall-transitions.js'));
  const adjacent=process.argv.includes('--adjacent');
  const E6_DEFAULT_BETA=adjacent?[[46/30,1/2],[3/2,61/60],[44/30,46/30]]:defaultBeta;
  const chamber=adjacent?{id:'side-zero-second',word:[4,1,0,3,0,1,4]}:undefined;
  const defaults={r:.35,theta:.7,t:.3,phi:.6,sphere:0},failures=[],rows=[];
  let solves=0;
  function sample(input){
    const p={...defaults,...input.p},beta=input.beta||E6_DEFAULT_BETA;
    const selectedChamber=input.chamber===undefined?chamber:input.chamber;
    const s=solveBalancedAtlas(p,betaToLevels(beta),{chamber:selectedChamber});solves++;
    if(!s.success)throw Error('solve '+JSON.stringify({p,beta,residuals:s.residuals}));
    if(!(s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8))throw Error('moment residual '+JSON.stringify({p,beta,residuals:s.residuals}));
    if(selectedChamber&&selectedChamber.id==='side-zero-second'&&(s.chamberId!=='side-zero-second'||s.diagnostics.transported!==true))throw Error('chamber transport was not applied');
    const d=balancedTensorDiagram(s.solvedRep);
    if(!d.valid)throw Error('camera '+JSON.stringify({p,beta,reason:d.reason}));
    const result=[invariantFeatures(balancedObservables(s.solvedRep)),renderedFeatures(d),glyphFeatures(d),arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity)];
    if(!result.every(a=>a.every(Number.isFinite)))throw Error('nonfinite '+JSON.stringify({p,beta}));
    return result;
  }
  // Compare shrinking opposite-side neighborhoods (or one-sided wall collars).
  // The factor .6 allows square-root endpoint charts (expected ratio sqrt(.1)),
  // while rejecting a persistent jump. Absolute floor only absorbs solve noise.
  function convergence(label,pair){
    try{
      const inputs=[1e-3,1e-4,1e-5].map(pair),features=inputs.map(ab=>ab.map(sample));
      const errors=[0,1,2,3].map(k=>features.map(ab=>distance(ab[0][k],ab[1][k])));
      const ok=errors.every(e=>e[2]<Math.max(2e-6,.6*e[0])&&e[2]<Math.max(2e-6,.8*e[1]));
      const row={label,errors};rows.push(row);
      if(!ok)failures.push({...row,inputs});
    }catch(e){failures.push({label,error:e.message});}
  }
  for(const r of [.2,.343,.5,.8])convergence('r='+r,h=>[-1,1].map(sign=>({p:{r:r+sign*h,t:0}})));
  for(const r of [0,.5,1])convergence('r attachment='+r,h=>{
    const offsets=r===0?[h,0]:r===1?[-h,0]:[-h,h];
    return offsets.map(offset=>({p:{r:r+offset,theta:0,t:.3}}));
  });
  convergence('theta=0 short attachment',h=>[-1,1].map(sign=>({p:{r:.5,theta:sign*h,t:.3}})));
  convergence('theta +/-pi seam',h=>[-1,1].map(sign=>({p:{theta:sign*(Math.PI-h),t:0}})));
  for(const r of [0,.5,1])for(const sphere of (r===.5?[0]:[0,1])){
    convergence('t tip '+r+':'+sphere,h=>[{p:{r,theta:0,sphere,t:1-h}},{p:{r,theta:0,sphere,t:1}}]);
    convergence('phi seam '+r+':'+sphere,h=>[-1,1].map(sign=>({p:{r,theta:0,sphere,t:.4,phi:sign*(Math.PI-h)}})));
    if(sphere===0&&r!==.5)convergence('sphere overlap '+r,h=>[{p:{r,theta:0,sphere:0,t:1-h}},{p:{r,theta:0,sphere:1,t:h}}]);
  }
  for(let index=0;index<6;index++)convergence('beta interior '+index,h=>[-1,1].map(sign=>{
    const beta=E6_DEFAULT_BETA.map(row=>row.slice());beta[Math.floor(index/2)][index%2]+=sign*h;
    return {beta};
  }));
  for(const wall of e6WallTransitionOptions(E6_DEFAULT_BETA)){
    // Stay strictly regular. Compare two points approaching the same physical
    // facet rather than pretending the regular solver accepts a singular orbit.
    for(const p of [{r:.35,theta:.7,t:0},{r:0,theta:0,t:.4,sphere:1}])
      convergence('wall '+wall.id+' '+JSON.stringify(p),h=>[h,2*h].map(epsilon=>({p,beta:wall.wallBeta.map((row,i)=>row.map((x,j)=>x+epsilon*(E6_DEFAULT_BETA[i][j]-x)))})));
  }
  if(adjacent)for(const p of [{r:.35,theta:.7,t:0},{r:0,theta:0,t:.4,sphere:1}]){
    convergence('two-sided crossed wall '+JSON.stringify(p),h=>[-1,1].map(sign=>({p,
      chamber:sign<0?{id:'default'}:chamber,
      beta:defaultBeta.map((row,i)=>row.map((x,j)=>(x+E6_DEFAULT_BETA[i][j])/2+sign*h*(E6_DEFAULT_BETA[i][j]-x)))
    })));
  }
  console.log(JSON.stringify({chamber:adjacent?'side-zero-second':'default',solves,cases:rows.length,rows,failures}));
  if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
