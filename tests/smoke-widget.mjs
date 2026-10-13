// smoke-widget.mjs — headless smoke test for assets/js/ek-nakajima/widget.js.
//
// Hand-made stubs only (NO new dependencies, matching the earlier ek-core
// scratch-stub approach): a fake `document`/`window`, `ResizeObserver`,
// `MutationObserver`, `requestAnimationFrame`, a recording 2D canvas context,
// and a universal Proxy stub for a global `THREE` covering the pieces
// widget.js / core-view.js touch. It then imports widget.js (copied to
// ./widget.js by run.sh) and asserts the widget mounts, the view toggle
// exists, switching to "Single element" builds the canvas view, and driving
// the |z| / theta inputs does not throw and runs the solve path.
//
// Run from tests/ (see run.sh):  node smoke-widget.mjs
//
// This is a FULL widget-init smoke, not a reduced one: makeCoreView and
// makeElementView both run against the stubs.

// ---------------------------------------------------------------------------
// recording 2D context
// ---------------------------------------------------------------------------
function makeCtx() {
  const calls = [];
  const ctx = { calls: calls };
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
    style: {},
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
  let importError = null;
  try {
    await import("./widget.js");
  } catch (e) {
    importError = e;
  }
  check("widget.js imports without throwing", importError === null, importError && String(importError));

  check("widget mounts (container has children)", container.children.length > 0);

  const typeBtn = findByText(container, "E6");
  check("type tab 'E6' exists", !!typeBtn);
  const coreBtn = findByText(container, "ALE core");
  const elemBtn = findByText(container, "Single element");
  check("view toggle 'ALE core' exists", !!coreBtn);
  check("view toggle 'Single element' exists", !!elemBtn);
  check("default view is ALE core (active class)", !!coreBtn && coreBtn.classList.contains("ek-active"));

  if (elemBtn) elemBtn._fire("click", { type: "click" });
  flushRaf(); // run the coalesced first element solve

  const allEls = walk(container, []);
  let canvas = null;
  for (let i = 0; i < allEls.length; i++) if (allEls[i].tagName === "CANVAS") { canvas = allEls[i]; break; }
  check("switching to Single element builds a canvas view", !!canvas);

  const frames = allEls.filter(function (e) { return e.tagName === "DIV" && e.classList && e.classList.contains("ek-frame"); });
  const hiddenFrames = frames.filter(function (e) { return e.style.display === "none"; });
  check("Single element shows one view frame and hides the other",
    frames.length === 2 && hiddenFrames.length === 1, "frames=" + frames.length + " hidden=" + hiddenFrames.length);
  check("view toggle active class moved to Single element",
    !!elemBtn && elemBtn.classList.contains("ek-active") && !coreBtn.classList.contains("ek-active"));

  const ranges = allEls.filter(function (e) { return e.tagName === "INPUT" && e.type === "range"; });
  check("element controls present (range inputs)", ranges.length >= 6, "n=" + ranges.length);

  const ctx = canvas && canvas._ctx ? canvas._ctx : null;
  const before = ctx ? ctx.calls.length : 0;
  check("element renderer drew on switch (solve path ran)", before > 0, "calls=" + before);

  // A status line reports the solve.
  const solved = allEls.some(function (e) {
    return typeof e.textContent === "string" && e.textContent.indexOf("solved") >= 0;
  });
  check("solve-status readout reports a solve", solved);

  // Drive every range input (|z|, theta included) and require no throw.
  let drove = false;
  try {
    for (let i = 0; i < ranges.length; i++) {
      ranges[i].value = i === ranges.length - 1 ? "0.5" : "2.5";
      ranges[i]._fire("input", { type: "input" });
      drove = true;
    }
  } catch (e) {
    check("driving |z| / theta inputs does not throw", false, String(e));
  }
  check("driving |z| / theta inputs does not throw", drove);

  flushRaf(); // run the coalesced solves queued by the input events

  const after = ctx ? ctx.calls.length : 0;
  check("solver path re-ran and redrew after input", after > before, "before=" + before + " after=" + after);

  console.log("smoke-widget: " + pass + "/" + (pass + fail) + " checks passed");
  process.exit(fail === 0 ? 0 : 1);
}

main();
