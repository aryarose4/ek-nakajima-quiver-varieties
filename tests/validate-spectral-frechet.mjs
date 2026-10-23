import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
function source(name) {
  if(cache[name])return cache[name];
  let code=fs.readFileSync(path.join(base,name),'utf8');
  if(name==='solver.js')code+='\nexport {makePackedResidual,cachedExpmTangent,expmSmooth};';
  code=code.replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
  return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
(async function(){
  const {cachedExpmTangent,expmSmooth}=await import(source('solver.js'));
  const {CENTER_BASIS,MIDDLE_BASIS,unpackHermitian,matScale}=await import(source('core-math.js'));
  let worst=0,checks=0;
  for(const basis of [CENTER_BASIS,MIDDLE_BASIS])for(const scale of [0,1e-9,.1,1,4,12]) {
    const coords=basis.map((_,i)=>scale*Math.sin(1.7*(i+1)));
    const entry={coords};
    for(let j=0;j<basis.length;j++) {
      const h=1e-5,plus=coords.slice(),minus=coords.slice();plus[j]+=h;minus[j]-=h;
      const a=expmSmooth(matScale(unpackHermitian(plus,basis),.5)),b=expmSmooth(matScale(unpackHermitian(minus,basis),.5));
      const tangent=cachedExpmTangent(entry,basis,matScale(basis[j],.5));
      let err2=0,norm2=0;
      for(let i=0;i<a.length;i++)for(let k=0;k<a.length;k++)for(let z=0;z<2;z++) {
        const fd=(a[i][k][z]-b[i][k][z])/(2*h);err2+=(fd-tangent[i][k][z])**2;norm2+=fd*fd;
      }
      const error=Math.sqrt(err2)/(1+Math.sqrt(norm2));worst=Math.max(worst,error);assert(error<2e-7,'Frechet derivative '+error);checks++;
    }
    assert(entry.spectrum,'block eigensystem is cached');
  }
  console.log('Cached spectral Frechet:',checks,'centered-difference columns; repeated/near-repeated and large spectra; max relative error',worst);
})().catch(error=>{console.error(error);process.exitCode=1;});
