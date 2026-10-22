import assert from 'assert';
import {e6AtlasPoint,e6HasInfinityLimit} from './e6-atlas.js';
let checks=0;
for(const r of [0,.2,.5,1])for(const theta of [0,.7])for(const sphere of [0,1])for(const outgoing of [false,true]) {
  const parameters={r,theta,t:1,phi:.6,sphere,outgoing};
  let supported=true;
  try{e6AtlasPoint(parameters);}catch(_){supported=false;}
  assert.strictEqual(e6HasInfinityLimit(parameters),supported,'control eligibility matches exact endpoint chart');checks++;
}
console.log(checks+' infinity control endpoint checks passed.');
