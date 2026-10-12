"""Fixture sanity tests."""

import numpy as np
import pytest

from e6sim.fixtures import symmetric_y0_fixture
from e6sim.moment_maps import complex_residual_norm, real_maps, real_residual_norm


@pytest.mark.parametrize("alpha,gamma", [(1.0, 1.0), (1.5, 2.0), (0.7, 3.2)])
def test_symmetric_y0_is_exact_solution(alpha, gamma):
    rep, levels = symmetric_y0_fixture(alpha, gamma)
    assert complex_residual_norm(rep) == pytest.approx(0.0, abs=1e-12)
    assert real_residual_norm(rep, levels) == pytest.approx(0.0, abs=1e-12)


def test_symmetric_y0_central_closure():
    rep, _ = symmetric_y0_fixture(2.0, 1.0)
    maps = real_maps(rep)
    assert np.allclose(maps["center"], 0.0, atol=1e-12)
