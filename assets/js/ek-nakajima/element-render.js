// The real flag skeleton records magnitude; line hue records phase.
import { flagDiagram } from "./flag-diagram.js";

const POINT = ["p₁", "p₂", "p₃"];
const LINE = ["ℓ₁", "ℓ₂", "ℓ₃"];

// All phases collapse at the two poles. Inside the chart, hue determines
// phase modulo 2π; the shared saturation keeps equal phases the same color.
export function phaseColor(phase, compactRadius, dark) {
  const r = Math.max(0, Math.min(1, compactRadius));
  const saturation = 70 * 4 * r * (1 - r);
  const angle = Number.isFinite(phase) ? phase : 0;
  const hue = ((210 + angle * 180 / Math.PI) % 360 + 360) % 360;
  return "hsl(" + hue + ", " + saturation + "%, " + (dark ? 70 : 40) + "%)";
}

export function makeElementView(host, opts) {
  opts = opts || {};
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.cursor = "default";
  if (canvas.setAttribute) {
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Flag incidence. Line positions show magnitude; line colors show phase.");
  }
  host.appendChild(canvas);
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  const status = document.createElement("div");
  status.className = "ek-elem-status";
  status.style.position = "absolute";
  status.style.bottom = "8px";
  status.style.left = "12px";
  status.style.right = "12px";
  status.style.fontSize = "12px";
  status.style.pointerEvents = "none";
  status.style.display = "none";
  host.appendChild(status);
  let data = null;
  let layout = null;
  let statusKind = "";

  function palette() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const p = opts.getPalette ? opts.getPalette() || {} : {};
    return {
      dark: dark,
      text: p.caption || (dark ? "#c0c6cf" : "#505762"),
      point: dark ? "#e5e8ed" : "#303740",
      background: dark ? "#20242b" : "#ffffff",
    };
  }

  function draw() {
    const pal = palette();
    status.style.color = statusKind === "error" ? "#d64545" : "#b27c22";
    if (!ctx) return;
    const w = host.clientWidth || 0;
    const h = host.clientHeight || 0;
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
      ctx.fillText("Incidence unavailable", w / 2, h / 2);
      return;
    }
    const scale = Math.max(1, Math.min(w / 2 - 36, h / 2 - 27));
    function pixel(p) { return [w / 2 + p[0] * scale, h / 2 - p[1] * scale]; }
    ctx.lineCap = "round";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    for (let i = 0; i < 3; i++) {
      const a = pixel(layout.lines[i][0]);
      const b = pixel(layout.lines[i][1]);
      const color = phaseColor(layout.linePhases[i], layout.compactRadius, pal.dark);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (ctx.setLineDash) ctx.setLineDash(i === 0 ? [] : i === 1 ? [8, 5] : [2, 5]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      let coincidentBefore = 0;
      for (let j = 0; j < i; j++) if (data.lineEqual && data.lineEqual[i][j]) coincidentBefore++;
      const t = 0.05 + coincidentBefore * 0.1;
      ctx.fillStyle = color;
      ctx.fillText(LINE[i], a[0] + (b[0] - a[0]) * t + 5, a[1] + (b[1] - a[1]) * t - 6);
    }
    if (ctx.setLineDash) ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const p = pixel(layout.points[i]);
      let groupIndex = 0;
      for (let j = 0; j < i; j++) {
        if (data.pointEqual && data.pointEqual[i][j]) groupIndex++;
      }
      ctx.beginPath(); ctx.arc(p[0], p[1], 4 + 3 * groupIndex, 0, Math.PI * 2);
      ctx.strokeStyle = pal.point; ctx.lineWidth = 2;
      if (groupIndex === 0) { ctx.fillStyle = pal.background; ctx.fill(); }
      ctx.stroke();
      ctx.fillStyle = pal.point;
      ctx.fillText(POINT[i], p[0] + 12, p[1] - 9 + groupIndex * 15);
    }
  }

  function setData(view) {
    data = view && view.incidence ? view.incidence : null;
    layout = data && data.valid ? flagDiagram(data, { compact: true }) : null;
    draw();
  }
  function setStatus(text, kind) {
    const failed = kind === "error" || kind === "warn";
    status.textContent = failed && text != null ? String(text) : "";
    status.style.display = status.textContent ? "block" : "none";
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
    getCamera: function () { return { azimuth: 0, elevation: 0, zoom: 1 }; },
  };
}
