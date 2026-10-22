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

> **Status.** The ALE core explorer and E6 flag-incidence view are integrated. The incidence view shows three marked projective lines, with hue for phase. Both views share their coordinates, with live complex x and y matrices above. It reads the candidate complex chart directly; it does not require a real moment-map solve or claim stability. The solver and older projection utilities remain available for mathematical validation.

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

The E6 incidence and moduli views appear together, with the complex arrow matrices above them. Shared controls use

$$z=\frac{r}{1-r}e^{i\theta},\qquad 0\leq r\leq1.$$

Thus `r=1` is infinity, and concurrency occurs at `r=1/2, theta=0`. Away from
the two endpoint attachments, the third branch uses
`A_3 = [e3, (1-r)e1 + r exp(i theta)e2]`. The restored `t` and `phi` controls set
`eta = t/(1-t) exp(i phi)`. Reverse arrows come from the exact M5 transverse
kernel: in the affine chart, `y = w Y(z)` with `w = (1-r)^2 eta`, transported
to the compact gauge. These representatives satisfy the complex moment-map
equations without real balancing and remain finite at both radial endpoints
for `t < 1`. At `t = 0` this is the previous zero-reverse-arrow chart.
The exact endpoint attachments use the stable replacement charts below.

The sliders snap to the three radial attachments and zero phase. The limit
buttons give one-sphere outward/inward navigation in the core portrait.
All E6 sphere intersections and exterior tips carry explicit C* grading
witnesses. Sphere radii, angles and the rendered motion remain schematic;
the implementation does not claim a global stable atlas. Unsupported charts clear
the matrix readout instead of leaving matrices from a different point visible.
The flag panel records the forward-arrow flags. Small nested rings beside each
point encode the three upper-triangular coefficients of `K_i=A_i B_i` in an
orthonormal flag basis: opacity encodes magnitude, and ticks encode complex
phase. These are display-basis coefficients, not complex-gauge invariants;
the canonical gauge reset at the limit may reset their phases. The full reverse
arrows remain visible in the matrix readout.

At the concurrency attachment (`r=1/2`, `theta=0`), the first outward limit
has a concrete E6 representation. Its next chart is obtained from the coupled
limit `z=1+v/lambda^2`, `w=lambda`, after a complex gauge change. Writing
`L=(1,1,1)`, `p_i=e_i-L/3`, and
`ell_1=(0,-1,1)`, `ell_2=(1,0,-1)`, `ell_3=(-1,1,0)`, its arrows are
`a_i=e1`, `A_i=[p_i,L]`, `b_i=(0,v)`, `B_i=[v L^T/3; ell_i]`.
The point `v=0` is the fixed-point limit; finite complex `v` extends beyond
that point. The E6 portrait places the single-sphere arm at this concurrency
attachment, with two spheres on each endpoint arm. The limit button enters
the outgoing paraboloid at the short arm's tip, rather than a second sphere.
The new chart satisfies the complex equations; stability throughout the chart
and the metric interpretation of its portrait coordinates are not certified.

The concurrency animation uses a projective change of display frame: its
marked points approach `p_i=e_i-L/3`, so all three become collinear while the
flag lines remain concurrent. A faint transversal marks this alignment.
Edge markers handle points outside the affine viewport. This is a gauge change
of the displayed flags, not additional motion in the moduli space. The outgoing
chart retains these flags while its reverse-arrow decorations change. No new
on-page announcements accompany the transition.
The outgoing coordinate has weight two under reverse-arrow scaling:
`v = (t/(1-t))^2 exp(2i phi)`. This preserves the original scaling/phase
meaning of the controls; the outgoing circle action has a half-turn stabilizer.

These charts do not yet represent every complex-gauge class. In particular,
generic fixed `z` does not have a finite `w -> infinity` limit: the invariant
`trace((A_1 B_1)^2 A_2 B_2) = -w^3 z^2 (z-1)^2` diverges away from
`z=0,1`. Additional exceptional charts and their stability/overlap checks
are needed before claiming complete coverage. E7/E8 remain portrait-only.
At the frozen levels `alpha=(3,3,3)`, `gamma=(1,2,3)`, the old compact endpoint
families are unstable for every reverse-arrow amplitude: the central plane
`P_3` defines a subrepresentation with middle dimensions `(1,1,2)` and outer
dimensions `(1,0,1)` at zero or `(0,1,1)` at infinity. Its King weight is
`6+1+2+6-(2/3)*21=1`. The reverse arrows preserve this subrepresentation.
Those old endpoint representatives are not used for further limits. The widget uses the nearby regular levels `gamma=(1,21/10,3)`;
the frozen solver fixture is unchanged. The full bounded-real-root audit finds
four zero-weight roots (two complementary pairs) at the frozen levels and none
at the display levels. The smallest absolute root weight there is `1/15`.

For the zero-side long arm, the replacement chart has
`A1=[e1,e2+z e3]`, `A2=[e2,e1+e3]`, `A3=[e3,e1+e2]` and `a_i=e1`.
Its reverse arrows and the full overlap gauges are in `branch-charts.js`.
The successive coordinates are `(z,w)`, `(s,v)=(1/w,z w^2)`, and
`(h,p)=(1/v,s v^2)`. Their C* weights are `(0,1)`, `(-1,2)`, `(-2,3)`.
The other arm swaps branches 2/3 and central coordinates 2/3, with signed fiber coordinates as specified in `branch-charts.js`. At the infinity pole its local phase is `phi+2 theta`. The second
sphere uses `v=(t/(1-t))^2 exp(2i phi)` and the outgoing tip chart uses
`p=(t/(1-t))^3 exp(3i phi)`. The limit buttons identify precisely equal
canonical matrices at each tip/base. The first climb adds a point-line
incidence; the second completes the coordinate triangle of flag lines.

Fixedness is tested on all arrows: in a supplied integer grading, each
forward arrow has target weight minus source weight zero, and each reverse
arrow has difference one. Hence the grading gauge sends `(x,y)` to
`(x,lambda*y)` for every nonzero complex `lambda`. Zero-section points use
the trivial grading. Stability is a separate King-weight check; fixedness
alone does not establish a valid moduli point.
`stability-certificates.js` independently checks all eight canonical
attachment/intersection/tip configurations using exact integer minors and
rational King weights. Every maximal weight is strictly negative at the
display levels. The old fixture's semistable points are detected by exact
zero weights. This endpoint certification does not claim complete coverage
or stability of every point in every two-dimensional chart.

The central chart now fixes the three marked points and lines 2/3, while line 1
moves with `A1=[e1,(1-r)e2+r exp(i theta)e3]`. The same polynomial representative
is used at both radial endpoints. Exact incidence-stratum certificates verify
stability of the entire central sphere in the display chamber. A continuous
diagonal display gauge also matches the long-arm frames at finite transverse
amplitude; line hue records phase and fades at the poles. The separate
concurrency animation still selects a special display frame at its attachment.
The E7/E8 tabs retain their moduli portraits; complex representatives are currently E6-only.


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
| `assets/js/ek-nakajima/chart.js` | Candidate affine/compact charts and the exact M5 reverse-arrow extension controlled by t and phi. |
| `assets/js/ek-nakajima/limit-chart.js` | Gauge-renormalized concurrency limit and its complex one-parameter family. |
| `assets/js/ek-nakajima/branch-charts.js` | Stable endpoint replacements and two exact overlap charts on each long E6 arm. |
| `assets/js/ek-nakajima/fixed-point.js` | Integer grading witnesses and infinitesimal obstructions to C* fixedness. |
| `assets/js/ek-nakajima/e6-levels.js` | Separate display/fixture levels and the full bounded-real-root wall audit. |
| `assets/js/ek-nakajima/e6-atlas.js` | Pure control-to-chart dispatch, including fixedness guards at intersections and tips. |
| `assets/js/ek-nakajima/stability-certificates.js` | Exact rational King certificates for all eight canonical attachment/intersection/tip fixtures. |
| `assets/js/ek-nakajima/element-model.js` | Pure driver: `solveElement(r, θ, levels, {initialLogGauge})` = chart -> warm-started solve -> element view. |
| `assets/js/ek-nakajima/element-screen.js` | Legacy orthographic projection utility, retained for validation. |
| `assets/js/ek-nakajima/flag-incidence.js` | Complex flag extraction, numerical incidence classification, and real schematic layout. |
| `assets/js/ek-nakajima/flag-diagram.js` | Continuous chart geometry and relative line phase, with reconstruction of the complex parameter from the decorated diagram. |
| `assets/js/ek-nakajima/element-render.js` | Continuous flag diagram with line hue for relative phase. |
| `assets/js/ek-nakajima/quiver-data.js` | Per-type affine ADE data: nodes, edges, marks $=\delta$, junction, framing nodes, the finite core tree, and `validateQuiver`. |
| `assets/js/ek-nakajima/tree-embed.js` | Shared pure radial tidy-tree embedding used by both layout layers. |
| `assets/js/ek-nakajima/core-layout.js` | Quiet core-tree layout: a non-overlapping externally-tangent radial packing of the finite Dynkin core. |
| `assets/js/ek-nakajima/diagram-layout.js` | Full affine-diagram layout (tree/cycle). Validated; not currently imported by the widget. |
| `assets/js/ek-nakajima/core-view.js` | The generalized side view: `buildSideLayout`, the Node-safe `coreFlow`, and the browser `makeCoreView` three.js factory. |
| `assets/js/ek-nakajima/representation-readout.js` | Live complex x and y arrow matrices for all three branches. |
| `assets/js/ek-nakajima/widget.js` | Simultaneous incidence and moduli views with shared compact coordinates. |
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
