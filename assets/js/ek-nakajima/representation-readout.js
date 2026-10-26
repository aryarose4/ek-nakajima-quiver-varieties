// Live arrow matrices in the selected representative.
import { applyComplexGauge } from './solver.js';

export function representativeForDisplay(result, mode) {
  if (!result || !result.success || !result.solvedRep) return null;
  if (mode !== 'complex') return result.solvedRep;
  if (!result.chamberId || result.chamberId === 'default') return result.rawRep;
  // rawRep belongs to the SOURCE chamber after reflection transport.
  // Central diag(2,1,1/2), with identity leg gauges, is a fixed positive
  // determinant-one complex gauge of the TARGET balanced representation.
  // It preserves its complex moment map and orbit without another solve.
  const identity = [[[1,0],[0,0]],[[0,0],[1,0]]];
  return applyComplexGauge(result.solvedRep,
    [[[2,0],[0,0],[0,0]],[[0,0],[1,0],[0,0]],[[0,0],[0,0],[0.5,0]]],
    [identity,identity,identity], [1,1,1]);
}
export function formatComplex(z) {
  if (z == null) return "\u2014";
  const real = typeof z === "number" ? z : z[0];
  const imaginaryPart = typeof z === "number" ? 0 : z[1];
  const re = Math.abs(real) < 1e-12 ? 0 : real;
  const im = Math.abs(imaginaryPart) < 1e-12 ? 0 : imaginaryPart;
  if (!Number.isFinite(re) || !Number.isFinite(im)) return "\u2014";
  function scalar(value) {
    if (value === 0) return "0";
    if (Math.abs(value) < 0.0005) return value.toExponential(1);
    return String(Math.round(value * 1000) / 1000);
  }
  if (im === 0) return scalar(re);
  const imaginary = (Math.abs(im) === 1 ? "" : scalar(Math.abs(im))) + "i";
  if (re === 0) return (im < 0 ? "\u2212" : "") + imaginary;
  return scalar(re) + (im < 0 ? "\u2212" : "+") + imaginary;
}

export function makeRepresentationReadout(host) {
  const style = document.createElement("style");
  style.textContent = `
.ek-rep-readout { display:grid; gap:10px; min-width:0; color:var(--ek-box-tx,inherit); }
.ek-rep-readout .ek-rep-card { min-width:0; border:1px solid var(--ek-box-bd,#cfd4da); border-radius:6px; overflow:hidden; }
.ek-rep-readout .ek-rep-header { display:flex; align-items:center; justify-content:space-between; gap:8px; height:34px; padding:0 10px; border-bottom:1px solid var(--ek-box-bd,#cfd4da); font:600 0.75rem ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
.ek-rep-readout .ek-rep-copy { color:inherit; background:transparent; border:1px solid var(--ek-box-bd,#cfd4da); border-radius:4px; padding:2px 6px; font:inherit; font-size:0.68rem; width:64px; cursor:pointer; }
.ek-rep-readout .ek-rep-copy:focus-visible { outline:2px solid currentColor; outline-offset:2px; }
.ek-rep-readout .ek-rep-body { height:244px; box-sizing:border-box; overflow-x:auto; overflow-y:hidden; padding:12px 10px 18px; }
.ek-rep-readout .ek-rep-code { display:flex; flex-direction:column; gap:12px; width:max-content; min-width:100%; font:0.75rem/18px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-variant-numeric:tabular-nums; user-select:text; }
.ek-rep-readout .ek-rep-matrix { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.ek-rep-readout .ek-rep-label { width:45px; flex-shrink:0; white-space:nowrap; }
.ek-rep-readout .ek-rep-label sub,.ek-rep-readout .ek-rep-label sup { font-size:0.72em; line-height:0; }
.ek-rep-readout .ek-rep-grid { display:grid; grid-auto-rows:18px; column-gap:10px; }
.ek-rep-readout .ek-rep-cell { text-align:right; white-space:pre; min-width:3ch; }
.ek-rep-readout .ek-rep-bracket { align-self:stretch; width:4px; box-sizing:border-box; border-top:1px solid; border-bottom:1px solid; flex-shrink:0; }
.ek-rep-readout .ek-rep-bracket-left { border-left:1px solid; }
.ek-rep-readout .ek-rep-bracket-right { border-right:1px solid; }
`;
  host.appendChild(style);
  const root = document.createElement("div");
  root.className = "ek-rep-readout";
  host.appendChild(root);
  function fitCards() {
    root.style.gridTemplateColumns = host.clientWidth >= 760 ? "repeat(3,minmax(0,1fr))" : "minmax(0,1fr)";
  }
  fitCards();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(fitCards).observe(host);
  else if (typeof window !== "undefined") window.addEventListener("resize", fitCards);
  const matrices = [];
  function fallbackCopy(text) {
    const previous = document.activeElement;
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    let copied = false;
    try { field.select(); copied = document.execCommand("copy"); }
    finally {
      document.body.removeChild(field);
      if (previous && previous.focus) previous.focus();
    }
    if (!copied) throw new Error("Copy failed");
  }
  function matrix(parent, letter, level, branch, key, rows, cols) {
    const wrap = document.createElement("div");
    wrap.className = "ek-rep-matrix";
    wrap.style.height = rows * 18 + "px";
    const label = document.createElement("span");
    label.className = "ek-rep-label";
    label.textContent = letter;
    const sub = document.createElement("sub");
    sub.textContent = String(branch + 1);
    const sup = document.createElement("sup");
    sup.textContent = "(" + level + ")";
    label.appendChild(sub);
    label.appendChild(sup);
    const equals = document.createElement("span");
    equals.textContent = " =";
    label.appendChild(equals);
    wrap.appendChild(label);
    function bracket(side) {
      const el = document.createElement("span");
      el.className = "ek-rep-bracket ek-rep-bracket-" + side;
      wrap.appendChild(el);
    }
    bracket("left");
    const grid = document.createElement("div");
    grid.className = "ek-rep-grid";
    grid.style.gridTemplateColumns = "repeat(" + cols + ", max-content)";
    wrap.appendChild(grid);
    const cells = [];
    for (let k = 0; k < rows * cols; k++) {
      const cell = document.createElement("span");
      cell.className = "ek-rep-cell";
      cell.textContent = "\u2014";
      cells.push(cell);
      grid.appendChild(cell);
    }
    bracket("right");
    parent.appendChild(wrap);
    const view = { branch, key, rows, cols, cells, letter, level };
    matrices.push(view);
    return view;
  }
  function branchText(views) {
    return views.map(function(view) {
      const lines = [];
      for (let i = 0; i < view.rows; i++) {
        lines.push("[ " + view.cells.slice(i * view.cols, (i + 1) * view.cols).map(function(cell) { return cell.textContent; }).join(", ") + " ]");
      }
      return view.letter + "_" + (view.branch + 1) + "^(" + view.level + ") =\n" + lines.join("\n");
    }).join("\n\n");
  }
  for (let i = 0; i < 3; i++) {
    const card = document.createElement("div");
    card.className = "ek-rep-card";
    const header = document.createElement("div");
    header.className = "ek-rep-header";
    const title = document.createElement("span");
    title.textContent = "Branch " + (i + 1);
    header.appendChild(title);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ek-rep-copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy Branch " + (i + 1) + " matrices");
    header.appendChild(button);
    card.appendChild(header);
    const body = document.createElement("div");
    body.className = "ek-rep-body";
    body.tabIndex = 0;
    body.setAttribute("aria-label", "Branch " + (i + 1) + " matrices");
    const code = document.createElement("div");
    code.className = "ek-rep-code";
    body.appendChild(code);
    card.appendChild(body);
    root.appendChild(card);
    const views = [matrix(code,"x",1,i,"a",2,1), matrix(code,"x",2,i,"A",3,2), matrix(code,"y",1,i,"b",1,2), matrix(code,"y",2,i,"B",2,3)];
    let feedbackTimer;
    button.addEventListener("click", function() {
      const text = branchText(views);
      Promise.resolve().then(function() {
        if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text).catch(function() { fallbackCopy(text); });
        }
        fallbackCopy(text);
      }).then(function() { button.textContent = "Copied"; }, function() { button.textContent = "Retry"; }).then(function() {
        clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(function() { button.textContent = "Copy"; }, 1400);
      });
    });
  }
  return {
    setData(rep) {
      matrices.forEach(function(view) {
        const values = rep && rep[view.key] && rep[view.key][view.branch];
        for (let i = 0; i < view.rows; i++) {
          for (let j = 0; j < view.cols; j++) {
            const z = values && values[i] && values[i][j];
            view.cells[i * view.cols + j].textContent = formatComplex(z);
          }
        }
      });
    },
    refreshTheme() {} // Colors follow the widget's CSS variables.
  };
}
