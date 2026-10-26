import assert from 'assert';
import {fullImageIncidences,balancedTensorDiagram} from './weighted-balanced-diagram.js';
import {incidenceIndicators} from './incidence-indicators.js';
import {elementFrame,makeElementView} from './element-render.js';
import {solveBalancedAtlas} from './balanced-model.js';
import {applyComplexGauge} from './solver.js';
import {eyeZ} from './core-math.js';
const z=x=>[x,0], M=rows=>rows.map(r=>r.map(z));
const A=M([[1,0],[0,1],[0,0]]),a=M([[1],[0]]);
const rep={A:[A,A,A],a:[a,a,a],B:[M([[0,1,0],[0,0,1]]),M([[0,0,0],[0,0,0]]),M([[1,0,0],[0,0,0]])]};
let facts=fullImageIncidences(rep);
assert.deepStrictEqual(facts[0].points,[false,false,false],'rank-two full image cannot equal one selected column');
assert.deepStrictEqual(facts[0].planes,[false,true,true]);
assert.strictEqual(facts[1],null,'zero operator has no image facts');
assert.deepStrictEqual(facts[2].points,[true,true,true]);
rep.a[1]=M([[0],[0]]);rep.A[1]=M([[1,0],[0,0],[0,0]]);
facts=fullImageIncidences(rep);assert.strictEqual(facts[2].points[1],false);assert.strictEqual(facts[0].planes[1],false);
const beta=[[1.004,.400],[2.753,1.315],[1.686,1.163]],levels=beta.map(r=>r.map(x=>2*x));
const chamber='weyl:5.2.0.1.4.1.4.1.0.1.4.1.0.4.1.0.2.5';
const U=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
let count=0;
for(const r of [0,.5,1,.37]){
 const solved=solveBalancedAtlas({r,theta:0,t:0,phi:0,sphere:0},levels,{chamber});assert(solved.success);
 const d=elementFrame({balancedRep:solved.solvedRep,chamberId:chamber}).data;
 const labels=incidenceIndicators(d);count+=labels.filter(s=>s.startsWith('im(')).length;
 const moved=balancedTensorDiagram(applyComplexGauge(solved.solvedRep,U,[eyeZ(2),eyeZ(2),eyeZ(2)],[1,1,1])).data;
 assert.deepStrictEqual(d.imageIncidences,moved.imageIncidences,'unitary gauge invariant');
 const complexGauge=M([[2,0,0],[0,.7,0],[0,0,1.4]]);
 assert.deepStrictEqual(fullImageIncidences(solved.solvedRep),fullImageIncidences(applyComplexGauge(solved.solvedRep,complexGauge,[eyeZ(2),eyeZ(2),eyeZ(2)],[1,1,1])),'nonunitary complex gauge preserves image incidences');
 const base=incidenceIndicators({...d,chamberId:'default'});
 assert.deepStrictEqual(labels.slice(0,base.length),base,'base stratum order retained');
 assert(!base.some(s=>s.startsWith('im(')));
 assert.deepStrictEqual(incidenceIndicators(elementFrame({balancedRep:solved.solvedRep}).data),base,'missing context clears image labels');
}
assert(count>0,'genuine reflected chamber provides informative images');
// Explicit formatter reduction: equality groups and point-implied planes.
const all=[0,1,2],matrix=f=>all.map(i=>all.map(j=>f(i,j)));
const grouped={valid:true,chamberId:chamber,pointPresent:[true,true,false],linePresent:[true,true,true],
 pointEqual:matrix((i,j)=>i===j||i<2&&j<2),lineEqual:matrix((i,j)=>i===j),incident:matrix((i,j)=>i===j||i<2&&j===2),
 imageIncidences:[{points:[true,true,false],planes:[false,true,true]},null,null]};
assert.deepStrictEqual(incidenceIndicators(grouped).filter(s=>s.startsWith('im(')),['im(ϕ₁)⊂L₁'],'point targets suppress implied planes');
function element(){const e={style:{},children:[],appendChild(c){this.children.push(c);},setAttribute(k,v){this[k]=v;},addEventListener(){},getContext(){return null;}};
 Object.defineProperty(e,'textContent',{set(v){this.children=[];this.text=v;},get(){return this.text;}});return e;}
global.document={createElement:element,documentElement:{getAttribute(){return 'light';}}};
const host=element();host.clientWidth=400;host.clientHeight=400;
const renderer=makeElementView(host),overlay=host.children.find(e=>e.className==='ek-incidence-indicators');
const solved=solveBalancedAtlas({r:0,theta:0,t:0,phi:0,sphere:0},levels,{chamber});
renderer.setData({balancedRep:solved.solvedRep,chamberId:chamber});
assert(overlay.children.some(e=>e.textContent.startsWith('im(')&&e.title&&e['aria-label']));
renderer.setData({balancedRep:solved.solvedRep,chamberId:'default'});
assert(!overlay.children.some(e=>e.textContent.startsWith('im(')),'live default context removes image badges');
renderer.setData(null);assert.strictEqual(overlay.children.length,0);
console.log('Full phi images: rank2, zero/missing flags, reflected fixtures, gauge invariance, chamber gating and ordering passed; badges='+count);
