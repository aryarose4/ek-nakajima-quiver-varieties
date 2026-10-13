// element-render.js — browser-only canvas renderer for the single-element
// view. Factory `makeElementView(host, { getPalette })` returns a small handle:
//
//   { setData(view), setStatus(text, kind), refreshTheme(), resize(), getCamera() }
//
// It draws the V2 "su(3) triangle + flag markers" display data (element-view.js)
// with the pure orthographic camera/projection in element-screen.js: the three
// branch-coloured triangle edges and vertices, plus the line (and plane) flag
// markers as dots connected to their edge midpoints.
//
// The drawing is deliberately a DISPLAY view: it is a projection of the 8-D
// su(3) data and is NOT claimed to be injective (see view.notes). It is not a
// solver and holds no state beyond the last view and the camera.
//
// Browser only (needs document/canvas): it never throws on a null view (it
// draws an empty frame) and the caller keeps the last good view.
//
// Style/palette conventions mirror the ALE-core widget (widget.js) and the
// three.js factory in core-view.js: transparent background, theme-driven
// colours read through getPalette() + document[data-theme].

import { elementScreen } from "./element-screen.js";

// Branch palette: three distinguishable hues, readable on the light and dark
// widget backgrounds. Kept in the same muted family as the core palette.
const BRANCH = {
  light: ["#c0504d", "#2f6fb0", "#c99a2e"],
  dark: ["#ff8074", "#6cb6ff", "#e3b341"],
};
const MARK_LINE = { light: "#2b3440", dark: "#e8e8e8" };
const MARK_PLANE = { light: "#8a93a0", dark: "#9aa4b2" };
const VERTEX = { light: "#2b3440", dark: "#f0f0f0" };

function isDarkRoot() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function makeElementView(host, opts) {
  opts = opts || {};
  const getPalette = opts.getPalette || function () { return {}; };

  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";
  host.appendChild(canvas);

  const ctx = canvas.getContext ? canvas.getContext("2d") : null;

  const status = document.createElement("div");
  status.className = "ek-elem-status";
  status.style.position = "absolute";
  status.style.left = "8px";
  status.style.bottom = "6px";
  status.style.fontSize = "0.8em";
  status.style.pointerEvents = "none";
  status.style.whiteSpace = "pre-line";
  host.appendChild(status);

  const cam = { azimuth: 0.6, elevation: 0.35, zoom: 1 };
  let view = null;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function palette() {
    const dark = isDarkRoot();
    const p = getPalette() || {};
    return {
      branch: BRANCH[dark ? "dark" : "light"],
      markLine: MARK_LINE[dark ? "dark" : "light"],
      markPlane: MARK_PLANE[dark ? "dark" : "light"],
      vertex: p.sphere === 0xffffff ? "#f0f0f0" : VERTEX[dark ? "dark" : "light"],
      text: p.caption || (dark ? "#a0a0a0" : "#666666"),
    };
  }

  function sizeOf() {
    const w = host.clientWidth || 0;
    const h = host.clientHeight || 0;
    return { width: w, height: h };
  }

  function drawDot(p, r, fill) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function draw() {
    if (!ctx) return;
    const { width: w, height: h } = sizeOf();
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!view) return;

    const pal = palette();
    const scr = elementScreen(view, cam, { width: w, height: h });

    // Edges.
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < scr.edges.length; i++) {
      const e = scr.edges[i];
      ctx.strokeStyle = pal.branch[i % pal.branch.length];
      ctx.beginPath();
      ctx.moveTo(e[0][0], e[0][1]);
      ctx.lineTo(e[1][0], e[1][1]);
      ctx.stroke();
    }

    // Flag markers: connector from the edge midpoint to the projected marker,
    // then the marker dot (line markers filled, plane markers hollow).
    const n = Math.min(scr.midpoints.length, scr.markersLine.length);
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = pal.markLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scr.midpoints[i][0], scr.midpoints[i][1]);
      ctx.lineTo(scr.markersLine[i][0], scr.markersLine[i][1]);
      ctx.stroke();
      drawDot(scr.markersLine[i], 3.2, pal.markLine);
    }
    for (let i = 0; i < scr.markersPlane.length; i++) {
      const p = scr.markersPlane[i];
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.4, 0, Math.PI * 2);
      ctx.strokeStyle = pal.markPlane;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Vertices on top.
    for (let i = 0; i < scr.vertices.length; i++) {
      drawDot(scr.vertices[i], 4, pal.branch[i % pal.branch.length]);
    }
    for (let i = 0; i < scr.vertices.length; i++) {
      drawDot(scr.vertices[i], 1.8, pal.vertex);
    }
  }

  function resize() {
    draw();
  }

  function setData(v) {
    view = v || null;
    draw();
  }

  function setStatus(text, kind) {
    const pal = palette();
    status.textContent = text == null ? "" : String(text);
    status.style.color =
      kind === "error" ? "#d64545" : kind === "warn" ? "#c98a2e" : pal.text;
  }

  function refreshTheme() {
    draw();
  }

  function getCamera() {
    return cam;
  }

  function onDown(ev) {
    dragging = true;
    lastX = ev.clientX || 0;
    lastY = ev.clientY || 0;
    canvas.style.cursor = "grabbing";
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    }
  }
  function onMove(ev) {
    if (!dragging) return;
    const x = ev.clientX || 0;
    const y = ev.clientY || 0;
    cam.azimuth -= (x - lastX) * 0.008;
    cam.elevation += (y - lastY) * 0.008;
    cam.elevation = Math.max(-1.5, Math.min(1.5, cam.elevation));
    lastX = x;
    lastY = y;
    draw();
  }
  function onUp() {
    dragging = false;
    canvas.style.cursor = "grab";
  }
  function onWheel(ev) {
    if (ev.preventDefault) ev.preventDefault();
    cam.zoom *= Math.exp(-(ev.deltaY || 0) * 0.001);
    cam.zoom = Math.max(0.2, Math.min(5, cam.zoom));
    draw();
  }

  if (canvas.addEventListener) {
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);
    canvas.addEventListener("wheel", onWheel);
  }

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(resize);
    ro.observe(host);
  } else if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", resize);
  }
  resize();

  return {
    setData: setData,
    setStatus: setStatus,
    refreshTheme: refreshTheme,
    resize: resize,
    getCamera: getCamera,
  };
}
