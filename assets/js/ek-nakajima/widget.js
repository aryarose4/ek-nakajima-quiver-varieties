// E6 complex representatives and simultaneous flag/moduli views.
// Compact representatives and the schematic core flow share coordinate controls.

import { AFFINE_ADE } from "./quiver-data.js";
import { buildSideLayout, makeCoreView, armAt, CAP_NEAR_INF_W, T_NEAR_INF } from "./core-view.js";
import { e6AtlasPoint, e6HasInfinityLimit } from "./e6-atlas.js";
import { createBalancedClient } from './balanced-client.js';
import { e6CoreAreas } from "./e6-areas.js";
import { createParametersPanel } from "./parameters-panel.js";
import { E6_DEFAULT_BETA, betaToLevels, e6DisplayBeta, e6ChamberWallOptions, e6ChamberWord } from './e6-parameters.js';
import { makeRepresentationReadout, representativeForDisplay } from "./representation-readout.js";
import { makeElementView } from "./element-render.js";
import { snapSliderInput } from "./slider-magnet.js";

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
    "  --ek-red: #a8322a;",
    "  --ek-wall: #c0392b;",
    "  --ek-amber: #9a6a1f;",
    "  --ek-amber-bg: #f4e8d0;",
    "  --ek-chamber-tx: #4a525c;",
    "}",
    '[data-theme="dark"] #ek-nakajima-widget {',
    "  --ek-box-bd: #4a4a4a;",
    "  --ek-box-tx: #b0b0b0;",
    "  --ek-panel-bg: rgba(148, 163, 184, 0.07);",
    "  --ek-frame-bg: rgba(148, 163, 184, 0.04);",
    "  --ek-track: #4a4a4a;",
    "  --ek-thumb: #b3b3b3;",
    "  --ek-btn-bd: #4a4a4a;",
    "  --ek-btn-tx: #b0b0b0;",
    "  --ek-red: #6b3630;",
    "  --ek-wall: #e07060;",
    "  --ek-amber: #d9a558;",
    "  --ek-amber-bg: #453519;",
    "  --ek-chamber-tx: var(--ek-box-tx);",
    "}",
    "#ek-nakajima-widget .ek-quiver { margin: 12px 0 20px; color: inherit; }",
    "#ek-nakajima-widget .ek-quiver img { display: block; width: 100%; max-width: 520px; height: auto; margin: auto; }",
    '#ek-nakajima-widget .ek-quiver[data-type="E6"] img { max-width: 400px; }',
    "#ek-nakajima-widget .ek-quiver .ek-quiver-dark { display: none; }",
    '[data-theme="dark"] #ek-nakajima-widget .ek-quiver .ek-quiver-light { display: none; }',
    '[data-theme="dark"] #ek-nakajima-widget .ek-quiver .ek-quiver-dark { display: block; }',
    "#ek-nakajima-widget .ek-quiver figcaption { text-align: center; font-size: .8em; color: var(--ek-box-tx); }",
    "#ek-nakajima-widget .ek-intro-note { color: var(--ek-box-tx); font-size: .85em; }",
    "#ek-nakajima-widget .ek-introduction { margin-bottom: 24px; }",
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
    "#ek-nakajima-widget .ek-beta-slider::-webkit-slider-runnable-track { background: linear-gradient(to right, var(--ek-red) 0%, var(--ek-red) var(--ek-beta-lo), var(--ek-track) var(--ek-beta-lo), var(--ek-track) var(--ek-beta-hi), var(--ek-red) var(--ek-beta-hi), var(--ek-red) 100%); }",
    "#ek-nakajima-widget .ek-beta-slider::-moz-range-track { background: linear-gradient(to right, var(--ek-red) 0%, var(--ek-red) var(--ek-beta-lo), var(--ek-track) var(--ek-beta-lo), var(--ek-track) var(--ek-beta-hi), var(--ek-red) var(--ek-beta-hi), var(--ek-red) 100%); }",
    "#ek-nakajima-widget .ek-btn { padding: 2px 10px; border: 1px solid var(--ek-btn-bd);",
    "  border-radius: 6px; background: transparent; color: var(--ek-btn-tx);",
    "  font-size: 0.85em; cursor: pointer; font-family: inherit; }",
    "#ek-nakajima-widget .ek-btn[aria-pressed='true'] { background: var(--ek-btn-tx); border-color: var(--ek-btn-tx); color: #fff; }",
    "[data-theme='dark'] #ek-nakajima-widget .ek-btn[aria-pressed='true'] { color: #14181e; }",
    "#ek-nakajima-widget .ek-btn:focus-visible { outline:2px solid currentColor; outline-offset:2px; }",
    "#ek-nakajima-widget .ek-btn:hover { border-color: var(--ek-btn-tx); }",
    "#ek-nakajima-widget .ek-cross-btn { border-color: var(--ek-amber); color: var(--ek-amber); background: transparent; padding: 0 6px; font-size: .75em; }",
    "#ek-nakajima-widget .ek-cross-btn:disabled { opacity: .45; cursor: default; }",
    "#ek-nakajima-widget .ek-cross-btn:not(:disabled):hover { border-color: var(--ek-amber); color: var(--ek-amber); }",
    "#ek-nakajima-widget .ek-wall-action-row[data-at-wall='true'] { color: var(--ek-amber); background: var(--ek-amber-bg); }",
  ].join("\n");
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Mount.
// ---------------------------------------------------------------------------
// The doubled affine quiver, with x directed toward the central vertex.
// In E6 these are the atlas maps a_i: C -> C^2 and A_i: C^2 -> C^3;
// y denotes the reverse maps b_i and B_i. No extra framing vertex is added.
const INTRO_QUIVER_IMAGES = null; // Replaced with data URLs by build-single.mjs.
function introMarkup(key) {
  const q = AFFINE_ADE[key];
  const group = key === "E6" ? "tetrahedral" : key === "E7" ? "octahedral" : "icosahedral";
  const image = function (theme) {
    const name = key.toLowerCase() + '_' + theme + '.svg';
    return INTRO_QUIVER_IMAGES ? INTRO_QUIVER_IMAGES[name] : 'assets/img/ek-nakajima/' + name;
  };
  const alt = 'Doubled ' + key + ' quiver, dimensions ' + q.marks.join(', ') + '. Left, right and upper branches; x points inward and y outward. Central SL(' + q.rStar + ', C), GL at other vertices; no framing.';
  const typeMarkup = 'E<sub>' + key.slice(1) + '</sub>';
  return '<figure class="ek-quiver" data-type="'+key+'"><img class="ek-quiver-light" src="'+image('light')+'" alt="'+alt+'"><img class="ek-quiver-dark" src="'+image('dark')+'" alt="'+alt+'"><figcaption>Q: doubled affine '+typeMarkup+' quiver</figcaption></figure>'+
    '<div class="intro"><p>'+(key === "E6" ? "The sliders" : "In the E<sub>6</sub> explorer, the sliders")+' parameterize &beta;-stable representations (x,y) of Q with complex moment 0, up to the action of the complex symmetry group. The solver finds a complex gauge transformation that balances (x, y) at &mu;<sub>&Ropf;</sub> = &beta;; the flag incidence panel displays the result.</p><p>For generic &beta;, this moduli space of four real dimensions is the minimal resolution of &Copf;&sup2;/&Gamma;, where &Gamma; &sub; SU(2) is the binary '+group+' group. With its hyperk&auml;hler metric, it is the ALE-'+typeMarkup+' gravitational instanton.</p><p class="ek-intro-note">'+(key === 'E6' ? 'The live solver and flag-incidence view currently support E<sub>6</sub>.' : 'The '+typeMarkup+' quiver and schematic core are available; its solver and flag-incidence view are not yet implemented.')+'</p></div>';
}

function activate(container) {
  ensureStyles();
  container.setAttribute("data-e6-levels", JSON.stringify(betaToLevels(E6_DEFAULT_BETA)));
  const state = { key: "E6", sphere: 0, arm: -1, outgoing: false };
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

  const intro = document.createElement("section");
  intro.className = "ek-introduction";
  container.appendChild(intro);

  const matrixHost = document.createElement("div");
  matrixHost.className = "ek-panel";
  matrixHost.style.marginBottom = "12px";
  container.appendChild(matrixHost);
  const matrixTop = document.createElement("div");
  matrixTop.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin-bottom:10px";
  matrixHost.appendChild(matrixTop);
  let representationMode = 'balanced';
  let displayedResult = null;
  const representationButtons = {};
  const representationSelector = document.createElement("div");
  representationSelector.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;min-width:0";
  representationSelector.setAttribute('role', 'group');
  representationSelector.setAttribute('aria-label', 'Representative');
  matrixTop.appendChild(representationSelector);
  const solvingStatus = document.createElement('span');
  solvingStatus.id = 'ek-representative-status';
  solvingStatus.style.cssText = "margin-left:auto;color:#888;white-space:nowrap;min-width:5em;min-height:1.5em;text-align:right";
  solvingStatus.setAttribute('role', 'status');
  matrixTop.appendChild(solvingStatus);
  function setRepresentationBusy(busy) {
    matrixHost.setAttribute('aria-busy', String(busy));
    solvingStatus.textContent = busy ? 'Solving\u2026' : '';
  }
  setRepresentationBusy(false);
  [['balanced', 'Balanced Representative'], ['complex', 'Complex Orbit Representative']].forEach(function(entry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ek-btn';
    button.id = 'ek-representative-' + entry[0];
    button.textContent = entry[1];
    button.setAttribute('aria-pressed', entry[0] === representationMode ? 'true' : 'false');
    button.addEventListener('click', function() {
      representationMode = entry[0];
      refreshRepresentation();
    });
    representationButtons[entry[0]] = button;
    representationSelector.appendChild(button);
  });
  const matrices = makeRepresentationReadout(matrixHost);
  function refreshRepresentation() {
    Object.keys(representationButtons).forEach(function(mode) {
      const selected = mode === representationMode;
      representationButtons[mode].setAttribute('aria-pressed', selected ? 'true' : 'false');
      representationButtons[mode].classList.toggle('active', selected);
    });
    const rep = representativeForDisplay(displayedResult, representationMode);
    matrixHost.title = representationMode === 'complex' ? 'A gauge-equivalent representative of the current complex orbit' : '';
    matrices.setData(rep);
  }
  function clearRepresentation() {
    displayedResult = null;
    refreshRepresentation();
  }
  refreshRepresentation();

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
  const incidenceFrame = frame(left, "ek-incidence-view", "Flag Incidence");
  const coreFrame = frame(right, "ek-moduli-view", "Moduli Space");
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

  // Keep intent through coalesced inputs and obsolete worker progress until
  // the latest accepted result settles (or the request is invalidated).
  let outstandingSnap = false;
  function slider(host, id, label, min, max, step, value, format, title, snaps) {
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
    input.disabled = false;
    input.title = title;
    const readout = document.createElement("span");
    readout.className = "ek-readout";
    const snapInput = snapSliderInput(input, snaps);
    function getValue() { return Number(input.value); }
    function refresh() { readout.textContent = format(getValue()); }
    input.addEventListener("input", function () {
      outstandingSnap = snapInput() || outstandingSnap;
      refresh();
      apply();
    });
    box.appendChild(lab);
    box.appendChild(input);
    box.appendChild(readout);
    host.appendChild(box);
    refresh();
    return { input: input, refresh: refresh, getValue: getValue };
  }
  const rControl = slider(firstRow, "ek-r", "r", 0, 1, 0.001, 0.25,
    function (v) { return v.toFixed(3); }, "z = r/(1-r) exp(i theta); r = 1 gives infinity",
    [0, 0.5, 1].map(function (v) { return { value: v, tol: v === 0.5 ? 0.02 : 0.005 }; }));
  const thetaControl = slider(firstRow, "ek-theta", "\u03b8", -Math.PI, Math.PI, "any", 0,
    function (v) { return v.toFixed(3); }, "Phase in radians", [{ value: 0, tol: 0.03 * Math.PI }]);
  const tCol = document.createElement("div");
  tCol.className = "ek-tcol";
  secondRow.appendChild(tCol);
  const tControl = slider(tCol, "ek-t", "t", 0, 1, 0.001, 0,
    function (v) { return v >= 1 ? "\u221e" : (v / (1 - v)).toFixed(2); },
    "Local flow on the current sphere; readout t/(1-t)", []);
  tControl.input.parentNode.style.flex = "1 1 auto";
  const limBtn = document.createElement("button");
  limBtn.id = "ek-limit";
  limBtn.type = "button";
  limBtn.className = "ek-btn";
  limBtn.style.display = "none";
  limBtn.style.alignSelf = "flex-start";
  tCol.appendChild(limBtn);
  const phiControl = slider(secondRow, "ek-phi", "\u03c6", -Math.PI, Math.PI, "any", 0,
    function (v) { return v.toFixed(3); }, "Flow phase in radians", [{ value: 0, tol: 0.03 * Math.PI }]);

  const coreView = makeCoreView(coreFrame, { getPalette: palette });
  const incidenceView = makeElementView(incidenceFrame, { getPalette: palette });
  if (coreView && coreView.setHover) {
    coreFrame.addEventListener("pointerenter", function () { coreView.setHover(true); });
    coreFrame.addEventListener("pointerleave", function () { coreView.setHover(false); });
  }
  let layout = null;
  let chamberId = 'default';
  let chamberEpoch = 0;
  const balancedClient = createBalancedClient({ onProgress: function (result, parameters, levels) {
    displayBalanced(result, parameters, levels, outstandingSnap);
    // This is a validated intermediate representation, not the latest request.
    incidenceFrame.setAttribute('aria-busy', 'true');
    incidenceFrame.setAttribute('data-balanced', 'pending');
  } });
  let balancedFrame = null;
  let lastBalancedKey = null;
  const parametersPanel = createParametersPanel(right, {
    getChamberId: () => chamberId,
    wallActions: {
      rows: true,
      getOptions: beta => e6ChamberWallOptions(beta, chamberId),
      onCross: function (wall) {
        // Keep beta and the dot's chart coordinates pinned. At the collapsed
        // component these coordinates denote the selected side's regular
        // limit; data-requested/displayed-levels report the interior sample.
        chamberId = wall.targetChamberId;
        chamberEpoch++;
        outstandingSnap = false; balancedClient.invalidate(); balancedFrame = null; lastBalancedKey = null;
        container.setAttribute('data-e6-chamber', chamberId);
        container.setAttribute('data-e6-chamber-epoch', String(chamberEpoch));
        parametersPanel.refresh(); refreshCoreLayout(); apply();
      }
    }, onChange: function (beta, levels) {
    lastBalancedKey = null;
    container.setAttribute('data-e6-levels', JSON.stringify(levels));
    refreshCoreLayout();
    apply();
  } });
  function displayBalanced(result, parameters, levels, animateSnap) {
    displayedResult = result;
    refreshRepresentation();
    const frame = incidenceView.setData({ balancedRep: result.solvedRep, chamberId: result.chamberId || chamberId, parameters, previous: balancedFrame, animateSnap: !!animateSnap });
    if (frame && frame.valid) balancedFrame = frame.continuation;
    incidenceFrame.setAttribute('data-displayed-parameters', JSON.stringify(parameters));
    incidenceFrame.setAttribute('data-displayed-levels', JSON.stringify(levels));
    incidenceFrame.setAttribute('data-real-residual', String(result.residuals.real_norm));
    incidenceView.setStatus('', 'info');
  }
  let lastFlow = null;
  function limitMode(t) {
    if (!lastFlow) return null;
    if (state.outgoing) return t <= 0.1 ? "return" : null;
    if (lastFlow.kind === "arm") {
      if (state.key === "E6" && state.sphere === lastFlow.sphereCount - 1 && t >= T_NEAR_INF) return "outgoing";
      if (state.sphere < lastFlow.sphereCount - 1 && t >= T_NEAR_INF) return "up";
      if (state.sphere > 0 && t <= 0.1) return "down";
    } else if (lastFlow.capture && lastFlow.capture.w >= CAP_NEAR_INF_W && t >= T_NEAR_INF &&
        (layout.arms[lastFlow.capture.k].nodes.length > 1 ||
         (state.key === "E6" && lastFlow.capture.k === 1))) return "enter";
    return null;
  }
  limBtn.addEventListener("click", function () {
    // Flush current slider values before resolving a transition (RAF may be pending).
    update();
    const mode = limitMode(Number(tControl.input.value));
    if (mode === "outgoing") { state.outgoing = true; tControl.input.value = "0"; }
    else if (mode === "return") { state.outgoing = false; tControl.input.max = "1"; tControl.input.value = "1"; }
    else if (mode === "up") { state.sphere++; tControl.input.value = "0"; }
    else if (mode === "down") { state.sphere--; tControl.input.value = "1"; }
    else if (mode === "enter") {
      state.arm = lastFlow.capture.k;
      state.outgoing = state.key === "E6" && state.arm === 1;
      state.sphere = state.outgoing ? 0 : 1;
      rControl.input.value = String(layout.arms[state.arm].param);
      thetaControl.input.value = "0";
      tControl.input.value = "0";
    } else return;
    apply();
  });
  let pending = false;
  function apply() {
    if (pending) return;
    pending = true;
    const run = function () { pending = false; update(); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else setTimeout(run, 0);
  }
  function update() {
    const r = rControl.getValue();
    const theta = thetaControl.getValue();
    const phi = phiControl.getValue();
    const arm = armAt(layout, r, theta);
    if (arm !== state.arm) { state.arm = arm; state.sphere = 0; state.outgoing = false; }
    const tMax = state.key !== 'E6' || e6HasInfinityLimit({r, theta, sphere:state.sphere, outgoing:state.outgoing}) ? 1 : .99;
    tControl.input.max = String(tMax);
    if (Number(tControl.input.value) > tMax) tControl.input.value = String(tMax);
    const t = Number(tControl.input.value);
    rControl.refresh();
    thetaControl.refresh();
    tControl.refresh();
    phiControl.refresh();
    lastFlow = coreView ? coreView.update(layout, { r: r, theta: theta, t: t, phi: phi, sphere: state.sphere, outgoing: state.outgoing }, true) : null;
    const mode = limitMode(t);
    limBtn.style.display = mode ? "inline-block" : "none";
    limBtn.textContent = mode === "down" || mode === "return" ? "lim t\u21920" : "lim t\u2192\u221e";
    limBtn.title = mode === "down" || mode === "return" ? "Move inward" : "Move outward";
    coreFrame.setAttribute("data-flow", lastFlow ? lastFlow.kind : "");
    coreFrame.setAttribute("data-sphere", String(state.sphere));
    if (state.key !== "E6") {
      outstandingSnap = false; balancedClient.invalidate(); lastBalancedKey = null; balancedFrame = null;
      setRepresentationBusy(false);
      incidenceFrame.setAttribute('aria-busy', 'false');
      incidenceFrame.setAttribute('data-balanced', 'false');
      coreFrame.setAttribute("data-fixed", "false");
      clearRepresentation();
      incidenceView.setData(null);
      incidenceView.setStatus("E6 only", "warn");
      return;
    }
    try {
      const parameters = { r, theta, t, phi, sphere: state.sphere, outgoing: state.outgoing };
      const point = e6AtlasPoint(parameters);
      coreFrame.setAttribute("data-fixed", point.grading ? "true" : "false");
      const requestedLevels = parametersPanel.getLevels();
      const levels = betaToLevels(e6DisplayBeta(parametersPanel.getBeta(), chamberId));
      const epoch = chamberEpoch;
      const chamber = { id: chamberId, word: e6ChamberWord(chamberId) };
      container.setAttribute('data-e6-chamber', chamberId);
      incidenceFrame.setAttribute('data-requested-levels', JSON.stringify(requestedLevels));
      incidenceFrame.setAttribute('data-wall-approximation', JSON.stringify(levels) !== JSON.stringify(requestedLevels) ? 'true' : 'false');
      const key = JSON.stringify({ parameters, levels, chamberId });
      if (key === lastBalancedKey) {
        if (incidenceFrame.getAttribute('aria-busy') !== 'true') outstandingSnap = false;
        return;
      }
      lastBalancedKey = key;
      setRepresentationBusy(true);
      incidenceFrame.setAttribute('aria-busy', 'true');
      incidenceFrame.setAttribute('data-balanced', 'pending');
      balancedClient.request(parameters, function (result) {
        if (epoch !== chamberEpoch || key !== lastBalancedKey) return;
        setRepresentationBusy(false);
        incidenceFrame.setAttribute('aria-busy', 'false');
        if (!result.success) {
          outstandingSnap = false;
          incidenceFrame.setAttribute('data-balanced', 'false');
          clearRepresentation();
          incidenceView.setData(null);
          incidenceView.setStatus('Balanced representation unavailable', 'error');
          return;
        }
        displayBalanced(result, parameters, levels, outstandingSnap);
        outstandingSnap = false;
        incidenceFrame.setAttribute('data-balanced', 'true');
      }, levels, chamber);
    } catch (error) {
      outstandingSnap = false; balancedClient.invalidate(); lastBalancedKey = null;
      setRepresentationBusy(false);
      incidenceFrame.setAttribute('aria-busy', 'false');
      incidenceFrame.setAttribute('data-balanced', 'false');
      coreFrame.setAttribute("data-fixed", "false");
      clearRepresentation();
      incidenceView.setData(null);
      incidenceView.setStatus("Representation unavailable", "error");
    }
  }
  function refreshCoreLayout() {
    const options = state.key === "E6" ? { radii: e6CoreAreas(e6DisplayBeta(parametersPanel.getBeta(), chamberId), chamberId).radii } : {};
    layout = buildSideLayout(AFFINE_ADE[state.key], options);
    if (coreView) coreView.setLayout(layout);
  }
  function sync() {
    intro.innerHTML = introMarkup(state.key);
    parametersPanel.setEnabled(state.key === "E6");
    Object.keys(tabButtons).forEach(function (key) {
      tabButtons[key].classList.toggle("ek-active", key === state.key);
      tabButtons[key].setAttribute("aria-pressed", String(key === state.key));
    });
    refreshCoreLayout();
    state.arm = -1;
    state.sphere = 0;
    state.outgoing = false;
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
    parametersPanel.refreshTheme();
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
