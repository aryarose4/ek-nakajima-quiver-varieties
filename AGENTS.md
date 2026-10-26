# AGENTS.md — E_k Nakajima Quiver Varieties (standalone repo)

This repository is the **source of truth** for the E_k (D4/E6/E7/E8) Nakajima
quiver-variety widget modules, the Node batteries, and the **E6 simulation
core**. A copy on the author's website is a downstream mirror.

## Read first

- Touching `sim/` → read **`sim/STATE.md`** first: frozen conventions, the exact
  certified fixture, verified/candidate/unsupported split, and the next task.
- The running work log is `journal/` (local, **untracked** — never commit it).

## Layout

- `sim/` — Python mathematical core for the E6 star-shaped simulator
  (`e6sim` package + `tests/`). Reference implementation; keep it decoupled
  from any UI. A browser JS port comes later.
- `assets/js/ek-nakajima/` — browser widget modules (dependency-free ES modules).
- `tests/` — Node batteries for the widget modules.
- `tools/build-single.mjs` — regenerates `ek-nakajima.html` from `index.html`.

## Commands

```
# Python core (run from sim/)
python -m pytest -q          # full suite

# Node widget batteries (devcontainer; Node is not on the host PATH)
bash tests/run.sh
```

Requirements for `sim/`: Python 3 with numpy, scipy, sympy, pytest.

## Rules

- Commit small, coherent changes at verified milestones. Before experimental
  changes, commit the current working result as a checkpoint so the experiment
  can be reverted separately. Commit only task-owned files, never unrelated
  user changes. Local commits do not authorize pushing or publishing.
- Separate **verified / candidate / unsupported** mathematics; never present an
  unverified result as certified. A small residual is not a proof.
- Keep conventions in `e6sim/conventions.py`; do not repair signs or factors of
  two in more than one place.
- Prefer small, targeted pytest runs while iterating and one full run at the
  end. Print norms/spectra, not raw matrices.
- This repo is **not to be published/pushed** unless the owner explicitly asks.
