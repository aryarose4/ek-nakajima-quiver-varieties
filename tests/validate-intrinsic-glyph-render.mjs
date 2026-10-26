import assert from 'assert';
import {source,glyphFeatures,distance} from './continuity-features.mjs';
(async function(){
 const {cotangentGlyphStyle:style}=await import(source('element-render.js'));
 const {newCotangentIncidenceHighlights:gains}=await import(source('element-render.js'));
 const {cotangentImageIncidences:incidences}=await import(source('weighted-balanced-diagram.js'));
 const {matMul}=await import(source('core-math.js'));
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram:diagram}=await import(source('weighted-balanced-diagram.js'));
 const {E6_REGULAR_LEVELS}=await import(source('e6-levels.js'));
 const {e6ReflectLevels,E6_ADJACENT_WORD}=await import(source('e6-chamber-transport.js'));
 const z=x=>[x,0],matrix=rows=>rows.map(row=>row.map(z));
 function normal(s,u) {
   const B=matrix([[0,s,0],[0,u,0]]);
   return {A:[matrix([[1,0],[0,0],[0,1]]),matrix([[0,1],[1,0],[0,1]]),matrix([[1,0],[0,0],[0,1]])],
     a:[matrix([[1],[0]]),matrix([[1],[0]]),matrix([[0],[1]])],
     B:[B,matrix([[0,0,0],[0,0,0]]),B.map(row=>row.map(v=>[-v[0],-v[1]]))]};
 }
 const snapshot=rep=>({valid:true,cotangentIncidences:incidences(rep)});
 const full=[{magnitudes:[0,1,1]},null,{magnitudes:[0,1,1]}];
 for(const [s,u,kind,j,expected,sparse] of [[1,0,'points',0,[1,2,8],[1,8]],[1,1,'planes',1,[2,8],[8]],[0,1,'points',2,[2,7,8],[8]]]) {
   const rep=normal(s,u),event=snapshot(rep),before=snapshot(normal(s+.03,u+.02));
   assert(event.cotangentIncidences[0][kind][j],'intrinsic normal-form special incidence');
   assert.deepStrictEqual(gains(before,event,full),expected,'own-point c13 and image-target c23 arrows pulse across branches');
   assert.deepStrictEqual(gains(null,event,full),[],'initial incidence does not pulse');
   assert.deepStrictEqual(gains(event,event,full),[],'held incidence does not repeat');
   assert.deepStrictEqual(gains(event,before,full),[],'exiting incidence rearms without a pulse');
   assert.deepStrictEqual(gains(before,event,[null,null,null]),[],'absent glyphs do not flash');
   assert.deepStrictEqual(gains(before,event,[{},null,{}]),[],'legacy glyphs without physical magnitudes do not flash');
   assert.deepStrictEqual(gains({valid:true,cotangentIncidences:[null,null,null]},event,full),[],'newly born operators have no previous image incidence');
   assert.deepStrictEqual(gains(before,event,[{magnitudes:[0,0,0]},null,{magnitudes:[0,0,0]}]),[],'hidden zero arrows do not flash');
   assert.deepStrictEqual(gains(before,event,[{magnitudes:[1,1,0]},null,{magnitudes:[0,0,1]}]),sparse,'zero and tangent blocks do not glow; other branches retain their image cue');
   const U=matrix([[.6,-.8,0],[.8,.6,0],[0,0,1]]),adj=U[0].map((_,j)=>U.map(row=>row[j]));
   assert.deepStrictEqual(incidences({...rep,A:rep.A.map(A=>matMul(U,A)),B:rep.B.map(B=>matMul(B,adj))}),event.cotangentIncidences,'unitary invariant image incidence');
 }
 const complex=normal(1,1);complex.B[0][1][1]=[0,1];complex.B[2][1][1]=[0,-1];
 assert(incidences(complex).filter(Boolean).every(e=>!e.points.some(Boolean)&&!e.planes.some(Boolean)),'complex image avoids all three special incidences');
 assert(incidences(normal(0,0)).every(e=>e===null),'zero operators have no image incidence');
 const ownPoint={valid:true,cotangentIncidences:[{points:[true,false,false],planes:[false,false,false]},null,null]};
 const newPlane={valid:true,cotangentIncidences:[{points:[true,false,false],planes:[false,true,false]},null,null]};
 assert.deepStrictEqual(gains(ownPoint,newPlane,[{magnitudes:[1,1,0]}]),[1],'c13 still ends at the gained incidence when its image already equals its own point');
 // Screenshot regression: two distinct arrows end at the newly shared point.
 // The other branch's c13 remains at its own, different marked point.
 const screenshotLevels=[[1.230,.400],[2.414,1.410],[1.060,1.088]].map(row=>row.map(x=>2*x));
 const adjacentLevels=E6_ADJACENT_WORD.reduce((z,v)=>e6ReflectLevels(z,v),E6_REGULAR_LEVELS);
 for(const [levels,chamber,nonzero] of [[screenshotLevels,'weyl:5.2.0.1.4.1.4.1.0.1.4.1.0.4.1.0.2.5',true],[E6_REGULAR_LEVELS,'default',false],[adjacentLevels,'side-zero-second',false]]) {
   const frame=r=>{
     const solved=solveBalancedAtlas({r,theta:0,t:0,phi:0,sphere:0},levels,{chamber});
     assert(solved.success,'endpoint fixture solves in '+chamber);
     assert(solved.residuals.real_norm<1e-7,'endpoint real moment-map residual');
     return diagram(solved.solvedRep);
   };
   for(const [near,r,expected] of [[.01,0,[1,8]],[.99,1,[2,7]]]) {
     const before=frame(near),after=frame(r);
     assert.deepStrictEqual(gains(before.data,after.data,after.glyphs),nonzero?expected:[],'only nonzero arrows ending at the shared point flash');
     assert.deepStrictEqual(gains(after.data,after.data,after.glyphs),[],'endpoint hold does not replay');
     assert.deepStrictEqual(gains(after.data,before.data,before.glyphs),[],'endpoint exit does not flash');
   }
 }
 const glyph={coefficients:[[0,0],[0,1],[1,0]],phaseCorrelations:[[0,0],[0,1],[1,0]],magnitudes:[1,1,0]};
 const gray=style(glyph,0,false,.2);
 assert.strictEqual(gray.opacity,1,'nonzero physical block survives vanishing phase correlation');
 assert(gray.color.includes('0%'),'undefined phase is gray');
 assert.strictEqual(style(glyph,2,false).opacity,0,'actual zero block is invisible despite nonzero correlation');
 assert.notStrictEqual(style(glyph,1,false).color,gray.color,'complex correlation supplies phase hue');
 assert.strictEqual(style({coefficients:[[1,0]]},0,false,.2).opacity,.2,'legacy coefficients retain object visibility');
 assert.strictEqual(style({coefficients:[[0,0]]},0,false).opacity,0,'legacy zero coefficients remain invisible');
 const features=(m,target)=>glyphFeatures({glyphs:[{coefficients:[[0,0],[0,0],[0,0]],magnitudes:[0,0,m]}],layout:{cotangentTargets:[{point:target}],pointOpacities:[1],lineOpacities:[1]}});
 assert.strictEqual(distance(features(0,[0,0]),features(0,[.5,.5])),0,'invisible target motion contributes no ink');
 assert(distance(features(1,[0,0]),features(1,[.5,.5]))>.1,'visible physical block retains target motion');
 assert(distance(features(1e-8,[0,0]),features(1e-8,[.5,.5]))<1e-8,'target contribution vanishes continuously');
 console.log('Intrinsic glyph rendering: physical size, gray zero correlation, phase hue, legacy visibility passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
