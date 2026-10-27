import assert from 'assert';

// Integer certificate: levels are numerator/10000, with center weight
// -sum(delta_i * numerator_i)/40000. No floating-point stability decisions.
const marks=[1,2,3,4,3,2,1,2];
const edges=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[3,7]];
const armNumerators=[10001,10002,10004,10008,10016,10032,5064];
const nodeNumerators=[10001,10002,10004,0,10032,10016,10008,5064];
const weightedTotal=nodeNumerators.reduce((s,n,i)=>s+n*marks[i],0);
let roots=0,minPairing=Infinity;
function enumerateBounds(bounds,fn,prefix=[]){
 if(prefix.length===bounds.length){fn(prefix);return;}
 for(let d=0;d<=bounds[prefix.length];d++)enumerateBounds(bounds,fn,prefix.concat(d));
}
enumerateBounds(marks,d=>{
 const q=d.reduce((s,n)=>s+n*n,0)-edges.reduce((s,e)=>s+d[e[0]]*d[e[1]],0);
 if(q!==1)return;
 roots++;
 const pairing=4*d.reduce((s,n,i)=>s+n*nodeNumerators[i],0)-d[3]*weightedTotal;
 assert.notStrictEqual(pairing,0,'regular fixture lies on root wall '+d.join(','));
 minPairing=Math.min(minPairing,Math.abs(pairing));
});
assert.strictEqual(roots,126);
assert.strictEqual(weightedTotal,130281);

// Geometric input (proved in docs/E7_OPEN_CHART.md): opposite full flags
// have sum of intersection dimensions <=3d; equality iff U is coordinate.
// The uniform Pluecker matroid of W(z), z !=0,1, gives coordinate intersections.
// For strict inequality we over-enumerate all dimension tuples, retaining
// even impossible flag tuples: proving all their weights negative is stronger.
const armDims=[1,2,3,1,2,3,2];
const weight=(d,v)=>4*v.reduce((s,n,i)=>s+n*armNumerators[i],0)-d*weightedTotal;
let checked=0,maxWeight=-Infinity;
for(let d=1;d<=3;d++){
 enumerateBounds(armDims.map(n=>Math.min(d,n)),v=>{
  if(v.slice(0,6).reduce((s,n)=>s+n,0)>3*d-1)return;
  const w=weight(d,v);assert(w<0,'strict-case destabilizer '+d+':'+v);checked++;maxWeight=Math.max(maxWeight,w);
 });
 for(let mask=1;mask<15;mask++){
  const chosen=[0,1,2,3].filter(i=>(mask&(1<<i))!==0);if(chosen.length!==d)continue;
  const v=[1,2,3].map(k=>chosen.filter(i=>i<k).length)
   .concat([1,2,3].map(k=>chosen.filter(i=>i>=4-k).length),[Math.max(0,d-2)]);
  assert.strictEqual(v.slice(0,6).reduce((s,n)=>s+n,0),3*d);
  const w=weight(d,v);assert(w<0,'coordinate destabilizer '+mask);checked++;maxWeight=Math.max(maxWeight,w);
 }
}
assert(armNumerators.every(n=>n>0)); // U=C4 proper peripheral spaces lose positive weight.
const perturbBound=armDims.reduce((s,d,i)=>s+d*Math.abs(armNumerators[i]-(i===6?5000:10000)),0);
assert(perturbBound<2500); // Original King margin .25, in units 1/10000.
console.log(JSON.stringify({certificate:'E7 Regular Fixture',realRoots:roots,minAbsRootPairing:minPairing+'/40000',subspaceBoundsChecked:checked,maxKingWeight:maxWeight+'/40000',perturbBound:perturbBound+'/10000'}));
console.log('Exact E7 regularity and open-chart stability certificate passed');
