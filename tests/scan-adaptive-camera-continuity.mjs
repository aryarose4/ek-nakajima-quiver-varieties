// Deterministic adaptive scanner. --extended adds chamber/direction coverage;
// --source-base=<directory> validates another worktree without copying source.
import fs from 'fs';
import {structuralDefects} from './structural-screen-features.mjs';
import path from 'path';
import {fileURLToPath} from 'url';
import {distance,renderedFeatures,glyphFeatures,invariantFeatures,arrowFeatures} from './continuity-features.mjs';
const arg=name=>process.argv.find(x=>x.startsWith('--'+name+'='));
const base=arg('source-base')?path.resolve(arg('source-base').split('=').slice(1).join('=')):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima');
const cache={};
function source(name){if(cache[name])return cache[name];const code=fs.readFileSync(path.join(base,name),'utf8').replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');}
(async function(){
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
 const {balancedObservables}=await import(source('balanced-observables.js'));
 const {cotangentArrowGeometry,cotangentArrowOpacity}=await import(source('element-render.js'));
 const {E6_DEFAULT_BETA,betaToLevels,e6ChamberWallOptions}=await import(source('e6-parameters.js'));
 const extended=process.argv.includes('--extended'),n=arg('steps')?Number(arg('steps').split('=')[1]):128;
 const fixtures=[{label:'default',beta:E6_DEFAULT_BETA},{label:'asymmetric',beta:[[.751,2.225],[2.793,.602],[.938,.702]],chamber:{id:'weyl:2.5.0.3.2.0.1.4.1.0.2.3.0.5.2.5.2.0.1.4.1.4.1.4.1.0.2.1.0.3.2.0.1.4.1.0.2.3.0.1.5'}}];
 if(extended)for(const index of [0,1,4]){const w=e6ChamberWallOptions(E6_DEFAULT_BETA,'default').filter(x=>x.canCross)[index];fixtures.push({label:'neighbor '+index,beta:w.crossing.targetBeta,chamber:{id:w.targetChamberId}});}
 // The gray collinearity guide and concurrency dot are part of the canvas too.
 function auxiliary(d){const l=d.layout,a=l.transversal,tw=a?(l.transversalOpacity===undefined?1:l.transversalOpacity):0,cw=l.concurrencyPoint?(l.concurrencyOpacity===undefined?1:l.concurrencyOpacity):0;return [tw,...(a?a[0].map((v,i)=>tw*(v+a[1][i])/2):[0,0]),...(a?a[0].map((v,i)=>tw*(v-a[1][i])**2):[0,0]),cw,...(l.concurrencyPoint||[0,0]).map(v=>cw*v)];}
 let solves=0;const failures=[],suspects=[],strata={equalPoints:0,equalPlanes:0,incidences:0,collinear:0,concurrent:0};
 function sample(f,p){const s=solveBalancedAtlas({r:.35,theta:0,t:0,phi:0,sphere:0,...p},betaToLevels(p.beta||f.beta),{chamber:f.chamber});solves++;if(!s.success||!(s.residuals.real_norm<1e-9&&s.residuals.complex_norm<1e-8))throw Error('strict solve '+JSON.stringify({f,p,residuals:s.residuals}));if(f.chamber&&(s.chamberId!==f.chamber.id||s.diagnostics.transported!==true))throw Error('wrong chamber '+JSON.stringify({f,p,chamber:s.chamberId}));const d=balancedTensorDiagram(s.solvedRep);if(!d.valid)throw Error('diagram '+JSON.stringify({f,p,reason:d.reason}));if(process.argv.includes('--incidence')){for(let i=0;i<3;i++)for(let j=0;j<3;j++){if(i<j){strata.equalPoints+=Number(d.data.pointEqual[i][j]);strata.equalPlanes+=Number(d.data.lineEqual[i][j]);}strata.incidences+=Number(d.data.incident[i][j]);}strata.collinear+=Number(d.data.collinear);strata.concurrent+=Number(d.data.concurrent);const defects=structuralDefects(d);if(defects.length)throw Error('structural '+JSON.stringify({f,p,defects}));}const features=[invariantFeatures(balancedObservables(s.solvedRep)),renderedFeatures(d),glyphFeatures(d).filter((_,i)=>i%8<6),arrowFeatures(d,cotangentArrowGeometry,cotangentArrowOpacity),auxiliary(d)];if(!features.every(v=>v.every(Number.isFinite)))throw Error('nonfinite '+JSON.stringify({f,p}));return {features,diagnostics:d.diagnostics};}
 // Target coordinates can switch to null when clipped; only their actual
 // rendered arrow contribution above is visible. Signed glyph coefficients remain.
 const delta=(a,b)=>a.features.map((v,k)=>distance(v,b.features[k]));
 function refine(f,label,at,lo,hi){let a=sample(f,at(lo)),b=sample(f,at(hi));const initial=delta(a,b);for(let i=0;i<18;i++){const mid=(lo+hi)/2,m=sample(f,at(mid));const left=delta(a,m),right=delta(m,b);if(i===0&&!left.some((v,k)=>k>0&&Math.max(v,right[k])>.7*initial[k]&&Math.max(v,right[k])>.1))return;if(Math.max(...left.slice(1))>=Math.max(...right.slice(1))){hi=mid;b=m;}else{lo=mid;a=m;}}const final=delta(a,b),row={fixture:f.label,label,lo,hi,input:at((lo+hi)/2),initial,final,beta:f.beta,chamber:f.chamber,diagnostics:[a.diagnostics,b.diagnostics]};suspects.push(row);if(final.some((v,k)=>v>2e-5&&v>.05*initial[k])){failures.push(row);console.log(JSON.stringify({failure:row}));}}
 function line(f,label,at){let a=sample(f,at(0));for(let i=1;i<=n;i++){const b=sample(f,at(i/n)),d=delta(a,b);if(Math.max(...d.slice(1))>.15)refine(f,label,at,(i-1)/n,i/n);a=b;}}
 function overlap(f,r){const errors=[1e-3,1e-4,1e-5].map(h=>delta(sample(f,{r,t:1-h,sphere:0}),sample(f,{r,t:h,sphere:1})));if(errors[2].some((v,k)=>v>2e-6&&(v>.6*errors[0][k]||v>.8*errors[1][k]))){const row={fixture:f.label,label:'sphere overlap '+r,errors,beta:f.beta,chamber:f.chamber};failures.push(row);console.log(JSON.stringify({failure:row}));}}
 for(const f of fixtures){
 if(process.argv.includes('--strata')){for(const r of [0,.5,1])for(const sphere of (r===.5?[0]:[0,1]))for(const t of [0,.4,1])sample(f,{r,sphere,t});continue;}
 if(process.argv.includes('--critical')){for(const r of (f.label==='default'?[.5748772323131561,.7803880870342255]:[.8028704226016998])){const errors=[1e-3,1e-4,1e-5].map(h=>delta(sample(f,{r:r-h}),sample(f,{r:r+h})));if(errors[2].some((v,k)=>v>2e-6&&(v>.6*errors[0][k]||v>.8*errors[1][k])))failures.push({fixture:f.label,label:'historical jump '+r,errors});console.log(JSON.stringify({critical:f.label,r,errors}));}continue;}for(const theta of (extended?[0,.03,.7,Math.PI-1e-6]:[0,.7]))line(f,'r theta='+theta,x=>({r:x,theta}));if(extended){for(const r of [0,1])overlap(f,r);line(f,'theta seam',x=>({r:.78,theta:2*Math.PI*x-Math.PI}));for(const r of [0,.5,1])for(const sphere of (r===.5?[0]:[0,1])){line(f,'t '+r+':'+sphere,x=>({r,sphere,t:x}));line(f,'phi '+r+':'+sphere,x=>({r,sphere,t:.4,phi:2*Math.PI*x-Math.PI}));}for(let j=0;j<6;j++){const original=f.beta;line(f,'beta '+j,x=>({r:.78,beta:original.map((row,i)=>row.map((v,k)=>v+(2*i+k===j?.04*(x-.5):0)))}));}}console.log(JSON.stringify({progress:f.label,solves,failures:failures.length}));}
 console.log(JSON.stringify({sourceBase:base,solves,strata,suspects:suspects.length,failures}));if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});












