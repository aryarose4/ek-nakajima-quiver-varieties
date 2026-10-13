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

> **Status.** This is a work in progress. The settled geometry layers, the ALE
> **core / space view**, and — newly — the **verified mathematics of the
> single-element view** are in place: the E6 real moment-map solver, the
> Milestone-0 core, and the projected su(3) "triangle + flag" element view all
> exist as dependency-free ES modules with Node batteries (`core-math.js` 40,
> `solver.js` 35, `element-view.js` 28 checks). What remains is the **widget
> integration**: driving these modules live from the $(r,\theta)$ controls and
> rendering the element panel — the analogue of the hyperpolygon's live polygon
> view. The type-D4 member of the family is the
> [hyperpolygon](https://github.com/aryarose4/hyperpolygon-moduli-spaces),
> whose interaction is the template used here.

## Try it

| | |
|---|---|
| **Single file** | Download [`ek-nakajima.html`](ek-nakajima.html) — everything inlined, works offline when opened over HTTP |
| **Local** | `python3 -m http.server 8000` in this folder, then open <http://localhost:8000/> |

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
| `assets/js/ek-nakajima/core-math.js` | Frozen Milestone-0 core ported to JS: dimensions, Hermitian bases, complex/unitary gauge, complex/real moment maps, the 23-coordinate packing, and the V0/V5 geometry. |
| `assets/js/ek-nakajima/solver.js` | The Milestone-2 positive-Hermitian-gauge real-moment-map solver (trust-region LM, Hermitian `expm`), ported from the Python reference. |
| `assets/js/ek-nakajima/element-view.js` | V2: the weighted-flag geometry at `y=0` and its projected su(3) "triangle + flag marker" display data. |
| `assets/js/ek-nakajima/chart.js` | The candidate `y=0` chart `z = r e^{iθ}` and its rep, ported from the Python reference. |
| `assets/js/ek-nakajima/element-model.js` | Pure driver: `solveElement(r, θ, levels, {initialLogGauge})` = chart -> warm-started solve -> element view. |
| `assets/js/ek-nakajima/element-screen.js` | Pure orthographic camera + projection (`elementScreen`) used by the browser renderer. |
| `assets/js/ek-nakajima/element-render.js` | Browser canvas renderer for the single-element view (orbit, zoom, themes). |
| `assets/js/ek-nakajima/quiver-data.js` | Per-type affine ADE data: nodes, edges, marks $=\delta$, junction, framing nodes, the finite core tree, and `validateQuiver`. |
| `assets/js/ek-nakajima/tree-embed.js` | Shared pure radial tidy-tree embedding used by both layout layers. |
| `assets/js/ek-nakajima/core-layout.js` | Quiet core-tree layout: a non-overlapping externally-tangent radial packing of the finite Dynkin core. |
| `assets/js/ek-nakajima/diagram-layout.js` | Full affine-diagram layout (tree/cycle). Validated; not currently imported by the widget. |
| `assets/js/ek-nakajima/core-view.js` | The generalized side view: `buildSideLayout`, the Node-safe `coreFlow`, and the browser `makeCoreView` three.js factory. |
| `assets/js/ek-nakajima/widget.js` | DOM, the E6/E7/E8 tabs, the ALE-core / Single-element view toggle, the $(r,\theta,t,\phi)$ and $(|z|,\theta)$ sliders. |
| `assets/js/hyperpolygon/sideview-shared.js` | The flow constants and vector helpers shared with the hyperpolygon side view (imported unchanged). |
| `assets/js/ek-nakajima/lib/` | Vendored `three.min.js` and `OrbitControls.js`. |

## Tests

The repository ships the Node validation harness for the geometry layers. It
has no dependencies and runs on plain Node.

```bash
bash tests/run.sh    # validate-data, validate-layout, validate-diagram
```

The batteries assert the arithmetic that makes the views trustworthy: the
affine Cartan condition, the unique junction and finite-tree structure, the
dimension count $\dim_{\mathbb H}M=1$ at every framing node, external
tangency of the whole core packing, and the diagram layout invariants. See
[`tests/README.md`](tests/README.md).

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
