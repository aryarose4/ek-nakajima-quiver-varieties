// Numerical balance of the existing E6 atlas; no UI or shared mutable state.
import { e6AtlasPoint } from './e6-atlas.js';
import { branchMiddleChart, branchTipChart } from './branch-charts.js';
import { e6ReflectLevels, e6TransportBalancedWord, E6_ADJACENT_WORD } from './e6-chamber-transport.js';
import { e6RootWallAudit } from './e6-levels.js';
import { realResidualNorm, complexResidualNorm } from './core-math.js';
import { makeRep } from './core-math.js';
import { E6_REGULAR_LEVELS } from './e6-levels.js';
import { solveRealMomentMap } from './solver.js';

function family(p) {
  if (p.r === 0 || p.r === 1) return `${p.r}:${p.outgoing ? 'outgoing' : p.t === 1 ? 'endpoint'+(p.sphere||0) : 'sphere'+(p.sphere||0)}`;
  return p.r === .5 && p.theta === 0 && (p.outgoing || p.t === 1) ? 'concurrency' : 'central';
}
function finiteGauge(g) {
  return g && Array.isArray(g.center) && g.center.length === 8 &&
    Array.isArray(g.middle) && g.middle.length === 3 && g.middle.every(a=>Array.isArray(a)&&a.length===4) &&
    Array.isArray(g.outer) && g.outer.length === 3 && g.outer.every(a=>Array.isArray(a)&&a.length===1) &&
    g.center.concat(...g.middle,...g.outer).every(Number.isFinite);
}
function failed(atlas, status, message) {
  return { success:false, solvedRep:null, logGauge:null, residuals:null, atlas,
    rawRep:atlas ? atlas.rep : null, continuation:null,
    diagnostics:{status,message,iterations:0,nfev:0} };
}

// Exact finite-gauge overlap along the incoming concurrency sphere.
// s=4/eta; at s=0 these matrices equal concurrencyLimitChart(0,0).
function boundedConcurrency(s) {
  const ell=[[0,-1,1],[1,0,-1],[-1,1,0]];
  return makeRep(
    ell.map(()=>[[[1,0]],[[0,0]]]),
    ell.map((_,i)=>ell.map((__,j)=>[[(i===j?1:0)-1/3+s[0]/3,s[1]/3],[1,0]])),
    ell.map(()=>[[[0,0],[0,0]]]),
    ell.map(row=>[row.map(()=>[0,0]),row.map(x=>[x,0])])
  );
}

// A previous successful result is an optional continuation token. Seeds are
// accepted within the same chart family, including changes in real levels.
// Failed attempts never expose a previous representation as the current solve.
export function solveBalancedAtlas(parameters, levels = E6_REGULAR_LEVELS, options = {}) {
  const chamber=options.chamber || 'default';
  const chamberId=typeof chamber==='string' ? chamber : chamber.id;
  if(chamberId && chamberId!=='default') {
    if(chamberId!=='side-zero-second')return failed(null,'unsupported_chamber','Unknown chamber.');
    const word=E6_ADJACENT_WORD;
    const sourceLevels=word.slice().reverse().reduce((z,v)=>e6ReflectLevels(z,v),levels);
    const sourceAudit=e6RootWallAudit(sourceLevels),referenceAudit=e6RootWallAudit(E6_REGULAR_LEVELS);
    if(!e6RootWallAudit(levels).regular || !sourceAudit.regular)
      return failed(null,'singular_chamber_level','Use an explicit interior wall-limit sample.');
    if(sourceAudit.roots.some((root,i)=>root.weight*referenceAudit.roots[i].weight<=0))
      return failed(null,'chamber_mismatch','Levels do not lie in the selected adjacent chamber.');
    const previous=options.previous && (options.previous.continuation || options.previous);
    const sourcePrevious=previous && previous.chamberId===chamberId ? previous.source : null;
    const source=solveBalancedAtlas(parameters,sourceLevels,Object.assign({},options,{
      chamber:'default',previous:sourcePrevious,initialLogGauge:null
    }));
    if(!source.success)return source;
    try {
      const transported=e6TransportBalancedWord(source.solvedRep,sourceLevels,word);
      let real=realResidualNorm(transported.rep,levels),complex=complexResidualNorm(transported.rep);
      // Reflection preserves the equations analytically; roundoff can amplify
      // a source residual near another facet. Polish the already balanced
      // target rather than relaxing the established acceptance tolerance.
      if(real>1e-9 && real<1e-6 && complex<1e-8) {
        const polish=solveRealMomentMap(transported.rep,levels,{analytic:true,centered:true,maxIter:40,max_nfev:2000,multistart:false,abs_tol:1e-11,rel_tol:1e-11});
        if(polish.success){transported.rep=polish.solvedRep;real=realResidualNorm(transported.rep,levels);complex=complexResidualNorm(transported.rep);}
      }
      if(!Number.isFinite(real)||!Number.isFinite(complex)||real>1e-9||complex>1e-8)
        return failed(source.atlas,'transport_residual','Transported moment-map residual exceeds tolerance: '+real+', '+complex);
      return Object.assign({},source,{solvedRep:transported.rep,logGauge:null,
        residuals:Object.assign({},source.residuals,{real_norm:real,complex_norm:complex}),
        continuation:{chamberId,source:source.continuation},chamberId,
        diagnostics:Object.assign({},source.diagnostics,{chamberId,transported:true,transportWord:word.slice(),sourceLevels})});
    }catch(e){return failed(source.atlas,'transport_exception',String(e));}
  }
  let atlas;
  try { atlas = e6AtlasPoint(parameters); }
  catch(e) { return failed(null,'chart_error',String(e)); }
  let numericalRep=atlas.rep, chartFamily=family(parameters);
  // Exact overlap formulas keep coefficients bounded near compact endpoints.
  if ((parameters.r===0 || parameters.r===1) && !parameters.outgoing && parameters.t>.5 && parameters.t<1) {
    const phase=parameters.phi+(parameters.r===1 ? 2*parameters.theta : 0);
    const power=parameters.sphere===1 ? 2 : 1;
    const magnitude=Math.pow((1-parameters.t)/parameters.t,power);
    const reciprocal=[magnitude*Math.cos(power*phase),-magnitude*Math.sin(power*phase)];
    numericalRep=power===2 ? branchTipChart(parameters.r,reciprocal,0) : branchMiddleChart(parameters.r,reciprocal,0);
    chartFamily+=':overlap';
  }
  if (parameters.r===.5 && parameters.theta===0 && !parameters.outgoing && parameters.t>.5 && parameters.t<1) {
    const magnitude=4*(1-parameters.t)/parameters.t;
    numericalRep=boundedConcurrency([magnitude*Math.cos(parameters.phi),-magnitude*Math.sin(parameters.phi)]);
    chartFamily='concurrency:incoming-overlap';
  }
  const levelKey=JSON.stringify(levels);
  const defaults={maxIter:80,max_nfev:4000,multistart:false};
  const solverOptions=Object.assign(defaults,options.solverOptions||{});
  const previous=options.previous && (options.previous.continuation || options.previous);
  const parameterKey=JSON.stringify(parameters);
  const audit=e6RootWallAudit(levels);
  const wallIndex=audit.roots.findIndex(root=>Math.abs(root.weight)<=audit.minAbsWeight+1e-12);
  const wallLog=Math.log(audit.minAbsWeight);
  let warm=options.initialLogGauge;
  if (!warm && previous && (!previous.chamberId || previous.chamberId==='default') && previous.family===chartFamily) warm=previous.logGauge;
  let predicted=false;
  // At a collapsing sphere the positive gauge grows logarithmically in the
  // vanishing period. Reusing its last value leaves a poorly conditioned LM
  // solve; a secant in log(period) gives a much closer initial gauge. This is
  // only a seed: all moment maps and positivity are still checked directly.
  if (!options.initialLogGauge && warm && previous.parameterKey===parameterKey &&
      previous.wallIndex===wallIndex && previous.history && finiteGauge(previous.history.logGauge) && audit.minAbsWeight<.1 &&
      wallLog<previous.wallLog && previous.wallLog<previous.history.wallLog) {
    const ratio=(wallLog-previous.wallLog)/(previous.wallLog-previous.history.wallLog);
    if(Number.isFinite(ratio) && ratio<=32) {
      const old=previous.history.logGauge;
      warm={center:warm.center.map((v,i)=>v+ratio*(v-old.center[i])),
        middle:warm.middle.map((row,j)=>row.map((v,i)=>v+ratio*(v-old.middle[j][i]))),
        outer:warm.outer.map((row,j)=>row.map((v,i)=>v+ratio*(v-old.outer[j][i])))};
      predicted=true;
    }
  }
  if (!finiteGauge(warm)) warm=null;
  let result, attempts=0, totalNfev=0;
  try {
    attempts++;
    result=solveRealMomentMap(numericalRep,levels,Object.assign({},solverOptions,{initialLogGauge:warm}));
    totalNfev+=result.diagnostics.nfev;
    if (!result.success && predicted) {
      attempts++;
      const unpredicted=solveRealMomentMap(numericalRep,levels,Object.assign({},solverOptions,{initialLogGauge:previous.logGauge}));
      totalNfev+=unpredicted.diagnostics.nfev;
      if(unpredicted.success || unpredicted.residuals.real_norm<result.residuals.real_norm) result=unpredicted;
    }
    if (!result.success && warm) {
      attempts++;
      const cold=solveRealMomentMap(numericalRep,levels,Object.assign({},solverOptions,{initialLogGauge:null}));
      totalNfev+=cold.diagnostics.nfev;
      if(cold.success || cold.residuals.real_norm<result.residuals.real_norm) result=cold;
    }
    if (!result.success && !options.solverOptions) {
      // Keep ordinary slider solves on the fast path. At ill-conditioned
      // chamber edges recover with an analytic Jacobian and QR, while retaining
      // the same direct residual, positivity and determinant acceptance checks.
      attempts++;
      const recovery=solveRealMomentMap(numericalRep,levels,Object.assign({},solverOptions,{
        initialLogGauge:result.logGauge,centered:true,analytic:true,maxIter:220,max_nfev:14000
      }));
      totalNfev+=recovery.diagnostics.nfev;
      if(recovery.success || recovery.residuals.real_norm<result.residuals.real_norm) result=recovery;
    }
  } catch(e) { return failed(atlas,'solver_exception',String(e)); }
  const success=!!result.success;
  return {
    success, solvedRep:success ? result.solvedRep : null,
    logGauge:success ? result.logGauge : null, residuals:result.residuals,
    atlas, rawRep:atlas.rep, numericalRep,
    diagnostics:Object.assign({},result.diagnostics,{attempts,nfev:totalNfev,warmStart:!!warm,predicted,chartFamily}),
    continuation:success ? {family:chartFamily,levelKey,chamberId:'default',logGauge:result.logGauge,
      parameterKey,wallIndex,wallLog,
      history:previous && previous.parameterKey===parameterKey && previous.wallIndex===wallIndex ?
        {wallLog:previous.wallLog,logGauge:previous.logGauge} : null} : null,
  };
}
