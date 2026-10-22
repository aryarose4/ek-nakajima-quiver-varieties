import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima');
const cache={};
function source(name) {
  if(cache[name])return cache[name];
  const text=fs.readFileSync(path.join(base,name),'utf8').replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
  return cache[name]='data:text/javascript;base64,'+Buffer.from(text).toString('base64');
}
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {applyComplexGauge}=await import(source('solver.js'));
 const {matSub,frobNorm}=await import(source('core-math.js'));
 let checks=0, worst=0;
 const p=(extra)=>Object.assign({r:.35,theta:.8,t:.3,phi:.7,sphere:0},extra);
 function solve(params,options){ const start=Date.now();const out=solveBalancedAtlas(params,undefined,options);worst=Math.max(worst,Date.now()-start);return out; }
 function good(out,label){checks++;assert.ok(out.success,label+': '+JSON.stringify(out.diagnostics));assert.ok(out.solvedRep);assert.ok(out.residuals.real_norm<=out.diagnostics.abs_tol);assert.ok(out.residuals.complex_norm<=out.diagnostics.complex_tol);assert.ok(out.diagnostics.gauge_positive);return out;}
 const first=good(solve(p()),'generic complex phases');
 const next=good(solve(p({theta:.81}),{previous:first}),'continuation');
 assert.ok(next.diagnostics.warmStart);checks++;
 // Eight canonical fixed configurations: the three central attachments,
 // central generic point, two long-arm intersections and two tips.
 for(const params of [p({r:0,t:0}),p({r:.5,theta:0,t:0}),p({r:1,t:0}),p({t:0}),p({r:0,t:1}),p({r:1,t:1}),p({r:0,sphere:1,t:1}),p({r:1,sphere:1,t:1})])good(solve(params),'fixed');
 for(const r of [0,1]) for(const sphere of [0,1]) for(const t of [.3,.8,.99,.99999])good(solve(p({r,sphere,t})),'long sphere');
 for(const r of [0,1])good(solve(p({r,sphere:1,t:.4,outgoing:true})),'outgoing long');
 for(const params of [p({r:.5,theta:0,t:1}),p({r:.5,theta:0,t:.4,outgoing:true}),p({r:.000001}),p({r:.999999})])good(solve(params),'concurrency/boundary');
 for(const phi of [0,.7]) {
   for(const t of [.99,.999,.99999])good(solve(p({r:.5,theta:0,t,phi})),'incoming concurrency near endpoint');
   good(solve(p({r:.49,theta:0,t:.95,phi})),'generic near concurrency');
   const t=.8, out=good(solve(p({r:.5,theta:0,t,phi})),'concurrency overlap');
   const mag=4*(1-t)/t,s=[mag*Math.cos(phi),-mag*Math.sin(phi)];
   const g=[0,1,2].map(i=>[0,1,2].map(j=>[(i===j?1:0)-1/3+s[0]/3,s[1]/3]));
   const h=[.5,1,1].map(c=>[[[1,0],[-c,0]],[[0,0],[c*s[0],c*s[1]]]]);
   const gauged=applyComplexGauge(out.rawRep,g,h,[1,1,1]);
   for(const key of ['a','A','b','B'])for(let i=0;i<3;i++)assert.ok(frobNorm(matSub(gauged[key][i],out.numericalRep[key][i]))<1e-12,'exact finite concurrency gauge overlap');
   checks++;
 }
 const transition=good(solve(p({r:0,sphere:1,t:0}),{previous:first}),'chart transition');assert.ok(!transition.diagnostics.warmStart);checks++;
 const failure=solve(p({theta:1.2,t:.6}),{previous:first,solverOptions:{maxIter:0}});assert.ok(!failure.success&&!failure.solvedRep&&!failure.continuation);checks++;
 const invalid=solve(p({t:2}),{previous:first});assert.ok(!invalid.success&&!invalid.solvedRep&&invalid.diagnostics.status==='chart_error');checks++;
 const poisoned=JSON.parse(JSON.stringify(first.continuation));poisoned.logGauge.center.fill(100);
 const fallback=good(solve(p(),{previous:poisoned}),'cold fallback');assert.ok(fallback.diagnostics.warmStart);checks++;
 console.log(`balanced model: ${checks} checks passed; worst cold/fallback solve ${worst} ms`);
})().catch(e=>{console.error(e);process.exitCode=1;});


