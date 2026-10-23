import assert from 'assert';
import {solveBalancedAtlas} from './balanced-model.js';
import {balancedObservables} from './balanced-observables.js';
import {balancedDiagram} from './balanced-diagram.js';
import {E6_DEFAULT_BETA,betaToLevels,e6DisplayBeta} from './e6-parameters.js';
const path=[1.50125,1.505,1.5075,1.5125,1.51625,1.51875,1.5225,1.52625,1.53,1.53375,1.5375,1.5425,1.54625,1.55];
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
      assert(last.diagnostics.rebased);assert(last.diagnostics.nfev<50,'wall solve avoids numerical stall');
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
  const away=solveBalancedAtlas(p,betaToLevels(beta),{previous,chamber});assert(away.success);assert(away.diagnostics.rebased);
  const moved=solveBalancedAtlas({...p,phi:.01},betaToLevels(beta),{previous,chamber});assert(moved.success);assert(!moved.diagnostics.rebased);
}
console.log('Wall rebased continuation, both chambers, residuals, invariants, render agreement and guards pass.');



