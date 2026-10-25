import assert from 'assert';
import {source,distance} from './continuity-features.mjs';
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {makeElementView,interpolateScreenLayout}=await import(source('element-render.js'));
 const {betaToLevels,E6_DEFAULT_BETA}=await import(source('e6-parameters.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {eyeZ}=await import(source('core-math.js'));
 const levels=betaToLevels(E6_DEFAULT_BETA);
 const solve=(r,t=0)=>solveBalancedAtlas({r,theta:0,t,phi:0,sphere:0},levels).solvedRep;
 const sample=r=>balancedTensorDiagram(solve(r));
 const strokes=[];let path=[];
 const ctx={globalAlpha:1,beginPath(){path=[];},moveTo(...p){path.push(p);},lineTo(...p){path.push(p);},stroke(){strokes.push({alpha:this.globalAlpha,width:this.lineWidth,path:path.slice()});}};
 for(const name of ['setTransform','clearRect','arc','fill','fillText','setLineDash'])ctx[name]=()=>{};
 const element=()=>({style:{},children:[],appendChild(c){this.children.push(c);},setAttribute(){},addEventListener(){},getContext(){return ctx;}});
 global.document={createElement:element,documentElement:{getAttribute(){return 'light';}}};
 const host=element();host.clientWidth=500;host.clientHeight=400;
 const renderer=makeElementView(host);
 function render(rep){strokes.length=0;const d=renderer.setData({balancedRep:rep});return {d,strokes:strokes.slice()};}
 function renderNonzeroY(rep){
  const d=render(rep).d;
  d.glyphs.forEach(g=>{if(g){g.coefficients=[[1,0],[1,0],[1,0]];g.phaseCorrelations=g.coefficients;g.magnitudes=[1,1,1];}});
  strokes.length=0;renderer.resize();return {d,strokes:strokes.slice()};
 }
 function markers(d){return d.layout.pointMarkers[1].boundaryPair;}
 function pairFeatures(d){return markers(d).map(m=>[m.weight,...m.point.map(x=>x*m.weight),...m.direction.map(x=>x*m.weight)]);}
 function pairDistance(a,b){const x=pairFeatures(a),y=pairFeatures(b);return Math.min(distance(x.flat(),y.flat()),distance(x.flat(),[y[1],y[0]].flat()));}
 const results=[];
 for(const approximate of [.4257443547,.6122562289]){
  let lo=approximate-1e-5,hi=approximate+1e-5,sign=Math.sign(sample(lo).layout.rawPoints[1][0]);
  for(let k=0;k<40;k++){const mid=(lo+hi)/2;if(Math.sign(sample(mid).layout.rawPoints[1][0])===sign)lo=mid;else hi=mid;}
  const root=(lo+hi)/2,exact=sample(root);
  assert(exact.layout.pointMarkers[1].atInfinity,'refined affine pole enters explicit infinity branch');
  assert.deepStrictEqual(markers(exact).map(m=>m.weight),[.5,.5]);
  const errors=[1e-4,1e-5,1e-6].map(h=>pairDistance(sample(root-h),sample(root+h)));
  assert(errors[2]<errors[0]/50&&errors[2]<1e-4,'unordered alpha-weighted pairs converge across pole');
  assert(pairDistance(exact,sample(root+1e-7))<1e-5,'exact pole joins same pair');
  const U=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
  const rep=solve(root+1e-5),base=balancedTensorDiagram(rep),gauged=balancedTensorDiagram(applyComplexGauge(rep,U,[eyeZ(2),eyeZ(2),eyeZ(2)],[1,1,1]));
  assert(pairDistance(base,gauged)<1e-7,'paired indicators are unitary gauge invariant');
  assert.deepStrictEqual(base.data.incident,gauged.data.incident);
  assert.strictEqual(base.source,'balanced-weighted-tensors');
  assert(distance(base.layout.incidenceColors.lineHues,gauged.layout.incidenceColors.lineHues)<1e-6);
  const left=render(solve(root-1e-6)),right=render(solve(root+1e-6));
  // Boundary chevrons are three-vertex, width-two strokes. Compare their
  // actual pixels and alpha in geometric order, keeping both individual marks.
  const chevrons=x=>x.strokes.filter(s=>s.width===2&&s.path.length===3).sort((a,b)=>a.path[1][0]-b.path[1][0]);
  const aa=chevrons(left),bb=chevrons(right);assert(aa.length>=2&&aa.length===bb.length);
  const features=x=>x.flatMap(s=>[s.alpha,...s.path.flat().map(v=>v*s.alpha)]);
  assert(distance(features(aa),features(bb))<.1,'actual chevron ink joins across pole');
  const yFeatures=x=>features(x.strokes.filter(s=>s.width===4/3));
  assert(distance(yFeatures(renderNonzeroY(solve(root-1e-6))),yFeatures(renderNonzeroY(solve(root+1e-6))))<.2,'actual nonzero y arrow paths and alpha join across pole');
  assert(markers(left.d).every(m=>Math.abs(Math.max(...m.point.map(Math.abs))-.9)<1e-10));
  const snap=interpolateScreenLayout(left.d.layout,right.d.layout,.5);
  markers({layout:snap}).forEach((m,k)=>assert(distance(m.point,markers(left.d)[k].point.map((v,j)=>(v+markers(right.d)[k].point[j])/2))<1e-12));
  results.push({root,errors});
 }
 // Entry preserves the real point and turns the secondary mark off.
 let lo=.33,hi=.34;
 for(let k=0;k<35;k++){const mid=(lo+hi)/2;if(sample(mid).layout.pointMarkers[1].clipped)hi=mid;else lo=mid;}
 const inside=sample(lo-1e-8),outside=sample(hi+1e-8),pair=markers(outside);
 assert(!inside.layout.pointMarkers[1].clipped);
 assert.deepStrictEqual(inside.layout.points[1],inside.layout.rawPoints[1]);
 assert(Math.min(...pair.map(m=>m.weight))<1e-6);
 assert(distance(pair.reduce((a,b)=>a.weight>b.weight?a:b).point,inside.layout.points[1])<1e-5);
 for(const [a,b]of [[inside.layout,outside.layout],[outside.layout,inside.layout]]){
  const halfway=interpolateScreenLayout(a,b,.5).pointMarkers[1].boundaryPair;
  assert(halfway&&Math.abs(halfway[0].weight+halfway[1].weight-1)<1e-12,'snap interpolates pair birth and loss');
 }
 // Verify actual nonzero-y arrows: two point-based blocks split their alpha,
 // while the line-based block appears once. Inject nonzero intrinsic sizes
 // into an actual rendered frame so the geometry check cannot pass on zero ink.
 const rendered=render(solve(.39,.2)),frame=rendered.d;
 frame.glyphs.forEach(g=>{if(g){g.coefficients=[[1,0],[1,0],[1,0]];g.phaseCorrelations=g.coefficients;g.magnitudes=[1,1,1];}});
 strokes.length=0;renderer.resize();
 const expected=frame.layout.pointMarkers.reduce((sum,m)=>sum+(m.boundaryPair?5:3),0);
 const arrows=strokes.filter(s=>s.width===4/3);assert.strictEqual(arrows.length,expected);
 assert(arrows.some(s=>s.alpha>0&&s.alpha<1),'paired y arrows carry partial brightness');
 assert(Math.abs(arrows.reduce((sum,s)=>sum+s.alpha,0)-9)<1e-12,'each physical block retains total ink once');
 console.log(JSON.stringify({pairedBoundary:results,nonzeroYArrowStrokes:arrows.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
