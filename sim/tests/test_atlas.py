"""Milestone 4 tests: north/south atlas, overlap, poles, and honest coverage.

All exact statements use SymPy; the real-moment-map solves use
:mod:`e6sim.hermitian_solver` and are compared modulo compact gauge through
central ``Q_i`` spectra.  Points that are genuinely unstable are *recorded*
(failed solves plus an exact positive King weight), never relabelled as stable.
"""

import numpy as np
import pytest
import sympy as sp

from e6sim import atlas as AT
from e6sim.charts import candidate_y0_chart, incidence_signature, subspace_contains
from e6sim.fixtures.certified_y0_chart import CERTIFIED_LEVELS
from e6sim.hermitian_solver import solve_real_moment_map
from e6sim.moment_maps import complex_residual_norm
from e6sim.stability import class_margins

LEVELS = CERTIFIED_LEVELS


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def _spectra(rep):
    out = []
    for i in range(3):
        M = rep.A[i] @ rep.A[i].conj().T - rep.B[i].conj().T @ rep.B[i]
        out.append(np.sort(np.linalg.eigvalsh(M - np.trace(M) / 3 * np.eye(3))))
    return np.array(out)


SIGMA = sp.Matrix([[0, 1, 0], [1, 0, 0], [0, 0, 1]])  # coordinate swap x <-> y
SIGMA_BRANCH = {1: 2, 2: 1, 3: 3}                      # branch relabelling


# --------------------------------------------------------------------------
# south chart and overlap identity
# --------------------------------------------------------------------------
def test_south_chart_complex_residual_zero_numeric():
    rep = AT.south_rep(sp.Rational(1, 2))
    assert complex_residual_norm(rep) == pytest.approx(0.0, abs=1e-15)


def test_south_chart_complex_residual_zero_symbolic():
    zeta = sp.symbols("zeta")
    a, A, b, B = AT.south_chart(zeta)
    for i in range(3):
        assert sp.simplify(b[i] * a[i]) == sp.zeros(1, 1)
        assert sp.simplify(B[i] * A[i] - a[i] * b[i]) == sp.zeros(2, 2)
    center = sp.zeros(3, 3)
    for i in range(3):
        center += A[i] * B[i]
    assert sp.simplify(center) == sp.zeros(3, 3)


def test_overlap_identity_exact():
    diffs = AT.overlap_identity()
    assert diffs, "no residuals produced"
    assert all(sp.simplify(d) == 0 for d in diffs)


def test_inverse_overlap_identity_exact():
    diffs = AT.inverse_overlap_identity()
    assert all(sp.simplify(d) == 0 for d in diffs)


def test_overlap_identity_specialises_to_finite_numbers():
    for val in (sp.Rational(1, 2), sp.Integer(2), sp.Integer(-3)):
        assert all(sp.simplify(d.subs(sp.Symbol("zeta"), val)) == 0
                   for d in AT.overlap_identity())


def test_coordinate_transition_roundtrip():
    z = sp.symbols("z")
    assert sp.simplify(AT.north_coordinate(AT.south_coordinate(z)) - z) == 0
    zeta = sp.symbols("zeta")
    assert sp.simplify(AT.south_coordinate(AT.north_coordinate(zeta)) - zeta) == 0
    # numeric round trip
    for val in (0.5, 2.0, -1.7 + 0.3j):
        assert abs(AT.north_coordinate(AT.south_coordinate(val)) - val) < 1e-14


# --------------------------------------------------------------------------
# south flags = sigma . (north flags), and stability reuse
# --------------------------------------------------------------------------
def test_south_flags_are_sigma_relabelled_north_flags():
    # sigma . (north flags at zeta) == south flags with branches 1<->2 swapped.
    for val in (sp.Rational(1, 2), sp.Integer(2), sp.Rational(-1, 3)):
        zz = sp.Rational(val)
        nf = AT.north_chart(zz)
        nL = [nf[1][i] * nf[0][i] for i in range(3)]     # north L_i
        nP = [nf[1][i] for i in range(3)]                # north P_i
        sf = AT.south_flags(zz)
        sL, sP = sf["L"], sf["P"]
        for i in range(3):
            j = SIGMA_BRANCH[i + 1] - 1
            # sigma(L^S_i) and L^N_{sigma(i)} span the same line
            assert subspace_contains(SIGMA * sL[i], nL[j])
            assert subspace_contains(nL[j], SIGMA * sL[i])
            # sigma(P^S_i) and P^N_{sigma(i)} span the same plane
            assert subspace_contains(SIGMA * sP[i], nP[j])
            assert subspace_contains(nP[j], SIGMA * sP[i])


def test_south_margins_multiset_matches_north_reciprocal():
    # south margins at zeta == multiset of class_margins(1/zeta) (flags coincide)
    for val in (sp.Rational(1, 2), sp.Integer(2), sp.Integer(1), sp.Rational(3)):
        south = AT.south_class_margins(val, LEVELS)
        north = class_margins(1 / val, LEVELS)
        assert sorted(sp.nsimplify(v) for v in south.values()) == \
               sorted(sp.nsimplify(v) for v in north.values())


def test_south_incidence_signature_matches_north_reciprocal():
    for val in (sp.Rational(1, 2), sp.Integer(2), sp.Rational(5, 3)):
        assert AT.south_incidence_signature(val) == incidence_signature(1 / val)


def test_south_chart_finite_at_pole():
    a, A, b, B = AT.south_chart(sp.Integer(0))
    assert sp.simplify(A[2]) == sp.Matrix([[0, 0], [0, 1], [1, 0]])
    # A_3 column space at the pole is <e_2, e_3>
    assert sp.simplify(A[2].col(0)) == sp.Matrix([0, 0, 1])
    assert sp.simplify(A[2].col(1)) == sp.Matrix([0, 1, 0])
    rep = AT.south_rep(sp.Integer(0))
    assert np.all(np.isfinite(rep.to_vector()))


# --------------------------------------------------------------------------
# endpoint classifications (task 3)
# --------------------------------------------------------------------------
def test_z1_is_stable_and_needs_no_alternate_chart():
    ok, margins = AT.north_stability(sp.Integer(1), LEVELS)
    assert ok
    assert all(bool(v < 0) for v in margins.values())
    assert AT.classify_margins(margins) == "stable"
    # the collapse of the three intersection lines is visible but harmless
    assert "line axis=- inPlanes=(1, 2, 3)" in margins
    assert margins["line axis=- inPlanes=(1, 2, 3)"] == -1


def test_z0_is_strictly_unstable_with_exact_weights():
    margins = AT.north_class_margins(sp.Integer(0), LEVELS)
    assert AT.classify_margins(margins) == "unstable"
    dest = AT.destabilising_classes(margins)
    # a wall class (exactly 0) and a strict destabiliser (+1)
    assert dest["line axis=L1 inPlanes=(1, 3)"] == 0
    assert dest["plane axes=(1, 3) equal=P3"] == 1


def test_pole_is_strictly_unstable_with_exact_weights():
    margins = AT.south_class_margins(sp.Integer(0), LEVELS)
    assert AT.classify_margins(margins) == "unstable"
    dest = AT.destabilising_classes(margins)
    # in the south frame: the line L_2 and the plane P_3 = <e_2,e_3>
    assert dest["line axis=L2 inPlanes=(2, 3)"] == 1
    assert dest["plane axes=(2, 3) equal=P3"] == 1


def test_pole_margins_equal_sigma_swapped_north_zero():
    # exact proof-by-reuse: south pole multiset == class_margins(0, swap12(levels))
    pole = AT.south_class_margins(sp.Integer(0), LEVELS)
    swapped = class_margins(sp.Integer(0), AT.swap_branches_12(LEVELS))
    assert sorted(sp.nsimplify(v) for v in pole.values()) == \
           sorted(sp.nsimplify(v) for v in swapped.values())
    # and the explicit flag-based signature at the pole is the expected one
    assert AT.pole_incidence_signature() == AT.south_incidence_signature(sp.Integer(0))


def test_endpoint_records_shape_and_verdicts():
    records = {r["name"]: r for r in AT.endpoint_records(LEVELS)}
    assert records["z=1"]["verdict"] == "stable"
    assert records["z=0"]["verdict"] == "unstable"
    assert records["z=infinity (pole)"]["verdict"] == "unstable"
    for r in records.values():
        assert r["signature"] is not None
        assert "margins" in r


def test_coverage_is_partial_not_full_sphere():
    cov = AT.coverage_verdict(LEVELS)
    assert cov["verdict"] == "partial"
    assert cov["z1_stable"] is True
    names = {u["name"] for u in cov["unstable_points"]}
    assert names == {"z=0", "z=infinity"}
    assert "open" in cov and cov["open"]


def test_stability_is_gauge_invariant_at_pole():
    # Any gauge maps the flags by a common invertible g, so L_2 subset P_3
    # persists: the +1 weight cannot be repaired by changing chart/gauge.
    rng = np.random.default_rng(3)
    rep = AT.south_rep(sp.Integer(0))
    g = rng.normal(size=(3, 3)) + 1j * rng.normal(size=(3, 3)) + 3 * np.eye(3)
    g = g / np.linalg.det(g) ** (1 / 3)
    h = [np.eye(2) + 0.4 * (rng.normal(size=(2, 2)) + 1j * rng.normal(size=(2, 2)))
         for _ in range(3)]
    q = [np.array([[1.0 + 0.3 * (rng.normal() + 1j * rng.normal())]])
         for _ in range(3)]
    gout = rep.gauge(g, h, q)
    # L_2 = col(A_2 a_2),  P_3 = col(A_3)
    L2 = gout.A[1] @ gout.a[1]
    P3 = gout.A[2]
    assert np.linalg.matrix_rank(P3) == 2
    assert np.linalg.matrix_rank(np.hstack([P3, L2])) == 2  # L_2 still inside P_3


# --------------------------------------------------------------------------
# pole approach direction (task 4)
# --------------------------------------------------------------------------
def test_pole_limit_independent_of_theta():
    base = np.array(AT.south_chart(sp.Integer(0))[1][2].tolist(), dtype=complex)
    for phi in (0.0, 0.7, np.pi / 2, np.pi, -1.1):
        zeta = 1e-6 * np.exp(1j * phi)
        A3 = np.array(AT.south_chart(zeta)[1][2].tolist(), dtype=complex)
        assert np.max(np.abs(A3 - base)) < 1e-5
    # but the gauge making the north representative finite depends on the
    # approach direction: its branch-3 block is diag(1, 1/zeta).
    g1 = AT.overlap_gauge_numeric(1e-3 * np.exp(1j * 0.3))["middle"][2]
    g2 = AT.overlap_gauge_numeric(1e-3 * np.exp(1j * 2.0))["middle"][2]
    assert abs(g1[1, 1] - g2[1, 1]) > 1.0


# --------------------------------------------------------------------------
# real solves: overlap agreement modulo compact gauge (task 5)
# --------------------------------------------------------------------------
def test_solve_overlap_both_sides_agree_modulo_gauge():
    repN = AT.north_rep(sp.Integer(2))          # z = 2
    repS = AT.south_rep(sp.Rational(1, 2))      # zeta = 1/2  (same orbit)
    resN = solve_real_moment_map(repN, LEVELS)
    resS = solve_real_moment_map(repS, LEVELS)
    assert resN.success and resS.success
    assert resN.residuals["real_norm"] < 1e-8
    assert resS.residuals["real_norm"] < 1e-8
    assert np.allclose(_spectra(resN.solved_rep), _spectra(resS.solved_rep),
                       atol=1e-6)


def test_solver_behavior_at_exceptional_points():
    # z = 1 is stable: the north chart solves directly.
    res1 = solve_real_moment_map(AT.north_rep(sp.Integer(1)), LEVELS)
    assert res1.success

    # z = 0 and the pole are strictly unstable (exact +1 weight): by
    # Kempf-Ness no positive gauge can reach the level, so the solve must fail.
    # The failure is *consistent with* the instability; the proof is the weight.
    for rep, tag in ((AT.north_rep(sp.Integer(0)), "z=0"),
                     (AT.south_rep(sp.Integer(0)), "pole")):
        res = solve_real_moment_map(rep, LEVELS)
        assert res.success is False, tag
        assert res.residuals["real_norm"] > 1e-2, tag
    # the north chart has no finite representative at the pole at all
    assert sp.oo in AT.atlas_entries(LEVELS)[0]["excluded"]
