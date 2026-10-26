import assert from 'assert';
import {representativeForDisplay} from './representation-readout.js';
import {solveBalancedAtlas} from './balanced-model.js';
import {complexResidualNorm,realResidualNorm} from './core-math.js';
import {E6_REGULAR_LEVELS} from './e6-levels.js';
import {e6ReflectLevels,E6_ADJACENT_WORD} from './e6-chamber-transport.js';
const p={r:.3,theta:.5,t:.2,phi:.7,sphere:0,outgoing:false};
const source=solveBalancedAtlas(p);
assert(source.success);
assert.strictEqual(representativeForDisplay(source,'balanced'),source.solvedRep);
assert.strictEqual(representativeForDisplay(source,'complex'),source.rawRep,'default uses actual pre-balance atlas');
const target=E6_ADJACENT_WORD.reduce((z,v)=>e6ReflectLevels(z,v),E6_REGULAR_LEVELS);
const result=solveBalancedAtlas(p,target,{chamber:'side-zero-second'});
assert(result.success);
const before=JSON.stringify(result);
const complex=representativeForDisplay(result,'complex');
assert(complexResidualNorm(complex)<1e-8,'target complex moment map remains zero');
assert(realResidualNorm(complex,target)>1e-3,'complex representative is not the balanced representative');
assert.notDeepStrictEqual(complex,result.rawRep,'never relabel source chamber atlas as target');
for(let branch=0;branch<3;branch++)for(let row=0;row<3;row++)for(let col=0;col<2;col++) {
  const scale=[2,1,.5][row];
  assert.deepStrictEqual(complex.A[branch][row][col],result.solvedRep.A[branch][row][col].map(v=>v*scale));
}
assert.strictEqual(JSON.stringify(result),before,'display transform leaves solver result untouched');
assert.strictEqual(representativeForDisplay(null,'complex'),null);
assert.strictEqual(representativeForDisplay({...source,success:false},'complex'),null);
console.log('Representative display: defaults, target orbit/gauge, residuals, immutability and failure checks passed');
