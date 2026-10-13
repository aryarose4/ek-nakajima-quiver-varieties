<div align="center">

<img src="assets/img/Star-Shaped_Quiver.jpg" alt="Affine ADE quiver diagram" width="160">

# E_k Nakajima Quiver Varieties

**An interactive explorer of the four-dimensional Nakajima quiver varieties of affine ADE type — the ALE gravitational instantons.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-node%20batteries-informational.svg)](#tests)

</div>

This repository is a browser-native explorer for the **Nakajima quiver
varieties** $M(v,w)$ attached to the affine ADE quivers of type E6, E7 and E8,
in the case where the dimension vector is the null root $v=\delta$ and the
framing is one-dimensional. The null-root property forces
$\dim_{\mathbb H}M(v,w)=1$, so these are the **four-dimensional ALE
gravitational instantons** — the minimal resolutions of $\mathbb C^2/\Gamma$
for the binary tetrahedral (E6), octahedral (E7) and icosahedral (E8)
subgroups of $\mathrm{SU}(2)$.

> **Status.** This is a work in progress. The settled, solver-free geometry
> layers and the ALE **core / space view** are in place. A first **triangle
> visualizer** (`triangle.html`, visualizer milestones V0–V2) is now testable:
> it renders the exact closed triangle of the solved, at-level E6 $y=0$
> representative in the eight-dimensional traceless-Hermitian space, with
> projected flag decorations (the $su(3)$ / generalized-hyperpolygon picture).
> The **single-element view** for the higher-rank core and a browser-side solver
> remain open; the mathematical core is the verify-first Python reference
> implementation in `sim/`. The type-D4 member of the family is the
> [hyperpolygon](https://github.com/aryarose4/hyperpolygon-moduli-spaces), whose
> interaction is the template used here.

## Try it

| | |
|---|---|
| **Local** | `python3 -m http.server 8000` in this folder, then open <http://localhost:8000/> |
| **Triangle view** | <http://localhost:8000/triangle.html> — the E6 triangle visualizer (after starting the server above) |
| **Single file** | `node tools/build-single.mjs` generates `ek-nakajima.html` (not committed) — everything inlined, works offline when opened over HTTP |

The widget is an ES-module app, so it must be served over **HTTP**, not opened
directly as a `file://` path. The single-file build inlines all modules, but
browsers still restrict module scripts on `file://`.

## What you are looking at

Take the **affine ADE quiver** $\widehat Q$ whose underlying graph is the
affine Dynkin diagram of type E6, E7 or E8, with dimension vector
$v=\delta$ (the marks) and a one-dimensional framing $w=e_j$ at a node of
mark $1$. Deleting the **affine node** leaves the **finite** Dynkin tree,
whose nodes index the exceptional $\mathbb P^1$'s of the **core** of the
ALE space:

- six spheres for E6 (a trivalent junction),
- seven for E7,
- eight for E8;

meeting transversally at points dual to the Dynkin edges, with the deleted
affine node the noncompact end where the framing lives.

The widget draws this core as an externally tangent packing of spheres and
lets you move a marker through the normal directions with the same
$(r,\theta,t,\phi)$ interaction as the hyperpolygon side view. Tabs switch
between E6, E7 and E8.

## Triangle visualizer (E6, V0–V2)

`triangle.html` renders the **exact closed triangle** of the solved, at-level
$y=0$ E6 representative. At $y=0$ the three traceless Hermitian central moment
maps are

$$
Q_i=\alpha_i\!\left(\Pi_{L_i}-\tfrac{1}{3}I_3\right)
   +\gamma_i\!\left(\Pi_{P_i}-\tfrac{2}{3}I_3\right),
\qquad \sum_i Q_i=0,
$$

where $L_i=\operatorname{im}(A_i a_i)$ is a line and $P_i=\operatorname{im}(A_i)$
a plane in $\mathbb C^3$ (rank 1 and rank 2, so $L_i\subset P_i$). The edge
vectors $q_i$ are the coordinates of $Q_i$ in a Frobenius-orthonormal basis of
traceless Hermitian $3\times 3$ matrices; they close, and the viewing frame's
first two directions lie in the triangle plane, so the drawn triangle preserves
the true edge lengths and angles up to roundoff.

At fixed levels the triangle is **rigid up to Euclidean rotation**: the moduli
vary through the flag *decorations* (the line/plane markers), not the Euclidean
shape. This is the $\mathfrak{su}(3)$ / generalized-hyperpolygon picture of
Rayan–Schaposnik.

The geometry is **solved**, not chart-based. The certified chart's own
orthogonal projectors are *not* the physical flags — they are not equivariant
under the solver's non-unitary complex gauge, so they neither close
($\lVert\sum_i Q_i\rVert\sim 3$) nor give the correct pairwise traces. The
browser instead reads the solved, at-level bundle
`assets/data/e6-triangle-solved.json` produced by the simulation core (`sim/`),
which solves the real moment map and aligns the sweep by the central $U(3)$.
Flag markers are projected display data and do not lie on the triangle.

## The mathematics

The construction (Nakajima '94) is the quiver analogue of the Kronheimer
ALE construction. With $v=\delta$ the null root, so that
$2\delta_i=\sum_{j\sim i}\delta_j$, the dimension formula gives

$$
\dim_{\mathbb H}M(\delta,w)=\sum_i \delta_i w_i=1
$$

for any framing $w=e_j$ at a mark-$1$ node, hence $M(\delta,w)$ is four real
dimensions. It carries a hyperkähler metric and is the minimal resolution
$\widetilde{\mathbb C^2/\Gamma}$ of the corresponding Kleinian singularity.

## Architecture

The geometry layers are dependency-free ES-module JavaScript; the display
layer uses a vendored three.js only.

| Module | Role |
|---|---|
| `assets/js/ek-nakajima/quiver-data.js` | Per-type affine ADE data: nodes, edges, marks $=\delta$, junction, framing nodes, the finite core tree, and `validateQuiver`. |
| `assets/js/ek-nakajima/tree-embed.js` | Shared pure radial tidy-tree embedding used by both layout layers. |
| `assets/js/ek-nakajima/core-layout.js` | Quiet core-tree layout: a non-overlapping externally-tangent radial packing of the finite Dynkin core. |
| `assets/js/ek-nakajima/diagram-layout.js` | Full affine-diagram layout (tree/cycle). Validated; not currently imported by the widget. |
| `assets/js/ek-nakajima/core-view.js` | The generalized side view: `buildSideLayout`, the Node-safe `coreFlow`, and the browser `makeCoreView` three.js factory. |
| `assets/js/ek-nakajima/widget.js` | DOM, the E6/E7/E8 tabs, the $(r,\theta,t,\phi)$ sliders and the ALE core viewport. |
| `assets/js/ek-nakajima/triangle-geometry.js` | Pure E6 triangle geometry: loads the solved bundle, projects the $q_i$ into the viewing frame, builds vertices and flag markers. |
| `assets/js/ek-nakajima/triangle-view.js` | The `triangle.html` three.js renderer (closed triangle, flag markers, OrbitControls). |
| `assets/data/e6-triangle-solved.json` | Solved, at-level E6 geometry bundle (schema `e6-triangle-solved/1`), written by `sim/tools/export_triangle_solved.py`. |
| `assets/js/hyperpolygon/sideview-shared.js` | The flow constants and vector helpers shared with the hyperpolygon side view (imported unchanged). |
| `assets/js/ek-nakajima/lib/` | Vendored `three.min.js` and `OrbitControls.js`. |

The E6 **mathematical core** is a separate, verify-first Python reference
implementation in `sim/` (NumPy/SciPy/SymPy), deliberately decoupled from the
UI: the moment-map conventions, the real-moment-map solver, the certified
fixture, the chart atlas, and the solved-geometry bundle. Its test suite
(`python -m pytest -q` from `sim/`) is the source of truth for the numbers the
browser displays.

## Tests

The repository ships the Node validation harness for the geometry layers. It
has no dependencies and runs on plain Node.

```bash
bash tests/run.sh    # validate-data, validate-layout, validate-diagram, triangle-geometry
```

The batteries assert the arithmetic that makes the views trustworthy: the
affine Cartan condition, the unique junction and finite-tree structure, the
dimension count $\dim_{\mathbb H}M=1$ at every framing node, external
tangency of the whole core packing, the diagram layout invariants, and — for
the triangle — that the projected edge lengths and closure match the solved
bundle. See [`tests/README.md`](tests/README.md).

### Single-file build

```bash
node tools/build-single.mjs   # regenerates ek-nakajima.html from index.html
```

## Updates

This repository is intended to be the **source of truth** for the E_k
Nakajima widget modules and batteries (mirroring the hyperpolygon setup). A
copy on the author's personal website is a downstream mirror synced from
here.

## Author

**Arya Yae** — questions, corrections and pull requests welcome.

## License

Released under the [MIT License](LICENSE). The bundled `three.js` is under its
own MIT license (see `assets/js/ek-nakajima/lib/`).
