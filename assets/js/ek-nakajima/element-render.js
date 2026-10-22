// The real flag skeleton records magnitude; line hue records phase.
import { flagDiagram, cotangentGlyphs, branchDisplayGauge, centralDisplayGauge } from "./flag-diagram.js";

const POINT = ["p₁", "p₂", "p₃"];
const LINE = ["ℓ₁", "ℓ₂", "ℓ₃"];

// Shared by the canvas and the atlas integration checks.
export function elementFrame(view) {
  let data = view && view.incidence ? view.incidence : null;
  let operators = view && view.cotangentOperators;
  if (data && data.valid && view.branchGauge) {
    const gauged = branchDisplayGauge(data, operators, { ...view.branchGauge, firstLine: view.firstLine });
    data = gauged.data; operators = gauged.operators;
  }
  const layout = data && data.valid ? flagDiagram(data, { compact: true,
    concurrencyProgress: view.concurrencyProgress, realFlags: view.realFlags,
    firstLine: view.firstLine, centralFlow: view.centralFlow }) : null;
  if (data && data.valid && view.centralFlow) {
    const gauged = centralDisplayGauge(data, operators, view.centralFlow);
    data = gauged.data; operators = gauged.operators;
  }
  return { data, layout, glyphs: cotangentGlyphs(data, operators, view && view.concurrencyProgress) };
}

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
    canvas.setAttribute("aria-label", "Flag incidence. Line positions show magnitude; line colors show phase. Boundary arrows mark points outside the projective viewport. Three small phase rings at each point encode its cotangent coefficients in a display basis.");
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
  let glyphs = [];
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
    if (layout.transversal) {
      const a = pixel(layout.transversal[0]), b = pixel(layout.transversal[1]);
      ctx.strokeStyle = pal.text; ctx.lineWidth = 1; ctx.globalAlpha = 0.25;
      if (ctx.setLineDash) ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }
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
      const marker = layout.pointMarkers && layout.pointMarkers[i];
      let groupIndex = 0;
      for (let j = 0; j < i; j++) {
        if (data.pointEqual && data.pointEqual[i][j]) groupIndex++;
      }
      ctx.strokeStyle = pal.point; ctx.lineWidth = 2;
      if (marker && marker.clipped) {
        const d = [marker.direction[0], -marker.direction[1]];
        ctx.beginPath();
        ctx.moveTo(p[0] - 8 * d[0] - 4 * d[1], p[1] - 8 * d[1] + 4 * d[0]);
        ctx.lineTo(p[0], p[1]);
        ctx.lineTo(p[0] - 8 * d[0] + 4 * d[1], p[1] - 8 * d[1] - 4 * d[0]);
        ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p[0], p[1], 4 + 3 * groupIndex, 0, Math.PI * 2);
        if (groupIndex === 0) { ctx.fillStyle = pal.background; ctx.fill(); }
        ctx.stroke();
      }
      ctx.fillStyle = pal.point;
      const labelX = marker && marker.clipped && p[0] > w / 2 ? p[0] - 44 : p[0] + 12;
      const labelY = marker && marker.clipped && p[1] < h / 2 ? p[1] + 18 : p[1] - 9 + groupIndex * 15;
      ctx.fillText(POINT[i], labelX, labelY);
      // A single quiet, three-ring glyph: radius identifies the coefficient,
      // opacity its bounded magnitude and the short hand its complex phase.
      const glyph = glyphs[i];
      if (glyph) glyph.coefficients.forEach((z, k) => {
        const magnitude = Math.hypot(z[0], z[1]);
        if (magnitude < 1e-10) return;
        const cx = labelX + 27, cy = labelY - 4, radius = 3 + 3 * k;
        const phase = Math.atan2(z[1], z[0]);
        ctx.globalAlpha = 0.2 + 0.8 * magnitude / (1 + magnitude);
        ctx.lineWidth = 1; ctx.strokeStyle = pal.point;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + (radius - 2) * Math.cos(phase), cy - (radius - 2) * Math.sin(phase));
        ctx.lineTo(cx + (radius + 1) * Math.cos(phase), cy - (radius + 1) * Math.sin(phase));
        ctx.stroke(); ctx.globalAlpha = 1;
      });
    }
  }

  function setData(view) {
    const frame = elementFrame(view);
    data = frame.data; layout = frame.layout; glyphs = frame.glyphs;
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
