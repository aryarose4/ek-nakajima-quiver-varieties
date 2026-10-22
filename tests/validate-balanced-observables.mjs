import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
function source(name) {
  if(cache[name])return cache[name];
  let code=fs.readFileSync(path.join(base,name),'utf8');
  code=code.replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
  return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
(async function(){
  const {balancedObservables}=await import(source('balanced-observables.js'));
  const {solveBalancedAtlas}=await import(source('balanced-model.js'));
  const {applyComplexGauge}=await import(source('solver.js'));
  const {eyeZ,matMul,matSub,matScale,frobNorm}=await import(source('core-math.js'));
  const U=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
  const M=[[[0,0],[0,1]],[[1,0],[0,0]]];
  const parameters=[{r:.2,theta:.3},{r:.4,theta:1.4},{r:.7,theta:2.7},{r:.9,theta:4.5}];
  let checks=0,previous=Infinity;
  const rows=[];
  for(const gamma of [.5,.01,.0001,1e-7]) {
    const values=[];
    for(const p of parameters) {
      const levels=[[3,gamma],[3,2.1],[3,3]];
      const solved=solveBalancedAtlas({...p,t:0,phi:0,sphere:0},levels);
      assert(solved.success);checks++;
      const rep=solved.solvedRep,o=balancedObservables(rep);
      for(let i=0;i<3;i++) {
        const b=o.branches[i],g=levels[i][1];
        assert(Math.abs(b.planeWeight-g*(3+g))<2e-8);
        assert(frobNorm(matMul(b.H,b.plane))<2e-8);
        assert(frobNorm(matSub(matMul(b.J,b.J),matScale(b.J,3*(3+g))))<2e-7);
        checks+=3;
      }
      const rotated=balancedObservables(applyComplexGauge(rep,U,[M,eyeZ(2),M],[1,1,1]));
      const features=x=>x.gram.flat(2).concat(x.cyclic.flat());
      const a=features(o),b=features(rotated);
      assert(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<2e-8);checks++;
      values.push(a);
    }
    const diameter=Math.max(...values.flatMap(a=>values.map(b=>Math.hypot(...a.map((v,i)=>v-b[i])))));
    assert(diameter<previous);checks++;previous=diameter;
    rows.push({gamma,diameter});
  }
  assert(rows[3].diameter<1e-4);checks++;
  // Exact rank-one input is accepted, including a vanishing point map.
  const rankOne={A:[0,1,2].map(()=>[[[1,0],[0,0]],[[0,0],[0,0]],[[0,0],[0,0]]]),
    a:[0,1,2].map(()=>[[[0,0]],[[0,0]]]),B:[0,1,2].map(()=>[[[0,0],[0,0],[0,0]],[[0,0],[0,0],[0,0]]])};
  const boundary=balancedObservables(rankOne);
  assert(boundary.branches.every(b=>b.planeWeight===0&&frobNorm(b.J)===0));checks++;
  assert(boundary.gram.flat(2).every(Number.isFinite));checks++;
  console.log(JSON.stringify({checks,collapse:rows}));
})().catch(error=>{console.error(error);process.exitCode=1;});
