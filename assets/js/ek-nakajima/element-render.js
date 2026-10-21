// Incidence-only projective schematic. The numerical table is authoritative;
// distances and angles do not encode a metric, stability, or moment maps.
import { incidenceLayout, flagTripleRatio } from "./flag-incidence.js";

const BRANCH = {
  light: ["#b5413b", "#2467aa", "#96700f"],
  dark: ["#ff8074", "#6cb6ff", "#e3b341"],
};
const POINT = ["p₁", "p₂", "p₃"];
const LINE = ["ℓ₁", "ℓ₂", "ℓ₃"];

export function makeElementView(host, opts) {
  opts = opts || {};
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "55%";
  canvas.style.cursor = "default";
  if (canvas.setAttribute) {
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Schematic of three projective flags; incidence values are in the table below.");
  }
  host.appendChild(canvas);
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  const details = document.createElement("div");
  details.style.position = "absolute";
  details.style.top = "55%";
  details.style.bottom = "0";
  details.style.left = "0";
  details.style.right = "0";
  details.style.overflow = "auto";
  details.style.padding = "4px 12px 8px";
  details.style.fontSize = "12px";
  details.style.lineHeight = "1.35";
  host.appendChild(details);
  const legend = document.createElement("div");
  legend.textContent = "Points pᵢ = ℙ(Lᵢ) · Lines ℓᵢ = ℙ(Pᵢ)";
  details.appendChild(legend);
  const table = document.createElement("table");
  table.style.margin = "4px 0";
  table.style.fontSize = "inherit";
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  const cap = document.createElement("caption");
  cap.textContent = "Numerical incidence: does pᵢ lie on ℓⱼ?";
  cap.style.textAlign = "left";
  cap.style.padding = "0";
  table.appendChild(cap);
  const header = document.createElement("tr");
  ["", LINE[0], LINE[1], LINE[2]].forEach(function (label) {
    const cell = document.createElement("th");
    cell.textContent = label;
    cell.scope = "col";
    cell.style.padding = "1px 8px";
    header.appendChild(cell);
  });
  table.appendChild(header);
  const cells = [];
  for (let i = 0; i < 3; i++) {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.textContent = POINT[i];
    row.appendChild(label);
    cells[i] = [];
    for (let j = 0; j < 3; j++) {
      const cell = document.createElement("td");
      cell.style.textAlign = "center";
      cell.style.padding = "1px 8px";
      cell.textContent = "—";
      row.appendChild(cell);
      cells[i].push(cell);
    }
    table.appendChild(row);
  }
  details.appendChild(table);
  const relations = document.createElement("div");
  details.appendChild(relations);
  const caption = document.createElement("div");
  details.appendChild(caption);
  const status = document.createElement("div");
  status.className = "ek-elem-status";
  status.style.whiteSpace = "pre-line";
  details.appendChild(status);
  const ratioBox = document.createElement("div");
  ratioBox.className = "ek-triple-ratio";
  ratioBox.style.marginTop = "12px";
  ratioBox.style.borderTop = "1px solid var(--ek-box-bd)";
  ratioBox.style.paddingTop = "10px";
  const ratioTitle = document.createElement("div");
  ratioTitle.className = "ek-sec";
  ratioTitle.textContent = "Complex triple ratio";
  ratioBox.appendChild(ratioTitle);
  const ratioRow = document.createElement("div");
  ratioRow.style.display = "flex";
  ratioRow.style.alignItems = "center";
  ratioRow.style.gap = "12px";
  ratioRow.style.flexWrap = "wrap";
  ratioBox.appendChild(ratioRow);
  const ratioCanvas = document.createElement("canvas");
  ratioCanvas.width = 160;
  ratioCanvas.height = 160;
  ratioCanvas.style.width = "160px";
  ratioCanvas.style.height = "160px";
  if (ratioCanvas.setAttribute) {
    ratioCanvas.setAttribute("role", "img");
    ratioCanvas.setAttribute("aria-label", "Live complex triple ratio: horizontal real axis, vertical imaginary axis, fixed scale from minus four to four.");
  }
  ratioRow.appendChild(ratioCanvas);
  const ratioCtx = ratioCanvas.getContext ? ratioCanvas.getContext("2d") : null;
  const ratioReadout = document.createElement("div");
  ratioReadout.className = "ek-triple-ratio-readout";
  ratioReadout.style.fontSize = "0.85em";
  ratioReadout.style.whiteSpace = "pre-line";
  ratioReadout.style.fontVariantNumeric = "tabular-nums";
  ratioRow.appendChild(ratioReadout);
  const ratioHelp = document.createElement("div");
  ratioHelp.style.fontSize = "0.78em";
  ratioHelp.style.marginTop = "6px";
  ratioHelp.textContent = "T = −z in this chart. Magnitude sets the radius; phase sets the angle. The incidence picture stays fixed until its incidence relations change.";
  ratioBox.appendChild(ratioHelp);
  (opts.invariantHost || details).appendChild(ratioBox);
  let data = null;
  let layout = null;
  let ratio = null;
  let statusKind = "";

  function drawRatio(pal) {
    ratioBox.style.color = pal.text;
    if (!ratioCtx) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    ratioCanvas.width = Math.round(160 * dpr);
    ratioCanvas.height = Math.round(160 * dpr);
    const c = ratioCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, 160, 160);
    c.strokeStyle = pal.text;
    c.fillStyle = pal.text;
    c.lineWidth = 1;
    c.font = "11px sans-serif";
    c.beginPath(); c.moveTo(10, 80); c.lineTo(150, 80);
    c.moveTo(80, 10); c.lineTo(80, 150); c.stroke();
    c.fillText("Re", 141, 73); c.fillText("Im", 86, 14);
    c.fillText("−4", 8, 95); c.fillText("4", 141, 95);
    c.globalAlpha = 0.35;
    c.beginPath(); c.arc(80, 80, 60, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
    if (!ratio || !ratio.valid) return;
    // Fixed scale: changing |z| must visibly move the marker radially.
    const x = 80 + 15 * ratio.value[0];
    const y = 80 - 15 * ratio.value[1];
    c.strokeStyle = pal.branch[1];
    c.beginPath(); c.moveTo(80, 80); c.lineTo(x, y); c.stroke();
    c.fillStyle = pal.branch[1];
    c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2); c.fill();
  }

  function palette() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const p = opts.getPalette ? opts.getPalette() || {} : {};
    return { branch: BRANCH[dark ? "dark" : "light"], text: p.caption || (dark ? "#c0c6cf" : "#505762"), background: dark ? "#20242b" : "#ffffff" };
  }

  function draw() {
    const pal = palette();
    drawRatio(pal);
    details.style.color = pal.text;
    status.style.color = statusKind === "error" ? "#d64545" : statusKind === "warn" ? "#b27c22" : pal.text;
    if (!ctx) return;
    const w = host.clientWidth || 0;
    const h = Math.round((host.clientHeight || 0) * 0.55);
    if (w <= 0 || h <= 0) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!data || !data.valid || !layout || !layout.valid) {
      ctx.fillStyle = pal.text;
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Incidence picture unavailable", w / 2, h / 2);
      return;
    }
    const sx = Math.max(1, w / 2 - 36);
    const sy = Math.max(1, h / 2 - 27);
    function pixel(p) { return [w / 2 + p[0] * sx, h / 2 - p[1] * sy]; }
    ctx.lineCap = "round";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    for (let i = 0; i < 3; i++) {
      const a = pixel(layout.lines[i][0]);
      const b = pixel(layout.lines[i][1]);
      // Different dash patterns keep coincident lines identifiable without
      // moving them off their true incidence locus.
      ctx.strokeStyle = pal.branch[i];
      ctx.lineWidth = 2;
      if (ctx.setLineDash) ctx.setLineDash(i === 0 ? [] : i === 1 ? [8, 5] : [2, 5]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      let coincidentBefore = 0;
      for (let j = 0; j < i; j++) if (data.lineEqual[i][j]) coincidentBefore++;
      const t = 0.05 + coincidentBefore * 0.1;
      ctx.fillStyle = pal.branch[i];
      ctx.fillText(LINE[i], a[0] + (b[0] - a[0]) * t + 5, a[1] + (b[1] - a[1]) * t - 6);
    }
    if (ctx.setLineDash) ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const p = pixel(layout.points[i]);
      let groupIndex = 0;
      for (let j = 0; j < i; j++) {
        if (data.pointEqual && data.pointEqual[i][j]) groupIndex++;
      }
      // Concentric rings and stacked labels retain every coincident flag.
      ctx.beginPath(); ctx.arc(p[0], p[1], 4 + 3 * groupIndex, 0, Math.PI * 2);
      ctx.strokeStyle = pal.branch[i]; ctx.lineWidth = 2;
      if (groupIndex === 0) { ctx.fillStyle = pal.background; ctx.fill(); }
      ctx.stroke();
      ctx.fillStyle = pal.branch[i];
      ctx.fillText(POINT[i], p[0] + 12, p[1] - 9 + groupIndex * 15);
    }
  }

  function setData(view) {
    data = view && view.incidence ? view.incidence : null;
    layout = data && data.valid ? incidenceLayout(data) : null;
    ratio = flagTripleRatio(data);
    if (ratio.valid) {
      const re = Math.abs(ratio.value[0]) < 0.00005 ? 0 : ratio.value[0];
      const im = Math.abs(ratio.value[1]) < 0.00005 ? 0 : ratio.value[1];
      ratioReadout.textContent = "T = " + re.toFixed(4) + (im < 0 ? " − " : " + ") + Math.abs(im).toFixed(4) + "i\n" +
        "|T| = " + ratio.magnitude.toFixed(4) + "\n" +
        "arg(T) = " + (ratio.phase === null ? "undefined at T = 0" : ratio.phase.toFixed(4) + " rad");
    } else {
      ratioReadout.textContent = ratio.reason || "Triple ratio unavailable.";
    }
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        cells[i][j].textContent = data && data.valid ? (data.incident[i][j] ? "Yes" : "No") : "—";
      }
    }
    const reason = !data ? "No flag data." : !data.valid ? data.reason : layout && !layout.valid ? layout.reason : "";
    const equalities = [];
    if (data && data.valid) {
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          if (data.pointEqual[i][j]) equalities.push(POINT[i] + " = " + POINT[j]);
          if (data.lineEqual[i][j]) equalities.push(LINE[i] + " = " + LINE[j]);
        }
      }
    }
    relations.textContent = equalities.length ? "Coincidences: " + equalities.join("; ") + "." :
      data && data.valid && data.concurrent ? "The three lines meet at one point." : "";
    caption.textContent = reason ? String(reason) : "Schematic only: lengths, angles and point collinearity are not encoded. Incidence tolerance: " + String(data.tolerance) + ".";
    draw();
  }
  function setStatus(text, kind) {
    status.textContent = text == null ? "" : String(text);
    statusKind = kind || "";
    draw();
  }
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(draw);
    ro.observe(host);
  } else if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", draw);
  }
  setData(null);
  return {
    setData: setData, setStatus: setStatus, refreshTheme: draw, resize: draw,
    // Retained for callers of the former camera API; this picture is fixed.
    getCamera: function () { return { azimuth: 0, elevation: 0, zoom: 1 }; },
  };
}
