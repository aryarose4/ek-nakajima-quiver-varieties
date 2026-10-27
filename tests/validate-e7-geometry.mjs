import fs from 'fs';import os from 'os';import path from 'path';import {pathToFileURL} from 'url';import assert from 'assert';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'e7-geometry-'));fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
for(const name of ['core-math','solver','e7-core','e7-solver','e7-geometry'])fs.copyFileSync(new URL('../assets/js/ek-nakajima/'+name+'.js',import.meta.url),path.join(temp,name+'.js'));
async function main(){
 const C=await import(pathToFileURL(path.join(temp,'e7-core.js')).href),G=await import(pathToFileURL(path.join(temp,'e7-geometry.js')).href),S=await import(pathToFileURL(path.join(temp,'e7-solver.js')).href),M=await import(pathToFileURL(path.join(temp,'solver.js')).href);
 let worst=0;
 for(const pair of [[2,0],[[2,.2],[.03,.01]]]){
  const solved=S.solveE7(C.makeE7Chart(...pair),[1,1,1,1,1,1,.5]);assert(solved.success);
  for(const rep of [solved.rep,(()=>{const g=C.positiveE7Gauge(Array.from({length:47},(_,i)=>.17*Math.cos(i)),M.expmHermitian);return C.gaugeActionE7(solved.rep,g.gauge,g.inverse);})()]){
   const geometry=G.e7FlagGeometry(rep);worst=Math.max(worst,geometry.maxIncidenceNorm);assert(geometry.maxIncidenceNorm<1e-10);assert.deepStrictEqual(geometry.intersections.map(item=>item.dimension),[1,1,0,0]);
   assert.deepStrictEqual(geometry.flags.map(f=>f.dimensions),[[1,2,3],[1,2,3],[2]]);
   for(const flag of geometry.flags){
    assert(flag.anchorComplex);assert(flag.line);assert.strictEqual(flag.directionsComplex.length,flag.name==='Short Line'?1:2);
    const points=[flag.point].concat(flag.line,flag.plane||[]);assert(points.every(p=>p.length===3&&p.every(Number.isFinite)));
    assert(flag.line.every(p=>p.every(x=>Math.abs(x)<=geometry.bound+1e-8)));
    flag.bases.slice(0,-1).forEach((B,i)=>B.forEach(v=>assert(G.complexMembershipNorm(v,flag.bases[i+1])<1e-10)));
    if(flag.plane){assert(flag.plane.length>=3);const a=flag.plane[0],u=flag.plane[1].map((x,i)=>x-a[i]),v=flag.plane[2].map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const p of [flag.point].concat(flag.line))assert(Math.abs(n.reduce((s,x,i)=>s+x*(p[i]-a[i]),0))<1e-8);}
   }
  }
 }
 const infinity=C.makeE7Chart(2);infinity.x[0][2][0][0]=[1,0];infinity.x[0][2][1][0]=[-1,0];const f=G.e7FlagGeometry(infinity).flags[0];assert.strictEqual(f.status,'at infinity');assert.strictEqual(f.point,null);
 assert.throws(()=>G.e7FlagGeometry(C.makeE7Chart(2),{bound:0}));
 assert.strictEqual(G.complexIntersectionDimension([[[1,0],[0,0]]],[[[1,0],[0,0]]]),1);
 console.log('E7 geometry passed; maximum exact-complex membership norm',worst);
}
main().catch(e=>{console.error(e);process.exitCode=1;});

