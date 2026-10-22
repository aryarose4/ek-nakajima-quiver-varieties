// Chamber-dependent effective classes, independent of representative transport.
import {e6BoundedRealRoots} from './e6-levels.js';
import {E6_CHAMBER_EDGES,e6VertexLevels} from './e6-chamber-transport.js';
const delta=[3,2,2,2,1,1,1];
const key=r=>r.join(',');
export function e6RootPairing(a,b) {
  return 2*a.reduce((s,x,i)=>s+x*b[i],0)-E6_CHAMBER_EDGES.reduce((s,[i,j])=>s+a[i]*b[j]+a[j]*b[i],0);
}
export function e6ReflectRoot(root,vertex) {
  if(!Number.isInteger(vertex)||vertex<0||vertex>6||!Array.isArray(root)||root.length!==7||!root.every(Number.isSafeInteger))throw new RangeError('Expected an integral E6 root and vertex.');
  const out=root.slice();out[vertex]=-root[vertex];
  E6_CHAMBER_EDGES.forEach(([a,b])=>{if(a===vertex)out[vertex]+=root[b];if(b===vertex)out[vertex]+=root[a];});
  // Finite lattice convention: delete outer2, the affine vertex.
  return out.map((x,i)=>x-out[6]*delta[i]);
}
export function e6ChamberRoots(levels,tolerance=1e-9) {
  if(!Number.isFinite(tolerance)||tolerance<0)throw new RangeError('Invalid wall tolerance.');
  const lambda=e6VertexLevels(levels);
  const roots=e6BoundedRealRoots().map(r=>[r.center].concat(r.middle,r.outer)).map(r=>r.map((x,i)=>x-r[6]*delta[i]));
  const weighted=roots.map(root=>({root,weight:root.reduce((s,x,i)=>s+x*lambda[i],0)}));
  if(weighted.some(r=>Math.abs(r.weight)<=tolerance))throw new RangeError('Effective simple roots require regular levels away from root walls.');
  const positive=weighted.filter(r=>r.weight>0),set=new Set(positive.map(r=>key(r.root)));
  const simple=positive.filter(a=>!positive.some(b=>set.has(key(a.root.map((x,i)=>x-b.root[i])))));
  if(simple.length!==6)throw new Error('Expected six indecomposable positive E6 roots.');
  return {simple:simple.map(r=>({root:r.root,period:r.weight/2})),
    gram:simple.map(a=>simple.map(b=>e6RootPairing(a.root,b.root)))};
}
