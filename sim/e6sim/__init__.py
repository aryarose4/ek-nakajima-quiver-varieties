"""E6 star-shaped Nakajima quiver variety: verification-first simulation core.

This package implements the mathematical core described in
``E6_Quiver_Simulation_Milestones.md`` (milestones 0-2 at present).  It is
deliberately decoupled from any UI framework.

The E6 model here is the *star-shaped* quiver with a common central space
``C^3`` and three branches ``C^1 -> C^2 -> C^3``.  The branch count and the
central rank match ``r_star = 3`` for E6 in the affine-ADE family.
"""

from .conventions import (  # noqa: F401
    NB,
    N_CENTER,
    N_MIDDLE,
    N_OUTER,
    traceless,
    traceless_hermitian_basis,
    hermitian_basis,
    pack_hermitian,
    unpack_hermitian,
    beta_to_level,
    level_to_beta,
)
from .representation import Rep  # noqa: F401
from .hermitian_solver import SolveResult, solve_real_moment_map  # noqa: F401
from .continuation import (  # noqa: F401
    H_to_log_gauge,
    continue_path,
    log_gauge_to_H,
    transport_seed,
)
from .charts import (  # noqa: F401
    candidate_y0_chart,
    central_flags,
    dxdz,
    x_gauge_action,
)
from .stability import class_margins, exceptional_z, is_stable  # noqa: F401
from .geometry import extract_geometry  # noqa: F401
from .fixtures import symmetric_y0_fixture  # noqa: F401

__all__ = [
    "NB",
    "N_CENTER",
    "N_MIDDLE",
    "N_OUTER",
    "traceless",
    "traceless_hermitian_basis",
    "hermitian_basis",
    "pack_hermitian",
    "unpack_hermitian",
    "beta_to_level",
    "level_to_beta",
    "Rep",
    "SolveResult",
    "solve_real_moment_map",
    "H_to_log_gauge",
    "log_gauge_to_H",
    "transport_seed",
    "continue_path",
    "candidate_y0_chart",
    "central_flags",
    "x_gauge_action",
    "dxdz",
    "class_margins",
    "is_stable",
    "exceptional_z",
    "extract_geometry",
    "symmetric_y0_fixture",
]

__version__ = "0.1.0"
