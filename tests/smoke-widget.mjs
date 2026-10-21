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
  check("shared coordinates with t and phi fixed", ranges.length === 4 && ranges.filter(function(e) { return !e.disabled; }).length === 2);
  const matrices = all.filter(function(e) { return e.className === "ek-rep-matrix"; });
  const cells = all.filter(function(e) { return e.className === "ek-rep-cell"; });
  check("all x and y arrows displayed", matrices.length === 12 && cells.length === 48);
  const a3 = walk(matrices[9], []).filter(function(e) { return e.className === "ek-rep-cell"; });
  check("initial A3 uses finite homogeneous representative", a3.map(function(e) { return e.textContent; }).join(",") === "0,0.5,0,0.5,1,0");
  const yCells = matrices.filter(function(_, i) { return i % 4 >= 2; }).reduce(function(out, el) {
    return out.concat(walk(el, []).filter(function(e) { return e.className === "ek-rep-cell"; }));
  }, []);
  check("all reverse arrows vanish at t=0", yCells.length === 24 && yCells.every(function(e) { return e.textContent === "0"; }));
  const canvas = walk(incidence, []).find(function(e) { return e.tagName === "CANVAS"; });
  const ctx = canvas._ctx;
  const lineColors = function() { return ctx.strokes.slice(-6, -3); };
  check("concurrent lines have the same hue", new Set(lineColors()).size === 1);
  const beforeLine = ctx.lines[ctx.lines.length - 1];
  radius.value = "0.75"; radius._fire("input", { type: "input" }); flushRaf();
  const afterLine = ctx.lines[ctx.lines.length - 1];
  check("radial slider moves the flag line", Math.hypot(afterLine[0]-beforeLine[0], afterLine[1]-beforeLine[1]) > 1);
  check("radial slider updates x readout", a3[1].textContent === "0.25" && a3[3].textContent === "0.75");
  theta.value = String(Math.PI/2); theta._fire("input", { type: "input" }); flushRaf();
  check("phase updates the complex representative", a3[3].textContent === "0.75i");
  check("phase changes line hue", lineColors()[0] === lineColors()[1] && lineColors()[1] !== lineColors()[2]);
  check("phase leaves modulus geometry fixed", JSON.stringify(ctx.lines[ctx.lines.length - 1]) === JSON.stringify(afterLine));
  check("phase circle removed", ctx.arcs.slice(-3).every(function(a) { return a[2] === 4; }));
  radius.value = "1"; radius._fire("input", { type: "input" }); flushRaf();
  check("infinity has finite x readout", a3[1].textContent === "0" && a3[3].textContent === "i");
  check("infinity has phase-independent gray lines", new Set(lineColors()).size === 1 && lineColors()[0].indexOf("0%,") >= 0);
  check("infinity diagram remains finite", ctx.lines.slice(-3).every(function(p) { return p.every(Number.isFinite); }));
  radius.value = "0"; radius._fire("input", { type: "input" }); flushRaf();
  check("zero has finite x readout", a3[1].textContent === "1" && a3[3].textContent === "0");
  findByText(container, "E7")._fire("click", {type:"click"}); flushRaf();
  check("unsupported type clears stale representative", cells.every(function(e) { return e.textContent === "\u2014"; }));
  findByText(container, "E6")._fire("click", {type:"click"}); flushRaf();
  check("returning to E6 restores representative", a3[1].textContent === "1");
  console.log("smoke-widget: " + pass + "/" + (pass+fail) + " checks passed");
  process.exit(fail === 0 ? 0 : 1);
}
main();
