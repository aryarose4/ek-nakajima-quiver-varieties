// Continuous E6 chart diagram: real modulus skeleton with phase on its third line.
// The decorated diagram recovers z; the table records complex incidence.
import { flagDiagram } from "./flag-diagram.js";

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
  canvas.style.height = "60%";
  canvas.style.cursor = "default";
  if (canvas.setAttribute) {
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Continuous phase-decorated E6 flags. Line three moves with magnitude and its attached phase needle turns with phase. Complex incidence values are in the table below.");
  }
  host.appendChild(canvas);
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  const details = document.createElement("div");
  details.style.position = "absolute";
  details.style.top = "60%";
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
  cap.textContent = "pᵢ ∈ ℓⱼ?";
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
  let data = null;
  let layout = null;
  let statusKind = "";

  function palette() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const p = opts.getPalette ? opts.getPalette() || {} : {};
    return { branch: BRANCH[dark ? "dark" : "light"], text: p.caption || (dark ? "#c0c6cf" : "#505762"), background: dark ? "#20242b" : "#ffffff" };
  }

  function draw() {
    const pal = palette();
    details.style.color = pal.text;
    status.style.color = statusKind === "error" ? "#d64545" : statusKind === "warn" ? "#b27c22" : pal.text;
    if (!ctx) return;
    const w = host.clientWidth || 0;
    const h = Math.round((host.clientHeight || 0) * 0.60);
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

    // Phase is part of this flag's visible data, attached to its line.
    // Shrinking the needle with |z| removes the phase ambiguity continuously
    // at z = 0, where every polar angle describes the same configuration.
    const ends = layout.lines[2].map(pixel);
    const anchor = [0.72 * ends[0][0] + 0.28 * ends[1][0],
      0.72 * ends[0][1] + 0.28 * ends[1][1]];
    const z = layout.parameter;
    const magnitude = Math.hypot(z[0], z[1]);
    const phase = magnitude === 0 ? null : Math.atan2(z[1], z[0]);
    ctx.strokeStyle = pal.branch[2];
    ctx.fillStyle = pal.background;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(anchor[0], anchor[1], 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(anchor[0], anchor[1]);
    ctx.lineTo(anchor[0] + 15 * z[0] / (1 + magnitude), anchor[1] - 15 * z[1] / (1 + magnitude));
    ctx.stroke();
    ctx.fillStyle = pal.branch[2];
    ctx.beginPath();
    ctx.arc(anchor[0] + 15 * z[0] / (1 + magnitude), anchor[1] - 15 * z[1] / (1 + magnitude), 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "12px sans-serif";
    ctx.fillText("arg z = " + (phase === null ? "undefined" : phase.toFixed(3) + " rad"), anchor[0] + 23, anchor[1] + 4);
  }

  function setData(view) {
    data = view && view.incidence ? view.incidence : null;
    layout = data && data.valid ? flagDiagram(data) : null;
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
    caption.textContent = reason ? String(reason) : "Concurrency requires matching phases.";
    table.title = data && data.valid ? "Incidence tolerance: " + String(data.tolerance) : "";
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
    // Retained for callers of the former camera API.
    getCamera: function () { return { azimuth: 0, elevation: 0, zoom: 1 }; },
  };
}
