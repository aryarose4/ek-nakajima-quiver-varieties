import assert from 'assert';
import fs from 'fs';
import {source} from './continuity-features.mjs';
// Compare only camera and line/dot placement. Hue and intrinsic y glyphs are
// intentionally newer than this frozen one-crossing-era reference.
(async function(){
 const code=fs.readFileSync(new URL('./fixtures/first-wall-camera.js',import.meta.url),'utf8').replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
 const {balancedTensorDiagram:historical}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const {balancedTensorDiagram:actual}=await import(source('weighted-balanced-diagram.js'));
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const m=await import(source('e6-parameters.js'));
 const cases=[{r:.35,theta:0,t:0,phi:0,sphere:0},{r:.35,theta:.7,t:.2,phi:.6,sphere:0}];
 for(const r of [0,1])for(const sphere of [0,1])for(const t of [0,.4,1])cases.push({r,theta:0,t,phi:.4,sphere});
 const chambers=[{beta:m.E6_DEFAULT_BETA,id:'default'}];
 for(const w of m.e6ChamberWallOptions(m.E6_DEFAULT_BETA).filter(w=>w.canCross)){
  chambers.push({beta:w.crossing.targetBeta,id:w.targetChamberId});
  const next=m.e6ChamberWallOptions(w.crossing.targetBeta,w.targetChamberId).find(v=>v.canCross&&v.targetChamberId!=='default');
  if(next)chambers.push({beta:next.crossing.targetBeta,id:next.targetChamberId});
 }
 let compared=0,defects=0;
 for(const chamber of chambers)for(const p of cases){
  const s=solveBalancedAtlas(p,m.betaToLevels(chamber.beta),{chamber:chamber.id});assert(s.success,'solver '+chamber.id);
  const a=actual(s.solvedRep),b=historical(s.solvedRep);
  assert.strictEqual(a.valid,b.valid,'historical defect status');
  if(!b.valid){assert.deepStrictEqual(a.cameraDefects,b.cameraDefects);defects++;continue;}
  assert.deepStrictEqual(a.frame,b.frame);
  for(const key of ['points','rawPoints','lines','pointMarkers','cameraDefects','transversal','concurrencyPoint'])assert.deepStrictEqual(a.layout[key],b.layout[key],key+' '+chamber.id);
  assert(a.glyphs.filter(Boolean).every(g=>g.kind==='intrinsic-block-contractions'));
  compared++;
 }
 console.log('First-wall camera: '+compared+' exact geometry matches, '+defects+' matched historical defects; '+chambers.length+' default/first-hop/multihop chamber paths.');
})().catch(e=>{console.error(e);process.exitCode=1;});

