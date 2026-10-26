import { E6_DEFAULT_BETA, E6_BETA_DISPLAY_MAX, betaToLevels, e6BetaInterval, constrainE6Beta } from './e6-parameters.js';

import { createChamberSlices } from './chamber-slices.js';

export function createParametersPanel(host, options = {}) {
  let beta = E6_DEFAULT_BETA.map(row => row.slice());
  let enabled = true;
  const panel = document.createElement('div');
  panel.className = 'ek-panel ek-parameters';
  const heading = document.createElement('div');
  heading.className = 'ek-sec'; heading.textContent = 'Parameters'; panel.appendChild(heading);
  const slices = createChamberSlices(panel, getBeta);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px';
  panel.appendChild(grid); host.appendChild(panel);
  const controls = [];
  function chamberId() { return options.getChamberId ? options.getChamberId() : undefined; }
  // Optional host adapter. Actions never mutate beta or assume solver support.
  // Descriptors: {id, label, atWall, canApproach, canCross, alwaysVisible}. Cross changes the
  // chamber at the pinned wall; transport and chamber areas belong to the host.
  // rows keeps every inequality visible, including locked coordinate-zero walls.
  const wallActions = options.wallActions;
  const wallRow = wallActions ? document.createElement('div') : null;
  let wallRevision = 0;
  let wallPending = false;
  if (wallRow) {
    wallRow.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;gap:6px;margin-top:10px;font-size:.85em';
    panel.appendChild(wallRow);
  }
  function wallOptions() {
    return wallActions && typeof wallActions.getOptions === 'function'
      ? wallActions.getOptions(getBeta()) || [] : [];
  }
  function permitted(wall, action) {
    return enabled && !wallPending && wall &&
      typeof wallActions[action === 'cross' ? 'onCross' : 'onApproach'] === 'function' &&
      (action === 'cross' ? wall.atWall === true && wall.canCross === true
        : wall.atWall !== true && wall.canApproach === true);
  }
  function refreshWallActions() {
    slices.draw();
    if (!wallRow) return;
    const revision = ++wallRevision;
    wallRow.textContent = '';
    let count = 0;
    const walls = wallOptions();
    walls.forEach(wall => {
      ['approach', 'cross'].forEach(action => {
        const available = permitted(wall, action);
        const persistent = enabled && action === 'cross' && (wallActions.rows === true || wall.alwaysVisible === true && wall.canCross === true) &&
          typeof wallActions.onCross === 'function';
        if (!available && !persistent) return;
        const box = document.createElement('span');
        box.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0';
        box.className = 'ek-wall-action-row';
        if (box.setAttribute) box.setAttribute('data-wall-id', wall.id);
        const label = document.createElement('span'); label.textContent = wall.label || '';
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'ek-btn';
        if (action === 'cross') button.className += ' ek-cross-btn';
        button.textContent = action === 'cross' ? 'Cross Wall' : 'Approach Wall';
        button.disabled = !available;
        button.style.flexShrink = '0';
        if (action === 'cross' && wall.atWall === true) {
          if (button.setAttribute) button.setAttribute('data-at-wall', 'true');
          if (box.setAttribute) box.setAttribute('data-at-wall', 'true');
        }
        if (!available) button.title = wallPending ? 'Crossing wall' : wall.canCross === true ? 'Reach this wall to cross' : 'Crossing this wall is not supported';
        button.addEventListener('click', () => {
          // Recheck live capability; detached buttons and double clicks are inert.
          if (revision !== wallRevision) return;
          const current = wallOptions().find(item => item.id === wall.id);
          if (!permitted(current, action)) { refreshWallActions(); return; }
          wallPending = true; refreshWallActions();
          function finish(error) {
            wallPending = false; refreshWallActions();
            if (error) {
              wallRow.title = String(error.message || error);
              if (typeof wallActions.onError === 'function') wallActions.onError(error);
            }
          }
          try {
            const result = wallActions[action === 'cross' ? 'onCross' : 'onApproach'](current, getBeta());
            if (result && typeof result.then === 'function') result.then(() => finish(), finish);
            else finish();
          } catch (error) { finish(error); }
        });
        if (label.textContent) box.appendChild(label);
        box.appendChild(button); wallRow.appendChild(box); count++;
      });
    });
    wallRow.style.display = count ? 'flex' : 'none';
  }
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
      const next = constrainE6Beta(beta, index, Number(input.value), chamberId());
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
      const iv = e6BetaInterval(beta, index, chamberId());
      const pct = wall => Math.max(0, Math.min(100, 100 * wall / E6_BETA_DISPLAY_MAX)) + '%';
      control.input.value = String(value); control.readout.textContent = value.toFixed(3);
      control.input.style.setProperty('--ek-beta-lo', pct(iv.lo));
      control.input.style.setProperty('--ek-beta-hi', pct(iv.hi));
      control.input.disabled = !enabled;
    });
    refreshWallActions();
  }
  function getBeta() { return beta.map(row => row.slice()); }
  refresh();
  return { getBeta, refresh, refreshWallActions, refreshTheme: slices.draw, getLevels: () => betaToLevels(beta), setEnabled(value) {
    enabled = !!value; panel.style.display = enabled ? '' : 'none'; refresh();
  } };
}
