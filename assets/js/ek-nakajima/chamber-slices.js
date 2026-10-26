import { E6_BETA_DISPLAY_MAX, e6BetaWallCoefficients } from './e6-parameters.js';

// Fix the other four beta coordinates, then clip genuine root walls to the box.
// Constant equations, even identically zero ones, do not define slice lines.
export function e6BranchSlice(beta, branch, walls = e6BetaWallCoefficients(), max = E6_BETA_DISPLAY_MAX) {
  if (!Number.isInteger(branch) || branch < 0 || branch > 2) throw new RangeError('Invalid branch.');
  const values = [].concat(...beta), ix = 2 * branch, iy = ix + 1;
  const seen = new Set(), segments = [], eps = 1e-9;
  walls.forEach(wall => {
    let a = wall[ix], b = wall[iy];
    let c = wall.reduce((sum, value, i) => sum + (i === ix || i === iy ? 0 : value * values[i]), 0);
    const norm = Math.hypot(a, b);
    if (norm < 1e-12) return;
    const sign = Math.abs(a) > 1e-12 ? Math.sign(a) : Math.sign(b);
    a /= norm * sign; b /= norm * sign; c /= norm * sign;
    const key = [a, b, c].map(x => Math.round(x * 1e9)).join(',');
    if (seen.has(key)) return;
    seen.add(key);
    const points = [];
    function add(x, y) {
      if (x < -eps || y < -eps || x > max + eps || y > max + eps) return;
      const p = [Math.max(0, Math.min(max, x)), Math.max(0, Math.min(max, y))];
      if (!points.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < eps)) points.push(p);
    }
    if (Math.abs(b) > 1e-12) { add(0, -c / b); add(max, -(c + a * max) / b); }
    if (Math.abs(a) > 1e-12) { add(-c / a, 0); add(-(c + b * max) / a, max); }
    if (points.length >= 2) segments.push({ equation: [a, b, c], points: points.slice(0, 2) });
  });
  return segments;
}

export function createChamberSlices(host, getBeta) {
  const row = document.createElement('div'); row.className = 'ek-chamber-slices';
  row.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px;min-width:0';
  host.appendChild(row);
  const canvases = [];
  for (let branch = 0; branch < 3; branch++) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;color:var(--ek-box-tx)';
    const title = document.createElement('div'); title.textContent = 'Branch ' + (branch + 1); title.style.fontSize = '.8em';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;max-width:110px;aspect-ratio:1;height:auto';
    canvas.width = 110; canvas.height = 110;
    const caption = document.createElement('div'); caption.style.cssText = 'font-size:.65em;white-space:nowrap';
    const symbol = power => '\u03b2<sub>' + (branch + 1) + '</sub><sup>(' + power + ')</sup>';
    caption.innerHTML = 'x: ' + symbol(1) + ', y: ' + symbol(2);
    if (canvas.setAttribute) canvas.setAttribute('aria-label', 'Branch ' + (branch + 1) + ' chamber slice; horizontal beta (' + (branch + 1) + ',1), vertical beta (' + (branch + 1) + ',2); both axes 0 to 3');
    wrap.appendChild(title); wrap.appendChild(canvas); wrap.appendChild(caption); row.appendChild(wrap); canvases.push(canvas);
  }
  function draw() {
    const beta = getBeta();
    const dark = document.documentElement && document.documentElement.getAttribute && document.documentElement.getAttribute('data-theme') === 'dark';
    const root = document.getElementById && document.getElementById('ek-nakajima-widget');
    const style = typeof getComputedStyle === 'function' && root ? getComputedStyle(root) : null;
    const css = (name, fallback) => style && style.getPropertyValue ? style.getPropertyValue(name).trim() || fallback : fallback;
    canvases.forEach((canvas, branch) => {
      if (typeof canvas.getContext !== 'function') return;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      const size = canvas.getBoundingClientRect ? canvas.getBoundingClientRect().width || 110 : 110;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const pixels = Math.round(size * dpr);
      if (canvas.width !== pixels || canvas.height !== pixels) { canvas.width = pixels; canvas.height = pixels; }
      ctx.setTransform(pixels / size, 0, 0, pixels / size, 0, 0); ctx.clearRect(0, 0, size, size);
      const pad = 7, span = size - 2 * pad;
      const x = value => pad + value / E6_BETA_DISPLAY_MAX * span;
      const y = value => size - pad - value / E6_BETA_DISPLAY_MAX * span;
      ctx.strokeStyle = css('--ek-box-bd', dark ? '#4a4a4a' : '#cfd4da'); ctx.lineWidth = 1; ctx.strokeRect(pad, pad, span, span);
      ctx.strokeStyle = css('--ek-wall', dark ? '#e07060' : '#c0392b'); ctx.lineWidth = 1.2;
      e6BranchSlice(beta, branch).forEach(segment => {
        const p = segment.points;
        ctx.beginPath(); ctx.moveTo(x(p[0][0]), y(p[0][1])); ctx.lineTo(x(p[1][0]), y(p[1][1])); ctx.stroke();
      });
      ctx.fillStyle = dark ? '#ffffff' : '#000000'; ctx.strokeStyle = css('--ek-box-bd', dark ? '#4a4a4a' : '#cfd4da'); ctx.lineWidth = 1; ctx.beginPath();
      ctx.arc(x(beta[branch][0]), y(beta[branch][1]), 3, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    });
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(draw).observe(row);
  else if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', draw);
  return { draw };
}
