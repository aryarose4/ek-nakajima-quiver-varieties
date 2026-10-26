// Canonical samples determine display order only. Current solved flags remain
// the sole evidence for badges; this cache never manufactures an incidence.
import {e6AtlasPoint} from './e6-atlas.js';
import {e6TransportWord} from './e6-chamber-transport.js';
import {e6ChamberWord} from './e6-parameters.js';
import {E6_REGULAR_LEVELS} from './e6-levels.js';
import {cSub,cMul,cScale} from './core-math.js';
import {fullImageIncidences} from './weighted-balanced-diagram.js';
const cache=new Map(),ids=[0,1,2];
const cross=(u,v)=>ids.map(i=>cSub(cMul(u[(i+1)%3],v[(i+2)%3]),cMul(u[(i+2)%3],v[(i+1)%3])));
const norm=v=>Math.hypot(...v.map(z=>Math.hypot(...z)));
export function informativeImageSources(rep) {
  const normals=rep.A.map(A=>cross(A.map(row=>row[0]),A.map(row=>row[1])));
  const equal=(i,j)=>norm(normals[i])>1e-12&&norm(normals[j])>1e-12&&
    norm(cross(normals[i].map(z=>cScale(z,1/norm(normals[i]))),normals[j].map(z=>cScale(z,1/norm(normals[j])))))<=1e-8;
  return fullImageIncidences(rep).map((image,i)=>image&&(
    image.points.some(Boolean)||image.planes.some((yes,j)=>yes&&!equal(i,j)))?i:null)
    .filter(i=>i!==null);
}
export function imageSourceOrder(chamberId,parameters) {
  if(!chamberId||chamberId==='default'||!parameters)return ids.slice();
  const {r,theta,t,outgoing}=parameters,sphere=parameters.sphere||0;
  const short=r===.5&&theta===0,long=r===0||r===1;
  if(!short&&!long)return ids.slice();
  const key=chamberId+':'+r;
  if(!cache.has(key)) {
    try {
      const stages=short?[[0,0,false],[0,.3,false],[0,1,false],[0,.3,true]]:
        [[0,0,false],[0,.3,false],[0,1,false],[1,.3,false],[1,1,false],[1,.3,true]];
      const word=e6ChamberWord(chamberId);let order=[];
      const orders=stages.map(([stageSphere,stageT,stageOutgoing])=>{
        const raw=e6AtlasPoint({r,theta:0,phi:.37,sphere:stageSphere,t:stageT,outgoing:stageOutgoing}).rep;
        const present=informativeImageSources(e6TransportWord(raw,E6_REGULAR_LEVELS,word).rep);
        order=order.filter(i=>present.includes(i)).concat(present.filter(i=>!order.includes(i)));
        return order.slice();
      });
      cache.set(key,orders);
    } catch(error) {
      // Unsupported or numerically singular canonical samples only affect
      // ordering. Keep current solved badges and a deterministic fallback.
      cache.set(key,null);
    }
  }
  const orders=cache.get(key);
  if(!orders)return ids.slice();
  const stage=outgoing?(short?3:5):short?(t===0?0:t===1?2:1):
    sphere===0?(t===0?0:t===1?2:1):(t===0?2:t===1?4:3);
  const order=orders[stage]||[];
  return order.concat(ids.filter(i=>!order.includes(i)));
}
