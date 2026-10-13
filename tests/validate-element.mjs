// validate-element.mjs — Node battery for assets/js/ek-nakajima/element-view.js.
//
// Verifies the V1 weighted-flag identities (projector identity, Q_i projector
// decomposition, ordered spectrum, squared norm) and the V2 projection: exact
// triangle edge lengths in the rendered 3D coordinates, no NaN at the fixture,
// marker invariance under a line-vector phase, and finite markers.
//
// The fixture is the EXACT symmetric y=0 real-moment-map solution
//   u_i = sqrt(alpha) e1,
//   A_1 = [sqrt(g+a) e1, sqrt(g) e2],
//   A_2 = [sqrt(g+a) e2, sqrt(g) e3],
//   A_3 = [sqrt(g+a) e3, sqrt(g) e1],
//   levels = [[alpha, gamma]] * 3.
//
// Run from tests/ after the modules are copied next to this file (see run.sh):
//   node validate-element.mjs
import {
  NB,
  frob2,
  frobNorm,
  makeRep,
  matMul,
  matSub,
  matScale,
  realResidualNorm,
  complexResidualNorm,
} from "./core-math.js";
import { elementView } from "./element-view.js";

let pass = 0;
let fail = 0;
const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else {
    fail++;
    console.log(`  FAIL: ${name}${detail ? " :: " + detail : ""}`);
  }
}

const Z = (rows) => rows.map((r) => r.map((e) => (Array.isArray(e) ? e : [e, 0])));
const dotVec = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const normVec = (v) => Math.hypot(...v);
const subVec = (a, b) => a.map((x, i) => x - b[i]);
const isFiniteVec = (v) => v.every((x) => Number.isFinite(x));
const idemRes = (P) => frobNorm(matSub(matMul(P, P), P));

// Exact symmetric y=0 solution with scalar branch levels (alpha, gamma).
function symmetricFixture(alpha, gamma) {
  const sq = Math.sqrt;
  const a = [Z([[sq(alpha)], [0]]), Z([[sq(alpha)], [0]]), Z([[sq(alpha)], [0]])];
  const A1 = Z([[sq(gamma + alpha), 0], [0, sq(gamma)], [0, 0]]); // [sqrt(g+a)e1, sqrt(g)e2]
  const A2 = Z([[0, 0], [sq(gamma + alpha), 0], [0, sq(gamma)]]); // [sqrt(g+a)e2, sqrt(g)e3]
  const A3 = Z([[0, sq(gamma)], [0, 0], [sq(gamma + alpha), 0]]); // [sqrt(g+a)e3, sqrt(g)e1]
  const b = [Z([[0, 0]]), Z([[0, 0]]), Z([[0, 0]])];
  const B = [Z([[0, 0, 0], [0, 0, 0]]), Z([[0, 0, 0], [0, 0, 0]]), Z([[0, 0, 0], [0, 0, 0]])];
  return {
    rep: makeRep(a, [A1, A2, A3], b, B),
    levels: [[alpha, gamma], [alpha, gamma], [alpha, gamma]],
  };
}

const ALPHA = 1.3;
const GAMMA = 0.9;
const { rep, levels } = symmetricFixture(ALPHA, GAMMA);

// ---------------------------------------------------------------------------
// A. fixture sanity: solves the real equations, y = 0
// ---------------------------------------------------------------------------
{
  check("fixture: complex residual ~ 0", complexResidualNorm(rep) < 1e-12);
  check("fixture: real residual ~ 0", realResidualNorm(rep, levels) < 1e-12,
    `norm=${realResidualNorm(rep, levels)}`);
}

// ---------------------------------------------------------------------------
// B. V1 flag/projector/eigenvalue/norm identities (to ~1e-9)
// ---------------------------------------------------------------------------
{
  const view = elementView(rep, levels);
  check("V1: projector identity ||X X^* - (a Pi_L + g Pi_P)|| < 1e-9",
    view.residuals.projectorIdentity < 1e-9, `res=${view.residuals.projectorIdentity}`);
  check("V1: Q projector decomposition < 1e-9",
    view.residuals.QProjector < 1e-9, `res=${view.residuals.QProjector}`);
  check("V1: ordered eigenvalues identity < 1e-9",
    view.residuals.eigenvalue < 1e-9, `res=${view.residuals.eigenvalue}`);
  check("V1: ||Q_i||^2 = 2/3(a^2+ag+g^2) < 1e-9",
    view.residuals.normSq < 1e-9, `res=${view.residuals.normSq}`);

  // Each projector is Hermitian idempotent; q norm matches ||Q||_F.
  for (let i = 0; i < NB; i++) {
    const f = view.flags[i];
    check(`V1: Pi_L_${i} idempotent`, idemRes(f.Pi_L) < 1e-9, `res=${idemRes(f.Pi_L)}`);
    check(`V1: Pi_P_${i} idempotent`, idemRes(f.Pi_P) < 1e-9, `res=${idemRes(f.Pi_P)}`);
    check(`V1: q_${i} norm matches ||Q_${i}||_F`,
      close(Math.hypot(...f.q), Math.sqrt(frob2(f.Q)), 1e-9));
  }
}

// ---------------------------------------------------------------------------
// C. V2 triangle edge lengths are EXACT (frame contains the triangle plane)
// ---------------------------------------------------------------------------
{
  const view = elementView(rep, levels);
  const q1 = view.flags[0].q;
  const q2 = view.flags[1].q;

  // |p(q_1)| = ||q_1||
  const v1 = view.vertices[1];
  check("V2: |p(q_1)| = ||q_1|| (exact)", close(normVec(v1), normVec(q1), 1e-9),
    `${normVec(v1)} vs ${normVec(q1)}`);

  // |p(q_1+q_2) - p(q_1)| = |p(q_2)| = ||q_2||
  const e2 = subVec(view.vertices[2], view.vertices[1]);
  check("V2: |p(q_1+q_2) - p(q_1)| = ||q_2|| (exact)",
    close(normVec(e2), normVec(q2), 1e-9), `${normVec(e2)} vs ${normVec(q2)}`);

  // Third edge closes the triangle (vertex 0 recovers 0).
  check("V2: triangle closes at origin",
    isFiniteVec(view.vertices[0]) && view.vertices[0].every((x) => x === 0));

  // Frame orthonormality.
  const { e1, e2: f2, e3 } = view.frame;
  check("V2: frame orthonormal",
    close(dotVec(e1, e1), 1, 1e-12) && close(dotVec(f2, f2), 1, 1e-12) &&
    close(dotVec(e3, e3), 1, 1e-12) && close(dotVec(e1, f2), 0, 1e-12) &&
    close(dotVec(e1, e3), 0, 1e-12) && close(dotVec(f2, e3), 0, 1e-12));
}

// ---------------------------------------------------------------------------
// D. no NaN; markers finite; projection loss nonnegative
// ---------------------------------------------------------------------------
{
  const view = elementView(rep, levels, { cL: 0.5, cP: 0.5 });
  check("V2: no NaN in vertices", view.vertices.every(isFiniteVec));
  check("V2: no NaN in midpoints", view.midpoints.every(isFiniteVec));
  check("V2: line markers finite", view.markers.line.every(isFiniteVec));
  check("V2: plane markers finite", view.markers.plane.every(isFiniteVec));
  check("V2: projection loss nonnegative (line)",
    view.projectionLoss.line.every((x) => x >= -1e-9), JSON.stringify(view.projectionLoss.line));
  check("V2: projection loss nonnegative (plane)",
    view.projectionLoss.plane.every((x) => x >= -1e-9), JSON.stringify(view.projectionLoss.plane));
}

// ---------------------------------------------------------------------------
// E. marker invariance under a unit phase of ell_i = X_i u_i
// ---------------------------------------------------------------------------
{
  const base = elementView(rep, levels, { cL: 0.5, cP: 0.5 });
  const phase = [Math.cos(0.7), Math.sin(0.7)];
  const a2 = rep.a.map((ai) => matScale(ai, phase)); // u_i -> phase * u_i
  const rep2 = makeRep(a2, rep.A, rep.b, rep.B);
  const moved = elementView(rep2, levels, { cL: 0.5, cP: 0.5 });

  let dL = 0;
  let dm = 0;
  for (let i = 0; i < NB; i++) {
    dL = Math.max(dL, frobNorm(matSub(base.flags[i].Pi_L, moved.flags[i].Pi_L)));
    dm = Math.max(dm, normVec(subVec(base.markers.line[i], moved.markers.line[i])));
  }
  check("V2: Pi_L invariant under ell phase", dL < 1e-12, `d=${dL}`);
  check("V2: line marker invariant under ell phase", dm < 1e-12, `d=${dm}`);

  // q vectors (hence triangle) are unchanged: they depend on X only.
  const dq = Math.max(...base.flags.map((f, i) => normVec(subVec(f.q, moved.flags[i].q))));
  check("V2: triangle q_i invariant under ell phase", dq < 1e-15, `d=${dq}`);
}

// ---------------------------------------------------------------------------
console.log(`element-view: ${pass}/${pass + fail} checks passed`);
process.exit(fail === 0 ? 0 : 1);
