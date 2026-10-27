import fs from 'fs';import os from 'os';import path from 'path';import {pathToFileURL} from 'url';import assert from 'assert';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'e7-frame-'));
fs.writeFileSync(path.join(temp,'package.json'),'{"type":"module"}');
for(const name of ['core-math','solver','e7-core','e7-solver','e7-atlas','e7-frame-transport'])fs.copyFileSync(new URL('../assets/js/ek-nakajima/'+name+'.js',import.meta.url),path.join(temp,name+'.js'));
async function main(){
 const load=name=>import(pathToFileURL(path.join(temp,name+'.js')).href);
 const A=await load('e7-atlas'),C=await load('e7-core'),S=await load('e7-solver'),F=await load('e7-frame-transport'),M=await load('core-math');
 const z=[1.5,.2],transition=A.transitionE7NorthToSouth(z,0);
 const north=S.solveE7(A.makeE7AtlasChart('north',z,0),C.E7_DEFAULT_LEVELS);
 const south=S.solveE7(A.makeE7AtlasChart('south',transition.base,transition.fiber),C.E7_DEFAULT_LEVELS);
 assert(north.success&&south.success);
 const move=F.transportE7DisplayFrame(F.identityE7DisplayFrame(),north,south,transition);
 const displayed=F.applyE7DisplayFrame(south.rep,move.frame);
 let maxMatrixError=0;
 for(const key of ['x','y'])displayed[key].forEach((arm,b)=>arm.forEach((mat,k)=>{maxMatrixError=Math.max(maxMatrixError,M.frobNorm(M.matSub(mat,north.rep[key][b][k])));}));
 assert(maxMatrixError<1e-7);assert(move.unitarityError<1e-10);
 assert(C.complexResidualNormE7(displayed)<1e-9);
 assert(Math.hypot(...C.packRealResidualE7(displayed,C.E7_DEFAULT_LEVELS))<1e-8);
 const reverse=F.transportE7DisplayFrame(move.frame,south,north,{gauge:transition.inverse,inverse:transition.gauge});
 const roundTripError=M.frobNorm(M.matSub(reverse.frame.center,M.eyeZ(4)));assert(roundTripError<1e-10);
 const incompatible=Object.assign({},south,{rep:JSON.parse(JSON.stringify(south.rep))});incompatible.rep.x[0][0][0][0][0]+=.1;
 assert.throws(()=>F.transportE7DisplayFrame(F.identityE7DisplayFrame(),north,incompatible,transition),/matching failed/);
 assert.throws(()=>F.transportE7DisplayFrame(null,Object.assign({},north,{success:false}),south,transition),/successful solves/);
 const near=M.eyeZ(4);near[0][0]=[1.2,0];near[0][1]=[.1,.15];
 const polar=F.e7UnitaryPolar(near);assert(M.frobNorm(M.matSub(M.matMul(M.matAdj(polar),polar),M.eyeZ(4)))<1e-10);
 console.log(JSON.stringify({matchingError:move.matchingError,maxMatrixError,unitarityError:move.unitarityError,roundTripError,northResidual:north.realNorm,southResidual:south.realNorm}));
 console.log('E7 exact chart frame transport validation passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
