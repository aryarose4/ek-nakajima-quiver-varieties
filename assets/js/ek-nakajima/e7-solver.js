// Numerical balancing on the E7 open chart; convergence is checked directly.
import {expmHermitian} from './solver.js';
import {validateE7Levels,positiveE7Gauge,gaugeActionE7,packRealResidualE7,complexResidualNormE7} from './e7-core.js';
const norm=v=>Math.hypot(...v);
function linear(A,b){
 const n=b.length,M=A.map((r,i)=>r.concat(b[i]));
 for(let k=0;k<n;k++){
  let p=k;for(let i=k+1;i<n;i++)if(Math.abs(M[i][k])>Math.abs(M[p][k]))p=i;
  if(Math.abs(M[p][k])<1e-18)return null;
  [M[k],M[p]]=[M[p],M[k]];
  for(let i=k+1;i<n;i++){const f=M[i][k]/M[k][k];for(let j=k+1;j<=n;j++)M[i][j]-=f*M[k][j];}
 }
 const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=M[i][n];for(let j=i+1;j<n;j++)s-=M[i][j]*x[j];x[i]=s/M[i][i];}return x;
}
export function solveE7(rep,levels,options={}){
 validateE7Levels(levels);
 let coords=options.warmStart?options.warmStart.slice():Array(47).fill(0);
 const tolerance=options.tolerance===undefined?1e-9:options.tolerance,maxIterations=options.maxIterations===undefined?100:options.maxIterations;
 if(!(tolerance>0)||!Number.isFinite(tolerance)||!Number.isInteger(maxIterations)||maxIterations<0)throw new Error('Invalid E7 solver options');
 const evaluate=c=>{const g=positiveE7Gauge(c,expmHermitian),balanced=gaugeActionE7(rep,g.gauge,g.inverse);return {rep:balanced,residual:packRealResidualE7(balanced,levels)};};
 let state=evaluate(coords),iterations=0,lambda=1e-6,reason='iteration limit',lastRank=0;
 for(;iterations<maxIterations;iterations++){
  const residual=state.residual,current=norm(residual);if(!Number.isFinite(current)){reason='nonfinite residual';break;}if(current<=tolerance){reason='converged';break;}
  const columns=[];
  for(let k=0;k<47;k++){const h=1e-5*(1+Math.abs(coords[k])),a=coords.slice(),b=coords.slice();a[k]+=h;b[k]-=h;const ra=evaluate(a).residual,rb=evaluate(b).residual;columns.push(ra.map((v,i)=>(v-rb[i])/(2*h)));}
  const J=Array.from({length:47},(_,i)=>columns.map(c=>c[i]));
  // Pivot elimination reports numerical differential rank independently of damping.
  const rankM=J.map(r=>r.slice());let row=0;const scale=Math.max(...columns.map(norm));
  for(let c=0;c<47;c++){let p=row;for(let i=row+1;i<47;i++)if(Math.abs(rankM[i][c])>Math.abs(rankM[p][c]))p=i;if(row===47||Math.abs(rankM[p][c])<scale*1e-9)continue;[rankM[row],rankM[p]]=[rankM[p],rankM[row]];for(let i=row+1;i<47;i++){const f=rankM[i][c]/rankM[row][c];for(let j=c;j<47;j++)rankM[i][j]-=f*rankM[row][j];}row++;}lastRank=row;
  const A=columns.map(a=>columns.map(b=>a.reduce((s,v,i)=>s+v*b[i],0))),rhs=columns.map(a=>-a.reduce((s,v,i)=>s+v*residual[i],0));
  let accepted=false;
  for(let trial=0;trial<12;trial++){
   const delta=linear(A.map((r,i)=>r.map((v,j)=>v+(i===j?lambda:0))),rhs);if(!delta){lambda*=10;continue;}
   const candidate=coords.map((v,i)=>v+delta[i]);
   try{const next=evaluate(candidate);if(norm(next.residual)<current){coords=candidate;state=next;lambda=Math.max(1e-12,lambda*.25);accepted=true;break;}}catch(e){/* reject overflowing trial */}
   lambda*=10;
  }
  if(!accepted){reason='no decreasing finite step';break;}
 }
 // Recompute both maps; optimizer flags alone never establish success.
 state=evaluate(coords);const realNorm=norm(state.residual),complexNorm=complexResidualNormE7(state.rep);
 const success=Number.isFinite(realNorm)&&Number.isFinite(complexNorm)&&realNorm<=tolerance&&complexNorm<=Math.max(1e-8,tolerance*10);
 if(success)reason='converged';
 return {rep:state.rep,coords,success,realNorm,complexNorm,iterations,reason,jacobianRank:lastRank};
}
