import assert from 'assert';
import {source,distance} from './continuity-features.mjs';
(async function(){
  const {solveBalancedAtlas}=await import(source('balanced-model.js'));
  const {balancedTensorDiagram}=await import(source('weighted-balanced-diagram.js'));
  const {E6_DEFAULT_BETA,betaToLevels}=await import(source('e6-parameters.js'));
  const levels=betaToLevels(E6_DEFAULT_BETA);
  function sample(r,theta=0){
    const s=solveBalancedAtlas({r,theta,t:0,phi:0,sphere:0},levels);
    assert(s.success&&s.residuals.real_norm<1e-9);
    const d=balancedTensorDiagram(s.solvedRep);assert(d.valid);return d.layout;
  }
  const lineDistance=(p,[a,b])=>Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))/distance(a,b);
  let clipped=0;
  for(const r of [.36,.375,.39])for(const theta of [0,.1,.7]){
    const l=sample(r,theta);
    l.points.forEach((p,i)=>{
      const raw=l.rawPoints[i],marker=l.pointMarkers[i];
      if(!marker.clipped){assert.deepStrictEqual(p,raw);return;}
      assert(!marker.atInfinity);clipped++;
      assert(Math.abs(Math.max(...p.map(Math.abs))-.9)<1e-10,'marker lies on viewport boundary');
      assert(lineDistance(raw,l.lines[i])<1e-8,'fixture raw point lies on its own line');
      assert(lineDistance(p,l.lines[i])<1e-8,'boundary marker stays on its own line');
      const delta=raw.map((v,j)=>v-p[j]),length=Math.hypot(...delta);
      assert(distance(marker.direction,delta.map(x=>x/length))<1e-8,'arrow points toward its off-screen raw point');
    });
  }
  assert(clipped>0,'off-screen fixture is exercised');
  // Find a viewport entry/exit and check that the marker joins the true point
  // continuously, rather than jumping when clipping starts.
  let bracket=null,previous={r:.3,l:sample(.3)};
  for(let k=1;k<=40&&!bracket;k++){
    const r=.3+k*.005,l=sample(r);
    for(let i=0;i<3;i++)if(previous.l.pointMarkers[i].clipped!==l.pointMarkers[i].clipped){bracket={lo:previous.r,hi:r,i};break;}
    previous={r,l};
  }
  assert(bracket,'viewport crossing is exercised');
  const side=sample(bracket.lo).pointMarkers[bracket.i].clipped;
  for(let k=0;k<20;k++){
    const mid=(bracket.lo+bracket.hi)/2;
    if(sample(mid).pointMarkers[bracket.i].clipped===side)bracket.lo=mid;else bracket.hi=mid;
  }
  const center=(bracket.lo+bracket.hi)/2;
  const errors=[1e-5,1e-6,1e-7].map(h=>distance(sample(center-h).points[bracket.i],sample(center+h).points[bracket.i]));
  assert(errors[2]<errors[0]/20&&errors[2]<1e-4,'viewport entry remains continuous');
  console.log(JSON.stringify({clippedCases:clipped,crossing:center,errors}));
})().catch(error=>{console.error(error);process.exitCode=1;});
