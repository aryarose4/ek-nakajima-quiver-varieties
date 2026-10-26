import assert from 'assert';
import {incidenceIndicators} from './incidence-indicators.js';
import {makeElementView} from './element-render.js';
import {e6AtlasPoint} from './e6-atlas.js';
import {flagIncidence} from './flag-incidence.js';
import {solveBalancedAtlas} from './balanced-model.js';
const matrix=f=>[0,1,2].map(i=>[0,1,2].map(j=>f(i,j)));
const generic=()=>({valid:true,incident:matrix((i,j)=>i===j),pointEqual:matrix((i,j)=>i===j),
  lineEqual:matrix((i,j)=>i===j),pointPresent:[true,true,true],linePresent:[true,true,true]});
assert.deepStrictEqual(incidenceIndicators(generic()),[]);
assert.deepStrictEqual(incidenceIndicators(null),[]);
let d=generic();d.incident[0][1]=d.incident[0][2]=true;
assert.deepStrictEqual(incidenceIndicators(d),['L₁⊂P₂∩P₃']);
d.pointPresent[0]=false;assert.deepStrictEqual(incidenceIndicators(d),[]);
d.pointPresent[0]=true;d.linePresent[1]=false;
assert.deepStrictEqual(incidenceIndicators(d),['L₁⊂P₃']);
d.valid=false;assert.deepStrictEqual(incidenceIndicators(d),[]);
d=generic();d.collinear=d.concurrent=true;
assert.deepStrictEqual(incidenceIndicators(d),['dim(L₁+L₂+L₃)≤2','P₁∩P₂∩P₃≠{0}']);
d.pointPresent[1]=d.linePresent[1]=false;assert.deepStrictEqual(incidenceIndicators(d),[]);
d=generic();d.pointEqual=d.lineEqual=d.incident=matrix(()=>true);d.collinear=d.concurrent=true;
assert.deepStrictEqual(incidenceIndicators(d),['L₁=L₂=L₃','P₁=P₂=P₃'],'equalities suppress tautological memberships and aggregate rank facts');
d=generic();d.pointEqual[0][1]=d.pointEqual[1][0]=true;d.incident[0][1]=d.incident[1][0]=true;
assert.deepStrictEqual(incidenceIndicators(d),['L₁=L₂']);
// A small DOM double gives textContent its real child-clearing behavior.
function element(){const e={style:{},children:[],appendChild(c){this.children.push(c);},
  setAttribute(k,v){this[k]=v;},addEventListener(){},getContext(){return null;}};
  Object.defineProperty(e,'textContent',{set(v){this.children=[];this.text=v;},get(){return this.text;}});return e;}
let theme='light';global.document={createElement:element,documentElement:{getAttribute(){return theme;}}};
const host=element();host.clientWidth=390;host.clientHeight=400;
const renderer=makeElementView(host),overlay=host.children.find(e=>e.className==='ek-incidence-indicators');
const solved=e6AtlasPoint({r:0,sphere:0,theta:0,t:.4,phi:.2});
const frame=renderer.setData({...solved.view,incidence:flagIncidence(solved.rep)});
assert.ok(frame.data.valid);
assert.deepStrictEqual(overlay.children.map(e=>e.textContent),incidenceIndicators(frame.data));
assert.ok(overlay.children.length,'singular solved fixture has active incidences');
const before=overlay.children.map(e=>e.textContent);
renderer.setStatus('Solving','pending');assert.deepStrictEqual(overlay.children.map(e=>e.textContent),before);
theme='dark';renderer.refreshTheme();assert.strictEqual(overlay.children[0].style.color,'#e8c84a');
assert.strictEqual(overlay.style.left,'90px','reserve room for y control at narrow widths');
for (const r of [0,.35]) {
  const solution=solveBalancedAtlas({r,sphere:0,theta:.8,t:.3,phi:.7});
  assert.ok(solution.success);
  const balanced=renderer.setData({balancedRep:solution.solvedRep});
  assert.strictEqual(balanced.source,'balanced-weighted-tensors');
  assert.deepStrictEqual(overlay.children.map(e=>e.textContent),incidenceIndicators(balanced.data),
    'live overlay uses the exact balanced frame flags');
}
renderer.setData(null);assert.strictEqual(overlay.children.length,0,'unavailable frame clears indicators');
renderer.setData({incidence:{valid:false}});assert.strictEqual(overlay.children.length,0);
console.log('Incidence indicators: exact flags, grouping, rank loss, notation, live updates and clearing passed.');
