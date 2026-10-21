// E6 complex representatives and simultaneous flag/moduli views.
// Both views share compact coordinates r,theta; t and phi are fixed at zero.

import { AFFINE_ADE } from "./quiver-data.js";
import { buildSideLayout, makeCoreView } from "./core-view.js";
import { compactChart } from "./chart.js";
import { makeRepresentationReadout } from "./representation-readout.js";
import { flagIncidence } from "./flag-incidence.js";
import { makeElementView } from "./element-render.js";

const TYPE_KEYS = ["E6", "E7", "E8"];

// Same palette values as the hyperpolygon side view (user request: match the
// coloring scheme there).
const PALETTES = {
  light: {
    sphere: 0x9fadb9,
    ext: 0x9fadb9,
    extHi: 0x74889e,
    dot: 0x000000,
    border: "#cfd4da",
    caption: "#666666",
    sideBg: null,
  },
  dark: {
    sphere: 0xffffff,
    ext: 0xffffff,
    extHi: 0xd8dee6,
    dot: 0x000000,
    border: "#4a525e",
    caption: "#a0a0a0",
    sideBg: null,
  },
};

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}
function palette() {
  return PALETTES[isDark() ? "dark" : "light"];
}

// ---------------------------------------------------------------------------
// Styles (same panel / frame / slider / button family as the hyperpolygon
// widget, scoped to #ek-nakajima-widget).
// ---------------------------------------------------------------------------
function ensureStyles() {
  if (document.getElementById("ek-nakajima-styles")) return;
  const style = document.createElement("style");
  style.id = "ek-nakajima-styles";
  style.textContent = [
    "#ek-nakajima-widget {",
    "  --ek-box-bd: #cfd4da;",
    "  --ek-box-tx: #666e78;",
    "  --ek-panel-bg: rgba(15, 23, 42, 0.028);",
    "  --ek-frame-bg: rgba(15, 23, 42, 0.016);",
    "  --ek-track: #c9cdd4;",
    "  --ek-thumb: #5b6570;",
    "  --ek-btn-bd: #cfd4da;",
    "  --ek-btn-tx: #666e78;",
    "}",
    '[data-theme="dark"] #ek-nakajima-widget {',
    "  --ek-box-bd: #4a525e;",
    "  --ek-box-tx: #a0a8b2;",
    "  --ek-panel-bg: rgba(148, 163, 184, 0.07);",
    "  --ek-frame-bg: rgba(148, 163, 184, 0.04);",
    "  --ek-track: #454d59;",
    "  --ek-thumb: #a8b2bd;",
    "  --ek-btn-bd: #4a525e;",
    "  --ek-btn-tx: #a0a8b2;",
    "}",
    "#ek-nakajima-widget { position: relative; }",
    "#ek-nakajima-widget .ek-tabs { display: flex; flex-wrap: wrap; gap: 6px;",
    "  align-items: center; margin-bottom: 12px; }",
    "#ek-nakajima-widget .ek-tab { padding: 2px 12px; border: 1px solid var(--ek-btn-bd);",
    "  background: transparent; color: var(--ek-btn-tx); border-radius: 6px; cursor: pointer;",
    "  font-size: 0.9em; font-family: inherit; }",
    "#ek-nakajima-widget .ek-tab:hover { border-color: var(--ek-btn-tx); }",
    "#ek-nakajima-widget .ek-tab.ek-active { background: var(--ek-btn-tx);",
    "  border-color: var(--ek-btn-tx); color: #fff; }",
    '[data-theme="dark"] #ek-nakajima-widget .ek-tab.ek-active { color: #14181e; }',
    "#ek-nakajima-widget .ek-row { display: flex; flex-wrap: wrap;",
    "  align-items: flex-start; gap: 12px; }",
    "#ek-nakajima-widget .ek-col { flex: 1 1 340px; min-width: 300px; }",
    "#ek-nakajima-widget .ek-frame { position: relative; box-sizing: border-box;",
    "  width: 100%; aspect-ratio: 1 / 1; border: 1px solid var(--ek-box-bd);",
    "  border-radius: 10px; overflow: hidden; background: var(--ek-frame-bg); }",
    "#ek-nakajima-widget .ek-cap { margin-top: 8px; font-size: 0.85em;",
    "  color: var(--ek-box-tx); text-align: center; }",
    "#ek-nakajima-widget .ek-panel { box-sizing: border-box;",
    "  border: 1px solid var(--ek-box-bd); border-radius: 10px;",
    "  background: var(--ek-panel-bg); padding: 10px 12px; margin-top: 12px; }",
    "#ek-nakajima-widget .ek-sec { font-size: 0.82em; font-weight: 600;",
    "  color: var(--ek-box-tx); margin: 0 0 8px 1px; }",
    "#ek-nakajima-widget .ek-modrow { display: flex; flex-wrap: wrap;",
    "  gap: 6px 16px; }",
    "#ek-nakajima-widget .ek-mod { display: flex; align-items: center; gap: 8px;",
    "  flex: 1 1 220px; min-width: 200px; color: var(--ek-box-tx); font-size: 0.9em; }",
    "#ek-nakajima-widget .ek-mod input[type=range] { flex: 1 1 auto; min-width: 120px; }",
    "#ek-nakajima-widget .ek-readout { min-width: 4.5em; text-align: right;",
    "  font-variant-numeric: tabular-nums;",
    "  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }",
    "#ek-nakajima-widget .ek-tcol { display: flex; flex-direction: column; gap: 3px;",
    "  flex: 1 1 220px; min-width: 200px; }",
    "#ek-nakajima-widget .ek-slider { -webkit-appearance: none; appearance: none;",
    "  background: transparent; height: 18px; }",
    "#ek-nakajima-widget .ek-slider::-webkit-slider-runnable-track { height: 5px;",
    "  border-radius: 3px; background: var(--ek-track); }",
    "#ek-nakajima-widget .ek-slider::-webkit-slider-thumb { -webkit-appearance: none;",
    "  appearance: none; width: 14px; height: 14px; border-radius: 50%;",
    "  background: var(--ek-thumb); margin-top: -4.5px; }",
    "#ek-nakajima-widget .ek-slider::-moz-range-track { height: 5px;",
    "  border-radius: 3px; background: var(--ek-track); }",
    "#ek-nakajima-widget .ek-slider::-moz-range-thumb { width: 13px; height: 13px;",
    "  border: none; border-radius: 50%; background: var(--ek-thumb); }",
    "#ek-nakajima-widget .ek-slider:disabled { opacity: 0.4; }",
    "#ek-nakajima-widget .ek-btn { padding: 2px 10px; border: 1px solid var(--ek-btn-bd);",
    "  border-radius: 6px; background: transparent; color: var(--ek-btn-tx);",
    "  font-size: 0.85em; cursor: pointer; font-family: inherit; }",
    "#ek-nakajima-widget .ek-btn:hover { border-color: var(--ek-btn-tx); }",
  ].join("\n");
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Mount.
// ---------------------------------------------------------------------------
function activate(container) {
  ensureStyles();
  const state = { key: "E6" };
  const tabs = document.createElement("div");
  tabs.className = "ek-tabs";
  container.appendChild(tabs);
  const tabButtons = {};
  TYPE_KEYS.forEach(function (key) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ek-tab";
    button.textContent = key;
    button.addEventListener("click", function () { state.key = key; sync(); });
    tabs.appendChild(button);
    tabButtons[key] = button;
  });

  const matrixHost = document.createElement("div");
  matrixHost.className = "ek-panel";
  matrixHost.style.marginBottom = "12px";
  container.appendChild(matrixHost);
  const matrixLabel = document.createElement("div");
  matrixLabel.className = "ek-sec";
  matrixLabel.textContent = "Complex representative";
  matrixHost.appendChild(matrixLabel);
  const matrices = makeRepresentationReadout(matrixHost);

  const row = document.createElement("div");
  row.className = "ek-row";
  container.appendChild(row);
  function column() {
    const col = document.createElement("div");
    col.className = "ek-col";
    row.appendChild(col);
    return col;
  }
  const left = column();
  const right = column();
  function frame(col, id, caption) {
    const box = document.createElement("div");
    box.id = id;
    box.className = "ek-frame";
    col.appendChild(box);
    const label = document.createElement("div");
    label.className = "ek-cap";
    label.textContent = caption;
    col.appendChild(label);
    return box;
  }
  const incidenceFrame = frame(left, "ek-incidence-view", "Flag incidence");
  const coreFrame = frame(right, "ek-moduli-view", "Moduli space");
  const modPanel = document.createElement("div");
  modPanel.className = "ek-panel";
  left.appendChild(modPanel);
  const heading = document.createElement("div");
  heading.className = "ek-sec";
  heading.textContent = "Moduli Coordinates";
  modPanel.appendChild(heading);
  const firstRow = document.createElement("div");
  firstRow.className = "ek-modrow";
  modPanel.appendChild(firstRow);
  const secondRow = document.createElement("div");
  secondRow.className = "ek-modrow";
  secondRow.style.marginTop = "6px";
  modPanel.appendChild(secondRow);

  function slider(host, id, label, min, max, step, value, format, title, disabled) {
    const box = document.createElement("div");
    box.className = "ek-mod";
    const lab = document.createElement("label");
    lab.textContent = label;
    lab.htmlFor = id;
    const input = document.createElement("input");
    input.id = id;
    input.type = "range";
    input.className = "ek-slider";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.disabled = !!disabled;
    input.title = title;
    const readout = document.createElement("span");
    readout.className = "ek-readout";
    function refresh() { readout.textContent = format(Number(input.value)); }
    input.addEventListener("input", function () {
      if (input.disabled) return;
      refresh();
      apply();
    });
    box.appendChild(lab);
    box.appendChild(input);
    box.appendChild(readout);
    host.appendChild(box);
    refresh();
    return { input: input, refresh: refresh };
  }
  const rControl = slider(firstRow, "ek-r", "r", 0, 1, 0.001, 0.5,
    function (v) { return v.toFixed(3); }, "z = r/(1-r) exp(i theta); r = 1 gives infinity", false);
  const thetaControl = slider(firstRow, "ek-theta", "\u03b8", -Math.PI, Math.PI, "any", 0,
    function (v) { return v.toFixed(3); }, "Phase in radians", false);
  slider(secondRow, "ek-t", "t", 0, 1, 0.001, 0,
    function () { return "0"; }, "Only t = 0 is implemented", true);
  slider(secondRow, "ek-phi", "\u03c6", -Math.PI, Math.PI, "any", 0,
    function () { return "0"; }, "Inactive when y = 0", true);

  const coreView = makeCoreView(coreFrame, { getPalette: palette });
  const incidenceView = makeElementView(incidenceFrame, { getPalette: palette });
  if (coreView && coreView.setHover) {
    coreFrame.addEventListener("pointerenter", function () { coreView.setHover(true); });
    coreFrame.addEventListener("pointerleave", function () { coreView.setHover(false); });
  }
  let layout = null;
  let pending = false;
  function apply() {
    if (pending) return;
    pending = true;
    const run = function () { pending = false; update(); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else setTimeout(run, 0);
  }
  function update() {
    const r = Number(rControl.input.value);
    const theta = Number(thetaControl.input.value);
    rControl.refresh();
    thetaControl.refresh();
    if (coreView) coreView.update(layout, { r: r, theta: theta, t: 0, phi: 0, sphere: 0 }, false);
    if (state.key !== "E6") {
      matrices.setData(null);
      incidenceView.setData(null);
      incidenceView.setStatus("E6 only", "warn");
      return;
    }
    try {
      const rep = compactChart(r, theta);
      matrices.setData(rep);
      incidenceView.setData({ incidence: flagIncidence(rep) });
      incidenceView.setStatus("", "info");
    } catch (error) {
      matrices.setData(null);
      incidenceView.setData(null);
      incidenceView.setStatus("Representation unavailable", "error");
    }
  }
  function sync() {
    Object.keys(tabButtons).forEach(function (key) {
      tabButtons[key].classList.toggle("ek-active", key === state.key);
    });
    layout = buildSideLayout(AFFINE_ADE[state.key]);
    if (coreView) coreView.setLayout(layout);
    apply();
  }
  function resize() {
    if (coreView) coreView.resize();
    incidenceView.resize();
  }
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(resize);
    observer.observe(incidenceFrame);
    observer.observe(coreFrame);
  } else if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", resize);
  }
  const themeObserver = new MutationObserver(function () {
    if (coreView) coreView.refreshTheme();
    incidenceView.refreshTheme();
    if (matrices.refreshTheme) matrices.refreshTheme();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  sync();
}

const widget = document.getElementById("ek-nakajima-widget");
if (widget) {
  if (typeof THREE === "undefined" || typeof THREE.OrbitControls === "undefined") {
    console.warn("ek-nakajima widget: three.js or OrbitControls failed to load");
  } else {
    activate(widget);
  }
}
