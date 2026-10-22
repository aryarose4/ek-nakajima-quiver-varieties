import { readFileSync } from 'fs';
import assert from 'assert';
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const source=n=>readFileSync(new URL('../assets/js/ek-nakajima/'+n,import.meta.url),'utf8');
const cu=uri(source('core-math.js'));
const bu=uri(source('branch-charts.js').replace("'./core-math.js'",JSON.stringify(cu)));
const tu=uri(source('chart.js').replace('"./core-math.js"',JSON.stringify(cu)));
Promise.all([import(bu),import(cu),import(tu)]).then(([b,c,t])=>{
  let checks=0;
  const check=(ok,name)=>{checks++;assert.ok(ok,name);};
  const C=x=>Array.isArray(x)?x:[x,0], mul=(x,y)=>c.cMul(C(x),C(y));
  const inv=x=>{x=C(x);const d=c.cAbs2(x);return [x[0]/d,-x[1]/d];};
  const flat=x=>Array.isArray(x)?x.reduce((a,v)=>a.concat(flat(v)),[]):[x];
  const same=(a,d)=>['a','A','b','B'].every(k=>flat(a[k]).every((x,j)=>Math.abs(x-flat(d[k])[j])<1e-9));
  const gauge=(rep,g,h,q)=>{
    const mm=(m,left,right)=>m.map((row,i)=>row.map((v,j)=>mul(mul(left[i],v),inv(right[j]))));
    return c.makeRep(rep.a.map((m,i)=>mm(m,h[i],[q[i]])),rep.A.map((m,i)=>mm(m,g,h[i])),rep.b.map((m,i)=>mm(m,[q[i]],h[i])),rep.B.map((m,i)=>mm(m,h[i],g)));
  };
  for(const side of [0,1]) for(const x of [0,0.2,1,[0.3,0.6]]) for(const y of [0,0.7,[0.4,-0.8]]) {
    for(const f of [b.stableBranchChart,b.branchMiddleChart,b.branchTipChart])
      check(c.complexResidualNorm(f(side,x,y))<1e-10,'exact chart moment maps');
  }
  for(const s of [0.3,1,[0.3,0.8]]) for(const v of [0,0.7,[0.8,-0.5]]) {
    const old=b.stableBranchChart(0,mul(v,mul(s,s)),inv(s));
    check(same(gauge(old,[1,s,1],[[1,s],[s,1],[1,1]],[1,s,1]),b.branchMiddleChart(0,s,v)),'first atlas overlap');
    const other=b.stableBranchChart(1,mul(v,mul(s,s)),inv(s));
    check(same(gauge(other,[1,1,s],[[1,s],[1,1],[s,1]],[1,1,s]),b.branchMiddleChart(1,s,v)),'infinity first atlas overlap');
  }
  for(const h of [0.2,1,[0.7,-0.2]]) for(const p of [0,0.3,[0.2,0.8]]) {
    const old=b.branchMiddleChart(0,mul(p,mul(h,h)),inv(h));
    check(same(gauge(old,[h,1,1],[[h,1],[1,1],[1,h]],[h,1,1]),b.branchTipChart(0,h,p)),'second atlas overlap');
    const other=b.branchMiddleChart(1,mul(p,mul(h,h)),inv(h));
    check(same(gauge(other,[h,1,1],[[h,1],[1,h],[1,1]],[h,1,1]),b.branchTipChart(1,h,p)),'infinity second atlas overlap');
  }
  for(const z of [0.2,1,[0.7,0.3]]) for(const w of [0,1,[0.3,-0.2]]) {
    const iz=inv(z), original=t.transverseChart(z,w);
    check(same(gauge(original,[1,iz,1],[[1,iz],[iz,1],[1,1]],[1,iz,1]),b.stableBranchChart(0,z,w)),'original M5 gauge overlap');
  }
  for(const r of [0,0.2,0.5,0.8,1]) for(const theta of [0,0.7,2]) {
    const rep=b.compactFirstLineChart(r,theta,0.6,0.4);
    check(c.complexResidualNorm(rep)<1e-10,'compact moving-first-line moment maps');
    if(r<1) {
      const s=1-r,z=[r/s*Math.cos(theta),r/s*Math.sin(theta)],eta=[1.5*Math.cos(0.4),1.5*Math.sin(0.4)];
      const old=b.stableBranchChart(0,z,mul(s*s,eta));
      check(same(rep,gauge(old,[1,1,1],[[1,1/s],[1,1],[1,1]],[1,1,1])),'compact first-line full-arrow gauge overlap');
    } else {
      const u=[Math.cos(theta),Math.sin(theta)],eta=[1.5*Math.cos(0.4),1.5*Math.sin(0.4)];
      const pole=b.stableBranchChart(1,0,mul(mul(u,u),eta));
      check(same(rep,gauge(pole,[1,1,1],[[1,inv(u)],[1,1],[1,1]],[1,1,1])),'infinity fiber phase and all-arrow gauge overlap');
    }
  }
  for(const f of [b.stableBranchChart,b.branchMiddleChart,b.branchTipChart]) {
    for(const bad of [NaN,Infinity,[NaN,0],[0,Infinity],[1],[1,2,3],null,'1']) {
      assert.throws(()=>f(0,bad,0),RangeError);checks++;
      assert.throws(()=>f(0,0,bad),RangeError);checks++;
    }
    for(const bad of [-1,2,'other',null]) {assert.throws(()=>f(bad,0,0),RangeError);checks++;}
  }
  // The slider phase/speed is inherited from y scaling, not independently
  // assigned on each sphere: the outgoing coordinates have weights 2 and 3.
  for(const side of [0,1]) for(const lam of [2,[0.8,0.6]]) for(const stage of [1,2]) {
    const f=stage===1?b.branchMiddleChart:b.branchTipChart;
    const x=[0.3,0.2], y=[0.4,-0.1], r=f(side,x,y);
    r.b=r.b.map(m=>c.matScale(m,lam)); r.B=r.B.map(m=>c.matScale(m,lam));
    const pow=n=>{let z=[1,0];for(let j=0;j<Math.abs(n);j++)z=mul(z,n<0?inv(lam):lam);return z;};
    const grading=b.branchFixedGrading(side,stage);
    const weights=key=>grading[key].weights.map(n=>pow(-n));
    const transformed=gauge(r,weights('center'),[0,1,2].map(i=>weights('middle'+i)),[0,1,2].map(i=>weights('outer'+i)[0]));
    check(same(transformed,f(side,mul(x,pow(-stage)),mul(y,pow(stage+1)))),'C* chart weights including complex phase');
  }
  for(const bad of [0,3,NaN,'1']) {assert.throws(()=>b.branchFixedGrading(0,bad),RangeError);checks++;}
  assert.throws(()=>b.branchFixedGrading('other',1),RangeError);checks++;
  console.log(checks+' branch atlas checks passed.');
}).catch(e=>{console.error(e);process.exitCode=1;});
