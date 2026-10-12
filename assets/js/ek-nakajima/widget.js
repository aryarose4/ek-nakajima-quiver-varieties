// E_k Nakajima quiver-varieties widget (2026-10-02 rework): the ALE core
// side view for the 4-dimensional Nakajima quiver varieties of affine ADE
// type E6/E7/E8.
//
// The D4 and A_n type tabs are gone (user request 2026-10-02): D4 is the
// hyperpolygon member already on the site and A_n is not one of the E_k
// targets. The Display and Invariants panels are gone too; the controls are
// the hyperpolygon "Moduli Coordinates" panel (same slider look and layout)
// plus an empty beta panel stub.
//
// Interaction (user request 2026-10-02): when an arm of the core tree is a
// chain of several exterior spheres, each sphere is its own stratum. The
// t slider climbs the CURRENT sphere only (base -> tip); the lim buttons
// step the dot by exactly ONE sphere: "lim t->inf" at a sphere's tip moves
// to the base of the next sphere outward, "lim t->0" at its base moves to
// the tip of the previous one. See core-view.js.
//
// The single-element view (the real moment maps mu_R for r_star >= 3) is an
// OPEN math question (agent_instructions/ek-nakajima.md, task 1); the dot's
// motion here is a deliberate, editable placeholder built on the
// hyperpolygon (r, theta, t, phi) interaction.
//
// Loaded as an ES module after the vendored three.min.js and OrbitControls
// (global THREE), mirroring assets/js/hyperpolygon/widget.js.

import { AFFINE_ADE } from "./quiver-data.js";
import { buildSideLayout, makeCoreView, armAt, CAP_NEAR_INF_W, T_NEAR_INF } from "./core-view.js";

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
  container.style.position = "relative";

  const tabs = document.createElement("div");
  tabs.className = "ek-tabs";
  container.appendChild(tabs);

  const state = { key: "E6", sphere: 0, arm: -1 };

  const tabButtons = {};
  TYPE_KEYS.forEach(function (key) {
    const btn = document.createElement("button");
    btn.className = "ek-tab";
    btn.type = "button";
    btn.textContent = key;
    btn.addEventListener("click", function () {
      state.key = key;
      state.arm = -1;
      state.sphere = 0;
      sync();
    });
    tabs.appendChild(btn);
    tabButtons[key] = btn;
  });

  const row = document.createElement("div");
  row.className = "ek-row";
  container.appendChild(row);

  // --- left column: the ALE core viewport -------------------------------
  const viewCol = document.createElement("div");
  viewCol.className = "ek-col";
  row.appendChild(viewCol);
  const frame = document.createElement("div");
  frame.className = "ek-frame";
  viewCol.appendChild(frame);
  const cap = document.createElement("div");
  cap.className = "ek-cap";
  cap.textContent = "ALE core of E6: exceptional \u2119\u00b9's";
  viewCol.appendChild(cap);

  // --- right column: controls -------------------------------------------
  const ctrlCol = document.createElement("div");
  ctrlCol.className = "ek-col";
  ctrlCol.style.minWidth = "280px";
  row.appendChild(ctrlCol);

  const modPanel = document.createElement("div");
  modPanel.className = "ek-panel";
  const modSec = document.createElement("div");
  modSec.className = "ek-sec";
  modSec.textContent = "Moduli Coordinates";
  modPanel.appendChild(modSec);
  ctrlCol.appendChild(modPanel);

  const modRowRT = document.createElement("div");
  modRowRT.className = "ek-modrow";
  modPanel.appendChild(modRowRT);
  const modRowTG = document.createElement("div");
  modRowTG.className = "ek-modrow";
  modRowTG.style.marginTop = "6px";
  modPanel.appendChild(modRowTG);

  // One moduli-slider row: label + range input + readout. Magnetic snaps
  // ({ value, tol }) are applied on input; returns the pieces the widget
  // needs. Appended to `row` (default the (r, theta) row).
  function makeSlider(label, min, max, step, value, format, snaps, row, tooltip) {
    const box = document.createElement("div");
    box.className = "ek-mod";
    const lab = document.createElement("span");
    lab.textContent = label;
    const input = document.createElement("input");
    input.type = "range";
    input.className = "ek-slider";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    if (tooltip) input.title = tooltip;
    const readout = document.createElement("span");
    readout.className = "ek-readout";
    const updateReadout = function () {
      readout.textContent = format(parseFloat(input.value));
    };
    updateReadout();
    input.addEventListener("input", function () {
      let v = parseFloat(input.value);
      for (const snap of snaps) {
        if (Math.abs(v - snap.value) <= snap.tol) {
          input.value = String(snap.value);
          v = snap.value;
          break;
        }
      }
      updateReadout();
      apply(box._role);
    });
    box.appendChild(lab);
    box.appendChild(input);
    box.appendChild(readout);
    (row || modRowRT).appendChild(box);
    return { box: box, input: input, readout: readout, updateReadout: updateReadout };
  }

  const rCtl = makeSlider("r", 0, 1, 0.005, 0.25, function (v) { return v.toFixed(2); }, [
    { value: 0, tol: 0.02 },
    { value: 0.5, tol: 0.02 },
    { value: 1, tol: 0.02 },
  ], modRowRT);
  const thCtl = makeSlider("\u03b8", -1, 1, 0.005, 0, function (v) {
    if (v >= 1) return "\u03c0";
    if (v <= -1) return "-\u03c0";
    return (v * Math.PI).toFixed(2);
  }, [{ value: 0, tol: 0.03 }], modRowRT);
  rCtl.box._role = "r";
  thCtl.box._role = "theta";
  const tCtl = makeSlider("t", 0, 1, 0.01, 0, function (v) {
    if (v >= 1) return "\u221e";
    return (v / (1 - v)).toFixed(2);
  }, [], modRowTG,
    "climbs the current exterior sphere from its base to its tip (readout t/(1-t))");
  const phCtl = makeSlider("\u03c6", -1, 1, 0.005, 0, function (v) {
    if (v >= 1) return "\u03c0";
    if (v <= -1) return "-\u03c0";
    return (v * Math.PI).toFixed(2);
  }, [{ value: 0, tol: 0.03 }], modRowTG);

  // Stack the lim button BELOW the t slider, hyperpolygon-style.
  const tCol = document.createElement("div");
  tCol.className = "ek-tcol";
  tCol.appendChild(tCtl.box);
  tCtl.box.style.flex = "1 1 auto";
  const limBtn = document.createElement("button");
  limBtn.type = "button";
  limBtn.className = "ek-btn";
  limBtn.textContent = "lim t\u2192\u221e";
  limBtn.style.display = "none";
  limBtn.style.alignSelf = "flex-start";
  tCol.appendChild(limBtn);
  modRowTG.insertBefore(tCol, phCtl.box);

  // --- beta panel stub (user request 2026-10-02): the container exists so
  // the beta/chamber controls can be dropped in later; deliberately blank
  // for now.
  const betaPanel = document.createElement("div");
  betaPanel.className = "ek-panel";
  betaPanel.id = "ek-nakajima-beta-panel";
  ctrlCol.appendChild(betaPanel);

  const coreView = makeCoreView(frame, { getPalette: palette });
  if (coreView && coreView.setHover) {
    frame.addEventListener("pointerenter", function () { coreView.setHover(true); });
    frame.addEventListener("pointerleave", function () { coreView.setHover(false); });
  }
  let lay = null;
  let lastState = null;

  // --- stratum stepping (user request 2026-10-02) -------------------------
  // t is local to ONE exterior sphere; the lim button moves the dot by
  // exactly one sphere. At a sphere's tip the outward step lands on the
  // base of the next sphere (t = 0); at its base the inward step lands on
  // the tip of the previous one (t = 1). No whole-chain jump.
  const LIM_T0_BAND = 0.1;

  function limMode(t) {
    if (!lastState) return null;
    if (lastState.kind === "arm") {
      if (state.sphere < lastState.sphereCount - 1 && t >= T_NEAR_INF) return "up";
      if (state.sphere > 0 && t <= LIM_T0_BAND) return "down";
      return null;
    }
    // Captured central branch (r inside an arm's capture band but not
    // exactly on its attachment): the dot is blended onto that arm's FIRST
    // sphere near its tip, so offer the outward step when a next sphere
    // exists (user request 2026-10-02; restores the pre-rework handover).
    if (
      lastState.kind === "central" &&
      lastState.capture &&
      lastState.capture.w >= CAP_NEAR_INF_W &&
      t >= T_NEAR_INF &&
      lay.arms[lastState.capture.k] &&
      lay.arms[lastState.capture.k].nodes.length > 1
    ) {
      return "enter";
    }
    return null;
  }

  limBtn.addEventListener("click", function () {
    const t = parseFloat(tCtl.input.value);
    const mode = limMode(t);
    if (mode === "up") {
      state.sphere += 1;
      tCtl.input.value = "0";
    } else if (mode === "down") {
      state.sphere -= 1;
      tCtl.input.value = "1";
    } else if (mode === "enter") {
      // step off the capture blend onto the captured arm, one sphere out
      state.arm = lastState.capture.k;
      state.sphere = 1;
      rCtl.input.value = String(lay.arms[state.arm].param);
      thCtl.input.value = "0";
      tCtl.input.value = "0";
    } else {
      return;
    }
    apply();
  });

  // --- readouts / snapping ----------------------------------------------
  function snapR(v) {
    if (!lay) return v;
    for (const arm of lay.arms) {
      if (Math.abs(v - arm.param) <= 0.02) return arm.param;
    }
    return v;
  }
  function snapTheta(s) {
    return Math.abs(s) <= 0.03 ? 0 : s;
  }

  // --- apply: read sliders -> flow -> view ------------------------------
  function apply(fromInput) {
    if (!lay || !coreView) return;
    if (fromInput === "r") {
      const raw = parseFloat(rCtl.input.value);
      const snapped = snapR(raw);
      if (snapped !== raw) rCtl.input.value = String(snapped);
    }
    if (fromInput === "theta") {
      const raw = parseFloat(thCtl.input.value);
      const snapped = snapTheta(raw);
      if (snapped !== raw) thCtl.input.value = String(snapped);
    }

    const r = parseFloat(rCtl.input.value);
    const theta = parseFloat(thCtl.input.value) * Math.PI;
    const t = parseFloat(tCtl.input.value);
    const phi = parseFloat(phCtl.input.value) * Math.PI;

    // Re-select the arm (and reset the sphere index when it changes) before
    // the flow call so the first frame on a new arm is already sphere 0.
    // `armAt` is shared with coreFlow so the two cannot disagree.
    const arm = armAt(lay, r, theta);
    if (arm !== state.arm) {
      state.arm = arm;
      state.sphere = 0;
    }

    lastState = coreView.update(lay, { r: r, theta: theta, t: t, phi: phi, sphere: state.sphere }, true);

    // readouts
    rCtl.updateReadout();
    thCtl.updateReadout();
    tCtl.updateReadout();
    phCtl.updateReadout();

    // lim button gate
    const mode = limMode(t);
    if (mode === "up" || mode === "enter") {
      limBtn.style.display = "inline-block";
      limBtn.textContent = "lim t\u2192\u221e";
      limBtn.title =
        mode === "enter"
          ? "enter the captured sphere and step outward one sphere"
          : "move outward one sphere (to the base of the next sphere)";
    } else if (mode === "down") {
      limBtn.style.display = "inline-block";
      limBtn.textContent = "lim t\u21920";
      limBtn.title = "move inward one sphere (to the tip of the previous sphere)";
    } else {
      limBtn.style.display = "none";
    }
  }

  function sync() {
    for (const key of Object.keys(tabButtons)) {
      tabButtons[key].classList.toggle("ek-active", key === state.key);
    }
    const q = AFFINE_ADE[state.key];
    lay = buildSideLayout(q);
    state.arm = -1;
    state.sphere = 0;
    if (coreView) {
      coreView.setLayout(lay);
      coreView.refreshTheme();
    }
    cap.textContent = "ALE core of " + q.name + ": exceptional \u2119\u00b9's";
    apply();
  }

  // resize handling
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(function () {
      if (coreView && coreView.resize) coreView.resize();
    });
    ro.observe(frame);
  } else {
    window.addEventListener("resize", function () {
      if (coreView && coreView.resize) coreView.resize();
    });
  }

  // theme repaint
  const themeObserver = new MutationObserver(function () {
    if (coreView) coreView.refreshTheme();
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
