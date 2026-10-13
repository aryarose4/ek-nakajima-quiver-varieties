// Browser three.js factory for the E6 triangle (visualizer milestone V2),
// now driven by a SOLVED, at-level bundle point (assets/data/e6-triangle-solved.json).
//
// Renders one bundle point:
//   vertices:  p(0), p(q_0), p(q_0 + q_1)     (re-projected with the point's
//              own view_frame, so the frame is explicit; agrees with the
//              stored `vertices` to roundoff)
//   edge i:    branch i (i = 1,2,3), directed; edge 3 returns v2 -> 0
//   line mark: the point's `markers.line[i]` (midpoint + p(d_i))
//   plane mark:the point's `markers.plane[i]` (midpoint + p(E_i))
//   connectors: short lines from each marker to the edge midpoint
//   axes gizmo: a small AxesHelper at the triangle centroid
//
// BRANCH COLOR MAP (fixed, documented): branch 1 -> palette.branch[0],
// branch 2 -> branch[1], branch 3 -> branch[2].  Line decoration uses
// palette.lineMark, plane decoration palette.planeMark.
//
// No chart geometry is computed here.  Needs a browser (global THREE +
// OrbitControls); makeTriangleView returns null without them, so importing it
// under Node is harmless.  Imports only the pure ./triangle-geometry.js.

import { verticesFromQ, markersFromDirs } from "./triangle-geometry.js";

export function makeTriangleView(host, opts) {
  if (typeof THREE === "undefined" || typeof THREE.OrbitControls === "undefined") return null;
  opts = opts || {};
  const getPalette = opts.getPalette || function () { return {}; };
  const cL = opts.cL === undefined ? 1 : opts.cL;
  const cP = opts.cP === undefined ? 1 : opts.cP;

  function pal() {
    const p = getPalette() || {};
    return {
      bg: p.bg === undefined ? null : p.bg,
      branch: p.branch || [0xd94f4f, 0x4f9ed9, 0x63b85e],
      lineMark: p.lineMark === undefined ? 0xd94f4f : p.lineMark,
      planeMark: p.planeMark === undefined ? 0x63b85e : p.planeMark,
      connector: p.connector === undefined ? 0x9aa4b0 : p.connector,
      vertex: p.vertex === undefined ? 0x111111 : p.vertex,
    };
  }

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
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
  camera.position.set(3, 2, 4);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x777788, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.65);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const P = pal();
  const V = function (a) { return new THREE.Vector3(a[0], a[1], a[2]); };

  // --- directed branch edges (ArrowHelper: shaft + head) -------------------
  const edges = [0, 1, 2].map(function (i) {
    const arrow = new THREE.ArrowHelper(V([1, 0, 0]), V([0, 0, 0]), 1, P.branch[i]);
    arrow.visible = false;
    scene.add(arrow);
    return arrow;
  });

  // --- vertices ------------------------------------------------------------
  const vertGeom = new THREE.SphereGeometry(1, 18, 12);
  const vertMat = new THREE.MeshBasicMaterial({ color: P.vertex });
  const verts = [0, 1, 2].map(function () {
    const m = new THREE.Mesh(vertGeom, vertMat);
    scene.add(m);
    return m;
  });

  // --- flag markers + connectors ------------------------------------------
  const lineMarkGeom = new THREE.OctahedronGeometry(1, 0);
  const lineMarkMat = new THREE.MeshLambertMaterial({ color: P.lineMark });
  const planeMarkGeom = new THREE.BoxGeometry(1, 1, 1);
  const planeMarkMat = new THREE.MeshLambertMaterial({ color: P.planeMark });
  const connectorMat = new THREE.LineBasicMaterial({ color: P.connector });

  const lineMarks = [];
  const planeMarks = [];
  const connectors = [];
  for (let i = 0; i < 3; i++) {
    const lm = new THREE.Mesh(lineMarkGeom, lineMarkMat);
    const pm = new THREE.Mesh(planeMarkGeom, planeMarkMat);
    const g1 = new THREE.BufferGeometry();
    g1.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const c1 = new THREE.Line(g1, connectorMat);
    const c2 = new THREE.Line(g2, connectorMat);
    scene.add(lm); scene.add(pm); scene.add(c1); scene.add(c2);
    lineMarks.push(lm);
    planeMarks.push(pm);
    connectors.push({ line: c1, plane: c2 });
  }

  // --- axes gizmo ----------------------------------------------------------
  const axes = new THREE.AxesHelper(1);
  scene.add(axes);

  // --- state / drawing -----------------------------------------------------
  let lastState = null;

  function setSegment(lineObj, a, b) {
    const pos = lineObj.geometry.attributes.position;
    pos.array[0] = a[0]; pos.array[1] = a[1]; pos.array[2] = a[2];
    pos.array[3] = b[0]; pos.array[4] = b[1]; pos.array[5] = b[2];
    pos.needsUpdate = true;
    lineObj.geometry.computeBoundingSphere();
  }

  function vadd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vscale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function finite(a) { return a && Number.isFinite(a[0]) && Number.isFinite(a[1]) && Number.isFinite(a[2]); }

  function fitCamera(center, radius) {
    const r = radius > 1e-6 ? radius : 1;
    const c = V(center);
    let dir = vsub(camera.position.toArray(), controls.target.toArray());
    let dn = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
    if (!(dn > 1e-6)) dir = [0.6, 0.45, 0.85];
    else dir = [dir[0] / dn, dir[1] / dn, dir[2] / dn];
    const dist = (r / Math.tan((camera.fov * Math.PI) / 360)) * 1.7;
    controls.target.copy(c);
    camera.position.set(c.x + dir[0] * dist, c.y + dir[1] * dist, c.z + dir[2] * dist);
    camera.near = Math.max(0.02, dist - r * 4);
    camera.far = dist + r * 8;
    camera.lookAt(c);
    camera.updateProjectionMatrix();
    controls.update();
    axes.scale.setScalar(r * 0.35);
    axes.position.copy(c);
  }

  // Draw one bundle point.  Returns a small record (or null on bad input).
  function setState(point) {
    if (!point || !Array.isArray(point.view_frame) || !Array.isArray(point.q)) return null;
    const frame = point.view_frame;
    let verts3;
    try {
      verts3 = verticesFromQ(point.q, frame);
    } catch (e) {
      return null;
    }
    if (!finite(verts3[0]) || !finite(verts3[1]) || !finite(verts3[2])) return null;

    let markers = point.markers;
    if (!markers && point.line_dir && point.plane_dir) {
      markers = markersFromDirs(point.q, point.line_dir, point.plane_dir, frame, cL, cP);
    }
    const lineM = markers && markers.line ? markers.line : [verts3[0], verts3[0], verts3[0]];
    const planeM = markers && markers.plane ? markers.plane : [verts3[0], verts3[0], verts3[0]];

    const mids = [
      vscale(vadd(verts3[0], verts3[1]), 0.5),
      vscale(vadd(verts3[1], verts3[2]), 0.5),
      vscale(vadd(verts3[2], verts3[0]), 0.5),
    ];

    // centre + radius over vertices and all markers
    let cx = 0, cy = 0, cz = 0, count = 0;
    function acc(p) { cx += p[0]; cy += p[1]; cz += p[2]; count++; }
    for (let i = 0; i < 3; i++) { acc(verts3[i]); acc(lineM[i]); acc(planeM[i]); }
    const center = [cx / count, cy / count, cz / count];

    let radius = 0;
    const all = verts3.concat(lineM, planeM);
    for (let i = 0; i < all.length; i++) {
      const d = vsub(all[i], center);
      radius = Math.max(radius, Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]));
    }
    const s = radius > 1e-9 ? radius : 1;

    for (let i = 0; i < 3; i++) {
      verts[i].position.set(verts3[i][0] - center[0], verts3[i][1] - center[1], verts3[i][2] - center[2]);
      verts[i].scale.setScalar(s * 0.055);
    }

    const edgeA = [verts3[0], verts3[1], verts3[2]];
    const edgeB = [verts3[1], verts3[2], verts3[0]];
    for (let i = 0; i < 3; i++) {
      const a = vsub(edgeA[i], center);
      const b = vsub(edgeB[i], center);
      const seg = vsub(b, a);
      const len = Math.sqrt(seg[0] * seg[0] + seg[1] * seg[1] + seg[2] * seg[2]);
      if (len > 1e-9) {
        edges[i].visible = true;
        edges[i].position.set(a[0], a[1], a[2]);
        edges[i].setDirection(new THREE.Vector3(seg[0] / len, seg[1] / len, seg[2] / len));
        edges[i].setLength(len, Math.min(len * 0.18, s * 0.12), Math.min(len * 0.10, s * 0.07));
        edges[i].setColor(new THREE.Color(pal().branch[i]));
      } else {
        edges[i].visible = false;
      }
    }

    for (let i = 0; i < 3; i++) {
      const mid = vsub(mids[i], center);
      const lm = vsub(lineM[i], center);
      const pm = vsub(planeM[i], center);
      lineMarks[i].position.set(lm[0], lm[1], lm[2]);
      lineMarks[i].scale.setScalar(s * 0.05);
      planeMarks[i].position.set(pm[0], pm[1], pm[2]);
      planeMarks[i].scale.setScalar(s * 0.05);
      setSegment(connectors[i].line, mid, lm);
      setSegment(connectors[i].plane, mid, pm);
    }

    axes.position.set(center[0], center[1], center[2]);
    axes.scale.setScalar(s * 0.35);

    fitCamera(center, radius);
    lastState = {
      point: point,
      vertices: verts3,
      markers: { line: lineM, plane: planeM },
      midpoints: mids,
      center: center,
      radius: radius,
    };
    return lastState;
  }

  function applyColors() {
    const p = pal();
    for (let i = 0; i < 3; i++) if (edges[i].visible) edges[i].setColor(new THREE.Color(p.branch[i]));
    lineMarkMat.color.setHex(p.lineMark);
    planeMarkMat.color.setHex(p.planeMark);
    connectorMat.color.setHex(p.connector);
    vertMat.color.setHex(p.vertex);
    if (p.bg === null) renderer.setClearColor(0x000000, 0);
    else renderer.setClearColor(p.bg, 1);
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(resize);
    ro.observe(host);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();

  let disposed = false;
  function loop() {
    if (disposed) return;
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  applyColors();
  loop();

  function dispose() {
    disposed = true;
    if (ro) ro.disconnect();
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
  }

  return {
    setState: setState,
    refreshTheme: applyColors,
    resize: resize,
    dispose: dispose,
    getState: function () { return lastState; },
  };
}
