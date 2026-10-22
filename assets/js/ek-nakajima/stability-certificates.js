// Exact King certificates for the eight canonical E6 attachment/fixed fixtures.
// This is deliberately not a numerical stability test for arbitrary matrices.
// All fixture entries become integers after multiplication by three. Ranks are
// computed by integer minors; all weights below have an explicit denominator.
//
// Injective x identifies the maximal branch spaces with W intersect L_i/P_i.
// Those spaces form a subrepresentation iff each K_i W is contained in W.
// Positive FI weights make these maximal spaces the worst case. At a graded
// fixed point any destabilizer has a grading-invariant degeneration, with
// intersection dimensions only increasing. Thus testing graded W suffices.
// W=0 forces the zero subrepresentation by injectivity. For W=V, any proper
// subrepresentation omits a positive-weight branch dimension and has weight<0.
import { stableBranchChart, branchMiddleChart, branchTipChart, branchFixedGrading } from './branch-charts.js';
import { concurrencyLimitChart } from './limit-chart.js';

import { E6_REGULAR_LEVEL_NUMERATORS, E6_REGULAR_LEVEL_DENOMINATOR } from './e6-levels.js';

export const ENDPOINT_LEVEL_NUMERATORS = E6_REGULAR_LEVEL_NUMERATORS;
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const det = (a,b,c) => dot(a,cross(b,c));
const nonzero = v => v.some(x=>x!==0);
const scale = (v,s) => v.map(x=>x*s);
const add = (a,b) => a.map((x,i)=>x+b[i]);
const rank = cols => {
  const nz=cols.filter(nonzero);
  if (!nz.length) return 0;
  for(let i=0;i<nz.length;i++) for(let j=i+1;j<nz.length;j++) {
    if(!nonzero(cross(nz[i],nz[j]))) continue;
    if(nz.some(v=>det(nz[i],nz[j],v)!==0)) return 3;
    return 2;
  }
  return 1;
};
const intersectionDimension=(a,b)=>rank(a)+rank(b)-rank(a.concat(b));
const image=(m,v)=>m.map(row=>dot(row,v));
const columns=m=>m[0].map((_,j)=>m.map(row=>row[j]));
function integerMatrix(m) {
  return m.map(row=>row.map(z=>{
    const n=Math.round(3*z[0]);
    if(z[1]!==0 || Math.abs(3*z[0]-n)>1e-12 || !Number.isSafeInteger(n)) {
      throw new RangeError('Endpoint certificate requires the canonical rational fixture.');
    }
    return n;
  }));
}
function geometry(rep) {
  const P=rep.A.map(a=>columns(integerMatrix(a)));
  const L=P.map(p=>[p[0]]); // Every canonical fixture has a_i=e1.
  const K=rep.A.map((a,i)=>{
    const x=integerMatrix(a), y=integerMatrix(rep.B[i]);
    return x.map(row=>[0,1,2].map(j=>row[0]*y[0][j]+row[1]*y[1][j]));
  });
  if(P.some(p=>rank(p)!==2)) throw new RangeError('Forward maps must be injective.');
  rep.a.forEach(a=>{
    const value=integerMatrix(a);
    if(value[0][0]!==3||value[1][0]!==0) throw new RangeError('Expected canonical outer arrows.');
  });
  rep.A.forEach((a,i)=>{
    const x=integerMatrix(a),y=integerMatrix(rep.B[i]),b=integerMatrix(rep.b[i]);
    for(let r=0;r<2;r++) for(let c=0;c<2;c++) {
      if(y[r].reduce((s,v,k)=>s+v*x[k][c],0)!==(r===0?3*b[0][c]:0)) {
        throw new Error('Fixture fails a middle complex moment equation.');
      }
    }
    if(b[0][0]!==0) throw new Error('Fixture fails an outer complex moment equation.');
  });
  for(let r=0;r<3;r++) for(let c=0;c<3;c++) {
    if(K.reduce((s,k)=>s+k[r][c],0)!==0) throw new Error('Fixture fails the central complex moment equation.');
  }
  return {P,L,K};
}
function validateGrading(g,kind,side) {
  let h,denominator=1;
  if(kind==='concurrency') {h=[[1,1,1],[1,1,1],[1,1,1]];denominator=3;}
  else {
    const weights=(kind==='attachment'||kind==='central-concurrency'||kind==='central-generic')?[0,0,0]:branchFixedGrading(side,kind==='middle'?1:2).center.weights;
    h=weights.map((w,i)=>weights.map((_,j)=>i===j?w:0));
  }
  g.L.concat(g.P).forEach(w=>{
    if(rank(w.concat(w.map(v=>image(h,v))))!==rank(w)) throw new Error('Fixture flags do not preserve the stated grading.');
  });
  g.K.forEach(k=>{
    for(let r=0;r<3;r++) for(let c=0;c<3;c++) {
      let commutator=0;
      for(let j=0;j<3;j++) commutator+=h[r][j]*k[j][c]-k[r][j]*h[j][c];
      if(commutator!==denominator*k[r][c]) throw new Error('Fixture reverse arrows do not have grading degree one.');
    }
  });
}
function distinctCandidates() {
  const e=[[1,0,0],[0,1,0],[0,0,1]];
  return e.map(v=>[v]).concat([[e[0],e[1]],[e[0],e[2]],[e[1],e[2]]]);
}
function repeatedCandidates(g,u0,u1,t) {
  const directions=[];
  const include=v=>{
    if(nonzero(v) && !directions.some(w=>!nonzero(cross(v,w)))) directions.push(v);
  };
  const n=cross(u0,u1), determinant=dot(n,t);
  if(!determinant) throw new RangeError('Invalid grading decomposition.');
  // All possible jumps in flag incidences on P(U): points lying in U,
  // projections of points along T, and intersections of flag planes with U.
  g.L.forEach(l=>include(add(scale(l[0],determinant),scale(t,-dot(n,l[0])))));
  g.P.forEach(p=>include(cross(n,cross(p[0],p[1]))));
  g.K.forEach(k=>{
    const kt=image(k,t);
    include(add(scale(kt,determinant),scale(t,-dot(n,kt))));
    const a=image(k,u0),b=image(k,u1);
    for(let j=0;j<3;j++) include(add(scale(u0,b[j]),scale(u1,-a[j])));
  });
  // A single additional direction represents the complement of this finite
  // set. Graded invariance and every incidence are constant on that complement.
  for(let k=0;k<=directions.length+1;k++) {
    const v=add(u0,scale(u1,k));
    if(!directions.some(w=>!nonzero(cross(v,w)))) { include(v); break; }
  }
  return [[t],[u0,u1]].concat(directions.map(v=>[v]),directions.map(v=>[t,v]));
}
function zeroCandidates(g) {
  // For positive levels, the largest line/plane incidence weights occur at
  // a marked point, a pairwise plane intersection, a flag plane, or a span
  // of two marked points. These dominate all remaining incidence patterns.
  const result=g.L.concat(g.P);
  for(let i=0;i<3;i++) for(let j=i+1;j<3;j++) {
    const v=cross(cross(g.P[i][0],g.P[i][1]),cross(g.P[j][0],g.P[j][1]));
    if(nonzero(v)) result.push([v]);
    if(rank(g.L[i].concat(g.L[j]))===2) result.push(g.L[i].concat(g.L[j]));
  }
  return result;
}

// kind: 'attachment', 'middle', 'tip', 'concurrency', or
// 'central-concurrency' (the y=0 central/short-arm attachment). side: 0/1.
// Default levels are exactly alpha=(3,3,3), gamma=(1,21/10,3).
// Supplying integer numerators keeps equality-to-wall tests exact.
export function endpointStabilityCertificate(kind,side=0,levelNumerators=ENDPOINT_LEVEL_NUMERATORS,denominator=E6_REGULAR_LEVEL_DENOMINATOR) {
  if(!Number.isSafeInteger(denominator)||denominator<=0||denominator>1000000 || !Array.isArray(levelNumerators) || levelNumerators.length!==3 ||
    levelNumerators.some(row=>!Array.isArray(row)||row.length!==2||row.some(x=>!Number.isSafeInteger(x)||x<=0||x>1000000))) {
    throw new RangeError('Certificates require positive rational levels with bounded integer numerators.');
  }
  if(side!==0&&side!==1) throw new RangeError('Expected branch side 0 or 1.');
  let rep;
  if(kind==='attachment') rep=stableBranchChart(side,0,0);
  else if(kind==='middle') rep=branchMiddleChart(side,0,0);
  else if(kind==='tip') rep=branchTipChart(side,0,0);
  else if(kind==='concurrency') rep=concurrencyLimitChart(0,0);
  else if(kind==='central-concurrency') rep=stableBranchChart(0,1,0);
  else if(kind==='central-generic') rep=stableBranchChart(0,2,0);
  else throw new RangeError('Unsupported endpoint kind.');
  const g=geometry(rep);
  validateGrading(g,kind,side);
  let candidates;
  const zeroSection=kind==='attachment'||kind==='central-concurrency'||kind==='central-generic';
  if(zeroSection) candidates=zeroCandidates(g);
  else if(kind==='tip') candidates=distinctCandidates();
  else if(kind==='middle') {
    const weights=branchFixedGrading(side,1).center.weights;
    const repeated=weights.map((w,i)=>weights.filter(v=>v===w).length===2?i:-1).filter(i=>i>=0);
    if(repeated.length!==2) throw new Error('Middle certificate expects one repeated grading eigenspace.');
    const single=[0,1,2].filter(i=>repeated.indexOf(i)<0)[0];
    const basis=[[1,0,0],[0,1,0],[0,0,1]];
    candidates=repeatedCandidates(g,basis[repeated[0]],basis[repeated[1]],basis[single]);
  }
  else candidates=repeatedCandidates(g,[1,-1,0],[1,0,-1],[1,1,1]);
  const total=levelNumerators.reduce((s,row)=>s+row[0]+2*row[1],0);
  const entries=[];
  candidates.forEach(w=>{
    const d=rank(w);
    if(d<1||d>2||g.K.some(k=>rank(w.concat(w.map(v=>image(k,v))))!==d)) return;
    const incidence=g.L.map((l,i)=>[intersectionDimension(w,l),intersectionDimension(w,g.P[i])]);
    const key=d+':'+JSON.stringify(incidence);
    if(entries.some(e=>e.key===key)) return;
    const numerator=3*incidence.reduce((s,p,i)=>s+levelNumerators[i][0]*p[0]+levelNumerators[i][1]*p[1],0)-d*total;
    entries.push({key,dimension:d,incidence,numerator,denominator:3*denominator});
  });
  if(!entries.length) throw new Error('Endpoint certificate has no invariant test subspaces.');
  const maximumNumerator=Math.max(...entries.map(e=>e.numerator));
  return {kind,side,stable:maximumNumerator<0,semistable:maximumNumerator<=0,
    maximumNumerator,denominator:3*denominator,entries,
    method:zeroSection?'positive flag incidence maxima':'graded invariant subspace enumeration'};
}


// Exact certificate for the entire compact y=0 family, not sampled evidence.
// Its marked points are e1,e2,e3 and plane normals are
// (0,-u,s), (1,0,-1), (-1,1,0). Consequently every incidence pattern is
// constant off u=0, s=0, u=s. Positive-level incidence maxima above cover
// all subspaces in each of these four algebraic strata.
export function centralSphereStabilityCertificate(levelNumerators=ENDPOINT_LEVEL_NUMERATORS,denominator=E6_REGULAR_LEVEL_DENOMINATOR) {
  const strata=[['zero','attachment',0],['infinity','attachment',1],
    ['concurrency','central-concurrency',0],['generic','central-generic',0]];
  const certificates=strata.map(([stratum,kind,side])=>({stratum,
    certificate:endpointStabilityCertificate(kind,side,levelNumerators,denominator)}));
  return {stable:certificates.every(row=>row.certificate.stable),
    maximumNumerator:Math.max(...certificates.map(row=>row.certificate.maximumNumerator)),
    denominator:3*denominator,certificates,
    method:'exhaustive algebraic incidence strata of the central projective line'};
}
