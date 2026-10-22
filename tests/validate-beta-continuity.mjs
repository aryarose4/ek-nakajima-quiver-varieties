import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
function source(name) {
  if(cache[name])return cache[name];
  let code=fs.readFileSync(path.join(base,name),'utf8');
  // Inspect the internal residual without adding a browser API just for tests.
  if(name==='solver.js')code+='\nexport {makePackedResidual};';
  code=code.replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
  return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
(async function(){
  const {solveBalancedAtlas}=await import(source('balanced-model.js'));
  const {makePackedResidual,flatLogGauge}=await import(source('solver.js'));
  const {balancedDiagram}=await import(source('balanced-diagram.js'));
  const {E6_DEFAULT_BETA,betaToLevels,constrainE6Beta,e6BetaInChamber}=await import(source('e6-parameters.js'));
  const parameters=(r,t)=>({r,theta:r===.5?0:.8,t,phi:.7,sphere:0});
  let checks=0,recovered=0,worstMs=0,worstResidual=0;
  function solve(p,beta,previous) {
    const start=Date.now(),out=solveBalancedAtlas(p,betaToLevels(beta),{previous});
    worstMs=Math.max(worstMs,Date.now()-start);
    assert(out.success,JSON.stringify({p,beta,residual:out.residuals,diagnostics:out.diagnostics}));
    assert(out.residuals.real_norm<=1e-9);assert(out.residuals.complex_norm<=1e-8);
    assert(out.diagnostics.gauge_positive);assert(out.continuation);checks++;
    if(out.diagnostics.attempts>1)recovered++;
    worstResidual=Math.max(worstResidual,out.residuals.real_norm);
    const diagram=balancedDiagram(out.solvedRep);
    assert(diagram.valid);assert(diagram.layout.points.flat().every(Number.isFinite));
    assert(diagram.layout.lines.flat(2).every(Number.isFinite));
    assert(diagram.layout.incidenceColors.lineHues.every(Number.isFinite));
    return out;
  }
  // Each of the six sliders at both red ends, from a completely cold solver.
  for(let index=0;index<6;index++)for(const endpoint of [0,3]) {
    const beta=constrainE6Beta(E6_DEFAULT_BETA,index,endpoint);assert(e6BetaInChamber(beta));
    for(const r of [0,.5,1])for(const t of [.3,1])solve(parameters(r,t),beta);
  }
  // Corners reached by successive slider drags reproduce reported browser failures.
  let corner=E6_DEFAULT_BETA.map(row=>row.slice());
  for(let index=0;index<6;index++)corner=constrainE6Beta(corner,index,3);
  for(const r of [0,.5,1])for(const t of [.3,.8,1])solve({...parameters(r,t),theta:0,phi:0},corner);
  for(const levels of [ [[3.0999996999999992,1.0000000000000007],[4.499999549999998,2.1],[3,3]], [[3.0999996999999992,1.0000000000000007],[4.499999549999998,2.1000000000000005],[3.899999324999998,3]] ]) {
    for(const r of [0,.5,1])solve({...parameters(r,.8),theta:0,phi:0},levels.map(row=>row.map(x=>x/2)));
  }
  // Validate all 23 analytic columns against independent centered differences.
  const baseline=solve(parameters(.35,.3),E6_DEFAULT_BETA);
  const f=makePackedResidual(baseline.numericalRep,betaToLevels(E6_DEFAULT_BETA),{analytic:true});
  const x=flatLogGauge(baseline.logGauge),J=f.jacobian(x);let jacobianError=0;
  for(let j=0;j<x.length;j++) {
    const h=1e-5*(1+Math.abs(x[j])),xp=x.slice(),xm=x.slice();xp[j]+=h;xm[j]-=h;
    const a=f(xp),b=f(xm);
    for(let i=0;i<a.length;i++)jacobianError=Math.max(jacobianError,Math.abs(J[i][j]-(a[i]-b[i])/(2*h))/(1+Math.abs(J[i][j])));
  }
  assert(jacobianError<2e-7,'analytic derivative relative error '+jacobianError);checks++;
  // Interior beta paths preserve a valid camera and return to the same view.
  for(const r of [0,.5,1]) {
    const p=parameters(r,.3);let out=solve(p,E6_DEFAULT_BETA),frame=balancedDiagram(out.solvedRep),first=frame;
    for(let k=1;k<=20;k++) {
      const beta=E6_DEFAULT_BETA.map((row,i)=>row.map((x,j)=>x+.001*Math.sin(2*Math.PI*k/20)*(1+i+j)));
      out=solve(p,beta,out);assert(out.diagnostics.warmStart,'changed beta uses continuation');
      const next=balancedDiagram(out.solvedRep,{previous:frame});
      const distance=Math.max(...next.layout.points.flat().map((x,i)=>Math.abs(x-frame.layout.points.flat()[i])));
      assert(distance<.04,'small beta step moves continuously '+distance);frame=next;
    }
    const distance=Math.max(...frame.layout.points.flat().map((x,i)=>Math.abs(x-first.layout.points.flat()[i])));
    assert(distance<2e-6,'closed beta path returns to same camera '+distance);checks++;
  }
  console.log(`Beta continuity: ${checks} checks; ${recovered} recovery solves; worst ${worstMs} ms, residual ${worstResidual}; Jacobian relative error ${jacobianError}.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
