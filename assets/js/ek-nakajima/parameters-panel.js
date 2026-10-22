import { E6_DEFAULT_BETA, E6_BETA_DISPLAY_MAX, betaToLevels, e6BetaInterval, constrainE6Beta } from './e6-parameters.js';

export function createParametersPanel(host, options = {}) {
  let beta = E6_DEFAULT_BETA.map(row => row.slice());
  let enabled = true;
  const panel = document.createElement('div');
  panel.className = 'ek-panel ek-parameters';
  const heading = document.createElement('div');
  heading.className = 'ek-sec'; heading.textContent = 'Parameters'; panel.appendChild(heading);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px';
  panel.appendChild(grid); host.appendChild(panel);
  const controls = [];
  for (let index = 0; index < 6; index++) {
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;color:var(--ek-box-tx);font-size:.9em';
    const label = document.createElement('label');
    const id = 'ek-beta-' + index;
    label.htmlFor = id;
    label.innerHTML = '\u03b2<sub>' + (Math.floor(index / 2) + 1) + '</sub><sup>(' + (index % 2 + 1) + ')</sup>';
    const input = document.createElement('input');
    input.type = 'range'; input.id = id; input.className = 'ek-slider ek-beta-slider';
    input.min = '0'; input.max = String(E6_BETA_DISPLAY_MAX); input.step = 'any';
    input.style.cssText = 'flex:1 1 auto;min-width:0;width:0';
    const readout = document.createElement('span');
    readout.className = 'ek-readout'; readout.style.minWidth = '3.5em';
    function change() {
      if (!enabled) { refresh(); return; }
      const next = constrainE6Beta(beta, index, Number(input.value));
      const changed = next.some((row, i) => row.some((value, j) => value !== beta[i][j]));
      beta = next; refresh();
      if (changed && options.onChange) options.onChange(getBeta(), betaToLevels(beta));
    }
    input.addEventListener('input', change); input.addEventListener('change', change);
    box.appendChild(label); box.appendChild(input); box.appendChild(readout); grid.appendChild(box);
    controls.push({input, readout});
  }
  function refresh() {
    controls.forEach((control, index) => {
      const value = beta[Math.floor(index / 2)][index % 2];
      const iv = e6BetaInterval(beta, index);
      const pct = wall => Math.max(0, Math.min(100, 100 * wall / E6_BETA_DISPLAY_MAX)) + '%';
      control.input.value = String(value); control.readout.textContent = value.toFixed(3);
      control.input.style.setProperty('--ek-beta-lo', pct(iv.lo));
      control.input.style.setProperty('--ek-beta-hi', pct(iv.hi));
      control.input.disabled = !enabled;
    });
  }
  function getBeta() { return beta.map(row => row.slice()); }
  refresh();
  return { getBeta, getLevels: () => betaToLevels(beta), setEnabled(value) {
    enabled = !!value; panel.style.display = enabled ? '' : 'none'; refresh();
  } };
}
