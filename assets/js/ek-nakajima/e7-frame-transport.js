// Exact unitary frame transport between balanced E7 atlas representatives.
// The frame is intentionally path dependent; it is not a global S2 gauge.
import {eyeZ,matMul,matAdj,matAdd,matSub,matScale,frobNorm,cMul,cSub} from './core-math.js';
import {positiveE7Gauge,identityE7Gauge,gaugeActionE7} from './e7-core.js';
import {expmHermitian} from './solver.js';
const reciprocal=z=>{const d=z[0]*z[0]+z[1]*z[1];return [z[0]/d,-z[1]/d];};
function inverse(M){
 const n=M.length,A=M.map((row,i)=>row.map(z=>z.slice()).concat(eyeZ(n)[i]));
 for(let k=0;k<n;k++){
  let pivot=k;for(let i=k+1;i<n;i++)if(Math.hypot(...A[i][k])>Math.hypot(...A[pivot][k]))pivot=i;
  if(!(Math.hypot(...A[pivot][k])>1e-14))throw new Error('Singular E7 frame transport');
  [A[k],A[pivot]]=[A[pivot],A[k]];
  const inv=reciprocal(A[k][k]);for(let j=0;j<2*n;j++)A[k][j]=cMul(A[k][j],inv);
  for(let i=0;i<n;i++)if(i!==k){const factor=A[i][k];for(let j=0;j<2*n;j++)A[i][j]=cSub(A[i][j],cMul(factor,A[k][j]));}
 }
 return A.map(row=>row.slice(n));
}
const unitaryError=M=>frobNorm(matSub(matMul(matAdj(M),M),eyeZ(M.length)));
export function e7UnitaryPolar(M){
 const size=frobNorm(M);if(!(size>0)||!Number.isFinite(size))throw new Error('Invalid E7 frame transport matrix');
 let U=matScale(M,Math.sqrt(M.length)/size);
 for(let step=0;step<24;step++){
  if(unitaryError(U)<2e-13)return U;
  U=matScale(matAdd(U,matAdj(inverse(U))),.5);
 }
 if(!(unitaryError(U)<1e-10))throw new Error('E7 unitary polar iteration did not converge');
 return U;
}
function mapGauge(fn,...gauges){
 return {center:fn(...gauges.map(g=>g.center)),branches:gauges[0].branches.map((arm,b)=>arm.map((_,k)=>fn(...gauges.map(g=>g.branches[b][k]))))};
}
const adjointGauge=G=>mapGauge(matAdj,G);
const multiplyGauge=(G,H)=>mapGauge(matMul,G,H);
export const identityE7DisplayFrame=identityE7Gauge;
export function applyE7DisplayFrame(rep,frame){return gaugeActionE7(rep,frame,adjointGauge(frame));}
function representationDistance(a,b){
 let squared=0;for(const key of ['x','y'])a[key].forEach((arm,i)=>arm.forEach((M,k)=>{const d=frobNorm(matSub(M,b[key][i][k]));squared+=d*d;}));return Math.sqrt(squared);
}
// rawTransition.gauge maps fromSolved's RAW representative to toSolved's RAW
// representative at the SAME moduli point. The solver coordinates recover the
// positive gauges Hfrom,Hto. K=Hto G Hfrom^-1 intertwines the balanced reps.
// Its polar unitary is exact in the zero-residual limit; polar projection only
// removes numerical drift. The matching check prevents it hiding a wrong orbit.
export function transportE7DisplayFrame(previousFrame,fromSolved,toSolved,rawTransition,options={}){
 if(!fromSolved.success||!toSolved.success)throw new Error('E7 frame transport requires two successful solves');
 const from=positiveE7Gauge(fromSolved.coords,expmHermitian),to=positiveE7Gauge(toSolved.coords,expmHermitian);
 const K=multiplyGauge(multiplyGauge(to.gauge,rawTransition.gauge),from.inverse);
 const backward=adjointGauge(mapGauge(e7UnitaryPolar,K));
 const matched=applyE7DisplayFrame(toSolved.rep,backward);
 const matchingError=representationDistance(matched,fromSolved.rep);
 const tolerance=options.matchingTolerance===undefined?1e-6:options.matchingTolerance;
 if(!(matchingError<=tolerance))throw new Error('E7 balanced chart matching failed: '+matchingError);
 const frame=mapGauge(e7UnitaryPolar,multiplyGauge(previousFrame||identityE7Gauge(),backward));
 const errors=[unitaryError(frame.center)].concat(...frame.branches.map(arm=>arm.map(unitaryError)));
 return {frame,matchingError,unitarityError:Math.max(...errors)};
}
