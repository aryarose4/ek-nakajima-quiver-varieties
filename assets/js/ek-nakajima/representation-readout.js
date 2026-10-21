// Live complex arrow matrices, before real moment-map balancing.
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
  style.textContent = [
    ".ek-rep-readout { min-width:0; color:var(--ek-box-tx,inherit); }",
    ".ek-rep-readout .ek-rep-row { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:12px 22px; padding:8px 0; }",
    ".ek-rep-readout .ek-rep-row + .ek-rep-row { border-top:1px solid var(--ek-box-bd,#cfd4da); }",
    ".ek-rep-readout .ek-rep-matrix { display:flex; align-items:center; gap:6px; min-width:0; }",
    ".ek-rep-readout .ek-rep-label { white-space:nowrap; font-family:Georgia,serif; font-style:italic; }",
    ".ek-rep-readout .ek-rep-grid { display:grid; gap:3px 10px; font:0.75rem ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-variant-numeric:tabular-nums; }",
    ".ek-rep-readout .ek-rep-cell { text-align:right; white-space:nowrap; }",
    ".ek-rep-readout .ek-rep-bracket { align-self:stretch; width:5px; box-sizing:border-box; border-top:1px solid; border-bottom:1px solid; flex-shrink:0; }",
    ".ek-rep-readout .ek-rep-bracket-left { border-left:1px solid; }",
    ".ek-rep-readout .ek-rep-bracket-right { border-right:1px solid; }",
    "@media(max-width:440px) { .ek-rep-readout .ek-rep-row { gap:12px 16px; } .ek-rep-readout .ek-rep-grid { font-size:0.68rem; column-gap:7px; } }"
  ].join("\n");
  host.appendChild(style);
  const root = document.createElement("div");
  root.className = "ek-rep-readout";
  host.appendChild(root);
  const matrices = [];
  function matrix(row, letter, level, branch, key, rows, cols) {
    const wrap = document.createElement("div");
    wrap.className = "ek-rep-matrix";
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
    grid.style.gridTemplateColumns = "repeat(" + cols + ", auto)";
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
    row.appendChild(wrap);
    matrices.push({ branch, key, rows, cols, cells });
  }
  for (let i = 0; i < 3; i++) {
    const row = document.createElement("div");
    row.className = "ek-rep-row";
    root.appendChild(row);
    matrix(row, "x", 1, i, "a", 2, 1);
    matrix(row, "x", 2, i, "A", 3, 2);
    matrix(row, "y", 1, i, "b", 1, 2);
    matrix(row, "y", 2, i, "B", 2, 3);
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
