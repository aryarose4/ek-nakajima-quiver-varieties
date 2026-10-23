import assert from 'assert';
import {E6_DEFAULT_BETA, E6_REFERENCE_BETA, betaToLevels, e6BetaInterval} from './e6-parameters.js';
import {e6RootWallAudit} from './e6-levels.js';
import {solveBalancedAtlas} from './balanced-model.js';
const flat=E6_DEFAULT_BETA.flat(), reference=e6RootWallAudit(betaToLevels(E6_REFERENCE_BETA));
assert.strictEqual(new Set(flat).size,6);
assert(flat.every(x=>x>0&&x<3));
const audit=e6RootWallAudit(betaToLevels(E6_DEFAULT_BETA));
assert(audit.minAbsWeight>=.20-1e-12);
assert.deepStrictEqual(audit.roots.map(r=>Math.sign(r.weight)),reference.roots.map(r=>Math.sign(r.weight)));
let minOther=Infinity,minTravel=Infinity;
for(let index=0;index<6;index++) {
 const interval=e6BetaInterval(E6_DEFAULT_BETA,index);
 minTravel=Math.min(minTravel,flat[index]-interval.lo,interval.hi-flat[index]);
 for(const endpoint of [interval.lo,interval.hi]) {
  const beta=E6_DEFAULT_BETA.map(row=>row.slice()); beta[Math.floor(index/2)][index%2]=endpoint;
  const boundary=e6RootWallAudit(betaToLevels(beta));
  assert.strictEqual(boundary.walls.length,2,'one complementary root pair at each slider endpoint');
  const a=boundary.walls[0],b=boundary.walls[1];
  assert.strictEqual(a.center+b.center,3);
  a.middle.forEach((x,i)=>assert.strictEqual(x+b.middle[i],2));
  a.outer.forEach((x,i)=>assert.strictEqual(x+b.outer[i],1));
  minOther=Math.min(minOther,...boundary.roots.filter(r=>Math.abs(r.weight)>1e-10).map(r=>Math.abs(r.weight)));
 }
}
assert(minTravel>=.30-1e-12);assert(minOther>=.34-1e-12);
let solves=0,worst=0;
const points=[{r:.35,theta:.8,t:.3,phi:.7,sphere:0}];
for(const r of [0,.5,1])for(const t of [0,.5,1])for(const sphere of (r===.5?[0]:[0,1]))points.push({r,theta:0,t,phi:.7,sphere});
for(const p of points){const out=solveBalancedAtlas(p,betaToLevels(E6_DEFAULT_BETA));assert(out.success,JSON.stringify({p,diagnostics:out.diagnostics}));assert(out.residuals.real_norm<=1e-9);assert(out.residuals.complex_norm<=1e-8);worst=Math.max(worst,out.residuals.real_norm);solves++;}
console.log('Distinct E6 defaults: 12 isolated slider walls; minimum travel '+minTravel.toFixed(2)+', other-root level margin '+minOther.toFixed(2)+'; '+solves+' central/arm/tip solves, worst real residual '+worst+'.');
