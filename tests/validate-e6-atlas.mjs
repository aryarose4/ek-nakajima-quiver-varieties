import assert from 'assert';
import { e6AtlasPoint } from './e6-atlas.js';
import { checkFixedPointGrading, fixedPointInfinitesimalTest } from './fixed-point.js';
import { complexResidualNorm } from './core-math.js';
let checks = 0;
function check(ok, message) { checks++; assert.ok(ok, message); }
for (const r of [0, 0.5, 1]) {
  const spheres = r === 0.5 ? 1 : 2;
  const point = (sphere,t,phi=0,outgoing=false) => e6AtlasPoint({r,theta:0,t,phi,sphere,outgoing});
  for (let sphere = 0; sphere < spheres; sphere++) {
    for (const t of [0, 1]) for (const phi of [0, 0.6, -2]) {
      const p = point(sphere,t,phi);
      check(complexResidualNorm(p.rep) < 1e-12, 'junction/tip complex equations');
      check(!!p.grading && checkFixedPointGrading(p.rep,p.grading).passes, 'every junction/tip has full C* grading');
      check(fixedPointInfinitesimalTest(p.rep).consistent, 'fixed grading agrees with infinitesimal equations');
      check(JSON.stringify(p.rep) === JSON.stringify(point(sphere,t).rep), 'canonical fixed endpoint is phase independent');
    }
    for (const t of [.1,.5,.9]) {
      const p = point(sphere,t,.3);
      check(complexResidualNorm(p.rep) < 1e-8, 'finite sphere chart complex equations');
      check(!p.grading, 'interior is not mislabeled fixed');
      check(!fixedPointInfinitesimalTest(p.rep).consistent, 'sphere interior not fixed under arbitrary gauge');
    }
    const next = sphere === spheres-1 ? point(sphere,0,0,true) : point(sphere+1,0);
    check(JSON.stringify(point(sphere,1).rep) === JSON.stringify(next.rep), 'limit button shares the exact fixed representative');
  }
  for (const t of [0,.2,.6]) {
    const p = point(spheres-1,t,.4,true);
    check(complexResidualNorm(p.rep) < 1e-10, 'outgoing chart complex equations');
    check(!!p.grading === (t===0), 'only outgoing origin is fixed');
  }
  assert.throws(() => point(spheres-1,1,0,true), RangeError);
}
console.log(checks + ' E6 atlas junction, tip, transition, and fixedness checks passed.');
