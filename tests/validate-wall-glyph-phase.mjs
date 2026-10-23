import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
function source(name){if(cache[name])return cache[name];let code=fs.readFileSync(path.join(base,name),'utf8');code=code.replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');}
(async function(){
 const {balancedTensorDiagram:diagram}=await import(source('weighted-balanced-diagram.js'));
 const {solveBalancedAtlas}=await import(source('balanced-model.js'));
 const beta=[[1.5,.5],[1.5,1.05],[1.5,1.5]],adjacent=[[46/30,.5],[1.5,61/60],[44/30,46/30]];
 const errors=[];
 for(const h of [1e-3,1e-4,1e-5]){
   const pictures=[-1,1].map(side=>{
     const levels=beta.map((row,i)=>row.map((v,j)=>2*(v+(adjacent[i][j]-v)*(.5+side*h))));
     const solve=solveBalancedAtlas({r:0,theta:0,t:.4,phi:.6,sphere:1},levels,side>0?{chamber:'side-zero-second'}:{});
     assert(solve.success,'balanced side of wall');
     const d=diagram(solve.solvedRep);assert(d.valid,'phase camera available');
     assert(d.layout.pointOpacities.concat(d.layout.lineOpacities).every(x=>x===1),'no objects hidden');
     assert(Math.hypot(...d.glyphs[0].coefficients[2])>1,'surviving coefficient stays large');
     return d;
   });
   const values=pictures.map(d=>d.glyphs.flatMap(g=>g.coefficients.flat()));
   errors.push(Math.hypot(...values[0].map((x,i)=>x-values[1][i])));
 }
 assert(errors[2]<.002&&errors[2]<errors[0]/5,'all cotangent coefficients converge across wall');
 console.log(JSON.stringify({wallGlyphErrors:errors}));
})().catch(error=>{console.error(error);process.exitCode=1;});
