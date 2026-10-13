// element-model.js — pure, Node-safe driver tying the y = 0 chart, the
// positive-Hermitian-gauge solver, and the single-element V2 view together so
// the browser can be driven live from (r, theta).
//
// solveElement(r, theta, levels, options):
//   1. build the chart rep at z = r exp(i theta)      (chart.js)
//   2. solve the real moment map, warm-started when options.initialLogGauge
//      (or its alias options.prevLogGauge) is supplied (solver.js)
//   3. extract the single-element view from the solved rep (element-view.js)
//
// It NEVER throws on a failed solve: it returns success:false together with
// the last solver diagnostics, so the caller can keep its previous valid frame
// (working rule 5 of the milestones: never display stale matrices as current).
//
// Pure: no UI, no global state, no I/O.

import { candidateY0Chart, chartZ } from "./chart.js";
import { solveRealMomentMap } from "./solver.js";
import { elementView } from "./element-view.js";

export function solveElement(r, theta, levels, options = {}) {
  // Forward solver options; translate the prevLogGauge alias.
  const solverOptions = Object.assign({}, options);
  if (solverOptions.initialLogGauge === undefined &&
      solverOptions.prevLogGauge !== undefined) {
    solverOptions.initialLogGauge = solverOptions.prevLogGauge;
  }
  delete solverOptions.prevLogGauge;

  let rep;
  try {
    rep = candidateY0Chart(chartZ(r, theta));
  } catch (e) {
    return failureResult(null, { status: "chart_error", message: String(e) });
  }

  let res;
  try {
    res = solveRealMomentMap(rep, levels, solverOptions);
  } catch (e) {
    return failureResult(rep, { status: "solver_exception", message: String(e) });
  }

  let view = null;
  try {
    view = elementView(res.solvedRep, levels);
  } catch (e) {
    view = null;
  }

  return {
    success: !!res.success,
    logGauge: res.logGauge,
    solvedRep: res.solvedRep,
    view,
    diagnostics: res.diagnostics,
  };
}

function failureResult(rep, diagnostics) {
  return {
    success: false,
    logGauge: null,
    solvedRep: rep,
    view: null,
    diagnostics: Object.assign(
      { status: "failure", iterations: 0, nfev: 0 },
      diagnostics
    ),
  };
}
