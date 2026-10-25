import assert from 'assert';
import {source,distance,arrowFeatures} from './continuity-features.mjs';
(async function(){
 const {balancedTensorDiagram:diagram,projectedBlockPhases:phases}=await import(source('weighted-balanced-diagram.js'));
 const {cotangentGlyphStyle:style,cotangentArrowGeometry:geometry,cotangentArrowOpacity:opacity}=await import(source('element-render.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {matMul,matAdj,eyeZ,cAdd,cMul,cConj,cScale}=await import(source('core-math.js'));
 const complex=M=>M.map(row=>row.map(x=>[x,0]));
 const rep={A:[complex([[-8.441,0],[0,-11.937],[0,0]]),complex([[11.994,0],[0,0],[0,8.481]]),complex([[0,0],[8.507,0],[0,12.028]])],a:[complex([[0],[8.466]]),complex([[8.426],[0]]),complex([[0],[-8.431]])],B:[complex([[0,0,11.73],[-8.294,0,0]]),complex([[0,0,8.255],[0,11.673,0]]),complex([[-11.638,0,0],[0,-8.23,0]])],b:Array.from({length:3},()=>complex([[0,0]]))};
 const d=diagram(rep);assert(d.valid);
 const saturation=color=>Number(color.match(/, ([^%]+)%/)[1]);
 let strong=0;
 for(const g of d.glyphs)for(let k=0;k<3;k++){
  const m=g.magnitudes[k],z=g.coefficients[k],st=style(g,k,false);
  assert(Math.abs(Math.hypot(...z)-m)<1e-8*Math.max(1,m),'rank-one block modulus');
  assert(Math.abs(saturation(st.color)-85*m/(1+m)*g.phaseConfidence[k])<1e-10,'renderer uses physical norm and confidence');
  if(k===1){assert(m<1e-10);assert.strictEqual(st.opacity,0,'no zero-block arrow');}
  else {assert(m>98&&m<101);assert(saturation(st.color)>83,'large fixture block strongly saturated');assert.strictEqual(st.opacity,1);strong++;}
 }
 assert.strictEqual(strong,6);
 let state=12345;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const inner=(u,v)=>u.reduce((s,z,i)=>cAdd(s,cMul(cConj(z),v[i])),[0,0]);
 function unitary(n){const cols=[];for(let j=0;j<n;j++){let v=Array.from({length:n},()=>[random()-.5,random()-.5]);for(let pass=0;pass<2;pass++)for(const u of cols){const z=inner(u,v);v=v.map((x,i)=>cAdd(x,cScale(cMul(u[i],z),-1)));}const norm=Math.hypot(...v.flat());cols.push(v.map(z=>cScale(z,1/norm)));}return Array.from({length:n},(_,i)=>cols.map(c=>c[i]));}
 const rendered=x=>arrowFeatures(x,geometry,opacity);
 const ink=rendered(d);
 for(let i=0;i<3;i++)for(const k of [0,2]){const offset=(i*3+k)*7;assert(Math.abs(Math.hypot(ink[offset+1],ink[offset+2])-saturation(style(d.glyphs[i],k,false).color)/85)<1e-12,'continuity adapter matches rendered saturation');}
 for(let j=0;j<20;j++){
  const moved=diagram(applyComplexGauge(rep,unitary(3),[unitary(2),unitary(2),unitary(2)],[0,1,2].map(()=>{const t=6.28*random();return [Math.cos(t),Math.sin(t)];})));
  assert(moved.valid);assert(distance(rendered(d),rendered(moved))<1e-7,'central and branch unitary gauge preserves actual arrow ink');
 }
 const E=[0,1,2].map(k=>eyeZ(3).map((row,i)=>row.map((z,j)=>i===k&&j===k?z:[0,0]))),K=complex([[0,100,0],[0,0,100],[0,0,0]]);
 let previous=null;
 for(let j=0;j<=100;j++){
  const t=2*Math.PI*j/100,seed=[[Math.cos(t)/Math.sqrt(3),Math.sin(t)/Math.sqrt(3)],[1/Math.sqrt(3),0],[1/Math.sqrt(3),0]],g=phases(E,K,seed);
  assert(distance(g.coefficients[0],[100*Math.cos(t),-100*Math.sin(t)])<1e-10,'regular phase sweep');
  const conjugated=phases(E,K,seed.map(cConj));assert(distance(conjugated.coefficients[0],cConj(g.coefficients[0]))<1e-10,'conjugation reverses phase');
  if(previous)assert(distance(g.coefficients[0],previous)<6.3);previous=g.coefficients[0];
 }
 for(const eps of [1e-3,1e-6,1e-9,0])for(const sign of [1,-1]){
  const g=phases(E,K,[[eps*sign,0],[1,0],[0,0]]),st=style({...g,magnitudes:[100,0,0]},0,false);
  assert.strictEqual(st.opacity,1,'undefined phase retains physical arrow');
  assert(saturation(st.color)<=85*eps/.001,'saturation vanishes at projection defect');
  if(!eps){assert.deepStrictEqual(g.coefficients[0],[0,0]);assert.strictEqual(saturation(st.color),0);}
 }
 console.log('Arrow phase strength: six strong fixture arrows, three zero blocks, 20 random gauges, phase/conjugation sweep and projection-defect fade passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
