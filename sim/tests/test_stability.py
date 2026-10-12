"""Milestone 1 tests: chart, exact stability certificate, rank 23, exceptional z."""

import numpy as np
import pytest
import sympy as sp

from e6sim.charts import (
    candidate_y0_chart,
    central_flags,
    dxdz,
    incidence_signature,
    x_gauge_action,
)
from e6sim.fixtures.certified_y0_chart import (
    CERTIFIED_LEVELS,
    CERTIFIED_Z,
    EXCEPTIONAL_Z,
    certified_fixture,
    certified_margins,
    dxdz_vector,
    gauge_action_matrix,
    stability_status,
)
from e6sim.moment_maps import complex_residual_norm
from e6sim.representation import Rep
from e6sim.stability import (
    class_margins,
    exceptional_z,
    incidence_pattern,
    is_stable,
    stability_weight,
)


# --- chart -----------------------------------------------------------------
def test_chart_complex_residual_zero_exact():
    rep, _, _ = certified_fixture()
    assert complex_residual_norm(rep) == pytest.approx(0.0, abs=1e-15)


def test_chart_complex_residual_zero_symbolic():
    z = sp.symbols("z")
    a, A, b, B = candidate_y0_chart(z)
    # all y vanish -> complex equations hold identically
    for i in range(3):
        assert sp.simplify(b[i] * a[i]) == sp.zeros(1, 1)
        assert sp.simplify(B[i] * A[i] - a[i] * b[i]) == sp.zeros(2, 2)
    center = sp.zeros(3, 3)
    for i in range(3):
        center += A[i] * B[i]
    assert sp.simplify(center) == sp.zeros(3, 3)


def test_flags_are_the_expected_lines_and_planes():
    z = sp.Rational(2)
    fl = central_flags(z)
    L, P = fl["L"], fl["P"]
    e = [sp.Matrix([1, 0, 0]), sp.Matrix([0, 1, 0]), sp.Matrix([0, 0, 1])]
    for i in range(3):
        assert L[i] == e[i]
        assert P[i].rank() == 2
    # P_3 is y - z x = 0
    for v in P[2].columnspace():
        assert sp.simplify(v[1] - z * v[0]) == 0


# --- stability certificate -------------------------------------------------
def test_certified_margins_exact_and_negative():
    margins = certified_margins()
    assert margins, "no margins recorded"
    for key, val in margins.items():
        assert isinstance(val, sp.Basic)
        assert bool(val < 0), (key, val)
    # tightest margin is -1 (axis L_3)
    assert max(margins.values()) == -1


def test_certified_fixture_shape_and_status():
    rep, levels, margins = certified_fixture()
    assert isinstance(rep, Rep)
    assert levels.shape == (3, 2)
    assert np.allclose(levels, np.array(CERTIFIED_LEVELS, dtype=float))
    assert set(margins) == set(certified_margins())
    ok, _ = stability_status()
    assert ok


def test_all_expected_incidence_classes_present():
    margins = certified_margins()
    # three axis lines, three pairwise-intersection lines, generic-in-plane
    # lines, a no-plane line; the three planes, three axis-span planes, a
    # generic plane.
    assert "line axis=L3 inPlanes=(3,)" in margins
    assert "line axis=- inPlanes=(1, 2)" in margins
    assert "line axis=- inPlanes=()" in margins
    assert "plane axes=(1, 2) equal=-" in margins
    assert "plane axes=() equal=-" in margins


def test_one_axis_plane_class_present():
    # A plane through exactly one axis that is NOT a P_i is a realizable
    # incidence pattern (e.g. <e1, e2+2e3>); it must be enumerated, with
    # exact weight alpha_i + sum(gamma) - (2/3)(A + 2G) = -5 here.
    margins = certified_margins()
    for i in (1, 2, 3):
        key = f"plane axes=({i},) equal=-"
        assert key in margins, key
        assert margins[key] == -5


def test_weight_matches_direct_formula():
    # recompute w(L_3) directly: alpha_3 + gamma_3 - (A/3 + 2G/3)
    margins = certified_margins()
    A = sum(a for a, g in CERTIFIED_LEVELS)
    G = sum(g for a, g in CERTIFIED_LEVELS)
    expected = sp.Rational(CERTIFIED_LEVELS[2][0] + CERTIFIED_LEVELS[2][1]) \
        - sp.Rational(A, 3) - sp.Rational(2 * G, 3)
    assert margins["line axis=L3 inPlanes=(3,)"] == expected == -1


def test_symmetric_levels_are_strictly_stable():
    # Equal levels are not on a wall here; exact certificate confirms it.
    z = sp.Rational(2)
    levels = ((1, 1), (1, 1), (1, 1))
    ok, margins = is_stable(z, levels)
    assert ok
    assert all(bool(v < 0) for v in margins.values())


def test_negative_level_can_destabilize():
    # A negative outer level is exactly where the maximal-subspace shortcut
    # is not claimed; it should be able to produce w >= 0.
    z = sp.Rational(2)
    levels = ((-5, 1), (-5, 1), (-5, 1))
    ok, margins = is_stable(z, levels)
    assert not ok


# --- gauge rank and dx/dz --------------------------------------------------
def test_x_gauge_action_shape_and_rank():
    M = gauge_action_matrix()
    assert M.shape == (24, 23)
    assert M.rank() == 23


def test_dxdz_not_in_gauge_image():
    M = gauge_action_matrix()
    d = dxdz_vector()
    assert M.row_join(d).rank() == 24  # strictly larger -> not in the image
    # dx/dz is the A_3 (2,2) entry
    assert list(d) == [0] * 21 + [1] + [0] * 2


def test_rank_is_generic_in_z():
    # rank 23 holds at a generic symbolic point too
    z = sp.symbols("z")
    M = x_gauge_action(z)
    assert M.rank() == 23


# --- exceptional z ---------------------------------------------------------
def test_exceptional_z_complete():
    exc = exceptional_z()
    assert sp.Integer(0) in exc
    assert sp.Integer(1) in exc
    assert sp.oo in exc
    assert EXCEPTIONAL_Z == exc


def test_incidence_changes_at_exceptional_values():
    base = incidence_signature(sp.Rational(2))
    assert incidence_signature(sp.Integer(0)) != base
    assert incidence_signature(sp.Integer(1)) != base
    # nearby non-exceptional points agree with the generic point
    assert incidence_signature(sp.Rational(3)) == base


def test_incidence_signature_captures_z0_and_z1():
    # z = 0: L_1 becomes contained in P_3.
    s0 = incidence_signature(sp.Integer(0))
    lp0 = s0[1]
    assert lp0[0 * 3 + 2] == 1  # L_1 subset P_3
    # z = 1: the three pairwise plane intersections collapse into one common
    # line (all three intersection directions lie in all three planes).
    z = sp.Integer(1)
    n = [sp.Matrix([[0, -1, 1]]), sp.Matrix([[1, 0, -1]]),
         sp.Matrix([[-z, 1, 0]])]
    dirs = [n[0].cross(n[1]), n[0].cross(n[2]), n[1].cross(n[2])]
    for d in dirs:
        for nv in n:
            assert sp.simplify((nv * d.T)[0]) == 0
