// Dedicated module worker: expensive numerical balancing never blocks orbiting.
import {makeE7Chart,betaToE7Levels} from './e7-core.js';
import {makeE7AtlasChart,transitionE7NorthToSouth} from './e7-atlas.js';
import {solveE7} from './e7-solver.js';
import {identityE7DisplayFrame,transportE7DisplayFrame,applyE7DisplayFrame} from './e7-frame-transport.js';
let displayFrame=identityE7DisplayFrame(),displayChart=null,previous=null;
const coordinates=(chart,r,theta)=>{
 const radius=chart==='north'?r/(1-r):(1-r)/r,angle=chart==='north'?theta:-theta;
 return [radius*Math.cos(angle),radius*Math.sin(angle)];
};
self.onmessage=event=>{
 const {id,z,p,beta,warmStart,chart,base,parameters}=event.data;
 try{
  const levels=betaToE7Levels(beta),rawRep=chart?makeE7AtlasChart(chart,base,0):makeE7Chart(z,p);
  let nextFrame=displayFrame,frameError=0;
  if(chart && displayChart && chart!==displayChart){
   // Large slider jumps still cross a finite overlap. These balances represent
   // exactly the same point; no screen coordinates enter frame transport.
   const r=Math.max(.4,Math.min(.6,parameters.r)),theta=parameters.theta;
   const from=solveE7(makeE7AtlasChart(displayChart,coordinates(displayChart,r,theta),0),levels,{tolerance:1e-9});
   const to=solveE7(makeE7AtlasChart(chart,coordinates(chart,r,theta),0),levels,{tolerance:1e-9});
   const transition=transitionE7NorthToSouth(coordinates('north',r,theta),0);
   const rawTransition=displayChart==='north'?transition:{gauge:transition.inverse,inverse:transition.gauge};
   const transport=transportE7DisplayFrame(displayFrame,from,to,rawTransition);
   nextFrame=transport.frame;frameError=transport.matchingError;
  }
  const seed=chart===displayChart && previous?previous.coords:warmStart;
  const result=solveE7(rawRep,levels,{warmStart:seed,maxIterations:100,tolerance:1e-9});
  if(result.success && chart){
   previous=result;displayChart=chart;displayFrame=nextFrame;
   result.rep=applyE7DisplayFrame(result.rep,displayFrame);
  }
  result.rawRep=rawRep;result.frameMatchingError=frameError;
  self.postMessage({id,levels,result,chart,parameters});
 }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
