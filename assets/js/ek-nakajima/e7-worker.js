// Dedicated module worker: expensive numerical balancing never blocks orbiting.
import {makeE7Chart,betaToE7Levels} from './e7-core.js';
import {solveE7} from './e7-solver.js';
self.onmessage=event=>{
 const {id,z,p,beta,warmStart}=event.data;
 try{
  const levels=betaToE7Levels(beta),result=solveE7(makeE7Chart(z,p),levels,{warmStart,maxIterations:100,tolerance:1e-9});
  self.postMessage({id,levels,result});
 }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
