import assert from 'assert';
import { solveBalancedAtlas } from './balanced-model.js';
import { e6RootWallAudit, E6_REGULAR_LEVELS } from './e6-levels.js';
import { frob2 } from './core-math.js';
const signs = e6RootWallAudit(E6_REGULAR_LEVELS).roots.map(root => Math.sign(root.weight));
let count = 0;
for (const levels of [E6_REGULAR_LEVELS, [[3.01,1.02],[2.99,2.11],[3.01,2.99]], [[2.98,.99],[3.02,2.09],[3,3.01]]]) {
  assert.ok(e6RootWallAudit(levels).roots.every((root,i) => Math.sign(root.weight) === signs[i]));
  const a = levels.map(row => row[0]/2), g = levels.map(row => row[1]/2);
  const T = a.reduce((s,v) => s+v,0)+2*g.reduce((s,v) => s+v,0);
  const fixed = [[0,0,T/3-a[1]-g[0]-g[1]], [0,1,-a[0]+a[2]-g[0]+g[1]],
    [1,0,T/3-a[2]-g[0]-g[2]], [1,1,-a[0]+a[1]-g[0]+g[2]],
    [.5,0,(a.reduce((s,v)=>s+v,0)-g.reduce((s,v)=>s+v,0))/3]];
  for (const [r,sphere,predicted] of fixed) {
    const out = solveBalancedAtlas({r,theta:0,t:1,phi:0,sphere},levels);
    assert.ok(out.success, 'fixed representative must balance');
    const measured = out.solvedRep.b.concat(out.solvedRep.B).reduce((s,m)=>s+frob2(m),0)/2;
    assert.ok(Math.abs(measured-predicted)<1e-8, 'fixed Hamiltonian agrees with grading');
    count++;
  }
}
console.log('E6 periods: '+count+' fixed Hamiltonians agree with grading formulas.');
