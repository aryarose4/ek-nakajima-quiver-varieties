// Exact integer King certificate with endpoint coordinate-plane exceptions.
import assert from 'assert';
const levels=[10001,10002,10004,10008,10016,10032,5064],dims=[1,2,3,1,2,3,2];
const weight=(d,v)=>4*v.reduce((s,n,i)=>s+n*levels[i],0)-d*130281;
function enumerate(bounds,fn,v=[]){if(v.length===bounds.length)return fn(v);for(let i=0;i<=bounds[v.length];i++)enumerate(bounds,fn,v.concat(i));}
const cases=[['raw0',6,54],['raw1',3,-126],['rawInfinity',10,70],['north0',9,-54],['north1',3,-126],['south0',5,-70],['south1',3,-126]];
const planes={raw0:[[1,0],[0,1],[1,1],[1,0]],raw1:[[1,0],[0,1],[1,1],[1,1]],rawInfinity:[[1,0],[0,1],[1,0],[1,1]],north0:[[1,0],[0,1],[0,1],[1,1]],north1:[[1,0],[0,1],[1,1],[1,1]],south0:[[1,0],[0,1],[1,1],[0,1]],south1:[[1,0],[0,1],[1,1],[1,1]]};
for(const entry of cases){
 const name=entry[0],exception=entry[1];let max=-Infinity,count=0,exceptionWeight;
 const W=planes[name];let zeros=0;
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
  if(W[i][0]*W[j][1]-W[i][1]*W[j][0]!==0)continue;
  zeros++;assert.strictEqual(15^(1<<i)^(1<<j),exception);
 }
 assert.strictEqual(zeros,1); // Exactly the claimed coordinate two-plane exception.
 for(let d=1;d<=3;d++){
  enumerate(dims.map(n=>Math.min(n,d)),v=>{if(v.slice(0,6).reduce((s,n)=>s+n,0)>3*d-1)return;const w=weight(d,v);assert(w<0);count++;max=Math.max(max,w);});
  for(let mask=1;mask<15;mask++){
   const indices=[0,1,2,3].filter(i=>mask&(1<<i));if(indices.length!==d)continue;
   const v=[1,2,3].map(k=>indices.filter(i=>i<k).length).concat([1,2,3].map(k=>indices.filter(i=>i>=4-k).length),[Math.max(0,d-2)+(mask===exception?1:0)]);
   const w=weight(d,v);if(mask===exception)exceptionWeight=w;else assert(w<0);max=Math.max(max,w);count++;
  }
 }
 assert.strictEqual(exceptionWeight,entry[2]);assert.strictEqual(count,2173);
 assert.strictEqual(max>0,name==='raw0'||name==='rawInfinity');
 console.log(JSON.stringify({endpoint:name,exceptionKing:exceptionWeight+'/40000',maxKing:max+'/40000',boundsChecked:count}));
}
// The projector/integer-gap proof supplies the exhaustive split above.
// Positive levels exclude proper peripheral choices for U=C4; injectivity
// excludes nonzero subrepresentations with U=0. No solver outcome enters it.
console.log('Exact E7 endpoint King certificate passed');
