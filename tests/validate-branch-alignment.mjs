import { readFileSync } from 'fs';
import assert from 'assert';
const source = n => readFileSync(new URL('../assets/js/ek-nakajima/' + n, import.meta.url), 'utf8');
const uri = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const core = uri(source('core-math.js'));
const moduleURI = n => uri(source(n).replace(/(['"])\.\/core-math\.js\1/g, JSON.stringify(core)));
Promise.all([import(core), import(moduleURI('branch-charts.js')), import(moduleURI('flag-incidence.js')), import(moduleURI('flag-diagram.js'))])
  .then(([m, chart, incidence, diagram]) => {
    let checks = 0;
    const check = (ok, label) => { checks++; assert.ok(ok, label); };
    const operators = rep => rep.A.map((A, i) => m.matMul(A, rep.B[i]));
    const dot = (a,b) => a.reduce((sum,v,i)=>sum+v*b[i],0);
    const flat = d => d.lines.reduce((out,line)=>out.concat(...line),[]);
    const distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
    for(const side of ['zero','infinity']) for(const stage of [0,1]) {
      const endpoint = stage===0 ? chart.branchMiddleChart(side) : chart.branchTipChart(side);
      const finalData=incidence.flagIncidence(endpoint);
      const finalDiagram=diagram.flagDiagram(finalData,{realFlags:true,firstLine:true});
      check(finalDiagram.valid,'fixed flags visible');
      let prior=Infinity;
      for(const magnitude of [0,0.1,1,10,100,1e6]) for(const phase of [0,0.7,-2]) {
        const coordinate=[magnitude*Math.cos(phase),magnitude*Math.sin(phase)];
        const rep=stage===0 ? chart.stableBranchChart(side,0,coordinate) : chart.branchMiddleChart(side,0,coordinate);
        const data=incidence.flagIncidence(rep);
        const g=diagram.branchDisplayGauge(data,operators(rep),{side,stage,magnitude,firstLine:true});
        const d=diagram.flagDiagram(g.data,{realFlags:true,firstLine:true});
        check(d.valid,'all finite ray flags visible independent of phase');
        check(d.points.every(p=>p.every(x=>Number.isFinite(x)&&Math.abs(x)<0.9)),'points stay bounded');
        const r=d.reconstruction;
        r.homogeneousLines.forEach((line,i)=> {
          check(Math.abs(dot(line,r.homogeneousPoints[i]))<1e-12,'true own incidence preserved');
          d.lines[i].forEach(p=>check(Math.abs(dot(line,p.concat([1])))<1e-12,'drawn line is exact projective image'));
        });
        const glyphs=diagram.cotangentGlyphs(g.data,g.operators);
        check(glyphs.every(glyph=>glyph.coefficients.every(z=>z.every(Number.isFinite))),'gauged cotangent glyphs finite');
        // Direct conjugation verifies the renderer uses the same gauge on y.
        const G=g.diagonal.map((v,i)=>g.diagonal.map((_,j)=>[i===j?v:0,0]));
        const Gi=g.diagonal.map((v,i)=>g.diagonal.map((_,j)=>[i===j?1/v:0,0]));
        operators(rep).forEach((K,i)=>check(m.frobNorm(m.matSub(g.operators[i],m.matMul(m.matMul(G,K),Gi)))<1e-9,'operator conjugation exact'));
        if(phase===0) {
          const error=distance(flat(d),flat(finalDiagram));
          check(error<prior,'flag lines continuously approach next fixed point'); prior=error;
          if(magnitude===1e6) {
            check(error<1e-5,'screen geometry reaches fixed endpoint');
            const target=diagram.cotangentGlyphs(finalData,operators(endpoint));
            const values=glyphs.reduce((out,glyph,i)=>out.concat(...glyph.coefficients.map((z,j)=>z.map((v,k)=>v-target[i].coefficients[j][k]))),[]);
            check(Math.hypot(...values)<1e-5,'normalized y reaches next fixed point '+side+' '+stage);
          }
        }
      }
    }
    for(const side of ['zero','infinity']) for(const p of [0,[1,2],[-3,4]]) {
      const data=incidence.flagIncidence(chart.branchTipChart(side,0,p));
      check(diagram.flagDiagram(data,{realFlags:true,firstLine:true}).valid,'outgoing tip flags remain visible');
      check(data.incident.every(row=>row.filter(Boolean).length===2),'tip consists of full coordinate triangle');
    }
    console.log(`${checks} branch-alignment checks passed.`);
  }).catch(error=>{console.error(error);process.exitCode=1;});
