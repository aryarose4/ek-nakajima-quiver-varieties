import assert from 'assert';
import {imageSourceOrder,informativeImageSources} from './image-incidence-order.js';
import {e6AtlasPoint} from './e6-atlas.js';
import {e6TransportWord} from './e6-chamber-transport.js';
import {e6ChamberWord} from './e6-parameters.js';
import {E6_REGULAR_LEVELS} from './e6-levels.js';
import {solveBalancedAtlas} from './balanced-model.js';
import {elementFrame} from './element-render.js';
import {incidenceIndicators} from './incidence-indicators.js';
const chamber='weyl:5.2.0.1.4.1.4.1.0.1.4.1.0.4.1.0.2.5',word=e6ChamberWord(chamber);
const levels=[[1.004,.400],[2.753,1.315],[1.686,1.163]].map(r=>r.map(x=>x*2));
let checks=0;
for(const r of [0,.5,1]) {
 const stages=r===.5?[[0,0,false],[0,.3,false],[0,1,false],[0,.3,true]]:
   [[0,0,false],[0,.3,false],[0,1,false],[1,0,false],[1,.3,false],[1,1,false],[1,.3,true]];
 for(const phase of [0,.37,.79]) {
  let previous=[];
  for(const [sphere,t,outgoing] of stages) {
   const parameters={r,theta:0,phi:phase,sphere,t,outgoing};
   const raw=e6TransportWord(e6AtlasPoint(parameters).rep,E6_REGULAR_LEVELS,word).rep;
   const solution=solveBalancedAtlas(parameters,levels,{chamber});assert(solution.success,JSON.stringify(parameters));
   assert.deepStrictEqual(informativeImageSources(raw),informativeImageSources(solution.solvedRep),'raw canonical source classification matches actual balanced chamber');
   const frame=elementFrame({balancedRep:solution.solvedRep,chamberId:chamber,parameters});
   const labels=incidenceIndicators(frame.data).filter(label=>label.startsWith('im('));
   const ids=labels.map(label=>['₁','₂','₃'].findIndex(sub=>label.startsWith('im(ϕ'+sub)));
   const surviving=previous.filter(i=>ids.includes(i)),fresh=ids.filter(i=>!previous.includes(i));
   assert.deepStrictEqual(ids,surviving.concat(fresh),'survivors retain order; new sources append at '+JSON.stringify(parameters));
   assert.deepStrictEqual(imageSourceOrder(chamber,parameters),imageSourceOrder(chamber,{...parameters}),'cached order deterministic');
   previous=ids;checks++;
  }
 }
}
assert.deepStrictEqual(imageSourceOrder('weyl:invalid',{r:0,t:.3,sphere:0,theta:0}),[0,1,2],'failed canonical transport keeps deterministic source fallback');
assert.deepStrictEqual(imageSourceOrder('default',{r:0,t:.3,sphere:0,theta:0}),[0,1,2]);
console.log('Image source order: '+checks+' reflected climb/phase comparisons, current solved-only badges, deterministic fallback passed.');
