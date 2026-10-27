// Shared prototype/widget renderer. The affine frame is a chart choice.
import { e7FlagGeometry } from './e7-geometry.js';
export function makeE7View(host) {
  const THREE = window.THREE;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42,1,.01,200); camera.position.set(12,10,14);
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2)); host.appendChild(renderer.domElement);
  const controls = new THREE.OrbitControls(camera,renderer.domElement); controls.enableDamping=true;
  scene.add(new THREE.AxesHelper(2));
  scene.add(new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(-6,-6,-6),new THREE.Vector3(6,6,6)),0x777777));
  let drawing = new THREE.Group(), visible = true, disposed = false; scene.add(drawing);
  function clear() {
    scene.remove(drawing); drawing.traverse(object => {if(object.geometry)object.geometry.dispose();if(object.material)object.material.dispose();});
    drawing = new THREE.Group();scene.add(drawing);
  }
  function line(points,color) {
    drawing.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color})));
  }
  function setData(rep) {
    clear(); if (!rep) return null;
    const geometry=e7FlagGeometry(rep), colors=[0xff9b71,0x71b7ff,0xb5dd7c];
    geometry.flags.forEach((flag,index)=>{
      const color=colors[index];
      if(index!==2 && flag.point && flag.point.every(x=>Math.abs(x)<=geometry.bound)) {
        const point=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),new THREE.MeshBasicMaterial({color}));point.position.set(...flag.point);drawing.add(point);
      }
      if(flag.line)line(flag.line,color);
      if(flag.plane && flag.plane.length>=3) {
        const positions=[]; for(let i=1;i<flag.plane.length-1;i++)positions.push(...flag.plane[0],...flag.plane[i],...flag.plane[i+1]);
        const mesh=new THREE.BufferGeometry();mesh.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));mesh.computeVertexNormals();
        drawing.add(new THREE.Mesh(mesh,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.19,depthWrite:false})));
        line(flag.plane.concat([flag.plane[0]]),color);
      }
    });
    return geometry;
  }
  function resize() {
    const width=host.clientWidth,height=host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  function animate() { if(disposed)return;requestAnimationFrame(animate);if(visible){controls.update();renderer.render(scene,camera);} }
  resize();animate();
  return {setData,resize,getObjectCount(){return drawing.children.length;},refreshTheme(){},setVisible(value){visible=value;host.style.display=value?'':'none';if(value)resize();},dispose(){disposed=true;clear();controls.dispose();renderer.dispose();renderer.domElement.remove();}};
}
