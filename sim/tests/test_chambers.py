"""Milestone 6 tests: exact wall arrangement in the six level coordinates."""

import sympy as sp

from e6sim.chambers import (
    ALPHA,
    GAMMA,
    LEVEL_SYMBOLS,
    chambers,
    classify_levels,
    generic_z_values,
    stable_chambers,
    wall_form_dict,
    wall_forms,
    wall_forms_agree,
)
from e6sim.fixtures.certified_y0_chart import CERTIFIED_LEVELS, CERTIFIED_Z
from e6sim.stability import class_margins, is_stable

Z2 = sp.Rational(2)
Z5 = sp.Rational(5, 2)


def _coeff_key(form):
    return tuple(sp.Poly(form, LEVEL_SYMBOLS).coeff_monomial(s) for s in LEVEL_SYMBOLS)


def _fixture_signs():
    mapping = {}
    for i in range(3):
        mapping[ALPHA[i]] = sp.sympify(CERTIFIED_LEVELS[i][0])
        mapping[GAMMA[i]] = sp.sympify(CERTIFIED_LEVELS[i][1])
    return tuple(int(sp.sign(form.subs(mapping))) for _, form in wall_forms())


# --- wall forms ------------------------------------------------------------
def test_wall_form_count_and_distinctness():
    forms = wall_forms()
    assert len(forms) == 20
    # Forms are primitive integer vectors; distinct keys therefore means no two
    # are positive multiples of one another (dedup up to positive scaling).
    keys = [_coeff_key(f) for _, f in forms]
    for key in keys:
        assert any(c != 0 for c in key)
    assert len(set(keys)) == len(keys)


def test_wall_forms_are_linear_in_the_six_symbols():
    for _, form in wall_forms():
        poly = sp.Poly(form, LEVEL_SYMBOLS)
        assert poly.total_degree() == 1
        assert poly.coeff_monomial(1) == 0  # homogeneous: no constant term


def test_wall_forms_match_class_margins_up_to_positive_scaling():
    sym_levels = [[ALPHA[i], GAMMA[i]] for i in range(3)]
    margins = class_margins(Z2, sym_levels)
    forms = dict(wall_forms())
    assert set(forms) <= set(margins)
    for label, form in forms.items():
        ref = sp.expand(margins[label])
        ratio = sp.simplify(form / ref)
        assert ratio.is_number and ratio > 0, (label, ratio)


def test_wall_forms_invariant_across_generic_z():
    assert wall_forms_agree()
    assert wall_forms_agree([Z2, Z5])
    # explicit set comparison at two generic points
    a = sorted(_coeff_key(f) for _, f in wall_forms(Z2))
    b = sorted(_coeff_key(f) for _, f in wall_forms(Z5))
    assert a == b
    # all default witnesses are generic (away from {0, 1, infinity})
    for z in generic_z_values():
        assert z not in (sp.Integer(0), sp.Integer(1))


# --- classification --------------------------------------------------------
def test_certified_fixture_is_interior_and_stable():
    r = classify_levels(Z2, CERTIFIED_LEVELS)
    assert r.status == "interior"
    assert r.on_wall == ()
    assert r.positive == ()
    assert r.stable is True
    # definitive verdict agrees with is_stable
    assert is_stable(Z2, CERTIFIED_LEVELS)[0] is True


def test_equal_levels_lie_on_a_wall():
    # alpha_i = gamma_i = (2, 1, 1): the fully "diagonal" level choice that
    # stability.py warns may lie on a wall.  It lies on the intersection of the
    # line wall w(L_1) and the plane wall w(P_1); verify both forms vanish.
    levels = ((2, 2), (1, 1), (1, 1))
    r = classify_levels(Z2, levels)
    assert r.status == "wall"
    assert r.positive == ()
    assert r.stable is False
    assert "line axis=L1 inPlanes=(1,)" in r.on_wall
    assert "plane axes=(1,) equal=P1" in r.on_wall
    mapping = {ALPHA[0]: 2, ALPHA[1]: 1, ALPHA[2]: 1,
               GAMMA[0]: 2, GAMMA[1]: 1, GAMMA[2]: 1}
    for label in r.on_wall:
        assert wall_form_dict(Z2)[label].subs(mapping) == 0
    # a genuinely diagonal point off every wall is strictly stable
    ok, _ = is_stable(Z2, ((1, 1), (1, 1), (1, 1)))
    assert ok


def test_negative_levels_can_be_flagged_unstable():
    r = classify_levels(Z2, ((-5, 1), (-5, 1), (-5, 1)))
    assert r.status == "unstable"
    assert r.positive
    assert r.stable is False


# --- chambers --------------------------------------------------------------
def test_chambers_are_certified_and_exact():
    ch = chambers()
    assert len(ch) == 64
    seen_signs = set()
    for c in ch:
        assert c.signs not in seen_signs
        seen_signs.add(c.signs)
        # exact positive rational sample
        for v in c.sample:
            assert isinstance(v, sp.Rational)
            assert v > 0
        # exact strict interior: every wall sign matched by the sample
        for sign, (_, form) in zip(c.signs, wall_forms()):
            val = form.subs({LEVEL_SYMBOLS[k]: c.sample[k] for k in range(6)})
            assert sp.sign(val) == sign
        # margins recomputed through the definitive class enumeration
        assert set(c.margins) == set(class_margins(Z2, [[c.sample[i], c.sample[3 + i]]
                                                        for i in range(3)]))


def test_unique_stable_chamber_certified():
    sc = stable_chambers()
    assert len(sc) == 1
    c = sc[0]
    assert c.stable is True
    for v in c.margins.values():
        assert bool(sp.simplify(v) < 0)
    # the all-negative sign vector is the stable chamber
    assert all(s == -1 for s in c.signs)


def test_fixture_lands_in_the_verified_stable_chamber():
    signs = _fixture_signs()
    ch = chambers()
    match = [c for c in ch if c.signs == signs]
    assert len(match) == 1
    assert match[0].stable is True
    assert match[0] == stable_chambers()[0]


def test_chamber_enumeration_is_z_independent():
    # The wall arrangement (and hence its chamber count) is z-independent on the
    # generic locus; checked cheaply via the wall-form sets rather than by
    # re-running the full (expensive) LP enumeration at a second z.
    assert wall_forms_agree([Z2, Z5])
    assert len(chambers(Z2)) == 64
