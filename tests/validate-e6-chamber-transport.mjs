import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
// Source imports work on Node 12 without generated copies or dependencies.
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../assets/js/ek-nakajima'),cache={};
function source(name) {
  if(cache[name])return cache[name];
  let code=fs.readFileSync(path.join(base,name),'utf8');
  code=code.replace(/from\s+['"]\.\/([^'"]+)['"]/g,(_,dep)=>'from '+JSON.stringify(source(dep)));
  return cache[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
(async function(){
  const {e6TransportBalancedWord,e6TransportWord,e6ReflectRepresentation,e6ReflectLevels,E6_ADJACENT_WORD,e6VertexLevels}=await import(source('e6-chamber-transport.js'));
  const {e6ChamberRoots,e6ReflectRoot}=await import(source('e6-chamber-roots.js'));
  const {E6_REGULAR_LEVELS,e6RootWallAudit}=await import(source('e6-levels.js'));
  const {stableBranchChart,branchMiddleChart,branchTipChart,branchFixedGrading,compactFirstLineChart}=await import(source('branch-charts.js'));
  const {concurrencyLimitChart}=await import(source('limit-chart.js'));
  const {checkFixedPointGrading}=await import(source('fixed-point.js'));
  const {endpointStabilityCertificate}=await import(source('stability-certificates.js'));
  const {solveRealMomentMap}=await import(source('solver.js'));
  const {complexResidualNorm,realResidualNorm,frob2,matMul,matAdj}=await import(source('core-math.js'));
  const levels=E6_REGULAR_LEVELS,target=E6_ADJACENT_WORD.reduce((z,v)=>e6ReflectLevels(z,v),levels);
  const expected=[[92,30],[90,61],[88,92]].map(r=>r.map(x=>x/30));
  target.forEach((r,i)=>r.forEach((x,j)=>assert(Math.abs(x-expected[i][j])<1e-12)));
  const before=e6RootWallAudit(levels),after=e6RootWallAudit(target);
  assert(after.regular);assert(target.every(r=>r.every(x=>x>0)));
  const changed=after.roots.filter((r,i)=>r.weight*before.roots[i].weight<0);
  assert.strictEqual(changed.length,2); // One complementary root pair = one wall.
  for(const kind of ['middle','tip']) {
    const cert=endpointStabilityCertificate(kind,0,[[92,30],[90,61],[88,92]],30);
    assert.strictEqual(cert.maximumNumerator,6);assert.strictEqual(cert.denominator,90);
    assert(!cert.semistable); // Exact +1/15 King witness, not solver failure.
  }
  const oldBasis=e6ChamberRoots(levels),newBasis=e6ChamberRoots(target);
  for(const a of oldBasis.simple) {
    const root=E6_ADJACENT_WORD.reduce((r,v)=>e6ReflectRoot(r,v),a.root);
    const b=newBasis.simple.find(b=>b.root.join()===root.join());
    assert(b);assert(Math.abs(a.period-b.period)<1e-12);
  }
  assert.deepStrictEqual(newBasis.gram.map(r=>r.filter(x=>x===-1).length).sort(),[1,1,1,2,2,3]);
  assert.throws(()=>e6ChamberRoots([[3,1],[3,2],[3,3]]),/regular/);
  const diagonalZero={center:{weights:[0,0,0]}};
  for(let i=0;i<3;i++){diagonalZero['middle'+i]={weights:[0,0]};diagonalZero['outer'+i]={weights:[0]};}
  const fixtures=[['central',stableBranchChart(0,2,0),diagonalZero],
    ['central-concurrency',stableBranchChart(0,1,0),diagonalZero],
    ['concurrency-tip',concurrencyLimitChart(0,0)],['concurrency-interior',concurrencyLimitChart(.3,.1)]];
  for(const side of [0,1])fixtures.push(
    ['attachment'+side,stableBranchChart(side,0,0),diagonalZero],
    ['middle'+side,branchMiddleChart(side,0,0),branchFixedGrading(side,1)],
    ['tip'+side,branchTipChart(side,0,0),branchFixedGrading(side,2)],
    ['branch'+side,stableBranchChart(side,[.2,.1],[.3,-.1])],
    ['middle-interior'+side,branchMiddleChart(side,[.2,.1],[.3,-.1])],
    ['tip-interior'+side,branchTipChart(side,[.2,.1],[.3,-.1])]);
  for(const r of [0,.3,.5,1])fixtures.push(['compact'+r,compactFirstLineChart(r,.4,.2,.7)]);
  let worstReal=0,worstComplex=0,fixed=0;
  const F=rep=>rep.b.concat(rep.B).reduce((s,m)=>s+frob2(m),0)/2;
  function balance(name,rep,z) {
    const solved=solveRealMomentMap(rep,z,{analytic:true,maxIter:500});
    assert(solved.success,name+' failed to balance: '+solved.residuals.real_norm);
    const real=realResidualNorm(solved.solvedRep,z),complex=complexResidualNorm(solved.solvedRep);
    assert(real<1e-9);assert(complex<1e-8);worstReal=Math.max(worstReal,real);worstComplex=Math.max(worstComplex,complex);
    // Positive final leg levels restore injective flag maps, despite negative intermediate levels.
    for(let i=0;i<3;i++) {
      const a=matMul(matAdj(solved.solvedRep.a[i]),solved.solvedRep.a[i]);assert(a[0][0][0]>0);
      const A=matMul(matAdj(solved.solvedRep.A[i]),solved.solvedRep.A[i]);
      assert(A[0][0][0]*A[1][1][0]-A[0][1][0]**2-A[0][1][1]**2>1e-8);
    }
    return solved.solvedRep;
  }
  for(const [name,rep,grading] of fixtures) {
    const out=e6TransportWord(rep,levels,E6_ADJACENT_WORD,grading);
    assert(complexResidualNorm(out.rep)<1e-9,name+' complex equation');
    const solved=balance(name,out.rep,out.levels);
    const originalBalanced=balance(name+' balanced source',rep,levels);
    const direct=e6TransportBalancedWord(originalBalanced,levels,E6_ADJACENT_WORD);
    assert(realResidualNorm(direct.rep,direct.levels)<1e-7,name+' balanced direct real');
    assert(complexResidualNorm(direct.rep)<1e-7,name+' balanced direct complex');
    assert(Math.abs(F(direct.rep)-F(solved))<1e-7,name+' balanced direct Hamiltonian');
    if(grading) {
      assert.strictEqual(checkFixedPointGrading(out.rep,out.grading).residual,0);fixed++;
      const z=e6VertexLevels(out.levels);
      const trace=g=>g.weights.reduce((s,x)=>s+x,0);
      const generators=[out.grading.center].concat([0,1,2].map(i=>out.grading['middle'+i]),[0,1,2].map(i=>out.grading['outer'+i]));
      const predicted=-z.reduce((s,x,i)=>s+x*trace(generators[i]),0)/2;
      assert(Math.abs(F(solved)-predicted)<2e-8,name+' circle Hamiltonian');
    }
    if(name==='branch0'||name==='middle0'||name==='tip0') {
      const back=e6TransportWord(out.rep,out.levels,E6_ADJACENT_WORD.slice().reverse());
      const round=balance(name+' round trip',back.rep,back.levels),original=balance(name+' source',rep,levels);
      assert(Math.abs(F(round)-F(original))<2e-8,name+' inverse transport');
    }
  }
  assert.throws(()=>e6ReflectRepresentation(stableBranchChart(0,2,0),[[3,0],[3,2],[3,3]],1),/nonzero/);
  console.log('Adjacent E6 chamber: '+fixtures.length+' transported fixtures, '+fixed+' exact diagonal gradings; 1 crossed wall, exact unstable old endpoints; worst real '+worstReal+', complex '+worstComplex+'.');
})().catch(error=>{console.error(error);process.exitCode=1;});
