// Experimental data layer, not wired into the live incidence camera.
// Polynomial tensors extend through rank loss without choosing a flag frame.
// Under unitary gauge they all transform by central conjugation; their trace
// correlations are gauge invariant. No completeness/separation claim is made.
import { matMul, matAdj, matTrace, cMul, cSub, cConj } from './core-math.js';

const outer = v => v.map(a => v.map(b => cMul(a, cConj(b))));
const cross = (u,v) => [0,1,2].map(i => cSub(
  cMul(u[(i+1)%3],v[(i+2)%3]), cMul(u[(i+2)%3],v[(i+1)%3])));
const traceProduct = (a,b,c) => matTrace(c ? matMul(matMul(a,b),c) : matMul(a,b));

export function balancedObservables(rep) {
  const branches=rep.A.map((A,i) => {
    const H=matMul(A,matAdj(A));
    const ell=matMul(A,rep.a[i]);
    const J=matMul(ell,matAdj(ell));
    const K=matMul(A,rep.B[i]);
    // adj(A A*) = conjugate(wedge(A)) conjugate(wedge(A))*.
    // At y=0: H=alpha Pi_L + gamma Pi_P and
    // plane=gamma(alpha+gamma) Pi_(P perpendicular). Unlike Pi_P,
    // this tensor is defined at rank one, where it is exactly zero.
    const normal=cross(A.map(row=>row[0]),A.map(row=>row[1])).map(cConj);
    const plane=outer(normal);
    return {H,J,K,plane,planeWeight:matTrace(plane)[0]};
  });
  const tensors=branches.flatMap(b=>[b.H,b.J,b.K,b.plane]);
  const gram=tensors.map(a=>tensors.map(b=>traceProduct(matAdj(a),b)));
  // Complex correlations retain signed phase; never normalize a vanishing
  // correlation to unit length. A renderer can map modulus to contrast and
  // argument to hue. The zero correlation has no distinguished phase.
  const cyclic=branches.map((b,i)=>traceProduct(b.J,
    branches[(i+1)%3].H,branches[(i+2)%3].H));
  return {branches,gram,cyclic,experimental:true};
}
