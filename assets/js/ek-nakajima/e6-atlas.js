// Pure control-to-chart dispatch, shared by the widget and endpoint tests.
// The explicit long-arm charts use E6_REGULAR_LEVELS; frozen fixture levels
// remain a separate wall-level test case. Portrait coordinates are schematic.
import { concurrencyLimitChart } from './limit-chart.js';
import { compactFirstLineChart, branchMiddleChart, branchTipChart, branchFixedGrading } from './branch-charts.js';
import { zeroSectionGrading, concurrencyGrading, checkFixedPointGrading } from './fixed-point.js';

// Exact endpoint availability in this atlas, shared with the compact t control.
export function e6HasInfinityLimit(parameters) {
  const {r, theta, outgoing} = parameters;
  const sphere = parameters.sphere === undefined ? 0 : parameters.sphere;
  return !outgoing && (((r === 0 || r === 1) && (sphere === 0 || sphere === 1)) ||
    (r === .5 && theta === 0 && sphere === 0));
}

export function e6AtlasPoint(parameters) {
  const { r, theta, t, phi } = parameters;
  const sphere = parameters.sphere === undefined ? 0 : parameters.sphere, outgoing = !!parameters.outgoing;
  if (![r, theta, t, phi].every(Number.isFinite) || r < 0 || r > 1 || t < 0 || t > 1 ||
    !Number.isInteger(sphere) || sphere < 0 || sphere > 1) throw new RangeError('Invalid E6 coordinates.');
  const longArm = r === 0 || r === 1;
  const shortArm = r === 0.5 && theta === 0;
  let rep, grading = null, view = { firstLine: true };
  const localPhase = r === 1 ? phi + 2 * theta : phi;
  const polar = power => {
    const magnitude = Math.pow(t / (1 - t), power);
    return [magnitude * Math.cos(power * localPhase), magnitude * Math.sin(power * localPhase)];
  };
  if (longArm) {
    const side = r === 0 ? 'zero' : 'infinity';
    view.realFlags = sphere > 0 || outgoing || t === 1;
    if (outgoing) {
      if (sphere !== 1 || t === 1) throw new RangeError('No finite chart beyond the outgoing tip.');
      rep = branchTipChart(side, 0, polar(3));
      if (t === 0) grading = branchFixedGrading(side, 2);
    } else if (t === 1) {
      rep = sphere === 0 ? branchMiddleChart(side) : branchTipChart(side);
      grading = branchFixedGrading(side, sphere + 1);
    } else if (sphere === 0) {
      rep = compactFirstLineChart(r, theta, t, phi);
      view.centralFlow = { r, t };
      if (t === 0) grading = zeroSectionGrading();
    } else {
      rep = branchMiddleChart(side, 0, polar(2));
      view.branchGauge = { side, stage: 1, magnitude: Math.pow(t / (1 - t), 2) };
      if (t === 0) grading = branchFixedGrading(side, 1);
    }
  } else if (shortArm && (outgoing || t === 1)) {
    if (sphere !== 0 || (outgoing && t === 1)) throw new RangeError('No finite chart beyond the outgoing tip.');
    rep = concurrencyLimitChart(0, outgoing ? polar(2) : 0);
    view.concurrencyProgress = 1;
    if (!outgoing || t === 0) grading = concurrencyGrading();
  } else {
    if (sphere !== 0 || outgoing || t === 1) throw new RangeError('No chart at this flow coordinate.');
    rep = compactFirstLineChart(r, theta, t, phi);
    view.centralFlow = { r, t };
    if (shortArm) view.concurrencyProgress = t;
    if (t === 0) grading = zeroSectionGrading();
  }
  // No endpoint is accepted solely because a marker reached a drawn tip.
  if (grading && !checkFixedPointGrading(rep, grading).passes) throw new Error('Invalid fixed-point grading.');
  return { rep, grading, view };
}
