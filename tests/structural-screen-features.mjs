// Screen-space structural checks for numerical flag strata. One pixel uses
// the production 600x400 canvas scale (173 pixels per diagram unit).
export function structuralDefects(d,tolerance=1/173){
 const data=d.data,l=d.layout,out=[],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>a.map((x,i)=>x-b[i]);
 const lineDistance=(p,s)=>{const v=sub(s[1],s[0]);return Math.abs(cross(sub(p,s[0]),v))/Math.hypot(...v);};
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
  if(data.pointEqual[i][j]&&Math.hypot(...sub(l.points[i],l.points[j]))>(Math.min(l.pointOpacities[i],l.pointOpacities[j])>.99?1e-7:tolerance))out.push('equal points '+i+':'+j);
  if(data.lineEqual[i][j]&&Math.max(...l.lines[i].map(p=>lineDistance(p,l.lines[j])))>(Math.min(l.lineOpacities[i],l.lineOpacities[j])>.99?1e-7:tolerance))out.push('equal planes '+i+':'+j);
 }
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(data.incident[i][j]&&l.pointOpacities[i]>.99&&l.lineOpacities[j]>.99&&lineDistance(l.points[i],l.lines[j])>tolerance)out.push('incidence '+i+':'+j);
 if(data.collinear){const a=l.points[0],b=l.points[1],v=sub(b,a);if(Math.hypot(...v)>1e-7&&lineDistance(l.points[2],[a,b])>tolerance)out.push('collinearity');}
 if(data.concurrent){let meeting=null;for(let i=0;i<3&&!meeting;i++)for(let j=i+1;j<3&&!meeting;j++){const a=l.lines[i][0],v=sub(l.lines[i][1],a),b=l.lines[j][0],w=sub(l.lines[j][1],b),det=cross(v,w);if(Math.abs(det)>1e-9){const t=cross(sub(b,a),w)/det;meeting=a.map((x,k)=>x+t*v[k]);}}if(meeting){if(l.lines.some(s=>lineDistance(meeting,s)>tolerance))out.push('concurrency');}else if(l.lines.some(s=>lineDistance(s[0],l.lines[0])>tolerance))out.push('parallel nonconcurrent lines');}
 return out;
}

