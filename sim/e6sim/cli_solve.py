"""Command-line demo for the milestone-2 Hermitian gauge solver.

Run from ``sim/``::

    python -m e6sim.cli_solve

Solves the certified symmetric ``y = 0`` fixture from the identity gauge and
prints the solver status, the recomputed residual norms, and the iteration
count.
"""

from __future__ import annotations

import argparse

from .fixtures import symmetric_y0_fixture
from .hermitian_solver import solve_real_moment_map


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--alpha", type=float, default=1.0,
                        help="outer branch level (default 1.0)")
    parser.add_argument("--gamma", type=float, default=1.0,
                        help="middle branch level (default 1.0)")
    parser.add_argument("--max-nfev", type=int, default=400,
                        help="least-squares function-evaluation limit")
    args = parser.parse_args(argv)

    rep, levels = symmetric_y0_fixture(args.alpha, args.gamma)
    result = solve_real_moment_map(rep, levels, options={"max_nfev": args.max_nfev})

    d = result.diagnostics
    r = result.residuals
    print(f"fixture: symmetric_y0(alpha={args.alpha}, gamma={args.gamma})")
    print(f"success        : {result.success}")
    print(f"status         : {d['status']} ({d['message']})")
    print(f"real_norm      : {r['real_norm']:.3e}")
    print(f"real_rel       : {r['real_rel']:.3e}")
    print(f"complex_norm   : {r['complex_norm']:.3e}")
    print(f"det(H_center)  : {d['det_H_center'].real:.12f}")
    print(f"n_iter / nfev  : {d['n_iter']} / {d['nfev']}")
    print(f"max_log_gauge  : {d['max_log_gauge']:.3e}")
    return 0 if result.success else 1


if __name__ == "__main__":
    raise SystemExit(main())
