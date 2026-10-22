// ALE core side view for the E_k Nakajima widget (2026-10-01 rework).
//
// This is the "side-view" analogue of the hyperpolygon widget's
// assets/js/hyperpolygon/sideview.js, generalized from D4 (central sphere +
// three exterior spheres) to the finite Dynkin core tree of any type. Two
// layers, mirroring sideview.js:
//
//   * a pure, Node-safe geometry/flow layer (buildSideLayout + coreFlow),
//     consumed by the harness and by the widget; no THREE, no DOM;
//   * a browser-only makeCoreView(host, opts) three.js factory (returns null
//     without global THREE), which draws the spheres, the black dot, the
//     guide arc and the paraboloids, and owns the highlight/pan polish.
//
// SPIDER LAYOUT. The finite core tree of D4/E6/E7/E8 is a "spider": the
// junction (max-mark node) branches into three arms, and every arm is a
// simple chain of spheres. A_n is a path (the root splits it into one or two
// arms). buildSideLayout therefore places the root at the origin and each
// arm along a fixed ray: the k-th root child attaches at the root-sphere
// meridian point r_k (0, 1/2, 1 for three arms; 0, 1 for two; 1/2 for one),
// and the rest of the chain continues straight out along that ray at
// externally tangent distances r_parent + r_child. For D4 this reproduces
// the hyperpolygon portrait exactly (central sphere + south/east/north
// exterior spheres).
//
// CONTROLS. (r, theta, t, phi) keep their hyperpolygon meaning, but with no
// polygon to derive the dot from, they now directly place the black dot:
//   r in [0,1]   position along the root-sphere meridian (0 = south pole,
//                1/2 = equator, 1 = north pole); the arm attachments sit at
//                r = r_k, theta = 0;
//   theta        angle around the root sphere's axis (the +y meridian at 0);
//   t in [0,1]   climbs the CURRENT exterior sphere from its base (the
//                tangency with its inner neighbour) to its tip; t is LOCAL
//                to that one sphere, it never crosses a sphere boundary;
//   sphere       which exterior sphere of the selected arm the dot sits on
//                (0 = the root child, counting outward). The widget's
//                "lim t->inf" / "lim t->0" buttons step this by ONE sphere:
//                at a sphere's tip the outward button moves to the base of
//                the next sphere, at its base the inward button moves to the
//                tip of the previous one. Each stacked exterior sphere is
//                its own stratum, so the limit button never jumps a whole
//                chain (user request 2026-10-02);
//   phi          U(1) phase: rotates the climb/level circles about the
//                local normal (bit-exact no-op at 0).
// Every exterior sphere carries the ghost paraboloid kissing its own tip
// (the same PARAB_FOCAL/PHI_CAP family as the central paraboloids), which is
// the boundary/stratum to the next sphere outward.
//
// NOTE: the single-element view for central rank r_star >= 3 is an open
// question (agent_instructions/ek-nakajima.md, task 1). Nothing here solves
// it; the flow above is a deliberate, editable placeholder that ports the
// hyperpolygon interaction the user asked to reuse.

import { orientCore } from "./core-layout.js";
import {
  PARAB_FOCAL,
  PHI_K,
  PHI_CAP,
  PHI_K_STRAT,
  T_NEAR_INF,
  T_PEEK_LO,
  T_PEEK_HI,
  CAP_BAND_R,
  CAP_BAND_TH,
  CAP_NEAR_INF_W,
  sub3,
  add3,
  scale3,
  dot3,
  cross3,
  len3,
  unit3,
  spherePoint,
} from "../hyperpolygon/sideview-shared.js";

// ---------------------------------------------------------------------------
// Constants and geometry helpers are SHARED with the hyperpolygon side
// view (./sideview-shared.js) so the two portraits cannot drift apart.
export {
  PARAB_FOCAL,
  PHI_K,
  PHI_CAP,
  PHI_K_STRAT,
  T_NEAR_INF,
  T_PEEK_LO,
  T_PEEK_HI,
  CAP_BAND_R,
  CAP_BAND_TH,
  CAP_NEAR_INF_W,
  spherePoint,
};

// Guide-arc sample count (shared by the pure layer and the factory).
const ARC_N = 33;

const Y_HAT = [0, 1, 0];

// Rotate v about unit axis n by angle g (Rodrigues).
function rotateAbout(v, n, g) {
  const c = Math.cos(g);
  const s = Math.sin(g);
  const ax = cross3(n, v);
  const d = dot3(n, v);
  return [
    c * v[0] + s * ax[0] + (1 - c) * d * n[0],
    c * v[1] + s * ax[1] + (1 - c) * d * n[1],
    c * v[2] + s * ax[2] + (1 - c) * d * n[2],
  ];
}

// Hermite smoothstep on [0,1].
function smoothstep(x) {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Spider side layout (pure).
// ---------------------------------------------------------------------------
// Returns { root, radii, arms, nodes, extent } where
//   nodes[i] = { center:[x,y,z], radius, arm, pos } (arm = -1 for the root),
//   arms[k]  = { param, dir, side, nodes:[chain node ids root-child..tip] }.
export function buildSideLayout(q, opts) {
  opts = opts || {};
  const oriented = orientCore(q);
  const tree = oriented.tree;
  const n = tree.nodes;
  const r0 = opts.r0 === undefined ? 1 : opts.r0;
  const radii = opts.radii ? opts.radii.slice() : (opts.sizeByMark ? tree.marks.slice() : new Array(n).fill(r0));
  if (radii.length !== n) throw new RangeError("buildSideLayout: radii length mismatch");
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(radii[i]) || radii[i] <= 0) throw new RangeError("buildSideLayout: radius " + i + " must be positive");
  }

  const root = oriented.root;
  const rootChildren = oriented.children[root].slice();
  // E6's concurrency attachment z=1 is the short arm. Preserve node IDs
  // and edges; traversal order alone does not specify chart attachments.
  if (q.name === "E6" && rootChildren.length === 3) {
    const short = rootChildren.findIndex(function (node) { return oriented.children[node].length === 0; });
    if (short >= 0) rootChildren.splice(1, 0, rootChildren.splice(short, 1)[0]);
  }
  const K = rootChildren.length;
  const nodes = new Array(n).fill(null);
  const arms = [];
  nodes[root] = { center: [0, 0, 0], radius: radii[root], arm: -1, pos: -1 };

  for (let k = 0; k < K; k++) {
    const param = K <= 1 ? 0.5 : k / (K - 1);
    const psi = Math.PI * param;
    const dir = [Math.sin(psi), -Math.cos(psi), 0];
    let side = unit3(sub3(Y_HAT, scale3(dir, dot3(Y_HAT, dir))));
    if (!side) side = [1, 0, 0];
    const chain = [];
    let parent = root;
    let u = rootChildren[k];
    while (u !== undefined && u !== null) {
      const pc = nodes[parent].center;
      const d = radii[parent] + radii[u];
      const c = [pc[0] + d * dir[0], pc[1] + d * dir[1], 0];
      nodes[u] = { center: c, radius: radii[u], arm: k, pos: chain.length };
      chain.push(u);
      parent = u;
      const kids = oriented.children[u];
      u = kids.length ? kids[0] : null;
    }
    arms.push({ param: param, dir: dir, side: side, nodes: chain });
  }

  let extent = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const nd = nodes[i];
    extent = Math.max(extent, Math.hypot(nd.center[0], nd.center[1]) + nd.radius);
    minX = Math.min(minX, nd.center[0] - nd.radius);
    maxX = Math.max(maxX, nd.center[0] + nd.radius);
    minY = Math.min(minY, nd.center[1] - nd.radius);
    maxY = Math.max(maxY, nd.center[1] + nd.radius);
  }
  return {
    q: q,
    tree: tree,
    root: root,
    radii: radii,
    arms: arms,
    nodes: nodes,
    oriented: oriented,
    extent: extent > 1e-9 ? extent : 1,
    // Bounding-box centre of the packing (the root sphere stays at the
    // world origin, so the flow/capture geometry is unchanged); the camera
    // frames this point so asymmetric spiders stay centred in the viewport.
    center: [(minX + maxX) / 2, (minY + maxY) / 2, 0],
  };
}

// ---------------------------------------------------------------------------
// Flow state (pure).
// ---------------------------------------------------------------------------
// Which arm (if any) the point (r, theta) selects: r exactly equal to an
// arm's attachment param, and theta = 0 unless the arm attaches at a root
// pole (where theta is degenerate). Shared by coreFlow and the widget so the
// widget's sphere reset cannot drift from the arm the flow actually parks on.
export function armAt(lay, r, theta) {
  for (let k = 0; k < lay.arms.length; k++) {
    const arm = lay.arms[k];
    if (Math.abs(r - arm.param) > 1e-9) continue;
    if (arm.param !== 0 && arm.param !== 1 && Math.abs(theta) > 1e-9) continue;
    return k;
  }
  return -1;
}

// prm = { r, theta, t, phi, sphere, outgoing }.
// outgoing selects the E6 short-arm tip's noncompact chart, with weight-2
// phase, rather than assigning that chart to a nonexistent second sphere.
// Returns null on any non-finite input; never throws for finite input.
export function coreFlow(lay, prm) {
  const r = prm.r;
  const theta = prm.theta;
  const t = prm.t;
  if (!Number.isFinite(r) || !Number.isFinite(theta) || !Number.isFinite(t)) return null;
  const sphereIn = Number.isFinite(prm.sphere) ? Math.floor(prm.sphere) : 0;
  const phaseWeight = lay.q.name === "E6" ? (prm.outgoing ? (r === 0.5 ? 2 : 3) : sphereIn + 1) : 1;
  const g = (Number.isFinite(prm.phi) ? prm.phi : 0) * phaseWeight;

  const rootNode = lay.nodes[lay.root];
  const R = rootNode.radius;
  const rootC = rootNode.center;

  // Per-arm frame: the (phi-rotated) climb side direction, and the arm's
  // attachment point on the root sphere.
  function armFrame(k) {
    const arm = lay.arms[k];
    let w = unit3(sub3(Y_HAT, scale3(arm.dir, dot3(Y_HAT, arm.dir))));
    if (!w) w = [1, 0, 0];
    if (g !== 0) w = rotateAbout(w, arm.dir, g);
    const attachment = add3(rootC, scale3(arm.dir, R));
    return { arm: arm, side: w, attachment: attachment };
  }

  // Point on the s-th sphere of an arm: sAbs = s + sLocal, sLocal in [0,1]
  // runs from the sphere's base (nearest the root) to its tip. Continuous
  // across sphere boundaries: tip(s) = base(s + 1).
  function ride(fr, sAbs) {
    const chain = fr.arm.nodes;
    const N = chain.length;
    const i = Math.min(Math.max(Math.floor(sAbs), 0), N - 1);
    const sLocal = Math.min(Math.max(sAbs - i, 0), 1);
    const alpha = Math.PI * sLocal;
    const nd = lay.nodes[chain[i]];
    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    return [
      nd.center[0] + nd.radius * (-ca * fr.arm.dir[0] + sa * fr.side[0]),
      nd.center[1] + nd.radius * (-ca * fr.arm.dir[1] + sa * fr.side[1]),
      nd.center[2] + nd.radius * (-ca * fr.arm.dir[2] + sa * fr.side[2]),
    ];
  }

  // A paraboloid frame kissing a sphere at `apex`, opening along `n`, with
  // in-plane axes u, v.
  function parabFrame(apex, n, u) {
    return { apex: apex, u: u, v: cross3(n, u), n: n, f: PARAB_FOCAL, cap: PHI_CAP };
  }

  // --- parked-on-an-arm branch: t is LOCAL to one sphere --------------------
  // The selected arm is fixed by r = arm.param (theta degenerate at pole
  // attachments). `sphere` picks which exterior sphere of the chain the dot
  // sits on; t climbs from that sphere's base to its tip only.
  const att = armAt(lay, r, theta);
  if (att >= 0) {
    const fr = armFrame(att);
    const N = fr.arm.nodes.length;
    const si = Math.min(Math.max(sphereIn, 0), N - 1);
    const tl = Math.min(Math.max(t, 0), 1);
    const curNode = fr.arm.nodes[si];
    const nd = lay.nodes[curNode];
    const base = add3(nd.center, scale3(fr.arm.dir, -nd.radius));
    const tip = add3(nd.center, scale3(fr.arm.dir, nd.radius));
    if (prm.outgoing && lay.q.name === "E6" && si === N - 1) {
      const wing = parabFrame(tip, fr.arm.dir, scale3(fr.side, -1));
      const angle = tl >= 1 ? PHI_CAP : Math.min(PHI_CAP, Math.atan(PHI_K_STRAT * tl / (1 - tl)));
      const climb = function (a) {
        const rho = wing.f * Math.tan(a);
        return add3(tip, add3(scale3(wing.u, rho), scale3(wing.n, rho * rho / (2 * wing.f))));
      };
      const arc = [];
      for (let i = 0; i < ARC_N; i++) arc.push(climb(angle * i / (ARC_N - 1)));
      return { kind: "outgoing", att: att, node: curNode, sphereCount: N,
        dot: climb(angle), arc: arc, exterior: null, paraboloid: wing,
        stratum: null, capture: null, nearInfinity: false };
    }
    // Guide arc: the meridian of THIS sphere only, base -> tip.
    const armArc = [];
    for (let i = 0; i < ARC_N; i++) armArc.push(ride(fr, si + i / (ARC_N - 1)));
    return {
      kind: "arm",
      att: att,
      node: curNode,
      sphereCount: N,
      dot: ride(fr, si + tl),
      arc: armArc,
      exterior: { center: nd.center, radius: nd.radius, dir: fr.arm.dir, side: fr.side, attachment: base },
      paraboloid: null,
      // Ghost paraboloid at THIS sphere's tip: the stratum to the next sphere.
      stratum: parabFrame(tip, fr.arm.dir, [-fr.side[0], -fr.side[1], -fr.side[2]]),
      capture: null,
      nearInfinity: tl >= T_NEAR_INF,
    };
  }

  // --- central branch: dot on the root sphere, climbing its paraboloid -----
  const p = add3(rootC, spherePoint(r, theta, R));
  const n = unit3(sub3(p, rootC)) || [0, 0, 1];
  let u = unit3(sub3(Y_HAT, scale3(n, dot3(Y_HAT, n))));
  if (!u) u = [1, 0, 0];
  if (g !== 0) u = rotateAbout(u, n, g);
  const v = cross3(n, u);

  let phi = t <= 0 ? 0 : t >= 1 ? PHI_CAP : Math.atan((PHI_K * t) / (1 - t));
  if (phi > PHI_CAP) phi = PHI_CAP;
  const rhoMax = PARAB_FOCAL * Math.tan(PHI_CAP);
  const climb = function (ph) {
    const rho = Math.min(PARAB_FOCAL * Math.tan(ph), rhoMax);
    const z = (rho * rho) / (2 * PARAB_FOCAL);
    return add3(p, add3(scale3(u, rho), scale3(n, z)));
  };
  const arc = [];
  for (let i = 0; i < ARC_N; i++) arc.push(climb((phi * i) / (ARC_N - 1)));

  // Capture blend onto the nearest arm attachment within the band. The
  // handover targets the FIRST sphere of that arm (sphere 0, the root
  // child); t is local, so the captured dot climbs only that sphere.
  let cap = null;
  for (let k = 0; k < lay.arms.length; k++) {
    const arm = lay.arms[k];
    // theta is degenerate at the poles, so pole arms capture on r alone.
    const pole = arm.param === 0 || arm.param === 1;
    const d = pole
      ? Math.abs(r - arm.param) / CAP_BAND_R
      : Math.max(Math.abs(r - arm.param) / CAP_BAND_R, Math.abs(theta) / CAP_BAND_TH);
    if (!(d < 1)) continue;
    const fr = armFrame(k);
    const wgt = smoothstep(1 - d);
    if (cap !== null && wgt <= cap.w) continue;
    const shift = sub3(p, fr.attachment);
    const tl = Math.min(Math.max(t, 0), 1);
    const ext = function (sAbs) {
      return add3(ride(fr, sAbs), shift);
    };
    const extArc = [];
    for (let i = 0; i < ARC_N; i++) extArc.push(ext(i / (ARC_N - 1)));
    const nd0 = lay.nodes[fr.arm.nodes[0]];
    cap = {
      k: k,
      w: wgt,
      attachment: fr.attachment,
      dot: ext(tl),
      arc: extArc,
      node: fr.arm.nodes[0],
      tip: add3(nd0.center, scale3(fr.arm.dir, nd0.radius)),
      dir: fr.arm.dir,
      side: fr.side,
    };
  }

  if (cap) {
    const wt = cap.w;
    const lp = function (a, b, f) {
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
    return {
      kind: "central",
      att: -1,
      node: lay.root,
      dot: lp(climb(phi), cap.dot, wt),
      arc: arc.map(function (q, i) {
        return lp(q, cap.arc[i], wt);
      }),
      exterior: null,
      paraboloid: parabFrame(p, n, u),
      stratum: parabFrame(cap.tip, cap.dir, [-cap.side[0], -cap.side[1], -cap.side[2]]),
      capture: { k: cap.k, w: wt, attachment: cap.attachment, node: cap.node },
      nearInfinity: wt >= CAP_NEAR_INF_W && t >= T_NEAR_INF,
    };
  }

  return {
    kind: "central",
    att: -1,
    node: lay.root,
    dot: climb(phi),
    arc: arc,
    exterior: null,
    paraboloid: parabFrame(p, n, u),
    stratum: null,
    capture: null,
    nearInfinity: false,
  };
}

// ---------------------------------------------------------------------------
// Browser-only three.js factory (side view + dot/dot-flow).
// ---------------------------------------------------------------------------
// Palette keys (getPalette() -> object): sphere (root), ext (arm spheres),
// extHi (highlight), dot, border, caption, sideBg. Two-state opacity, same
// tuned values as the hyperpolygon side view.
const EXT_UNHI_OPACITY = 0.5;
const EXT_HI_OPACITY = 0.92;
const GLOW_TAU = 0.08;
function glowFactor(dt) {
  return 1 - Math.exp(-dt / GLOW_TAU);
}

function lambert(opts) {
  return new THREE.MeshLambertMaterial(opts);
}

export function makeCoreView(host, opts) {
  if (typeof THREE === "undefined" || typeof THREE.OrbitControls === "undefined") return null;
  opts = opts || {};
  const getPalette = opts.getPalette || function () { return {}; };

  const pal = function () {
    const p = getPalette() || {};
    return {
      sideBg: p.sideBg === undefined ? null : p.sideBg,
      sphere: p.sphere === undefined ? 0xffffff : p.sphere,
      ext: p.ext === undefined ? 0xffffff : p.ext,
      extHi: p.extHi === undefined ? 0xd8dee6 : p.extHi,
      dot: p.dot === undefined ? 0x000000 : p.dot,
      border: p.border === undefined ? "#cfd4da" : p.border,
      caption: p.caption === undefined ? "#666666" : p.caption,
    };
  };

  host.style.position = host.style.position || "relative";
  host.style.boxSizing = host.style.boxSizing || "border-box";

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
  camera.position.set(2.4, 1.4, 2.8);
  camera.lookAt(0, 0, 0);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x777788, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const unitSphere = new THREE.SphereGeometry(1, 40, 28);
  const extHiCol = new THREE.Color(0xffffff);

  // Root sphere (the "central" sphere).
  const rootMat = lambert({ color: 0xffffff, transparent: true, opacity: EXT_UNHI_OPACITY, depthWrite: false });
  const rootMesh = new THREE.Mesh(unitSphere, rootMat);
  scene.add(rootMesh);

  // Arm spheres: one mesh per non-root core node (rebuilt on layout change).
  const armGroup = new THREE.Group();
  scene.add(armGroup);
  let armMeshes = []; // { mesh, mat, gloss, node, arm }

  const dotMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), dotMat);
  scene.add(dot);

  // Guide arc (opaque, dot-coloured), fixed topology.
  const arcPos = new Float32Array(ARC_N * 3);
  const arcGeom = new THREE.BufferGeometry();
  arcGeom.setAttribute("position", new THREE.BufferAttribute(arcPos, 3));
  const arcMat = new THREE.LineBasicMaterial({ color: 0x000000 });
  const arcLine = new THREE.Line(arcGeom, arcMat);
  scene.add(arcLine);

  // Paraboloids: fixed-topology polar grids refilled from flow frames.
  const PARA_A = 28;
  const PARA_R = 12;
  function makeParaMesh(mat) {
    const pos = new Float32Array(PARA_A * PARA_R * 3);
    const idx = [];
    for (let i = 0; i < PARA_A; i++) {
      for (let j = 0; j < PARA_R - 1; j++) {
        const a0 = i * PARA_R + j;
        const a1 = ((i + 1) % PARA_A) * PARA_R + j;
        idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setIndex(idx);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.visible = false;
    scene.add(mesh);
    return { pos: pos, geom: geom, mesh: mesh };
  }
  const paraMat = lambert({ color: 0xffffff, transparent: true, opacity: EXT_UNHI_OPACITY, side: THREE.FrontSide, depthWrite: false });
  const para = makeParaMesh(paraMat);
  const stratMat = lambert({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.FrontSide, depthWrite: false });
  const strat = makeParaMesh(stratMat);

  let lastState = null;
  let lastShowParab = false;
  let lastT = 0;
  let lastLay = null;
  let hovered = false;
  let paraClimb = 0;
  let centralHi = 0;
  let disposed = false;
  let homeCenter = [0, 0, 0];
  const panTgt = [0, 0, 0];
  function lerp3(a, b, f) {
    panTgt[0] = a[0] + (b[0] - a[0]) * f;
    panTgt[1] = a[1] + (b[1] - a[1]) * f;
    panTgt[2] = a[2] + (b[2] - a[2]) * f;
    return panTgt;
  }

  function applyColors() {
    const p = pal();
    extHiCol.setHex(p.extHi);
    rootMat.color.setHex(p.sphere);
    dotMat.color.setHex(p.dot);
    arcMat.color.setHex(p.dot);
    paraMat.color.setHex(p.ext);
    stratMat.color.setHex(p.ext);
    for (let i = 0; i < armMeshes.length; i++) armMeshes[i].mat.color.setHex(p.ext).lerp(extHiCol, armMeshes[i].gloss);
    if (p.sideBg === null) renderer.setClearColor(0x000000, 0);
    else renderer.setClearColor(p.sideBg, 1);
    host.style.border = "1px solid " + (hovered ? p.caption : p.border);
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Rebuild the sphere meshes for a new layout (type / radius toggle).
  function setLayout(lay) {
    const previous = lastLay;
    const sameTopology = previous && previous.q.name === lay.q.name && previous.tree.nodes === lay.tree.nodes;
    lastLay = lay;
    homeCenter = lay.center ? lay.center.slice() : [0, 0, 0];
    const ext = lay.extent || 1;
    const dist = (ext / Math.sin(Math.atan(Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, camera.aspect)))) * 1.15;
    const dir = unit3([0.5, 0.35, 0.9]) || [0, 0, 1];
    if (sameTopology) {
      // Keep the user's orbit and zoom as beta moves; rescale the current
      // camera/target offsets with the packing rather than resetting them.
      const ratio = ext / previous.extent;
      const oldCenter = previous.center || [0, 0, 0];
      camera.position.set(homeCenter[0] + (camera.position.x-oldCenter[0])*ratio,
        homeCenter[1] + (camera.position.y-oldCenter[1])*ratio,
        homeCenter[2] + (camera.position.z-oldCenter[2])*ratio);
      controls.target.set(homeCenter[0] + (controls.target.x-oldCenter[0])*ratio,
        homeCenter[1] + (controls.target.y-oldCenter[1])*ratio,
        homeCenter[2] + (controls.target.z-oldCenter[2])*ratio);
    } else {
      camera.position.set(homeCenter[0] + dir[0] * dist, homeCenter[1] + dir[1] * dist, homeCenter[2] + dir[2] * dist);
      controls.target.set(homeCenter[0], homeCenter[1], homeCenter[2]);
    }
    camera.near = Math.max(0.02, dist - ext * 3);
    camera.far = dist + ext * 6;
    camera.lookAt(controls.target.x, controls.target.y, controls.target.z);
    camera.updateProjectionMatrix();
    controls.update();
    rootMesh.scale.setScalar(lay.nodes[lay.root].radius);
    rootMesh.position.set(lay.nodes[lay.root].center[0], lay.nodes[lay.root].center[1], lay.nodes[lay.root].center[2]);
    if (sameTopology) {
      armMeshes.forEach(function (entry) {
        const nd = lay.nodes[entry.node];
        entry.mesh.position.set(nd.center[0], nd.center[1], nd.center[2]);
        entry.mesh.scale.setScalar(nd.radius);
      });
      return;
    }
    while (armGroup.children.length) {
      armGroup.remove(armGroup.children[armGroup.children.length - 1]);
    }
    for (let i = 0; i < armMeshes.length; i++) armMeshes[i].mat.dispose();
    armMeshes = [];
    for (let i = 0; i < lay.tree.nodes; i++) {
      if (i === lay.root) continue;
      const nd = lay.nodes[i];
      const mat = lambert({ color: 0xffffff, transparent: true, opacity: EXT_UNHI_OPACITY, depthWrite: false });
      const mesh = new THREE.Mesh(unitSphere, mat);
      mesh.position.set(nd.center[0], nd.center[1], nd.center[2]);
      mesh.scale.setScalar(nd.radius);
      armGroup.add(mesh);
      armMeshes.push({ mesh: mesh, mat: mat, gloss: 0, node: i, arm: nd.arm });
    }
    applyColors();
  }

  function fillParaboloid(target, P) {
    const pos = target.pos;
    const geom = target.geom;
    const rhoMax = P.f * Math.tan(P.cap);
    for (let i = 0; i < PARA_A; i++) {
      const ang = (2 * Math.PI * i) / PARA_A;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (let j = 0; j < PARA_R; j++) {
        const rho = (rhoMax * j) / (PARA_R - 1);
        const z = (rho * rho) / (2 * P.f);
        const ou = rho * ca;
        const ov = rho * sa;
        const o = 3 * (i * PARA_R + j);
        pos[o] = P.apex[0] + ou * P.u[0] + ov * P.v[0] + z * P.n[0];
        pos[o + 1] = P.apex[1] + ou * P.u[1] + ov * P.v[1] + z * P.n[1];
        pos[o + 2] = P.apex[2] + ou * P.u[2] + ov * P.v[2] + z * P.n[2];
      }
    }
    geom.attributes.position.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
  }

  function setArc(st) {
    const a = st.arc;
    for (let i = 0; i < ARC_N; i++) {
      const q = a[Math.min(i, a.length - 1)];
      arcPos[3 * i] = q[0];
      arcPos[3 * i + 1] = q[1];
      arcPos[3 * i + 2] = q[2];
    }
    arcGeom.attributes.position.needsUpdate = true;
    arcGeom.computeBoundingSphere();
  }

  // update(lay, prm, showParaboloid): recompute the flow and move the dot,
  // arc and paraboloid meshes. Returns the flow state (or null on failure);
  // the widget drives the lim step buttons off state.kind / state.sphereCount
  // (and state.capture for the captured-central handover).
  function update(lay, prm, showParaboloid) {
    let st = null;
    try {
      st = coreFlow(lay, prm);
    } catch (e) {
      st = null;
    }
    if (
      st === null ||
      !Number.isFinite(st.dot[0]) ||
      !Number.isFinite(st.dot[1]) ||
      !Number.isFinite(st.dot[2]) ||
      (st.paraboloid !== null && !Number.isFinite(st.paraboloid.f)) ||
      (st.stratum !== null && !Number.isFinite(st.stratum.f))
    ) {
      return null;
    }
    lastState = st;
    lastShowParab = !!showParaboloid;
    lastT = prm.t;
    dot.position.set(st.dot[0], st.dot[1], st.dot[2]);
    setArc(st);
    if (lastShowParab && st.paraboloid) fillParaboloid(para, st.paraboloid);
    if (st.stratum) fillParaboloid(strat, st.stratum);
    return st;
  }

  function setHover(on) {
    hovered = !!on;
    applyColors();
  }
  function refreshTheme() {
    applyColors();
  }

  let lastFrame = performance.now();
  function loop() {
    if (disposed) return;
    requestAnimationFrame(loop);
    const now = performance.now();
    let dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (dt > 0.05) dt = 0.05;
    const p = pal();

    const activeArm = lastState && lastState.att >= 0 ? lastState.att : -1;
    const activeNode = lastState ? lastState.node : -1;
    const capW = lastState && lastState.capture ? lastState.capture.w : 0;

    // Arm spheres: lit if this is the sphere the dot currently occupies.
    for (let i = 0; i < armMeshes.length; i++) {
      const e = armMeshes[i];
      let target = 0;
      if (activeArm >= 0 && e.node === activeNode) target = 1;
      if (lastState && lastState.capture && e.node === lastState.capture.node) {
        target = Math.max(target, capW);
      }
      e.gloss += (target - e.gloss) * glowFactor(dt);
      e.mat.opacity = EXT_UNHI_OPACITY + (EXT_HI_OPACITY - EXT_UNHI_OPACITY) * e.gloss;
      e.mat.color.setHex(p.ext).lerp(extHiCol, e.gloss);
    }

    // Root sphere: lit on the central branch; co-lights when the dot hugs it.
    let centralTarget = lastState && lastState.kind === "central" ? 1 - capW : 0;
    if (lastState && lastState.kind !== "central" && lastLay) {
      const R = lastLay.nodes[lastLay.root].radius;
      const dC = Math.hypot(dot.position.x, dot.position.y, dot.position.z) - R;
      const tol = Math.max(0.04, 0.25 * R);
      if (dC < tol) centralTarget = Math.max(centralTarget, smoothstep(1 - dC / tol));
    }
    centralHi += (centralTarget - centralHi) * glowFactor(dt);
    rootMat.color.setHex(p.sphere).lerp(extHiCol, centralHi);
    rootMat.opacity = EXT_UNHI_OPACITY + (EXT_HI_OPACITY - EXT_UNHI_OPACITY) * centralHi;

    // Stratum ghost: the paraboloid kissing the CURRENT exterior sphere's
    // tip (the boundary to the next sphere outward), fading in near t -> 1.
    // It is never the active surface — the lim buttons step to the next
    // sphere instead of climbing a parked stratum branch.
    let stratGhost = 0;
    if (lastState && lastState.stratum && (lastState.kind === "arm" || lastState.capture)) {
      const ramp = lastT <= T_PEEK_LO ? 0 : lastT >= T_PEEK_HI ? 1 : (lastT - T_PEEK_LO) / (T_PEEK_HI - T_PEEK_LO);
      stratGhost = ramp * (lastState.capture ? capW : 1);
    }
    const stratOp = EXT_UNHI_OPACITY * stratGhost;
    if (lastState && lastState.stratum && stratOp > 0.004) {
      strat.mesh.visible = true;
      stratMat.opacity = stratOp;
      stratMat.color.setHex(p.ext);
    } else {
      strat.mesh.visible = false;
    }

    // Central paraboloid.
    const showPara = lastShowParab && lastState && lastState.paraboloid !== null;
    const paraClimbTarget = showPara && lastT > 1e-9 ? 1 : 0;
    paraClimb += (paraClimbTarget - paraClimb) * glowFactor(dt);
    paraMat.color.setHex(p.ext).lerp(extHiCol, paraClimb);
    paraMat.opacity = (EXT_UNHI_OPACITY + (EXT_HI_OPACITY - EXT_UNHI_OPACITY) * paraClimb) * (1 - capW);
    para.mesh.visible = !!showPara;
    arcLine.visible = !!lastState && (lastState.kind === "arm" || !!showPara);

    // Camera pan toward the active sphere's attachment / the captured arm.
    let tgt = null;
    if (lastState) {
      if (lastState.kind === "arm" && lastState.exterior) {
        tgt = lastState.exterior.attachment;
      } else if (lastState.capture) {
        tgt = lerp3(homeCenter, lastState.capture.attachment, capW);
      }
    }
    if (tgt) {
      const pf = 1 - Math.exp(-dt / 0.3);
      const dx = (tgt[0] - controls.target.x) * pf;
      const dy = (tgt[1] - controls.target.y) * pf;
      const dz = (tgt[2] - controls.target.z) * pf;
      controls.target.x += dx;
      controls.target.y += dy;
      controls.target.z += dz;
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }

    controls.update();
    renderer.render(scene, camera);
  }
  loop();

  function dispose() {
    disposed = true;
    ro.disconnect();
    controls.dispose();
    unitSphere.dispose();
    rootMat.dispose();
    armMeshes.forEach(function (entry) { entry.mat.dispose(); });
    dot.geometry.dispose();
    dotMat.dispose();
    arcGeom.dispose();
    arcMat.dispose();
    para.geom.dispose();
    paraMat.dispose();
    strat.geom.dispose();
    stratMat.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
  }

  return {
    setLayout: setLayout,
    update: update,
    setHover: setHover,
    refreshTheme: refreshTheme,
    resize: resize,
    dispose: dispose,
  };
}
