// Snapping is an exact mathematical jump; only projected drawing coordinates ease.
import assert from 'assert';
import {source} from './continuity-features.mjs';
(async function(){
 const {magneticValue}=await import(source('slider-magnet.js'));
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {interpolateScreenLayout,makeElementView}=await import(source('element-render.js'));
 const levels=[[1.23,.40],[1.64,1.41],[1.06,1.82]].map(row=>row.map(x=>2*x));
 let now=1000;
 const realNow=Date.now;Date.now=()=>now;
 const calls=[],ctx={};
 for(const name of ['setTransform','clearRect','beginPath','moveTo','lineTo','arc','fill','stroke','fillText','setLineDash'])ctx[name]=(...args)=>calls.push({name,args});
 const element=()=>({style:{},children:[],appendChild(x){this.children.push(x);},setAttribute(k,v){this[k]=v;},addEventListener(){},getContext(){return ctx;}});
 global.document={createElement:element,documentElement:{getAttribute(){return 'light';}}};
 global.requestAnimationFrame=()=>1;
 const host=element();host.clientWidth=500;host.clientHeight=400;
 const renderer=makeElementView(host),canvas=host.children[0];
 let cases=0;
 for(const [key,snaps,raw] of [
  ['r',[{value:0,tol:.005}],.004], ['r',[{value:.5,tol:.02}],.49],
  ['r',[{value:1,tol:.005}],.996], ['theta',[{value:0,tol:.03*Math.PI}],.08],
  ['phi',[{value:0,tol:.03*Math.PI}],.08]
 ]) {
  const p={r:.3,theta:.2,t:.2,phi:.2,sphere:0,[key]:raw};
  const before=solveBalancedAtlas(p,levels);assert(before.success);
  p[key]=magneticValue(raw,snaps);assert.strictEqual(p[key],snaps[0].value);
  const after=solveBalancedAtlas(p,levels);assert(after.success);
  assert(after.residuals.real_norm<1e-9&&after.residuals.complex_norm<1e-8);
  const a=balancedTensorDiagram(before.solvedRep),b=balancedTensorDiagram(after.solvedRep);
  assert(a.valid&&b.valid);
  const frozen=JSON.stringify(b);
  const start=interpolateScreenLayout(a.layout,b.layout,0);
  assert.deepStrictEqual(start.points,a.layout.points);
  const middle=interpolateScreenLayout(a.layout,b.layout,.5);
  assert.deepStrictEqual(middle.points[0],a.layout.points[0].map((x,i)=>(x+b.layout.points[0][i])/2));
  assert.strictEqual(interpolateScreenLayout(a.layout,b.layout,1),b.layout);
  assert.strictEqual(interpolateScreenLayout(a.layout,b.layout,2),b.layout);
  // Interrupted transitions restart at the currently displayed geometry.
  assert.deepStrictEqual(interpolateScreenLayout(middle,a.layout,0).points,middle.points);
  assert.strictEqual(interpolateScreenLayout(middle,a.layout,1),a.layout);
  assert.strictEqual(JSON.stringify(b),frozen,'target representation/frame untouched');
  assert.strictEqual(middle.incidenceColors,b.layout.incidenceColors,'target classifications stay exact');
  renderer.setData(null);
  renderer.setData({balancedRep:before.solvedRep});
  calls.length=0;
  renderer.setData({balancedRep:after.solvedRep,animateSnap:true});
  assert.strictEqual(canvas['data-snap-transition'],'true');
  const first=calls.find(c=>c.name==='moveTo').args;
  now+=80;calls.length=0;renderer.resize();
  const halfway=calls.find(c=>c.name==='moveTo').args;
  calls.length=0;
  renderer.setData({balancedRep:before.solvedRep});
  assert.strictEqual(canvas['data-snap-transition'],'true','nonsnap input retargets active ease');
  assert.deepStrictEqual(calls.find(c=>c.name==='moveTo').args,halfway,'interruption starts at displayed geometry');
  now+=160;calls.length=0;renderer.resize();
  assert.strictEqual(canvas['data-snap-transition'],'false');
  assert.deepStrictEqual(calls.find(c=>c.name==='moveTo').args,first,'interruption reaches exact original endpoint');
  cases++;
 }
 Date.now=realNow;
 console.log(cases+' exact solver targets and screen-only easing/interruption cases passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
