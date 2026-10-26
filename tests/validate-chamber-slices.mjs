import assert from 'assert';
import {e6BranchSlice} from './chamber-slices.js';
import {E6_DEFAULT_BETA,e6BetaWallCoefficients} from './e6-parameters.js';
import {createParametersPanel} from './parameters-panel.js';
const walls=e6BetaWallCoefficients();
for(let branch=0;branch<3;branch++) {
 const segments=e6BranchSlice(E6_DEFAULT_BETA,branch); assert(segments.length>5);
 const keys=new Set();
 segments.forEach(({equation,points})=>{
  const key=equation.map(x=>Math.round(x*1e8)).join(',');assert(!keys.has(key));keys.add(key);
  points.forEach(p=>{
   assert(p.every(x=>x>=0&&x<=3));assert(p.some(x=>Math.min(x,3-x)<1e-8));
   assert(Math.abs(equation[0]*p[0]+equation[1]*p[1]+equation[2])<1e-8);
  });
  assert(walls.some(w=>points.every(p=>{
   const v=[].concat(...E6_DEFAULT_BETA);v[2*branch]=p[0];v[2*branch+1]=p[1];
   return Math.abs(w.reduce((s,x,i)=>s+x*v[i],0))<1e-8;
  })), 'both endpoints lie on one genuine E6 wall');
 });
 assert.deepStrictEqual(e6BranchSlice(E6_DEFAULT_BETA,branch,walls.concat(walls.map(w=>w.map(x=>-x)))),segments);
}
const beta=[[1,1],[1,1],[1,1]];
assert.strictEqual(e6BranchSlice(beta,0,[[0,0,1,-1,0,0],[0,0,1,0,0,0]]).length,0);
assert.strictEqual(e6BranchSlice(beta,0,[[1,1,0,0,0,0]]).length,0,'corner contact is not a segment');
assert.strictEqual(e6BranchSlice(beta,0,[[1,-1,0,0,0,0],[-2,2,0,0,0,0],[1,-1,1,-1,0,0]]).length,1);
assert.strictEqual(e6BranchSlice(beta,0,[[1,0,0,0,0,0]]).length,1,'box edge is a segment');
let theme='light',resize;
globalThis.ResizeObserver=class {constructor(fn){resize=fn;}observe(){}};
function element(tag){const e={tag,children:[],handlers:{},style:{setProperty(){}},appendChild(c){this.children.push(c);},addEventListener(n,f){this.handlers[n]=f;}};
 if(tag==='canvas') {e.dots=[];e.fills=[];e.getBoundingClientRect=()=>({width:90});e.getContext=()=>({setTransform(){},clearRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(x,y){e.dots.push([x,y]);},fill(){e.fills.push(this.fillStyle);}});}return e;}
globalThis.document={createElement:element,documentElement:{getAttribute(){return theme;}}};
globalThis.window={devicePixelRatio:2};
const host=element('div'),panel=createParametersPanel(host);
const all=n=>[n].concat(...n.children.map(all));
const canvases=all(host).filter(n=>n.tag==='canvas');assert.strictEqual(canvases.length,3);
assert(canvases.every(c=>c.width===180&&c.height===180));
let counts=canvases.map(c=>c.dots.length);
const input=all(host).find(n=>n.tag==='input');input.value='1.231';input.handlers.input();
assert(canvases.every((c,i)=>c.dots.length>counts[i]));
assert.notDeepStrictEqual(canvases[0].dots[0],canvases[0].dots[canvases[0].dots.length-1]);
counts=canvases.map(c=>c.dots.length);panel.refreshWallActions();panel.setEnabled(true);resize();
assert(canvases.every((c,i)=>c.dots.length>=counts[i]+3));
theme='dark';panel.refreshTheme();assert(canvases.every(c=>c.fills[c.fills.length-1]==='#ffffff'));
theme='light';panel.refreshTheme();assert(canvases.every(c=>c.fills[c.fills.length-1]==='#000000'));
console.log('chamber slice geometry and live panel checks passed');
