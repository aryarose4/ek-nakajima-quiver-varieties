// Headless integration smoke: simultaneous flag/moduli views, shared compact
// coordinates, live complex x/y matrices, phase hue and projective endpoints.
// DOM/canvas/THREE stubs only; tests/run.sh copies the live modules here.

// ---------------------------------------------------------------------------
// recording 2D context
// ---------------------------------------------------------------------------
function makeCtx() {
  const calls = [];
  const ctx = { calls: calls, arcs: [], moves: [], lines: [], strokes: [] };
  const methods = [
    "clearRect", "setTransform", "scale", "translate", "rotate", "save", "restore",
    "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "ellipse", "rect",
    "fill", "stroke", "fillRect", "strokeRect", "fillText", "strokeText",
    "setLineDash", "clip", "bezierCurveTo", "quadraticCurveTo",
    "createLinearGradient", "createRadialGradient", "measureText",
  ];
  methods.forEach(function (m) {
    ctx[m] = function () {
      calls.push(m);
      if (m === "stroke") ctx.strokes.push(ctx.strokeStyle);
      if (m === "arc") ctx.arcs.push(Array.prototype.slice.call(arguments));
      if (m === "moveTo") ctx.moves.push(Array.prototype.slice.call(arguments));
      if (m === "lineTo") ctx.lines.push(Array.prototype.slice.call(arguments));
      if (m === "measureText") return { width: 0 };
      if (m === "createLinearGradient" || m === "createRadialGradient") return { addColorStop: function () {} };
    };
  });
  return ctx;
}

// ---------------------------------------------------------------------------
// fake element
// ---------------------------------------------------------------------------
function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: { setProperty(k, v) { this[k] = v; } },
    children: [],
    parentNode: null,
    _classes: [],
    _handlers: {},
    textContent: "",
    id: "",
    type: "",
    value: "",
    min: "", max: "", step: "", title: "", width: 0, height: 0,
    appendChild: function (c) { el.children.push(c); if (c) c.parentNode = el; return c; },
    removeChild: function (c) { el.children = el.children.filter(function (x) { return x !== c; }); },
    insertBefore: function (node, ref) {
      const i = el.children.indexOf(ref);
      if (i < 0) el.children.push(node); else el.children.splice(i, 0, node);
      if (node) node.parentNode = el;
      return node;
    },
    addEventListener: function (t, fn) { (el._handlers[t] || (el._handlers[t] = [])).push(fn); },
    removeEventListener: function (t, fn) { if (el._handlers[t]) el._handlers[t] = el._handlers[t].filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { el._fire(ev && ev.type ? ev.type : "event", ev); return true; },
    _fire: function (type, ev) {
      (el._handlers[type] || []).forEach(function (fn) {
        fn(ev || { type: type, preventDefault: function () {}, clientX: 0, clientY: 0, deltaY: 0, pointerId: 1 });
      });
    },
    getContext: function (kind) { if (kind === "2d") return el._ctx || (el._ctx = makeCtx()); return null; },
    setPointerCapture: function () {}, releasePointerCapture: function () {},
    setAttribute: function (key, value) { el[key] = value; },
    getAttribute: function (key) { return el[key] === undefined ? null : el[key]; },
  };
  Object.defineProperty(el, "className", {
    get: function () { return el._classes.join(" "); },
    set: function (v) { el._classes = String(v).split(/\s+/).filter(Boolean); },
  });
  Object.defineProperty(el, "clientWidth", { get: function () { return 320; } });
  Object.defineProperty(el, "clientHeight", { get: function () { return 320; } });
  const classList = {
    add: function (c) { if (el._classes.indexOf(c) < 0) el._classes.push(c); },
    remove: function (c) { el._classes = el._classes.filter(function (x) { return x !== c; }); },
    contains: function (c) { return el._classes.indexOf(c) >= 0; },
    toggle: function (c, on) {
      const has = el._classes.indexOf(c) >= 0;
      const want = on === undefined ? !has : !!on;
      if (want && !has) el._classes.push(c);
      if (!want && has) el._classes = el._classes.filter(function (x) { return x !== c; });
      return want;
    },
  };
  el.classList = classList;
  return el;
}

// ---------------------------------------------------------------------------
// fake document / window
// ---------------------------------------------------------------------------
const registry = {};
const head = makeEl("head");
head.appendChild = function (c) { this.children.push(c); if (c && c.id) registry[c.id] = c; return c; };
const docEl = makeEl("html");
docEl.getAttribute = function (n) { return n === "data-theme" ? "dark" : null; };
const fakeDoc = {
  documentElement: docEl,
  head: head,
  createElement: function (t) { return makeEl(t); },
  getElementById: function (id) { return registry[id] || null; },
  querySelectorAll: function () { return []; },
  addEventListener: function () {},
};
const fakeWindow = { devicePixelRatio: 1, addEventListener: function () {}, removeEventListener: function () {} };

global.document = fakeDoc;
global.window = fakeWindow;
global.ResizeObserver = function (fn) { this.fn = fn; this.observe = function () {}; this.unobserve = function () {}; this.disconnect = function () {}; };
global.MutationObserver = function (fn) { this.fn = fn; this.observe = function () {}; this.disconnect = function () {}; };
// requestAnimationFrame QUEUES callbacks (it must not run them synchronously:
// core-view.js drives a self-re-enqueuing render loop). The element solve is
// coalesced to one call per frame, so the test flushes a bounded number of
// queued frames via flushRaf() at the points where a solve is expected.
const rafQueue = [];
global.requestAnimationFrame = function (fn) { rafQueue.push(fn); return rafQueue.length; };
function flushRaf(max) {
  const n = max === undefined ? 8 : max;
  for (let i = 0; i < n && rafQueue.length; i++) {
    const fn = rafQueue.shift();
    if (typeof fn === "function") fn();
  }
}
global.cancelAnimationFrame = function () {};
if (!global.performance) global.performance = { now: function () { return Date.now(); } };

// Universal Proxy stub for THREE (callable + constructable + property chain).
function makeThreeStub() {
  function makeStub() {
    const target = function () {};
    return new Proxy(target, {
      get: function (t, prop) {
        if (prop === Symbol.toPrimitive || prop === "valueOf") return function () { return 0; };
        if (prop === "toString") return function () { return "three-stub"; };
        if (prop === "then" || prop === Symbol.iterator) return undefined;
        if (prop === "length") return 0;
        if (prop === "children") return t.children || (t.children = []);
        if (prop in t) return t[prop];
        const child = makeStub();
        t[prop] = child;
        return child;
      },
      set: function (t, prop, v) { t[prop] = v; return true; },
      apply: function () { return makeStub(); },
      construct: function () { return makeStub(); },
      has: function () { return true; },
    });
  }
  return makeStub();
}
global.THREE = makeThreeStub();

// ---------------------------------------------------------------------------
// assertions
// ---------------------------------------------------------------------------
let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) pass++;
  else { fail++; console.log("  FAIL: " + name + (detail ? " :: " + detail : "")); }
}
function walk(el, out) {
  if (!el || !el.children) return out;
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    out.push(c);
    walk(c, out);
  }
  return out;
}
function findByText(el, text) {
  const all = walk(el, []);
  for (let i = 0; i < all.length; i++) if (all[i].textContent === text) return all[i];
  return null;
}

const container = makeEl("div");
registry["ek-nakajima-widget"] = container;

async function main() {
  try { await import("./widget.js"); }
  catch (error) { check("widget imports", false, String(error)); console.log(error.stack); process.exit(1); }
  flushRaf();
  check("widget mounts", container.children.length > 0);
  const all = walk(container, []);
  const incidence = all.find(function(e) { return e.id === "ek-incidence-view"; });
  const moduli = all.find(function(e) { return e.id === "ek-moduli-view"; });
  check("incidence and moduli views are simultaneously visible", !!incidence && !!moduli && incidence.style.display !== "none" && moduli.style.display !== "none");
  check("view toggles removed", !findByText(container, "ALE core"));
  check("example presets removed", !findByText(container, "Generic") && !findByText(container, "Concurrent lines"));
  check("incidence table removed", !all.some(function(e) { return e.tagName === "TABLE"; }));
  const radius = all.find(function(e) { return e.id === "ek-r"; });
  const theta = all.find(function(e) { return e.id === "ek-theta"; });
  check("one compact radius slider", radius && radius.min === "0" && radius.max === "1");
  check("one theta slider", !!theta);
  const ranges = all.filter(function(e) { return e.tagName === "INPUT" && e.type === "range"; });
  check("four coordinate and six beta sliders are enabled", ranges.length === 10 && ranges.every(function(e) { return !e.disabled; }));
  const t = all.find(function(e) { return e.id === "ek-t"; });
  const phi = all.find(function(e) { return e.id === "ek-phi"; });
  const limit = all.find(function(e) { return e.id === "ek-limit"; });
  check("no extra flow-status text", !all.some(function(e) { return e.id === "ek-flow-status"; }));
  function set(input, value) { input.value = String(value); input._fire("input", { type: "input" }); flushRaf(); }
  const matrices = all.filter(function(e) { return e.className === "ek-rep-matrix"; });
  const cells = all.filter(function(e) { return e.className === "ek-rep-cell"; });
  check("all x and y arrows displayed", matrices.length === 12 && cells.length === 48);
  const balanced = () => incidence.getAttribute('data-balanced') === 'true' && Number(incidence.getAttribute('data-real-residual')) < 1e-7;
  const matrixText = () => cells.map(e => e.textContent).join(',');
  check('initial displayed matrices are balanced', balanced());
  const balancedButton = all.find(e => e.id === 'ek-representative-balanced');
  const complexButton = all.find(e => e.id === 'ek-representative-complex');
  check('balanced representative selected by default', balancedButton.getAttribute('aria-pressed') === 'true' && complexButton.getAttribute('aria-pressed') === 'false');
  const balancedText = matrixText();
  const incidenceBeforeRepresentativeToggle = incidence.getAttribute('data-displayed-parameters');
  complexButton._fire('click');
  check('complex selector changes matrices without changing incidence', matrixText() !== balancedText && incidence.getAttribute('data-displayed-parameters') === incidenceBeforeRepresentativeToggle && complexButton.getAttribute('aria-pressed') === 'true');
  const copied = [];
  Object.defineProperty(globalThis, 'navigator', {configurable:true,value:{clipboard:{writeText(text) {copied.push(text); return Promise.resolve();}}}});
  const copyButton = all.find(e => e.className === 'ek-rep-copy');
  copyButton._fire('click'); await Promise.resolve(); await Promise.resolve();
  check('copy follows selected complex matrices', copied.length === 1 && copied[0].includes(cells[0].textContent));
  set(radius, 0.3);
  check('complex selection persists across slider changes', complexButton.getAttribute('aria-pressed') === 'true' && cells.every(e => e.textContent !== '\u2014'));
  set(radius, 0.5);
  balancedButton._fire('click');
  check('balanced toggle restores balanced matrices', matrixText() === balancedText && balancedButton.getAttribute('aria-pressed') === 'true');
  copyButton._fire('click'); await Promise.resolve(); await Promise.resolve();
  check('copy changes with representative selection', copied.length === 2 && copied[0] !== copied[1]);
  const beta0 = all.find(e => e.id === 'ek-beta-0');
  const matricesBeforeBeta = matrixText();
  set(beta0, 1.52);
  check('beta slider rebalances displayed representation', balanced() && matrixText() !== matricesBeforeBeta);
  check('displayed levels identify current balanced result', JSON.parse(incidence.getAttribute('data-displayed-levels'))[0][0] === 3.04);
  set(beta0, 1.5);
  const initialMatrices = matrixText();
  const yCells = matrices.filter((_, i) => i % 4 >= 2).reduce((out, el) => out.concat(walk(el, []).filter(e => e.className === 'ek-rep-cell')), []);
  check('reverse arrows vanish on the zero section', yCells.length === 24 && yCells.every(e => e.textContent === '0'));
  const canvas = walk(incidence, []).find(e => e.tagName === 'CANVAS'), ctx = canvas._ctx;
  const yToggle=all.find(e=>e.id==='ek-y-data');
  check('y data toggle starts checked',!!yToggle&&yToggle.checked&&canvas.getAttribute('data-y-data')==='true');
  const displayedBeforeToggle=incidence.getAttribute('data-displayed-parameters');
  yToggle.checked=false;yToggle._fire('change');
  check('y data toggle redraws without another solve',canvas.getAttribute('data-y-data')==='false'&&incidence.getAttribute('data-displayed-parameters')===displayedBeforeToggle);
  yToggle.checked=true;yToggle._fire('change');
  const beforeLines = JSON.stringify(ctx.lines.slice(-3));
  set(radius, .75);
  check('radial slider updates balanced matrices', balanced() && matrixText() !== initialMatrices);
  check('radial slider changes balanced geometry', JSON.stringify(ctx.lines.slice(-3)) !== beforeLines);
  const realMatrices = matrixText();
  set(theta, Math.PI / 2);
  check('phase updates balanced complex representative', balanced() && matrixText() !== realMatrices && cells.some(e => e.textContent.includes('i')));
  check('complex phase projection remains finite', ctx.lines.slice(-3).every(p => p.every(Number.isFinite)));
  set(radius, 1);
  check('infinity uses a balanced endpoint', balanced());
  check('infinity diagram remains finite', ctx.lines.slice(-3).every(p => p.every(Number.isFinite)));
  set(radius, 0);
  check('zero uses a balanced endpoint', balanced());
  const effective = () => JSON.parse(incidence.getAttribute('data-displayed-parameters'));
  set(theta, 0);
  set(radius, .015); check('radius outside weaker endpoint magnet is unchanged', effective().r === .015);
  set(radius, .001); check('endpoint thumb and solver snap exactly', Number(radius.value) === 0 && effective().r === 0);
  set(radius, .004); check('full weak endpoint tolerance snaps', effective().r === 0 && Number(radius.value) === 0);
  set(radius, .502); check('central thumb and solver snap exactly', Number(radius.value) === .5 && effective().r === .5);
  set(radius, .49); check('full central tolerance snaps', effective().r === .5 && Number(radius.value) === .5);
  radius._fire('input'); flushRaf();
  check('repeated input preserves exact target', effective().r === .5 && Number(radius.value) === .5);
  set(radius, .999); check('upper endpoint snaps exactly', effective().r === 1 && Number(radius.value) === 1);
  set(radius, .996); check('full upper endpoint tolerance snaps', effective().r === 1 && Number(radius.value) === 1);
  set(radius, .47); check('radius outside magnet remains free', effective().r === .47);
  set(theta, .01); check('theta thumb snaps exactly', effective().theta === 0 && Number(theta.value) === 0);
  set(theta, .08); check('full theta tolerance snaps', effective().theta === 0 && Number(theta.value) === 0);
  set(phi, -.01); check('phi thumb snaps exactly', effective().phi === 0 && Number(phi.value) === 0);
  set(phi, -.08); check('full phi tolerance snaps', effective().phi === 0 && Number(phi.value) === 0);
  set(theta, 0); set(phi, 0); set(radius, .5);
  radius._fire('keydown', {key:'ArrowRight'});
  for (let i = 0; i < 5; i++) set(radius, Number(radius.value) + .001);
  radius._fire('keyup', {key:'ArrowRight'});
  check('keyboard steps escape snap', effective().r > .504 && Number(radius.value) > .504);
  check('readout equals solver and thumb coordinate', radius.parentNode.children[2].textContent === effective().r.toFixed(3));
  set(radius, 0.25);
  check('generic branch t slider stops at finite cap',t.max==='0.99');
  set(t,1);
  check('unsupported infinity is clamped to readout 99',Number(t.value)===.99&&balanced());
  set(t, 0.4);
  check("finite transverse coordinate produces nonzero reverse arrows", yCells.some(function(e) { return e.textContent !== "0" && e.textContent !== "\u2014"; }));
  const beforePhase = yCells.map(function(e) { return e.textContent; }).join(",");
  set(phi, Math.PI / 2);
  check("phi changes the transverse representative", beforePhase !== yCells.map(function(e) { return e.textContent; }).join(","));
  set(radius, 0); set(theta, 0); set(t, 1);
  check('exact branch restores infinity endpoint',t.max==='1'&&Number(t.value)===1);
  check("first long-arm infinity has certified fixed matrices", cells.every(function(e) { return e.textContent !== "\u2014"; }) && moduli.getAttribute("data-fixed") === "true");
  check("outward limit available at first sphere tip", limit.style.display !== "none" && limit.textContent === "lim t\u2192\u221e");
  limit._fire("click", { type: "click" }); flushRaf();
  check("outward limit steps exactly one sphere", Number(t.value) === 0 && moduli["data-sphere"] === "1");
  check("second long-arm sphere starts at certified fixed matrices", cells.every(function(e) { return e.textContent !== "\u2014"; }) && moduli.getAttribute("data-fixed") === "true");
  check("inward limit available at higher sphere base", limit.style.display !== "none" && limit.textContent === "lim t\u21920");
  limit._fire("click", { type: "click" }); flushRaf();
  check("inward limit returns to previous sphere tip", Number(t.value) === 1 && moduli["data-sphere"] === "0");
  limit._fire("click", { type: "click" }); flushRaf();
  set(radius, 0.25);
  check("leaving an arm resets sphere selection and restores finite chart", balanced());
  set(radius, 0); set(t, 1); limit._fire("click", { type: "click" }); flushRaf();
  findByText(container, "E7")._fire("click", {type:"click"}); flushRaf();
  complexButton._fire('click');
  check('unsupported complex toggle cannot restore stale matrices', cells.every(e => e.textContent === '\u2014'));
  balancedButton._fire('click');
  check("unsupported type clears stale representative", cells.every(function(e) { return e.textContent === "\u2014"; }));
  findByText(container, "E6")._fire("click", {type:"click"}); flushRaf();
  check("returning to E6 restores representative", balanced());
  set(radius, 0.03); set(t, 0.95);
  check("captured central branch offers outward transition", limit.style.display !== "none");
  limit._fire("click", { type: "click" }); flushRaf();
  check("capture handover parks on the arm one sphere outward", Number(radius.value) === 0 && Number(t.value) === 0 && moduli["data-sphere"] === "1");
  set(radius, 0.5); set(theta, 0); set(t, 1);
  check("concurrency infinity has a finite representative", cells.every(function(e) { return e.textContent !== "\u2014"; }));
  check("concurrency infinity retains nonzero reverse arrows", yCells.some(function(e) { return e.textContent !== "0" && e.textContent !== "\u2014"; }));
  const limitCells = cells.map(function(e) { return e.textContent; }).join(",");
  limit._fire("click", { type: "click" }); flushRaf();
  check("concurrency limit persists at outgoing wing base", Number(t.value) === 0 && moduli["data-flow"] === "outgoing" && limitCells === cells.map(function(e) { return e.textContent; }).join(","));
  set(t, 0.2);
  check("higher concurrency chart has finite moving matrices", cells.every(function(e) { return e.textContent !== "\u2014"; }) && limitCells !== cells.map(function(e) { return e.textContent; }).join(","));
  const higherCells = cells.map(function(e) { return e.textContent; }).join(",");
  set(phi, 0.7);
  check("higher concurrency chart phase changes matrices", higherCells !== cells.map(function(e) { return e.textContent; }).join(","));
  set(phi, 0);
  const weightTwoCells = cells.map(function(e) { return e.textContent; }).join(",");
  set(phi, Math.PI);
  check("outgoing coordinate has weight two under phase", weightTwoCells === cells.map(function(e) { return e.textContent; }).join(","));
  set(t, 1);
  check("outgoing chart stops at finite 99 with a balanced representative", Number(t.value)===.99&&t.max==='0.99'&&balanced());
  set(t, 0); limit._fire("click", { type: "click" }); flushRaf();
  check("return to concurrency tip restores same limit", Number(t.value) === 1 && limitCells === cells.map(function(e) { return e.textContent; }).join(","));
  set(radius, 0.53); set(t, 0.95);
  check("captured concurrency offers short-arm transition", limit.style.display !== "none");
  limit._fire("click", {type:"click"}); flushRaf();
  check("captured concurrency enters wing without another sphere", Number(radius.value) === 0.5 && Number(t.value) === 0 && moduli["data-flow"] === "outgoing" && moduli["data-sphere"] === "0");
  set(radius, 0.25);
  check("leaving concurrency resets outgoing chart", moduli["data-flow"] === "central" && balanced());
  const data = await import("./quiver-data.js");
  const core = await import("./core-view.js");
  ["E6", "E7", "E8"].forEach(function(key) {
    findByText(container, key)._fire("click", { type: "click" }); flushRaf();
    const layout = core.buildSideLayout(data.AFFINE_ADE[key]);
    layout.arms.forEach(function(arm, index) {
      set(radius, arm.param); set(theta, 0);
      for (let i = 0; i < arm.nodes.length; i++) {
        set(t, 1);
        check(key + " arm " + index + " reaches sphere " + (i + 1), moduli["data-flow"] === "arm" && Number(moduli["data-sphere"]) === i);
        check(key + " arm " + index + " limit bounded at sphere " + (i + 1), (limit.style.display !== "none") === (i < arm.nodes.length - 1 || key === "E6"));
        if (key === "E6") check("E6 visible junction/tip is fixed", moduli.getAttribute("data-fixed") === "true");
        if (i < arm.nodes.length - 1) { limit._fire("click", { type: "click" }); flushRaf(); }
      }
      if (key === "E6") {
        const tipCells = cells.map(function(e) { return e.textContent; }).join(",");
        limit._fire("click", { type: "click" }); flushRaf();
        check("E6 outgoing chart starts at same fixed tip", moduli.getAttribute("data-flow") === "outgoing" && tipCells === cells.map(function(e) { return e.textContent; }).join(","));
        set(t, 0.4);
        check("E6 outgoing chart moves off fixed point", moduli.getAttribute("data-fixed") === "false" && cells.every(function(e) { return e.textContent !== "\u2014"; }));
      }
    });
  });
  const layout = core.buildSideLayout(data.AFFINE_ADE.E6);
  check("E6 chart attachments have long-short-long arms", layout.arms.map(function(a) { return a.nodes.length; }).join(",") === "2,1,2");
  const tip = core.coreFlow(layout, {r:0.5,theta:0,t:1,phi:0,sphere:0});
  [-2,0,2].forEach(function(phase) {
    const base = core.coreFlow(layout, {r:0.5,theta:0,t:0,phi:phase,sphere:0,outgoing:true});
    check("outgoing base is continuous at phase " + phase, base.kind === "outgoing" && Math.hypot.apply(Math,base.dot.map(function(x,i){return x-tip.dot[i];})) < 1e-12);
    [0.2,0.7,1].forEach(function(t) {
      const flow = core.coreFlow(layout, {r:0.5,theta:0,t:t,phi:phase,outgoing:true});
      check("outgoing wing finite " + phase + "/" + t, flow.dot.every(Number.isFinite) && flow.dot[0] > tip.dot[0]);
    });
  });
  // A delayed worker exercises obsolete progress and coalesced native input.
  const {solveBalancedAtlas}=await import('./balanced-model.js');
  let worker;
  global.Blob=class {};
  global.URL.createObjectURL=()=> 'blob:queued-test';
  global.URL.revokeObjectURL=()=> {};
  global.Worker=class {
    constructor(){worker=this;this.requests=[];}
    postMessage(request){this.requests.push(request);}
    finish(){const request=this.requests.shift();this.onmessage({data:solveBalancedAtlas(request.parameters,request.levels,{chamber:request.chamber})});}
  };
  const asyncContainer=makeEl('div');registry['ek-nakajima-widget']=asyncContainer;
  await import('./widget.js?queued-snap');flushRaf();
  const initialStatus=walk(asyncContainer,[]).find(e=>e.id==='ek-representative-status');
  check('initial pending solve shows status before any representative',initialStatus.textContent==='Solving\u2026' && initialStatus.parentNode.parentNode.getAttribute('aria-busy')==='true');
  worker.finish();
  check('successful initial solve clears status',initialStatus.textContent==='' && initialStatus.parentNode.parentNode.getAttribute('aria-busy')==='false');
  const asyncElements=walk(asyncContainer,[]),asyncRadius=asyncElements.find(e=>e.id==='ek-r');
  const asyncIncidence=asyncElements.find(e=>e.id==='ek-incidence-view');
  const asyncCanvas=walk(asyncIncidence,[]).find(e=>e.tagName==='CANVAS');
  set(asyncRadius,.3);worker.finish();
  const asyncCells=asyncElements.filter(e=>e.className==='ek-rep-cell');
  const asyncComplex=asyncElements.find(e=>e.id==='ek-representative-complex');
  const asyncBalanced=asyncElements.find(e=>e.id==='ek-representative-balanced');
  const previousBalanced=asyncCells.map(e=>e.textContent).join(',');
  asyncComplex._fire('click');
  const previousComplex=asyncCells.map(e=>e.textContent).join(',');
  asyncBalanced._fire('click');
  set(asyncRadius,.49); // Start snapped request; leave it in flight.
  check('pending solve retains balanced matrices and shows status',asyncCells.map(e=>e.textContent).join(',')===previousBalanced && initialStatus.textContent==='Solving\u2026');
  asyncComplex._fire('click');
  check('pending toggle uses previous complex representative without another solve', asyncCells.map(e=>e.textContent).join(',')===previousComplex && worker.requests.length===1);
  asyncBalanced._fire('click');
  asyncRadius.value='.47';asyncRadius._fire('input');
  asyncRadius.value='.46';asyncRadius._fire('input');flushRaf();
  worker.finish(); // Obsolete snapped request is validated progress.
  check('obsolete snapped worker progress keeps exact solved geometry',asyncCanvas.getAttribute('data-snap-transition')==='false');
  check('obsolete progress keeps latest request status busy',initialStatus.textContent==='Solving\u2026');
  worker.finish(); // Latest coalesced nonsnap request completes.
  check('latest completion clears status',initialStatus.textContent==='');
  check('coalesced nonsnap final draws exact solved geometry',asyncCanvas.getAttribute('data-snap-transition')==='false');
  check('coalesced final remains mathematically exact',JSON.parse(asyncIncidence.getAttribute('data-displayed-parameters')).r===.46);
  const realDateNow=Date.now,future=Date.now()+1000;Date.now=()=>future;
  set(asyncRadius,.4);worker.finish();
  check('ordinary later inputs also draw exact solved geometry',asyncCanvas.getAttribute('data-snap-transition')==='false');
  Date.now=realDateNow;
  const {E6_ADJACENT_WORD,e6ReflectLevels}=await import('./e6-chamber-transport.js');
  const {E6_REGULAR_LEVELS}=await import('./e6-levels.js');
  const targetLevels=E6_ADJACENT_WORD.reduce((z,v)=>e6ReflectLevels(z,v),E6_REGULAR_LEVELS);
  set(asyncRadius,.42); const chamberRequest=worker.requests.shift();
  asyncComplex._fire('click');
  const transportedResult=solveBalancedAtlas(chamberRequest.parameters,targetLevels,{chamber:'side-zero-second'});
  worker.onmessage({data:transportedResult});
  const {representativeForDisplay,formatComplex}=await import('./representation-readout.js');
  const expectedComplex=representativeForDisplay(transportedResult,'complex');
  const expectedCells=[];
  for(let branch=0;branch<3;branch++) for(const key of ['a','A','b','B']) for(const row of expectedComplex[key][branch]) for(const z of row) expectedCells.push(formatComplex(z));
  check('selected complex mode follows transported chamber result',asyncComplex.getAttribute('aria-pressed')==='true' && asyncCells.map(e=>e.textContent).join(',')===expectedCells.join(','));
  set(asyncRadius,.41);
  worker.requests.shift(); worker.onmessage({data:{success:false}});
  asyncComplex._fire('click');
  check('failed solve cannot restore previous complex representation',asyncCells.every(e=>e.textContent==='\u2014'));
  check('failed solve clears status',initialStatus.textContent==='' && initialStatus.parentNode.parentNode.getAttribute('aria-busy')==='false');
  set(asyncRadius,.43);
  findByText(asyncContainer,'E7')._fire('click',{type:'click'});flushRaf();
  check('unsupported type clears matrices and solving status',asyncCells.every(e=>e.textContent==='\u2014') && initialStatus.textContent==='');
  worker.finish();
  check('obsolete completion cannot restore unsupported matrices or status',asyncCells.every(e=>e.textContent==='\u2014') && initialStatus.textContent==='');
  console.log("smoke-widget: " + pass + "/" + (pass+fail) + " checks passed");
  process.exit(fail === 0 ? 0 : 1);
}
main();
