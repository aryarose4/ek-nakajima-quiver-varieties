import assert from 'assert';
import { source } from './continuity-features.mjs';
(async function () {
 const { magneticValue, snapSliderInput } = await import(source('slider-magnet.js'));
 const radial = [{value:0,tol:.005},{value:.5,tol:.02},{value:1,tol:.005}];
 for (const snap of radial.concat([{value:0,tol:.03*Math.PI}])) {
  assert.strictEqual(magneticValue(snap.value+.9*snap.tol,[snap]),snap.value);
  const outside=snap.value+1.01*snap.tol;
  assert.strictEqual(magneticValue(outside,[snap]),outside);
 }
 assert.strictEqual(magneticValue(.006,radial),.006);
 const handlers={}, input={value:'.49',addEventListener:(event,fn)=>handlers[event]=fn};
 const snap=snapSliderInput(input,radial);
 assert(snap()); assert.strictEqual(input.value,'0.5');
 handlers.keydown({key:'ArrowRight'});input.value='.501';
 assert(!snap()); assert.strictEqual(input.value,'0.501');
 handlers.keyup();input.value='.51';assert(snap());assert.strictEqual(input.value,'0.5');
 handlers.keydown({key:'ArrowLeft'});handlers.pointerdown();input.value='.49';assert(snap());
 console.log('Exact native snap thresholds and keyboard escape passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
