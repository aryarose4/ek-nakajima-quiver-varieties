import assert from 'assert';
import { e6CoreAreas } from './e6-areas.js';
import { E6_DEFAULT_BETA, constrainE6Beta } from './e6-parameters.js';
import { AFFINE_ADE } from './quiver-data.js';
import { buildSideLayout, coreFlow } from './core-view.js';
let checks = 0;
function close(a,b,msg) { assert.ok(Math.abs(a-b)<1e-10,msg); checks++; }
function point(a,b,msg) { a.forEach((v,i)=>close(v,b[i],msg)); }
const initial = e6CoreAreas(E6_DEFAULT_BETA);
[1/30,29/60,.5,1/30,29/60,29/60].forEach((v,i)=>close(initial.periods[i],v,'default period/node mapping'));
const paths = [E6_DEFAULT_BETA];
for (let i=0;i<6;i++) for (const value of [0,3,1,2]) paths.push(constrainE6Beta(E6_DEFAULT_BETA,i,value));
let walk = E6_DEFAULT_BETA;
for (let j=0;j<60;j++) { walk=constrainE6Beta(walk,j%6,(j%11)/3); paths.push(walk); }
for (const beta of paths) {
  const areas = e6CoreAreas(beta);
  const lay = buildSideLayout(AFFINE_ADE.E6,{radii:areas.radii});
  areas.radii.forEach((radius,i)=>close(4*Math.PI*radius*radius,areas.areas[i],'surface area equals symplectic area'));
  assert.deepStrictEqual(lay.arms.map(a=>a.nodes),[[1,0],[5],[3,4]]); checks++;
  lay.arms.forEach(arm=> {
    let parent=lay.root;
    arm.nodes.forEach((node,sphere)=> {
      const nd=lay.nodes[node], prev=lay.nodes[parent];
      close(Math.hypot(...nd.center.map((v,i)=>v-prev.center[i])),nd.radius+prev.radius,'edge tangent');
      const base=coreFlow(lay,{r:arm.param,theta:0,t:0,phi:.7,sphere});
      const tip=coreFlow(lay,{r:arm.param,theta:0,t:1,phi:.7,sphere});
      point(base.dot,nd.center.map((v,i)=>v-nd.radius*arm.dir[i]),'base attachment');
      point(tip.dot,nd.center.map((v,i)=>v+nd.radius*arm.dir[i]),'tip attachment');
      if (sphere>0) point(base.dot,coreFlow(lay,{r:arm.param,theta:0,t:1,phi:1.2,sphere:sphere-1}).dot,'limit transition continuous');
      else point(base.dot,prev.center.map((v,i)=>v+prev.radius*arm.dir[i]),'root attachment');
      const approach=coreFlow(lay,{r:arm.param===1?1-1e-10:arm.param+1e-10,theta:0,t:.4,phi:.7});
      if(sphere===0) point(approach.dot,coreFlow(lay,{r:arm.param,theta:0,t:.4,phi:.7,sphere:0}).dot,'capture smooth limit');
      parent=node;
    });
  });
}
assert.throws(()=>buildSideLayout(AFFINE_ADE.E6,{radii:[1,1,0,1,1,1]}),RangeError);
const tiny=buildSideLayout(AFFINE_ADE.E6,{radii:[1,1,1e-12,1,1,1]});
assert.strictEqual(tiny.nodes[tiny.root].radius,1e-12);
assert.throws(()=>e6CoreAreas([[1,1],[1,1],[1,1]]),RangeError);
for (const name of ['E7','E8']) assert.ok(buildSideLayout(AFFINE_ADE[name]).radii.every(v=>v===1));
console.log('E6 areas/layout: '+checks+' checks passed across '+paths.length+' chamber beta samples.');
