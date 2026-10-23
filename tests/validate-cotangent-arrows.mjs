import assert from 'assert';
import {cotangentArrowGeometry,cotangentArrowColor,cotangentArrowOpacity} from './element-render.js';
import {balancedDiagram} from './balanced-diagram.js';
import {solveBalancedAtlas} from './balanced-model.js';
import {applyComplexGauge} from './solver.js';
import {eyeZ} from './core-math.js';
for(const line of [[[0,0],[100,0]],[[0,0],[60,80]]]) {
  const d=line[1],p=d.map(x=>.3*x),target=d.map(x=>.7*x);
  const arrows=cotangentArrowGeometry(p,line,target);
  arrows.forEach(a=>assert.ok(Math.abs(Math.hypot(...a.end.map((v,j)=>v-a.start[j]))-16)<1e-10));
  const vectors=arrows.map(a=>a.end.map((v,j)=>v-a.start[j]));
  assert.ok(Math.abs(vectors[0][0]*d[1]-vectors[0][1]*d[0])<1e-10);
  for(const k of [1,2])assert.ok(Math.abs(vectors[k][0]*d[0]+vectors[k][1]*d[1])<1e-10);
  assert.strictEqual(cotangentArrowGeometry(p,line,null)[2],null);
  // Target crossing and the former close-target cutoff cannot flip sides.
  for(const center of [0,64/3]) {
    const nearby=[-1e-6,1e-6].map(h=>cotangentArrowGeometry(p,line,p.map((x,j)=>x+(center+h)*d[j]/100)));
    for(let k=0;k<3;k++)for(const endpoint of ['start','end'])
      assert.ok(Math.hypot(...nearby[0][k][endpoint].map((x,j)=>x-nearby[1][k][endpoint][j]))<3e-6,'continuous arrow side at target crossing/cutoff');
  }
  assert.ok(vectors[1].reduce((s,x,j)=>s+x*vectors[2][j],0)<0,'normal arrows stay on opposite sides');
}
assert.strictEqual(cotangentArrowColor([0,0],false),null);
assert.strictEqual(cotangentArrowOpacity([0,0]),0);
assert.ok(cotangentArrowOpacity([.001,0])<.002,'tiny arrows still fade almost completely');
assert.strictEqual(cotangentArrowOpacity([.025,0]),.5,'fade is concentrated near zero');
assert.strictEqual(cotangentArrowOpacity([.05,0]),1,'small nonzero arrows reach full opacity');
assert.strictEqual(cotangentArrowOpacity([1,0]),1,'larger arrows stay fully opaque');
assert.strictEqual(cotangentArrowOpacity([.1,0]),cotangentArrowOpacity([0,.1]));
assert.ok(cotangentArrowColor([1,0],false).includes('28%)'),'light-theme arrows are darker');
assert.notStrictEqual(cotangentArrowColor([1,0],false),cotangentArrowColor([0,1],false));
const solved=solveBalancedAtlas({r:.3,theta:.7,t:.4,phi:.9});assert.ok(solved.success);
const rep=solved.solvedRep,a=rep.a[0].map(row=>row[0]),n=Math.hypot(...a.flat());
const h=eyeZ(2);
h[0]=[a[1].map(v=>-v/n),a[0].map(v=>v/n)];
h[1]=a.map(z=>[z[0]/n,-z[1]/n]);
const swapped=applyComplexGauge(rep,eyeZ(3),[h,eyeZ(2),eyeZ(2)],[1,1,1]);
const before=balancedDiagram(rep),after=balancedDiagram(swapped,{previous:before});
const q=before.layout.cotangentTargets[0].homogeneous,v=after.layout.cotangentTargets[0].homogeneous;
const overlap=q.reduce((s,z,j)=>[s[0]+z[0]*v[j][0]+z[1]*v[j][1],s[1]+z[0]*v[j][1]-z[1]*v[j][0]],[0,0]);
assert.ok(Math.abs(Math.hypot(...overlap)-1)<1e-8,'fallback column preserves target after middle unitary gauge');
console.log('Cotangent arrows: fixed size, directions, colors, zero suppression, and column fallback passed.');
