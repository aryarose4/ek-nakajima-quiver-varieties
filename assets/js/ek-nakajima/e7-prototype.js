import {E7_DEFAULT_BETA} from './e7-core.js';
import {makeE7View} from './e7-render.js';
const host=document.getElementById('scene'),status=document.getElementById('status');
const view=makeE7View(host);
let worker=null,requestId=0,warmStart=null,currentState='idle',latestResult=null;
const inputs=Array.from(document.querySelectorAll('input'));
function clearGeometry(){view.setData(null);document.getElementById('projection-note').textContent='';document.getElementById('geometry-status').textContent='';}
function drawGeometry(rep){
 const geometry=view.setData(rep);
 document.getElementById('projection-note').textContent=geometry.isReal?'Real slice: literal affine projective flags.':'Complex data: selected real-coefficient slices are shown; this 3D picture does not faithfully represent complex projective lines or planes.';
 document.getElementById('geometry-status').textContent='Exact complex membership residual: '+geometry.maxIncidenceNorm.toExponential(2)+' ? '+geometry.flags.map(f=>f.name+': '+f.status).join(' ? ')+'\nComplex intersections: '+geometry.intersections.map(item=>item.label+': '+item.dimension).join(', ')+'. Dimensions are complex vector-space dimensions; 0 means empty projective intersection.';
 return geometry;
}
function read(id){const element=document.getElementById(id);if(element.value.trim()===''||!Number.isFinite(element.valueAsNumber))throw new Error('Enter a finite number for '+id);return element.valueAsNumber;}
function balance(){
 requestId++;const id=requestId;if(worker)worker.terminate();clearGeometry();latestResult=null;
 let payload;
 try{payload={id,z:[read('z-re'),read('z-im')],p:[read('p-re'),read('p-im')],beta:Array.from({length:7},(_,i)=>read('beta-'+i)),warmStart};}
 catch(error){currentState='failed';status.textContent=error.message;return;}
 currentState='balancing';status.textContent='Balancing flags…';
 worker=new Worker(new URL('./e7-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=event=>{
  if(event.data.id!==requestId)return;
  const {error,result,levels}=event.data;
  if(error){currentState='failed';status.textContent='Balance failed: '+error;return;}
  latestResult=result;
  const details='Real residual: '+result.realNorm.toExponential(3)+'\nComplex residual: '+result.complexNorm.toExponential(3)+'\nIterations: '+result.iterations+' · Jacobian rank: '+result.jacobianRank+'\nEquation levels: '+levels.join(', ');
  if(!result.success){currentState='failed';status.textContent='Balance failed: '+result.reason+'\n'+details;return;}
  try{drawGeometry(result.rep);warmStart=result.coords;currentState='balanced';status.textContent='Balanced Flags\n'+details;}
  catch(e){clearGeometry();currentState='failed';status.textContent='Geometry failed: '+e.message+'\n'+details;}
 };
 worker.onerror=event=>{if(id!==requestId)return;currentState='failed';status.textContent='Worker failed: '+event.message;};
 worker.postMessage(payload);
}
inputs.forEach(input=>input.addEventListener('input',()=>{requestId++;currentState='stale';latestResult=null;clearGeometry();status.textContent='Inputs changed — balance flags to update';}));
document.getElementById('balance').addEventListener('click',balance);
document.getElementById('reset').addEventListener('click',()=>{['z-re','z-im','p-re','p-im'].forEach((id,i)=>document.getElementById(id).value=i===0?'2':'0');for(let i=0;i<7;i++)document.getElementById('beta-'+i).value=String(E7_DEFAULT_BETA[i]);warmStart=null;balance();});
window.addEventListener('resize',view.resize);
window.e7PrototypeDiagnostics=()=>({state:currentState,requestId,result:latestResult,renderedObjects:view.getObjectCount()});
balance();
