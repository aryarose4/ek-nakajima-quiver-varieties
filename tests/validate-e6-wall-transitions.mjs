import assert from 'assert';
import { e6WallTransitionOptions } from './e6-wall-transitions.js';
import { e6RootWallAudit } from './e6-levels.js';
const initial = [[1.5,0.5],[1.5,1.05],[1.5,1.5]];
const audit = beta => e6RootWallAudit(beta, 1e-9);
let beta = initial, count = 0;
for (let step = 0; step < 100; step++) {
  const before = JSON.stringify(beta), options = e6WallTransitionOptions(beta);
  assert.strictEqual(options.length,6);
  assert.strictEqual(new Set(options.map(x => x.id)).size,6);
  options.forEach(option => {
    assert.strictEqual(option.canCross,false);
    assert.strictEqual(option.canApproach,false);
    assert(option.period > 0);
    assert.strictEqual(audit(option.wallBeta).walls.length,2);
    if (option.kind === 'coordinate-zero') {
      assert.strictEqual(option.crossing,null);
      assert([].concat(...option.wallBeta).some(x => Math.abs(x)<1e-9));
      return;
    }
    const target = option.crossing.targetBeta;
    assert([].concat(...target).every(x => x>0));
    const sourceRoots = audit(beta).roots, targetAudit = audit(target);
    assert(targetAudit.regular);
    assert.strictEqual(sourceRoots.filter((r,i) => r.weight*targetAudit.roots[i].weight<0).length,2);
    count++;
  });
  assert.strictEqual(JSON.stringify(beta), before);
  // Deterministic bounded exploration: reset periodically to avoid exponential
  // approach to intersections in a long sequence of halfway-to-wall steps.
  const reachable = options.filter(x => x.crossing);
  beta = step % 4 === 3 ? initial : reachable[step % reachable.length].crossing.targetBeta;
}
const options = e6WallTransitionOptions(initial);
assert.strictEqual(options.filter(x=>x.crossing).length,5);
assert.strictEqual(options.filter(x=>x.kind==='coordinate-zero').length,1);
assert.throws(()=>e6WallTransitionOptions([[1,2]]),RangeError);
assert.throws(()=>e6WallTransitionOptions([[0,1],[1,1],[1,1]]),RangeError);
assert.throws(()=>e6WallTransitionOptions(options[0].wallBeta),RangeError);
console.log('E6 wall planning: '+count+' positive-beta crossings, six facets, boundary rejection and mutation guards pass.');

