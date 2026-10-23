import assert from 'assert';
import {solveBalancedAtlas} from './balanced-model.js';
import {balancedObservables} from './balanced-observables.js';
import {balancedDiagram} from './balanced-diagram.js';
import {E6_DEFAULT_BETA,betaToLevels,e6DisplayBeta} from './e6-parameters.js';
const path=[1.5,1.53,1.54,1.545,1.549,1.5499,1.54999,1.55];
for(const chamber of ['default','side-zero-second'])for(const t of [.4,.7]) {
  const p={r:0,theta:0,t,phi:0,sphere:1};let previous=null,last;
  for(const b of path) {
    const beta=E6_DEFAULT_BETA.map(row=>row.slice());beta[0][0]=chamber==='default'?b:3.1-b;
    const levels=betaToLevels(e6DisplayBeta(beta,chamber));
    const saved=JSON.stringify(previous),start=Date.now();
    last=solveBalancedAtlas(p,levels,{previous,chamber});
    assert(last.success);assert(last.residuals.real_norm<=1e-9);assert(last.residuals.complex_norm<=1e-8);
    assert.strictEqual(JSON.stringify(previous),saved,'continuation remains immutable');
    previous=last; const elapsed=Date.now()-start;
    if(b===1.55) {
      assert(last.diagnostics.predicted);assert(last.diagnostics.nfev<500,'wall solve avoids numerical stall');
      const cold=solveBalancedAtlas(p,levels,{chamber});assert(cold.success);
      const a=balancedObservables(last.solvedRep).gram.flat(2),c=balancedObservables(cold.solvedRep).gram.flat(2);
      assert(Math.max(...a.map((v,i)=>Math.abs(v-c[i])/(1+Math.abs(c[i]))))<3e-7);
      const frame=balancedDiagram(last.solvedRep),reference=balancedDiagram(cold.solvedRep,{previous:frame});
      assert(frame.valid&&reference.valid);
      assert(Math.max(...frame.layout.points.flat().map((v,i)=>Math.abs(v-reference.layout.points.flat()[i])))<1e-5);
      console.log(chamber,t,'wall ms',elapsed,'nfev',last.diagnostics.nfev,'real',last.residuals.real_norm);
    }
  }
  const beta=E6_DEFAULT_BETA.map(row=>row.slice());beta[0][0]=chamber==='default'?1.54:1.56;
  const away=solveBalancedAtlas(p,betaToLevels(beta),{previous,chamber});assert(away.success);assert(!away.diagnostics.predicted);
  const moved=solveBalancedAtlas({...p,phi:.01},betaToLevels(beta),{previous,chamber});assert(moved.success);assert(!moved.diagnostics.predicted);
}
console.log('Wall secant continuation, both chambers, residuals, invariants, render agreement and guards pass.');


