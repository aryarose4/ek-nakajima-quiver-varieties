// Exact E6 long-arm atlas. Coordinates and gauges are derived in
// journal/2026-10-21-stable-branches.txt. These charts satisfy mu_C=0;
// their stable endpoints require the generic chamber gamma=(1,2.1,3).
import { makeRep, cMul, cSub, cScale } from './core-math.js';
const C = x => {
  if (typeof x === 'number' && Number.isFinite(x)) return [x,0];
  if (Array.isArray(x) && x.length===2 && x.every(v=>typeof v==='number' && Number.isFinite(v))) return [x[0],x[1]];
  throw new RangeError('Expected a finite number or complex [real, imaginary] pair.');
};
function validateSide(side) {
  if(side!==0 && side!==1 && side!=='zero' && side!=='infinity') throw new RangeError('Expected side 0, 1, zero, or infinity.');
}
const M = rows => rows.map(row => row.map(C));
const mul = (a,b) => cMul(C(a), C(b));
const neg = a => cScale(C(a), -1);
const sub1 = a => cSub(C(a), [1,0]);
function assemble(side, A, b, B) {
  validateSide(side);
  const rep = makeRep([M([[1],[0]]),M([[1],[0]]),M([[1],[0]])], A.map(M), b.map(M), B.map(M));
  if (side === 'infinity' || side === 1) {
    for (const key of ['a','A','b','B']) [rep[key][1],rep[key][2]]=[rep[key][2],rep[key][1]];
    rep.A.forEach(m => { [m[1],m[2]]=[m[2],m[1]]; });
    rep.B.forEach(m => m.forEach(row => { [row[1],row[2]]=[row[2],row[1]]; }));
    // The reciprocal cotangent fiber has opposite sign. Keep this same
    // normalization in every infinity chart so positive real gauges glue
    // their reverse-arrow decorations continuously at the fixed endpoints.
    for (const key of ['b','B']) rep[key]=rep[key].map(m=>m.map(row=>row.map(neg)));
  }
  return rep;
}

// z is the original z on side zero, and 1/z on side infinity.
// Infinity swaps branches 2/3 and central e2/e3; its signed fiber convention
// agrees with compactFirstLineChart at both real radial endpoints.
export function stableBranchChart(side, z=0, w=0) {
  z=C(z); w=C(w); const zm=sub1(z), zz=mul(z,z);
  const B=[[[0,neg(z),z],[0,neg(z),1]],[[z,0,-1],[z,0,neg(z)]],[[neg(z),zz,0],[neg(z),z,0]]];
  return assemble(side,
    [[[1,0],[0,1],[0,z]],[[0,1],[1,0],[0,1]],[[0,1],[0,1],[1,0]]],
    [[[0,mul(mul(z,zm),w)]],[[0,mul(zm,w)]],[[0,mul(mul(z,zm),w)]]],
    B.map(m=>m.map(row=>row.map(a=>mul(a,w)))));
}

// Blow-up chart s=1/w, v=z*w^2. C* weights: s=-1, v=2.
export function branchMiddleChart(side, s=0, v=0) {
  s=C(s); v=C(v); const vs=mul(v,s), z=mul(vs,s), zm=sub1(z);
  return assemble(side,
    [[[1,0],[0,1],[0,vs]],[[0,1],[1,0],[0,1]],[[0,1],[0,s],[1,0]]],
    [[[0,mul(v,zm)]],[[0,zm]],[[0,mul(vs,zm)]]],
    [[[0,neg(v),vs],[0,neg(vs),1]],[[z,0,-1],[vs,0,neg(vs)]],[[neg(vs),mul(vs,vs),0],[neg(vs),v,0]]]);
}

// Next blow-up chart h=1/v, p=s*v^2. C* weights: h=-2, p=3.
export function branchTipChart(side, h=0, p=0) {
  h=C(h); p=C(p); const ph=mul(p,h), ph2=mul(ph,h), p2h2=mul(ph,ph), z=mul(p2h2,h), zm=sub1(z);
  return assemble(side,
    [[[1,0],[0,1],[0,ph]],[[0,h],[1,0],[0,1]],[[0,1],[0,ph],[1,0]]],
    [[[0,zm]],[[0,zm]],[[0,mul(p,zm)]]],
    [[[0,-1,ph2],[0,neg(ph),1]],[[p2h2,0,-1],[p,0,neg(ph)]],[[neg(p),p2h2,0],[neg(ph),1,0]]]);
}

// Convention: g(lambda).rep=(x,lambda*y), including every vertex.
export function branchFixedGrading(side, stage=1) {
  validateSide(side);
  if(stage!==1 && stage!==2) throw new RangeError('Expected fixed-point stage 1 or 2.');
  let center=stage===1?[0,1,0]:[2,1,0];
  let middle=stage===1?[[0,1],[1,0],[0,0]]:[[2,1],[1,0],[0,2]];
  let outer=stage===1?[0,1,0]:[2,1,0];
  if(side==='infinity'||side===1) {
    [center[1],center[2]]=[center[2],center[1]];
    [middle[1],middle[2]]=[middle[2],middle[1]];
    [outer[1],outer[2]]=[outer[2],outer[1]];
  }
  const result={center:{weights:center}};
  for(let i=0;i<3;i++){ result['middle'+i]={weights:middle[i]};result['outer'+i]={weights:[outer[i]]}; }
  return result;
}

// Homogeneous moving-first-line chart. A middle-1 basis change makes both
// radial endpoints finite, including the reverse arrows. At the infinity
// pole the side-1 local fiber is exp(2i theta) eta.
export function compactFirstLineChart(r, theta, t=0, phi=0) {
  if(![r,theta,t,phi].every(Number.isFinite)||r<0||r>1||t<0||t>=1) throw new RangeError('Invalid compact coordinates.');
  const s=1-r,u=[r*Math.cos(theta),r*Math.sin(theta)], su=mul(s,u), uu=mul(u,u), d=cSub(u,C(s));
  const eta=[t/(1-t)*Math.cos(phi),t/(1-t)*Math.sin(phi)];
  return assemble(0,
    [[[1,0],[0,s],[0,u]],[[0,1],[1,0],[0,1]],[[0,1],[0,1],[1,0]]],
    [[[0,mul(mul(mul(u,d),s),eta)]],[[0,mul(mul(s,d),eta)]],[[0,mul(mul(u,d),eta)]]],
    [[[0,neg(su),su],[0,neg(u),s]],[[su,0,-s*s],[su,0,neg(su)]],[[neg(su),uu,0],[neg(su),su,0]]].map(m=>m.map(row=>row.map(a=>mul(a,eta)))));
}
