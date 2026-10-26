import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
function source(name){if(cache[name])return cache[name];let code=fs.readFileSync(path.join(base,name),'utf8');code=code.replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');}
(async function(){
 const {experimentalBalancedDiagram:diagram}=await import(source('weighted-balanced-diagram.js'));
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {eyeZ,cAdd,cMul,cConj,matMul,matTrace}=await import(source('core-math.js'));
 const {compactFirstLineChart}=await import(source('branch-charts.js'));
 const levels=[[3,1],[3,2.1],[3,3]],U=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
 let checks=0;const defects={},unavailable=[];
 const check=(ok,label)=>{checks++;assert(ok,label);};
 function signature(d){const l=d.layout;let values=[];for(let i=0;i<3;i++){const pw=l.pointOpacities[i],lw=l.lineOpacities[i],a=l.lines[i][0],b=l.lines[i][1],v=b.map((x,j)=>x-a[j]);values.push(pw,...l.points[i].map(x=>pw*x),lw,...a.map((x,j)=>lw*(x+b[j])/2),lw*v[0]*v[0],lw*v[0]*v[1],lw*v[1]*v[1]);const colors=l.incidenceColors;for(const [h,s]of [[colors.lineHues[i],lw*colors.lineStrengths[i]],[colors.pointHues[i],pw*colors.pointStrengths[i]]])values.push(s*Math.cos((h||0)*Math.PI/180),s*Math.sin((h||0)*Math.PI/180));}return values;}
 const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
 function solve(p,lev=levels){const s=solveBalancedAtlas({theta:0,phi:.3,sphere:0,...p},lev);check(s.success,'solve '+JSON.stringify({p,lev}));return s.solvedRep;}
 function inspect(rep,label){const d=diagram(rep);if(!d.valid){unavailable.push({label,reason:d.reason});return d;}check(signature(d).every(Number.isFinite),'finite diagram');for(const def of d.layout.cameraDefects)defects[def.kind]=(defects[def.kind]||0)+1;return d;}
 const branchGauge=[[[.6,0],[0,.8]],[[0,.8],[.6,0]]];
 const gaugeRep=solve({r:.35,theta:.7,t:.3});
 const gaugeBase=diagram(gaugeRep),gaugeMoved=diagram(applyComplexGauge(gaugeRep,U,[branchGauge,branchGauge,branchGauge],[1,1,1]));
 check(gaugeMoved.valid&&distance(signature(gaugeBase),signature(gaugeMoved))<1e-6,'central and middle unitary gauge invariance');
 check(distance(gaugeBase.glyphs.flatMap(g=>g.coefficients.flat()),gaugeMoved.glyphs.flatMap(g=>g.coefficients.flat()))<1e-6,'middle gauge glyph invariance');
 const samples=[{r:.2,theta:.3},{r:.4,theta:1.4},{r:.7,theta:2.7},{r:.9,theta:4.5}],collapse=[];
 for(const gamma of [.5,.01,1e-4,1e-7]){const ds=samples.map(p=>inspect(solve({...p,t:0},[[3,gamma],[3,2.1],[3,3]]),'collapse'));check(ds.every(d=>d.valid),'collapse camera defined');const ss=ds.map(signature);const diameter=Math.max(...ss.flatMap(a=>ss.map(b=>distance(a,b))));collapse.push({gamma,diameter});check(ds.every(d=>d.layout.pointOpacities.every(w=>w===1)),'all three marked points survive');check(ds.every(d=>d.layout.lineOpacities.slice(1).every(w=>w===1)),'planes2/3 survive');}
 check(collapse[3].diameter<1e-4,'weighted picture contracts');check(collapse[3].diameter<collapse[2].diameter/500,'linear collapse scale');
 for(const r of [0,.5,1])for(const sphere of(r===.5?[0]:[0,1]))for(const t of[0,.4,1])for(const phi of[0,.7]){const rep=solve({r,t,sphere,phi}),d=inspect(rep,{r,t,sphere,phi});check(d.valid,'all default tips available');const rotated=diagram(applyComplexGauge(rep,U,[eyeZ(2),eyeZ(2),eyeZ(2)],[1,1,1]));check(rotated.valid,'gauge preserves availability');check(distance(signature(d),signature(rotated))<1e-6,'unitary gauge invariance');
   const inner=(u,v)=>u.reduce((s,z,j)=>cAdd(s,cMul(cConj(z),v[j])),[0,0]);
   d.glyphs.forEach((g,i)=>{check(!!g,'full flag has cotangent glyph');const pairs=[[0,1],[0,2],[1,2]],blocks=pairs.map(([a,b])=>matMul(matMul(g.projectors[a],d.operators[i]),g.projectors[b]));
     const actual=blocks.map(B=>matTrace(matMul(B,g.reference)));
     check(distance(g.coefficients.flat(),actual.flat())<1e-10,'intrinsic block correlation transform');
     check(distance(g.magnitudes,blocks.map(B=>Math.hypot(...B.flat(2))))<1e-10,'physical block magnitudes retained');
     check(distance(g.coefficients.flat(),rotated.glyphs[i].coefficients.flat())<1e-6,'glyph gauge invariance');
     const target=d.layout.cotangentTargets[i],other=rotated.layout.cotangentTargets[i];
     if(!target||!other){check(target===null&&other===null,'zero cotangent image has no target in either gauge');return;}
     check(target.atInfinity===other.atInfinity&&target.clipped===other.clipped,'target gauge status');
     if(target.point)check(distance(target.point,other.point)<1e-6,'target gauge position');
   });}
 // Separate-chamber rank example, NOT a reachable path in the default chamber:
 // alpha=0 erases a marked point, not its rank-two plane.
 const outer=[];for(const alpha of[.01,1e-4,1e-7]){const d=inspect(solve({r:.35,theta:.7,t:0},[[alpha,1],[3,2.1],[3,3]]),'outer');check(d.valid,'outer camera defined');check(d.layout.lineOpacities[0]===1,'plane survives outer collapse');outer.push({alpha,pointOpacity:d.layout.pointOpacities[0]});}check(outer[2].pointOpacity<1e-5,'point loses visibility with actual map');
 // Accessible positive-beta wall: beta_2^(2) -> 1 contracts the first
 // r=1 exterior sphere while every displayed point/plane remains present.
 const positiveCollapse=[];
 for(const epsilon of[.01,1e-4,1e-7]){
   const ds=[0,.3,.7,1].map(t=>inspect(solve({r:1,theta:0,t,phi:.7},[[3,1],[3,2+2*epsilon],[3,3]]),'positive wall'));
   check(ds.every(d=>d.valid),'positive wall camera defined');
   check(ds.every(d=>d.layout.lineOpacities.concat(d.layout.pointOpacities).every(w=>w===1)),'positive wall does not erase flags');
   const ss=ds.map(signature);positiveCollapse.push({epsilon,diameter:Math.max(...ss.flatMap(a=>ss.map(b=>distance(a,b))))});
 }
 check(positiveCollapse[2].diameter<.001,'positive wall contracts without fading');
 check(positiveCollapse[2].diameter<positiveCollapse[1].diameter/20,'positive wall convergence scale');
 const equation=([a,b])=>[b[1]-a[1],a[0]-b[0],b[0]*a[1]-a[0]*b[1]];
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(const r of[0,.5,1]){const d=inspect(solve({r,theta:0,t:0,phi:0}),'real incidence');check(d.valid,'real incidence camera');const l=d.layout,eq=l.lines.map(equation);l.rawPoints.forEach((p,i)=>check(Math.abs(dot(eq[i],p.concat(1)))/Math.hypot(eq[i][0],eq[i][1])<1e-6,'real own incidence fit below .001 screen pixels'));if(r===.5)check(eq.every(e=>Math.abs(dot(e,l.concurrencyPoint.concat(1)))/Math.hypot(e[0],e[1])<1e-6),'real concurrence fit below .001 screen pixels');else check(Math.abs(dot(eq[0],l.rawPoints[r===0?1:2].concat(1)))/Math.hypot(eq[0][0],eq[0][1])<1e-6,'real special cross-incidence fit below .001 screen pixels');}
 // Stateless camera closes a phase loop; record any interior defects honestly.
 const loop=[];for(let k=0;k<=24;k++){const d=inspect(solve({r:.35,theta:2*Math.PI*k/24,t:0}),'loop '+k);check(d.valid,'central phase loop camera defined');loop.push(signature(d));}check(distance(loop[0],loop[24])<1e-7,'phase loop closes');
 const steps=[];for(let k=0;k<=10;k++){const d=inspect(solve({r:.35,theta:.7,t:0},[[3,.01+k*1e-5],[3,2.1],[3,3]]),'small beta');check(d.valid,'small beta camera defined');steps.push(signature(d));}check(Math.max(...steps.slice(1).map((s,i)=>distance(s,steps[i])))<.02,'small beta changes small');
 const rankOne=compactFirstLineChart(.3,.7);rankOne.A[0].forEach(row=>{row[1]=[0,0];});const exact=diagram(rankOne);check(exact.valid,'exact plane rank loss accepted');check(exact.layout.lineOpacities[0]===0&&exact.layout.pointOpacities[0]>0,'only plane absent at exact rank loss');
 check(exact.data.incident.every(row=>row[0]===false)&&exact.data.lineEqual[0].every(x=>x===false)&&!exact.data.concurrent,'missing plane creates no incidences');
 check(exact.glyphs[0]===null&&exact.layout.cotangentTargets[0]===null,'missing flag has no glyph or target');
 const noPoint=compactFirstLineChart(.3,.7);noPoint.a[0].forEach(row=>{row[0]=[0,0];});const absent=diagram(noPoint);
 check(absent.valid&&!absent.data.pointPresent[0]&&absent.data.incident[0].every(x=>x===false)&&absent.data.pointEqual[0].every(x=>x===false)&&!absent.data.collinear,'missing point creates no incidences');
 for(const r of[0,1])for(const phi of[0,.7]){
   const ds=[1-1e-6,1-1e-8,1].map(t=>diagram(solve({r,sphere:1,t,phi})));
   check(ds.every(d=>d.valid),'near-tip cameras available');
   const near=distance(signature(ds[1]),signature(ds[2])),far=distance(signature(ds[0]),signature(ds[2]));
   check(near<.02&&near<Math.max(1e-8,far/4),'near-tip continuous convergence above roundoff floor');
 }
 check(diagram(solve({r:.5,theta:0,t:0,phi:0})).layout.concurrencyPoint!==null,'true real concurrence location retained');
 check(unavailable.length===0,'no unavailable sampled cameras');
 console.log(JSON.stringify({checks,collapse,positiveCollapse,outer,unavailable,projectionDefects:defects}));
})().catch(e=>{console.error(e);process.exitCode=1;});
