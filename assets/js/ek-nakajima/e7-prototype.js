import {E7_DEFAULT_BETA} from './e7-core.js';
import {e7FlagGeometry} from './e7-geometry.js';
const THREE=window.THREE;
const host=document.getElementById('scene'),status=document.getElementById('status');
const scene=new THREE.Scene();scene.background=new THREE.Color('#212529');
const camera=new THREE.PerspectiveCamera(42,1,.01,200);camera.position.set(12,10,14);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));host.appendChild(renderer.domElement);
const controls=new THREE.OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;
scene.add(new THREE.AxesHelper(2));
const box=new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(-6,-6,-6),new THREE.Vector3(6,6,6)),0x555555);scene.add(box);
let drawing=new THREE.Group();scene.add(drawing);
let worker=null,requestId=0,warmStart=null,currentState='idle',latestResult=null;
const inputs=Array.from(document.querySelectorAll('input'));
function clearGeometry(){
 scene.remove(drawing);drawing.traverse(object=>{if(object.geometry)object.geometry.dispose();if(object.material)object.material.dispose();});drawing=new THREE.Group();scene.add(drawing);
 document.getElementById('projection-note').textContent='';document.getElementById('geometry-status').textContent='';
}
function line(points,color){
 const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
 drawing.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color})));
}
function drawGeometry(rep){
 const geometry=e7FlagGeometry(rep),colors=[0xff9b71,0x71b7ff,0xb5dd7c];
 geometry.flags.forEach((flag,index)=>{
  const color=colors[index];
  if(flag.point&&flag.point.every(x=>Math.abs(x)<=geometry.bound)){
   const point=new THREE.Mesh(new THREE.SphereGeometry(index===2?.065:.12,16,12),new THREE.MeshBasicMaterial({color}));point.position.set(...flag.point);drawing.add(point);
  }
  if(flag.line)line(flag.line,color);
  if(flag.plane&&flag.plane.length>=3){
   const positions=[];for(let i=1;i<flag.plane.length-1;i++)positions.push(...flag.plane[0],...flag.plane[i],...flag.plane[i+1]);
   const meshGeometry=new THREE.BufferGeometry();meshGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));meshGeometry.computeVertexNormals();
   drawing.add(new THREE.Mesh(meshGeometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.19,depthWrite:false})));
   line(flag.plane.concat([flag.plane[0]]),color);
  }
 });
 document.getElementById('projection-note').textContent=geometry.isReal?'Real Slice: These Are Literal RP³ Affine Flags.':'Complex Data: Selected Real-Coefficient Slices Are Shown. A Complex Projective Line Or Plane Is Not Faithfully Represented By This 3D Picture.';
 document.getElementById('geometry-status').textContent='Exact Complex Membership Residual: '+geometry.maxIncidenceNorm.toExponential(2)+' · '+geometry.flags.map(f=>f.name+': '+f.status).join(' · ');
 return geometry;
}
function read(id){const element=document.getElementById(id);if(element.value.trim()===''||!Number.isFinite(element.valueAsNumber))throw new Error('Enter A Finite Number For '+id);return element.valueAsNumber;}
function balance(){
 requestId++;const id=requestId;if(worker)worker.terminate();clearGeometry();latestResult=null;
 let payload;
 try{payload={id,z:[read('z-re'),read('z-im')],p:[read('p-re'),read('p-im')],beta:Array.from({length:7},(_,i)=>read('beta-'+i)),warmStart};}
 catch(error){currentState='failed';status.textContent=error.message;return;}
 currentState='balancing';status.textContent='Balancing Flags…';
 worker=new Worker(new URL('./e7-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=event=>{
  if(event.data.id!==requestId)return;
  const {error,result,levels}=event.data;
  if(error){currentState='failed';status.textContent='Balance Failed: '+error;return;}
  latestResult=result;
  const details='Real Residual: '+result.realNorm.toExponential(3)+'\nComplex Residual: '+result.complexNorm.toExponential(3)+'\nIterations: '+result.iterations+' · Jacobian Rank: '+result.jacobianRank+'\nEquation Levels: '+levels.join(', ');
  if(!result.success){currentState='failed';status.textContent='Balance Failed: '+result.reason+'\n'+details;return;}
  try{drawGeometry(result.rep);warmStart=result.coords;currentState='balanced';status.textContent='Balanced Flags\n'+details;}
  catch(e){clearGeometry();currentState='failed';status.textContent='Geometry Failed: '+e.message+'\n'+details;}
 };
 worker.onerror=event=>{if(id!==requestId)return;currentState='failed';status.textContent='Worker Failed: '+event.message;};
 worker.postMessage(payload);
}
inputs.forEach(input=>input.addEventListener('input',()=>{requestId++;currentState='stale';latestResult=null;clearGeometry();status.textContent='Inputs Changed — Balance Flags To Update';}));
document.getElementById('balance').addEventListener('click',balance);
document.getElementById('reset').addEventListener('click',()=>{['z-re','z-im','p-re','p-im'].forEach((id,i)=>document.getElementById(id).value=i===0?'2':'0');for(let i=0;i<7;i++)document.getElementById('beta-'+i).value=String(E7_DEFAULT_BETA[i]);warmStart=null;balance();});
function resize(){const width=host.clientWidth,height=host.clientHeight;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
window.e7PrototypeDiagnostics=()=>({state:currentState,requestId,result:latestResult,renderedObjects:drawing.children.length});
balance();

