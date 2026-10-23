import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
export function source(name){
  if(cache[name])return cache[name];
  const code=fs.readFileSync(path.join(base,name),'utf8').replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
  return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
export const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
// Segment center and second moment ignore endpoint ordering. Hue is embedded
// in the color disk so its arbitrary 360-degree cut cannot create a jump.
export function renderedFeatures(d){
  const l=d.layout,out=[];
  for(let i=0;i<3;i++){
    const pw=l.pointOpacities[i],lw=l.lineOpacities[i],a=l.lines[i][0],b=l.lines[i][1],v=b.map((x,j)=>x-a[j]);
    out.push(pw,...l.points[i].map(x=>pw*x),lw,...a.map((x,j)=>lw*(x+b[j])/2),lw*v[0]*v[0],lw*v[0]*v[1],lw*v[1]*v[1]);
    const c=l.incidenceColors;
    for(const [h,s]of [[c.lineHues[i],lw*c.lineStrengths[i]],[c.pointHues[i],pw*c.pointStrengths[i]]])out.push(s*Math.cos((h||0)*Math.PI/180),s*Math.sin((h||0)*Math.PI/180));
  }
  return out;
}
export function glyphFeatures(d){
  // Actual glyph coefficients retain both signed phase and vanishing amplitude.
  // Projected target positions are tested separately from Boolean UI statuses.
  return d.glyphs.flatMap((g,i)=>{
    const target=d.layout.cotangentTargets[i],p=target&&target.point;
    return (g?g.coefficients.flat():[0,0,0,0,0,0]).concat(p?p:[0,0]);
  });
}
export const invariantFeatures=o=>o.gram.flat(2).concat(o.cyclic.flat());

export function arrowFeatures(d,geometry,opacity){
  // Match the canvas at a fixed 600x400 viewport, including endpoint direction.
  // Segment orientation is irrelevant in renderedFeatures, but an orientation
  // change that reverses an actual arrow remains visible here.
  const pixel=p=>[300+173*p[0],200-173*p[1]],l=d.layout,out=[];
  for(let i=0;i<3;i++){
    const target=l.cotangentTargets[i],arrows=geometry(pixel(l.points[i]),l.lines[i].map(pixel),target&&target.point?pixel(target.point):null);
    for(let k=0;k<3;k++){
      const z=d.glyphs[i]?d.glyphs[i].coefficients[k]:[0,0],m=Math.hypot(...z),a=arrows[k];
      const alpha=a?opacity(z)*Math.min(l.pointOpacities[i],l.lineOpacities[i]):0;
      // Hue's constant 210-degree rotation preserves disk distances. The
      // magnitude/(1+magnitude) radius is the renderer's saturation curve.
      out.push(alpha,alpha*z[0]/(1+m),alpha*z[1]/(1+m));
      out.push(...(a?a.start.concat(a.end).map(v=>alpha*v/173):[0,0,0,0]));
    }
  }
  return out;
}
