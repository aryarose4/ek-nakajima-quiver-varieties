// Snaps and rapid retargets draw one exact solved frame, including all glyphs.
import assert from 'assert';
import {source} from './continuity-features.mjs';
(async function(){
 const {magneticValue}=await import(source('slider-magnet.js'));
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {makeElementView}=await import(source('element-render.js'));
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
 const paths=()=>calls.filter(c=>['moveTo','lineTo'].includes(c.name));
 function draw(rep,animateSnap){calls.length=0;const frame=renderer.setData({balancedRep:rep,animateSnap});return {frame,paths:paths()};}
 function ownIncidences(layout){
  layout.points.forEach((p,i)=>{
   if(layout.pointMarkers[i].clipped||!layout.pointOpacities[i]||!layout.lineOpacities[i])return;
   const [a,b]=layout.lines[i],d=b.map((v,j)=>v-a[j]);
   assert(Math.abs(d[0]*(p[1]-a[1])-d[1]*(p[0]-a[0]))/Math.hypot(...d)<1e-8,'visible own incidence is exact');
  });
 }
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
  const exact=balancedTensorDiagram(after.solvedRep),frozen=JSON.stringify(exact);
  renderer.setData(null);
  const target=draw(after.solvedRep,false);
  draw(before.solvedRep,false);
  const snapped=draw(after.solvedRep,true);
  assert.deepStrictEqual(snapped.paths,target.paths,'snap draws exact target lines, points and cotangent arrows immediately');
  assert.deepStrictEqual(snapped.frame,exact,'classifications, markers and glyphs share exact target geometry');
  assert.strictEqual(canvas['data-snap-transition'],'false');
  ownIncidences(snapped.frame.layout);
  for(const elapsed of [1,39,80,159,160]){
   now+=elapsed;calls.length=0;renderer.resize();
   assert.deepStrictEqual(paths(),target.paths,'no invalid intermediate frame after snap');
  }
  const original=draw(before.solvedRep,false);
  for(let k=0;k<8;k++){
   now+=7;
   const toAfter=k%2===0,rapid=draw(toAfter?after.solvedRep:before.solvedRep,true);
   assert.deepStrictEqual(rapid.paths,toAfter?target.paths:original.paths,'rapid retarget has no stale eased geometry');
   ownIncidences(rapid.frame.layout);
  }
  assert.strictEqual(JSON.stringify(exact),frozen,'target frame untouched');
  cases++;
 }
 // A segment is an unoriented projective line. Reversing its endpoints used
 // to collapse the screen tween to a point at 80ms. Exercise the actual draw.
 const solved=solveBalancedAtlas({r:.3,theta:0,t:.2,phi:0,sphere:0},levels);
 const frame=draw(solved.solvedRep,true).frame;
 frame.layout.lines[0]=[[-.6,0],[.6,0]];frame.layout.points[0]=[0,0];
 calls.length=0;renderer.resize();const forward=paths();
 frame.layout.lines[0]=[[.6,0],[-.6,0]];
 for(const elapsed of [0,40,80,120,160]){
  now+=elapsed;calls.length=0;renderer.resize();
  const line=paths().slice(0,2);
  assert.strictEqual(line[0].name,'moveTo');assert.strictEqual(line[1].name,'lineTo');
  assert(Math.hypot(...line[1].args.map((x,j)=>x-line[0].args[j]))>100,'endpoint reversal never collapses rendered line');
  assert.deepStrictEqual(line[0].args,forward[1].args);
  assert.deepStrictEqual(line[1].args,forward[0].args);
 }
 Date.now=realNow;
 console.log(cases+' exact solver snaps, rapid retargets, own incidences and reversed-line draw passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
