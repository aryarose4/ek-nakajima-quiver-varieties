// Experimental holomorphic reflection transport. Not connected to the UI.
// Vertex order: center, middle0..2, outer0..2. See docs/e6-chamber-transport.md.
import {cAbs2,cSub,cMul,eyeZ,matMul,matScale,matAdj,matAdd,matSub,frob2,complexResidualNorm} from './core-math.js';
import {checkFixedPointGrading} from './fixed-point.js';
export const E6_CHAMBER_EDGES = [[0,1],[0,2],[0,3],[1,4],[2,5],[3,6]];
const dims=[3,2,2,2,1,1,1];
const copy=x=>JSON.parse(JSON.stringify(x));
const div=(a,b)=>[(a[0]*b[0]+a[1]*b[1])/cAbs2(b),(a[1]*b[0]-a[0]*b[1])/cAbs2(b)];
function elimination(matrix) {
  const a=copy(matrix),pivots=[];let row=0;
  for(let col=0;col<a[0].length&&row<a.length;col++) {
    let pivot=row;for(let i=row+1;i<a.length;i++)if(cAbs2(a[i][col])>cAbs2(a[pivot][col]))pivot=i;
    if(cAbs2(a[pivot][col])<1e-22)continue;
    [a[row],a[pivot]]=[a[pivot],a[row]];const value=a[row][col];a[row]=a[row].map(z=>div(z,value));
    for(let i=0;i<a.length;i++)if(i!==row){const f=a[i][col];a[i]=a[i].map((z,j)=>cSub(z,cMul(f,a[row][j])));}
    pivots.push(col);row++;
  }
  return {a,pivots};
}
function inverse(a) {
  const n=a.length,e=eyeZ(n),out=elimination(a.map((r,i)=>r.concat(e[i])));
  if(out.pivots.slice(0,n).some((x,i)=>x!==i))throw new RangeError('Singular reflection basis.');
  return out.a.map(r=>r.slice(n));
}
const transpose=a=>a[0].map((_,j)=>a.map(r=>r[j]));
const horizontal=blocks=>blocks[0].map((_,i)=>[].concat(...blocks.map(b=>b[i])));
export function e6VertexLevels(levels) {
  if(!Array.isArray(levels)||levels.length!==3||levels.some(r=>!Array.isArray(r)||r.length!==2||!r.every(Number.isFinite)))throw new RangeError('Expected three finite level pairs.');
  return [-levels.reduce((s,r)=>s+r[0]+2*r[1],0)/3].concat(levels.map(r=>r[1]),levels.map(r=>r[0]));
}
export function e6ReflectLevels(levels,vertex) {
  if(!Number.isInteger(vertex)||vertex<0||vertex>6)throw new RangeError('Invalid E6 vertex.');
  const z=e6VertexLevels(levels),value=z[vertex];z[vertex]=-value;
  E6_CHAMBER_EDGES.forEach(([a,b])=>{if(a===vertex)z[b]+=value;if(b===vertex)z[a]+=value;});
  return [0,1,2].map(i=>[z[i+4],z[i+1]]);
}
function localMaps(rep,vertex) {
  if(vertex===0)return {p:[].concat(...rep.B),q:horizontal(rep.A.map(m=>matScale(m,-1)))};
  if(vertex<=3){const i=vertex-1;return {p:rep.A[i].concat(rep.b[i]),q:horizontal([rep.B[i],matScale(rep.a[i],-1)])};}
  const i=vertex-4;return {p:rep.a[i],q:rep.b[i]};
}
function install(rep,vertex,p,q) {
  const out=copy(rep);
  if(vertex===0)for(let i=0;i<3;i++){out.B[i]=p.slice(2*i,2*i+2);out.A[i]=matScale(q.map(r=>r.slice(2*i,2*i+2)),-1);}
  else if(vertex<=3){const i=vertex-1;out.A[i]=p.slice(0,3);out.b[i]=p.slice(3);out.B[i]=q.map(r=>r.slice(0,3));out.a[i]=matScale(q.map(r=>r.slice(3)),-1);}
  else {const i=vertex-4;out.a[i]=p;out.b[i]=q;}
  return out;
}
export function e6ReflectRepresentation(rep,levels,vertex,grading) {
  const nextLevels=e6ReflectLevels(levels,vertex),value=e6VertexLevels(levels)[vertex];
  if(Math.abs(value)<1e-10)throw new RangeError('Reflection requires a nonzero vertex level.');
  if(complexResidualNorm(rep)>1e-8)throw new RangeError('Reflection requires the zero complex moment level.');
  if(grading && (Object.values(grading).some(g=>g.basis)||!checkFixedPointGrading(rep,grading).passes))throw new RangeError('Expected a valid diagonal fixed grading.');
  const {p,q}=localMaps(rep,vertex),d=dims[vertex],n=2*d,e=eyeZ(n);let pp,qq,free;
  if(value>0) {
    // Independent rows of p identify the coordinate vectors completing im p.
    const pivots=elimination(transpose(p)).pivots;
    if(pivots.length!==d)throw new RangeError('Positive-level reflection requires injective outgoing map.');
    free=e.map((_,i)=>i).filter(i=>pivots.indexOf(i)<0);const s=e.map(r=>free.map(i=>r[i]));
    const h=horizontal([p,s]),quotient=inverse(h).slice(d);
    pp=matMul(matMul(p,q),s);qq=quotient;
  } else {
    const pivots=elimination(q).pivots;
    if(pivots.length!==d)throw new RangeError('Negative-level reflection requires surjective incoming map.');
    free=e.map((_,i)=>i).filter(i=>pivots.indexOf(i)<0);const left=free.map(i=>e[i]);
    const h=q.concat(left),kernel=inverse(h).map(r=>r.slice(d));
    pp=kernel;qq=matMul(matMul(left,p),q);
  }
  const result={rep:install(rep,vertex,pp,qq),levels:nextLevels};
  if(grading) {
    let weights,name;
    if(vertex===0){name='center';weights=[].concat(...[0,1,2].map(i=>grading['middle'+i].weights.map(w=>w-1)));}
    else if(vertex<=3){const i=vertex-1;name='middle'+i;weights=grading.center.weights.concat(grading['outer'+i].weights.map(w=>w-1));}
    else {const i=vertex-4;name='outer'+i;weights=grading['middle'+i].weights;}
    result.grading=copy(grading);result.grading[name]={weights:free.map(i=>weights[i]+(value>0?1:0))};
  }
  return result;
}
export function e6TransportWord(rep,levels,word,grading) {
  let out={rep:copy(rep),levels:copy(levels)};
  if(grading)out.grading=copy(grading);
  for(const vertex of word)out=e6ReflectRepresentation(out.rep,out.levels,vertex,out.grading);
  return out;
}
// Conjugated reflection in the current r=0 second sphere root.
// root=(1; middle 1,0,1; outer 1,0,0), with the sign chosen for reduction.
export const E6_ADJACENT_WORD = [4,1,0,3,0,1,4];

// Balanced reflection: orthonormal bases affect only unitary gauge, hence
// discontinuous coordinate pivots do not alter quotient observables.
function complement(p) {
  const n=p.length,d=p[0].length,basis=[];
  const dot=(a,b)=>a.reduce((s,z,i)=>{const w=cMul([z[0],-z[1]],b[i]);return [s[0]+w[0],s[1]+w[1]];},[0,0]);
  function orthogonal(v) {
    for(let pass=0;pass<2;pass++)for(const u of basis){const z=dot(u,v);v=v.map((x,i)=>cSub(x,cMul(u[i],z)));}
    const norm=Math.sqrt(v.reduce((s,z)=>s+cAbs2(z),0));
    if(norm<1e-10)return null;
    return v.map(z=>[z[0]/norm,z[1]/norm]);
  }
  for(let j=0;j<d;j++){const u=orthogonal(p.map(r=>r[j]));if(!u)throw new RangeError('Balanced reflection requires full rank.');basis.push(u);}
  const out=[];
  for(let i=0;i<n&&out.length<d;i++){const v=orthogonal(eyeZ(n).map(r=>r[i]));if(v){basis.push(v);out.push(v);}}
  if(out.length!==d)throw new RangeError('Balanced reflection complement failed.');
  return transpose(out);
}
function positiveSquareRoot(a) {
  // Scaled Denman--Beavers iteration for matrices of size at most three.
  const scale=Math.max(...a.map((r,i)=>Math.abs(r[i][0])),1e-30);
  let y=matScale(a,1/scale),z=eyeZ(a.length);
  for(let k=0;k<40;k++) {
    const yy=matScale(matAdd(y,inverse(z)),.5),zz=matScale(matAdd(z,inverse(y)),.5);
    const delta=Math.sqrt(frob2(matSub(yy,y)));y=yy;z=zz;
    if(delta<1e-13)break;
  }
  return {root:matScale(y,Math.sqrt(scale)),inverseRoot:matScale(z,1/Math.sqrt(scale))};
}
export function e6ReflectBalancedRepresentation(rep,levels,vertex) {
  const value=e6VertexLevels(levels)[vertex];
  if(Math.abs(value)<1e-10)throw new RangeError('Reflection requires a nonzero vertex level.');
  let {p,q}=localMaps(rep,vertex);
  const negative=value<0;
  if(negative){const pp=matAdj(q);q=matAdj(p);p=pp;}
  const u=complement(p),Q=matMul(q,u);
  const h=positiveSquareRoot(matAdd(matScale(eyeZ(dims[vertex]),Math.abs(value)),matMul(matAdj(Q),Q)));
  let pp=matMul(matMul(p,Q),h.inverseRoot),qq=matMul(h.root,matAdj(u));
  if(negative){const t=matAdj(qq);qq=matAdj(pp);pp=t;}
  return {rep:install(rep,vertex,pp,qq),levels:e6ReflectLevels(levels,vertex)};
}
export function e6TransportBalancedWord(rep,levels,word) {
  let out={rep:copy(rep),levels:copy(levels)};
  for(const vertex of word)out=e6ReflectBalancedRepresentation(out.rep,out.levels,vertex);
  return out;
}

