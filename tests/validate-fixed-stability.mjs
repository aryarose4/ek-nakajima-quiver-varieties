import { readFileSync } from 'fs';
import assert from 'assert';
const cache={};
function uri(name) {
  if(cache[name]) return cache[name];
  const source=readFileSync(new URL('../assets/js/ek-nakajima/'+name,import.meta.url),'utf8')
    .replace(/(['"])\.\/([^'"]+\.js)\1/g,(_,quote,dependency)=>JSON.stringify(uri(dependency)));
  cache[name]='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  return cache[name];
}
import(uri('stability-certificates.js')).then(({endpointStabilityCertificate:certificate,centralSphereStabilityCertificate:centralCertificate})=>{
  let count=0;
  function check(value,label){count++;assert.ok(value,label);}
  const generic=[[30,10],[30,21],[30,30]], frozen=[[3,1],[3,2],[3,3]];
  const records=[];
  for(const kind of ['attachment','middle','tip']) for(const side of [0,1]) {
    const result=certificate(kind,side);
    records.push([kind,side,result.maximumNumerator,result.denominator]);
    check(result.stable,kind+' '+side+' is strictly stable at exact generic levels');
    check(result.entries.every(e=>e.numerator<0),kind+' '+side+' has no nonnegative invariant incidence');
    check(result.entries.every(e=>Number.isSafeInteger(e.numerator)), 'weights are exact integer numerators');
    const scaled=certificate(kind,side,generic.map(r=>r.map(x=>x*3)),30);
    check(scaled.maximumNumerator===3*result.maximumNumerator,'rational level rescaling preserves exact certificate');
  }
  check(JSON.stringify(records.map(row=>row[2]))===JSON.stringify([-29,-2,-2,-2,-2,-29]),'all six long-arm exact margins match the new chamber');
  const concurrency=certificate('concurrency');
  check(concurrency.stable,'concurrency endpoint is strictly stable');
  check(concurrency.entries.length===5,'concurrency has one invariant eigenline, three exceptional planes, and a generic plane pattern');
  check(concurrency.maximumNumerator===-29,'concurrency worst weight is -29/30');
  check(certificate('concurrency',0,frozen,1).stable,'concurrency remains stable at frozen levels');
  const centralConcurrency=certificate('central-concurrency');
  check(centralConcurrency.stable,'central/short-arm attachment is strictly stable at generic levels');
  check(centralConcurrency.maximumNumerator===-29,'central/short-arm attachment exact worst weight is -29/30');
  check(certificate('central-concurrency',0,frozen,1).stable,'central/short-arm attachment remains stable at frozen levels');
  const sphere=centralCertificate();
  check(sphere.stable,'entire central projective line is stable by exhaustive incidence strata');
  check(sphere.maximumNumerator===-2,'central sphere tightest margin is exactly 1/15');
  check(JSON.stringify(sphere.certificates.map(row=>row.certificate.maximumNumerator))===JSON.stringify([-29,-2,-29,-32]),'all four central incidence strata have exact expected bounds');
  check(!centralCertificate([[30,10],[30,19],[30,30]],10).stable,'moving-line sphere fails in the previous chamber');
  check(centralCertificate(frozen,1).certificates[1].certificate.maximumNumerator===0,'frozen central infinity lies exactly on the wall');
  const wall=certificate('tip',0,frozen,1);
  check(wall.semistable&&!wall.stable,'collapsed frozen-FI tip is correctly identified as strictly semistable');
  check(wall.maximumNumerator===0,'root wall is detected by exact zero, not a tolerance');
  check(certificate('tip',1,frozen,1).stable,'the other tip is strictly stable at frozen levels');
  check(certificate('middle',0,frozen,1).maximumNumerator===0,'zero-side middle also meets the frozen wall');
  check(certificate('middle',1,frozen,1).maximumNumerator===0,'infinity-side middle also meets the frozen wall');
  for(const bad of [[[0,1],[3,2],[3,3]],[[-3,1],[3,2],[3,3]],[[3.1,1],[3,2],[3,3]]]) {
    count++;assert.throws(()=>certificate('middle',0,bad,1),RangeError);
  }
  count++;assert.throws(()=>certificate('unknown'),RangeError);
  console.log('fixed stability: '+count+' checks passed; endpoint max weights '+JSON.stringify(records));
}).catch(error=>{console.error(error);process.exitCode=1;});




