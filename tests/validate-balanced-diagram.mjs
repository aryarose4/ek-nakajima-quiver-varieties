import assert from 'assert';
import { balancedDiagram, incidenceColors } from './balanced-diagram.js';
import { solveBalancedAtlas } from './balanced-model.js';
import { e6AtlasPoint } from './e6-atlas.js';
import { E6_REGULAR_LEVELS } from './e6-levels.js';
import { solveRealMomentMap, applyComplexGauge } from './solver.js';
import { eyeZ, matMul, matAdj, matSub, frobNorm, realResidualNorm } from './core-math.js';
let checks=0;
const check=(ok,msg)=>{checks++;assert.ok(ok,msg);};
const distance=(a,b)=>Math.max(...a.map((row,i)=>Math.max(...row.map((x,j)=>Math.abs(x-b[i][j])))));
const representations=[];
const hueDistance=(a,b)=>Math.abs(((a-b+540)%360)-180);
// Opposite residual weighting must never confuse a cross-incidence with a
// phase coincidence. Exercise each target, interior hues, and the neutral limit.
for(let i=0;i<3;i++) {
  const [j,k]=[0,1,2].filter(q=>q!==i);
  function colors(a,b) {
    const residuals=[[0,1,1],[1,0,1],[1,1,0]];
    residuals[i][j]=a;residuals[i][k]=b;
    return incidenceColors({residuals,tolerance:1e-8});
  }
  for(const pair of [[0,.4],[.4,0]]) {
    const c=colors(...pair),target=pair[0]===0?j:k;
    check(hueDistance(c.pointHues[i],c.lineHues[target])<1e-10,'single cross-incidence matches target hue');
    check(c.pointStrengths[i]===1,'isolated incidence has full saturation');
  }
  for(const a of [.001,.1,1]) for(const b of [.001,.1,1]) {
    const c=colors(a,b);
    check(c.lineHues.every(h=>hueDistance(c.pointHues[i],h)>1e-5),'nonincident dot matches neither other line nor own hue');
  }
  let strength=1;
  for(const e of [1e-3,1e-5,1e-7,1e-9,0]) {
    const c=colors(e,2*e);
    check(c.pointStrengths[i]<strength,'simultaneous incidence approaches neutral continuously');
    strength=c.pointStrengths[i];
    if(e===0)check(c.pointHues[i]===null&&c.ambiguous[i],'double incidence claims no unique hue');
  }
}
// Signed phase varies line hue inside disjoint bands, without inventing a
// point/line hue match. Exercise the widest possible band separation too.
for(const signs of [[1,-1,1],[-1,1,-1],[.3,-.8,.7]]) {
  const phaseVectors=signs.map(x=>[0,x]);
  for(let i=0;i<3;i++) {
    const [j,k]=[0,1,2].filter(q=>q!==i);
    for(const pair of [[0,.4],[.4,0],[.1,.4],[.4,.1]]) {
      const residuals=[[0,1,1],[1,0,1],[1,1,0]];
      residuals[i][j]=pair[0];residuals[i][k]=pair[1];
      const colors=incidenceColors({residuals,tolerance:1e-8},phaseVectors);
      if(pair[0]===0||pair[1]===0) {
        check(hueDistance(colors.pointHues[i],colors.lineHues[pair[0]===0?j:k])<1e-10,'dynamic hue matches true incidence');
      } else check(colors.lineHues.every(h=>hueDistance(h,colors.pointHues[i])>1e-5),'dynamic hue does not invent incidence');
    }
  }
}
for(const r of [0,.5,1]) for(const sphere of (r===.5?[0]:[0,1])) for(const t of [0,.4,1]) {
  const point=e6AtlasPoint({r,theta:0,t,phi:.3,sphere});
  const solved=solveRealMomentMap(point.rep,E6_REGULAR_LEVELS,{maxIter:100});
  check(solved.success,'representative balanced');
  representations.push(solved.solvedRep);
  const d=balancedDiagram(solved.solvedRep);
  check(d.valid,'all endpoints and interiors have a diagram');
  check(d.layout.points.flat().every(Number.isFinite)&&d.layout.lines.flat(2).every(Number.isFinite),'finite viewport output');
  const F=[0,1,2].map(i=>d.frame.map(v=>v[i]));
  check(frobNorm(matSub(matMul(matAdj(F),F),eyeZ(3)))<1e-9,'viewing frame is unitary');
  check(d.glyphs.length===3&&d.glyphs.every(g=>g.coefficients.flat().every(Number.isFinite)),'finite balanced cotangent coefficients');
  d.layout.cotangentTargets.forEach((target,i)=>{
    check(!!target,'orthogonal column target exists');
    const q=target.homogeneous,e2=d.glyphs[i].basis[1];
    const overlap=q.reduce((s,z,j)=>[s[0]+z[0]*e2[j][0]+z[1]*e2[j][1],s[1]+z[0]*e2[j][1]-z[1]*e2[j][0]],[0,0]);
    check(Math.abs(Math.hypot(...overlap)-1)<1e-8,'column target is existing coefficient basis direction projectively');
    if(target.point){
      const [a,b]=d.layout.lines[i],p=target.point;
      check(Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<1e-8,'target lies on projected line');
    }else check(target.atInfinity||target.clipped,'unavailable target has explicit camera reason');
  });
  // An arbitrary central unitary, plus independent middle/outer unitary phases,
  // models the ambiguity left by balancing two overlapping complex charts.
  const U=[[[.6,0],[0,.8],[0,0]],[[0,.8],[.6,0],[0,0]],[[0,0],[0,0],[Math.cos(.8),Math.sin(.8)]]];
  const rotated=applyComplexGauge(solved.solvedRep,U,[eyeZ(2),eyeZ(2),eyeZ(2)],[1,1,1]);
  const next=balancedDiagram(rotated,{previous:d});
  d.layout.cotangentTargets.forEach((target,i)=>{
    const other=next.layout.cotangentTargets[i];
    if(target.point&&other.point)check(Math.hypot(...target.point.map((v,j)=>v-other.point[j]))<1e-7,'unitary gauge does not move arrow target');
  });
  const colors=d.layout.incidenceColors,rotatedColors=next.layout.incidenceColors;
  for(let i=0;i<3;i++) {
    check(Math.abs(colors.pointStrengths[i]-rotatedColors.pointStrengths[i])<1e-7,'incidence saturation is unitary invariant');
    if(colors.pointStrengths[i]>1e-5)check(hueDistance(colors.pointHues[i],rotatedColors.pointHues[i])<1e-6,'visible incidence hue is unitary invariant');
    for(let j=0;j<3;j++)if(i!==j&&colors.pointStrengths[i]>1e-5) {
      if(hueDistance(colors.pointHues[i],colors.lineHues[j])<1e-7)check(d.data.incident[i][j],'matching hue on atlas fixture is a true numerical incidence');
    }
  }
  check(Math.abs(realResidualNorm(rotated,E6_REGULAR_LEVELS)-realResidualNorm(solved.solvedRep,E6_REGULAR_LEVELS))<1e-8,'unitary coordinate change preserves balance');
  check(distance(d.layout.points,next.layout.points)<1e-7,'unitary/chart ambiguity has no point jump');
  check(distance(d.layout.lines.flat(),next.layout.lines.flat())<1e-7,'unitary/chart ambiguity has no line jump');
  check(distance(d.glyphs.flatMap(g=>g.coefficients),next.glyphs.flatMap(g=>g.coefficients))<1e-7,'unitary/chart ambiguity has no cotangent coefficient jump');
}
// Own incidence survives the real projection whenever the point is in view.
for(const rep of representations) {
  const d=balancedDiagram(rep);
  d.layout.points.forEach((p,i)=>{
    const [a,b]=d.layout.lines[i];
    check(Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<1e-8,'marked point lies on its projected line');
  });
}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
let previous=null;
for(const t of [.9,.99,.999,1]) {
  const solved=solveRealMomentMap(e6AtlasPoint({r:.5,theta:0,t,phi:0,sphere:0}).rep,E6_REGULAR_LEVELS);
  check(solved.success,'short-arm real path balances');
  const d=balancedDiagram(solved.solvedRep,{previous});
  const equations=d.layout.lines.map(l=>cross(l[0].concat(1),l[1].concat(1)));
  const meet=cross(equations[0],equations[1]);
  check(Math.abs(meet.reduce((s,x,j)=>s+x*equations[2][j],0))<1e-7,'actual real concurrency retained through endpoint');
  // The nonvanishing camera reference is complex even on this real path.
  // Its projection loss is recorded; concurrence and the actual tip alignment
  // remain visible (checked separately), rather than asserted for all flags.
  check(d.layout.projectionResiduals.every(x=>x!==null&&Number.isFinite(x)),'complex camera records finite projection loss');
  if(t===1) {
    check(distance(previous.layout.points,d.layout.points)<.003,'short-arm endpoint point limit has no residual chart jump');
    check(distance(previous.layout.lines.flat(),d.layout.lines.flat())<.003,'short-arm endpoint line limit has no residual chart jump');
    check(distance(previous.glyphs.flatMap(g=>g.coefficients),d.glyphs.flatMap(g=>g.coefficients))<.01,'short-arm endpoint y-glyph limit has no residual chart jump');
  }
  previous=d;
}
function continuousPair(from,to,label,tolerance=.002) {
  const a=solveBalancedAtlas(from);
  check(a.success,label+' first solve converges');
  const b=solveBalancedAtlas(to,E6_REGULAR_LEVELS,{previous:a});
  check(b.success,label+' next solve converges');
  const da=balancedDiagram(a.solvedRep),db=balancedDiagram(b.solvedRep,{previous:da});
  const deltas={points:distance(da.layout.points,db.layout.points),lines:distance(da.layout.lines.flat(),db.layout.lines.flat()),
    glyphs:distance(da.glyphs.flatMap(g=>g.coefficients),db.glyphs.flatMap(g=>g.coefficients)),
    phases:distance(da.layout.phaseVectors,db.layout.phaseVectors)};
  for(const key of Object.keys(deltas)) check(deltas[key]<tolerance,label+' '+key+' continuous: '+deltas[key]);
  return deltas;
}
const eps=1e-6;
for(const side of [0,1]) for(const t of [0,.4]) {
  const params={theta:.7,t,phi:.3,sphere:0};
  const coarse=continuousPair({...params,r:side===0?1e-4:1-1e-4},{...params,r:side},'radial endpoint coarse '+side+' t='+t,.1);
  const fine=continuousPair({...params,r:side===0?eps:1-eps},{...params,r:side},'radial endpoint '+side+' t='+t);
  check(Math.max(...Object.values(fine))<Math.max(...Object.values(coarse))/10+1e-7,'radial endpoint discrepancy decreases with epsilon');
}
for(const r of [0,.5,1]) for(const sphere of (r===.5?[0]:[0,1])) {
  const params={r,theta:r===.5?0:.7,phi:.3,sphere};
  continuousPair({...params,t:.5-eps},{...params,t:.5+eps},'numerical rechart r='+r+' sphere='+sphere);
}
// Regression: a complex slider history must not separate genuinely concurrent
// lines. The common point must lie on the actual finite drawn segments.
const historySolve=solveBalancedAtlas({r:.75,theta:1.5,t:.4,phi:.7});
check(historySolve.success,'complex history seed balances');
const history=balancedDiagram(historySolve.solvedRep);
for(const phi of [0,.7,2.1]) for(const t of [0,.4,.999,1]) {
  const solved=solveBalancedAtlas({r:.5,theta:0,t,phi});
  check(solved.success,'concurrent phase/history representative balances');
  const d=balancedDiagram(solved.solvedRep,{previous:history});
  check(d.data.concurrent&&d.layout.concurrencyPoint!==null,'genuine concurrence has a visible common marker');
  for(const [a,b] of d.layout.lines) {
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    check(length>.1,'concurrent line has a noncollapsed visible segment');
    check(Math.abs(a[0]*b[1]-a[1]*b[0])/length<1e-7,'drawn line passes through the common origin');
    check(a[0]*b[0]+a[1]*b[1]<=1e-8,'common origin lies inside the drawn segment');
  }
  check(!d.layout.cameraDefects.some(x=>x.kind==='line-outside-camera'),'concurrency cannot be clipped offscreen');
  if(t===1) {
    const [a,b,c]=d.layout.points;
    check(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-7,
      'short-tip marked points remain visibly collinear after complex history');
    check(d.layout.pointMarkers.every(marker=>!marker.clipped),'tip alignment is not concealed by per-point clipping');
  }
}
for(const r of [.49,.505,.52]) {
  const solved=solveBalancedAtlas({r,theta:.03,t:.4,phi:.7});
  check(solved.success,'nearby camera solve converges');
  const a=balancedDiagram(solved.solvedRep,{previous:history});
  const b=balancedDiagram(solved.solvedRep,{previous:a});
  check(distance(a.layout.lines.flat(),b.layout.lines.flat())<1e-7,'repeated frame does not accumulate camera correction');
  check(distance(a.layout.points,b.layout.points)<1e-7,'repeated frame does not accumulate point motion');
}
for(const epsilon of [1e-3,1e-5,1e-7]) {
  const near=solveBalancedAtlas({r:.5+epsilon,theta:epsilon,t:.4,phi:.7});
  const exact=solveBalancedAtlas({r:.5,theta:0,t:.4,phi:.7});
  check(near.success&&exact.success,'near-concurrency path balances');
  const from=balancedDiagram(near.solvedRep,{previous:history});
  const to=balancedDiagram(exact.solvedRep,{previous:from});
  check(distance(from.layout.lines.flat(),to.layout.lines.flat())<100*epsilon+1e-6,
    'visible concurrence approached continuously, not snapped by a boolean');
}
// A closed theta loop must return the same picture, including y colors.
function pictureDistance(a,b) {
  return Math.max(distance(a.layout.points,b.layout.points),
    ...a.layout.lines.map((segment,i)=>Math.min(distance(segment,b.layout.lines[i]),distance(segment,b.layout.lines[i].slice().reverse()))),
    distance(a.glyphs.flatMap(g=>g.coefficients),b.glyphs.flatMap(g=>g.coefficients)),
    distance(a.layout.phaseVectors,b.layout.phaseVectors));
}
// Regression for the vanishing first-point phase anchor. Balanced data is
// regular here, so all displayed changes must decrease with the input step.
for(const epsilon of [1e-4,1e-6,1e-8]) {
  const params={theta:0,t:0,phi:0};
  const a=solveBalancedAtlas({...params,r:.34623782588-epsilon});
  const b=solveBalancedAtlas({...params,r:.34623782588+epsilon},E6_REGULAR_LEVELS,{previous:a});
  check(a.success&&b.success,'radial phase-reference crossing balances');
  const da=balancedDiagram(a.solvedRep),db=balancedDiagram(b.solvedRep,{previous:da});
  check(pictureDistance(da,db)<20*epsilon+1e-7,'radial camera crossing has no finite jump');
  check(!db.layout.cameraDefects.some(d=>d.kind==='camera-phase-anchor-vanishing'),'crossing uses a nonvanishing camera reference');
}
for(const r of [.3,.5]) for(const t of [0,.4]) {
  const pictures=[-.3,.3].map(theta=>balancedDiagram(solveBalancedAtlas({r,t,theta,phi:0}).solvedRep));
  check(pictures[0].layout.incidenceColors.lineHues.some((h,i)=>hueDistance(h,pictures[1].layout.incidenceColors.lineHues[i])>1),
    'line hues distinguish conjugate complex flag data');
}
for(const r of [.3,.5]) for(const t of [0,.4]) {
  const params={r,t,phi:.7};
  const cold=solveBalancedAtlas({...params,theta:Math.PI});
  const expected=balancedDiagram(cold.solvedRep);
  for(const direction of [-1,1]) {
    let solved=null,diagram=null;
    for(let step=0;step<=32;step++) {
      const theta=direction*(-Math.PI+2*Math.PI*step/32);
      solved=solveBalancedAtlas({...params,theta},E6_REGULAR_LEVELS,{previous:solved});
      check(solved.success,'theta sweep balances');
      diagram=balancedDiagram(solved.solvedRep,{previous:diagram});
    }
    check(pictureDistance(diagram,expected)<1e-5,'theta loop is periodic and independent of sweep direction: '+JSON.stringify({r,t,direction,points:distance(diagram.layout.points,expected.layout.points),lines:distance(diagram.layout.lines.flat(),expected.layout.lines.flat()),glyphs:distance(diagram.glyphs.flatMap(g=>g.coefficients),expected.glyphs.flatMap(g=>g.coefficients)),phases:distance(diagram.layout.phaseVectors,expected.layout.phaseVectors)}));
    for(const epsilon of [1e-3,1e-5]) {
      if(r!==.5)continue;
      const views=[-epsilon,0,epsilon].map(theta=>{
        const result=solveBalancedAtlas({...params,theta});
        check(result.success,'theta zero approach balances');
        return balancedDiagram(result.solvedRep,{previous:diagram});
      });
      check(pictureDistance(views[0],views[1])<epsilon*2+1e-6,'left theta zero approach is continuous: '+pictureDistance(views[0],views[1])+' eps '+epsilon+' t '+t);
      check(pictureDistance(views[2],views[1])<epsilon*2+1e-6,'right theta zero approach is continuous: '+pictureDistance(views[2],views[1]));
    }
  }
}
console.log(checks+' balanced diagram checks passed.');

