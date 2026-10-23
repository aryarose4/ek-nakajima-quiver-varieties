import { createBalancedClient } from '../assets/js/ek-nakajima/balanced-client.js';
import { balancedDiagram } from '../assets/js/ek-nakajima/balanced-diagram.js';
import { experimentalBalancedDiagram } from '../assets/js/ek-nakajima/weighted-balanced-diagram.js';
import { E6_DEFAULT_BETA, betaToLevels } from '../assets/js/ek-nakajima/e6-parameters.js';

// Development comparison only: both panels intentionally omit cotangent glyphs.
// Every opacity is provided by the candidate math module, never by this renderer.
const ids = ['r', 'theta', 't', 'phi', 'beta'];
const controls = ids.map(id => document.getElementById(id));
const canvases = ['current', 'proposed'].map(id => document.getElementById(id));
const status = document.getElementById('status');
const path = document.getElementById('path');
let frames = [], requestNumber = 0;
const client = createBalancedClient();
const color = (hue, strength) => 'hsl(' + (hue === null ? 0 : hue) + ', ' + 85 * strength + '%, 40%)';

function draw(canvas, frame) {
  const width = canvas.clientWidth, height = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  if (!frame || !frame.valid || !frame.layout || !frame.layout.valid) {
    ctx.fillStyle = '#657080'; ctx.textAlign = 'center'; ctx.font = '13px system-ui';
    ctx.fillText(frame && frame.reason ? String(frame.reason) : 'Waiting for solve', width / 2, height / 2); return;
  }
  const layout = frame.layout, colors = layout.incidenceColors;
  const scale = Math.max(1, Math.min(width / 2 - 36, height / 2 - 27));
  const pixel = p => [width / 2 + p[0] * scale, height / 2 - p[1] * scale];
  ctx.lineCap = 'round'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
  layout.lines.forEach((line, i) => {
    if (!line) return;
    const a = pixel(line[0]), b = pixel(line[1]);
    ctx.globalAlpha = layout.lineOpacities ? layout.lineOpacities[i] : 1;
    ctx.strokeStyle = colors ? color(colors.lineHues[i], colors.lineStrengths[i]) : '#505762';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.fillText('ℓ' + (i + 1), a[0] + (b[0] - a[0]) * .08 + 5, a[1] + (b[1] - a[1]) * .08 - 6);
  });
  ctx.globalAlpha = 1;
  if (layout.concurrencyPoint) {
    const p = pixel(layout.concurrencyPoint); ctx.fillStyle = '#303740';
    ctx.beginPath(); ctx.arc(...p, 3, 0, Math.PI * 2); ctx.fill();
  }
  layout.points.forEach((point, i) => {
    if (!point) return;
    const p = pixel(point), marker = layout.pointMarkers && layout.pointMarkers[i];
    ctx.globalAlpha = layout.pointOpacities ? layout.pointOpacities[i] : 1;
    ctx.strokeStyle = colors ? color(colors.pointHues[i], colors.pointStrengths[i]) : '#303740'; ctx.lineWidth = 2;
    let group = 0;
    if (frame.data && frame.data.pointEqual) for (let j = 0; j < i; j++) if (frame.data.pointEqual[i][j]) group++;
    ctx.beginPath();
    if (marker && marker.clipped && marker.direction) {
      const d = [marker.direction[0], -marker.direction[1]];
      ctx.moveTo(p[0] - 8*d[0] - 4*d[1], p[1] - 8*d[1] + 4*d[0]); ctx.lineTo(...p);
      ctx.lineTo(p[0] - 8*d[0] + 4*d[1], p[1] - 8*d[1] - 4*d[0]); ctx.stroke();
    } else {
      ctx.arc(...p, 4 + 3*group, 0, Math.PI*2); ctx.fillStyle = 'white'; if (!group) ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = ctx.strokeStyle; ctx.fillText('p' + (i + 1), p[0] + 8, p[1] - 8 - group*12);
  });
  ctx.globalAlpha = 1;
}

function update() {
  const values = controls.map(input => Number(input.value));
  const positive = path.value === 'positive';
  const start = positive ? .05 : .5;
  const distance = start * Math.pow(1e-7 / start, values[4]);
  const betaValue = positive ? 1 + distance : distance;
  document.getElementById('beta-label').textContent = positive ? 'β₂⁽²⁾' : 'β₁⁽²⁾';
  controls.forEach((input, i) => { input.nextElementSibling.value = i === 4 ? betaValue.toExponential(2) : values[i].toFixed(3); });
  const parameters = { r: values[0], theta: values[1], t: values[2], phi: values[3], sphere: 0, outgoing: false };
  const beta = E6_DEFAULT_BETA.map(row => row.slice()); beta[positive ? 1 : 0][1] = betaValue;
  const levels = betaToLevels(beta), revision = ++requestNumber;
  status.textContent = 'Solving…'; document.body.dataset.busy = 'true';
  client.request(parameters, result => {
    if (revision !== requestNumber) return;
    document.body.dataset.busy = 'false';
    const diagnostics = { success: result.success, path: positive ? 'positive' : 'coordinate', distance, parameters, beta, levels, residuals: result.residuals, diagnostics: result.diagnostics };
    window.collapsePreview = diagnostics;
    document.body.dataset.realResidual = String(result.residuals && result.residuals.real_norm);
    document.body.dataset.parameters = JSON.stringify(parameters); document.body.dataset.beta = JSON.stringify(beta);
    if (!result.success) { status.textContent = 'Solve unavailable'; console.info('collapse-preview', diagnostics); return; }
    frames = [balancedDiagram(result.solvedRep), experimentalBalancedDiagram(result.solvedRep)];
    frames.forEach((frame, i) => {
      canvases[i].dataset.valid = String(frame.valid);
      canvases[i].dataset.lineOpacities = JSON.stringify(frame.layout && frame.layout.lineOpacities);
      canvases[i].dataset.pointOpacities = JSON.stringify(frame.layout && frame.layout.pointOpacities);
      draw(canvases[i], frame);
    });
    window.collapsePreview.frames = frames;
    status.textContent = frames[1].valid ? '' : 'Proposed camera unavailable';
    console.info('collapse-preview', diagnostics);
  }, levels);
}
controls.forEach(input => input.addEventListener('input', update));
path.addEventListener('change', update);
window.addEventListener('resize', () => canvases.forEach((canvas, i) => draw(canvas, frames[i])));
window.addEventListener('pagehide', () => client.dispose());
update();
