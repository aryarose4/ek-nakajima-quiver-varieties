// Describe solved numerical flags only; display geometry is not evidence.
export function incidenceIndicators(data) {
  if (!data || !data.valid) return [];
  const ids = [0, 1, 2], subs = ['₁', '₂', '₃'];
  const present = (kind, i) => !data[kind + 'Present'] || !!data[kind + 'Present'][i];
  const flag = (key, i, j) => !!(data[key] && data[key][i] && data[key][i][j]);
  function groups(kind) {
    const result = [];
    ids.filter(i => present(kind, i)).forEach(i => {
      const group = result.find(g => g.some(j => flag(kind + 'Equal', i, j)));
      if (group) group.push(i); else result.push([i]);
    });
    return result;
  }
  const points = groups('point'), lines = groups('line'), labels = [];
  const name = (prefix, i) => prefix + subs[i];
  points.forEach(g => { if (g.length > 1) labels.push(g.map(i => name('L', i)).join('=')); });
  lines.forEach(g => { if (g.length > 1) labels.push(g.map(i => name('P', i)).join('=')); });
  points.forEach(pg => {
    const targets = lines.filter(lg =>
      // Own-flag membership plus the equality badges already implies this.
      !pg.some(i => lg.indexOf(i) >= 0 && flag('incident', i, i)) &&
      pg.some(i => lg.some(j => i !== j && flag('incident', i, j))));
    if (targets.length) labels.push(name('L', pg[0]) + '⊂' + targets.map(g => name('P', g[0])).join('∩'));
  });
  if (points.length === 3 && data.collinear) labels.push('dim(L₁+L₂+L₃)≤2');
  if (lines.length === 3 && data.concurrent) labels.push('P₁∩P₂∩P₃≠{0}');
  // E6 atlas height order, independent of the path used to reach this frame:
  // long arms start with L2/3 in P1, gain L1 in P3/2 at the middle
  // fixed point, then L3/2 in P2/3 at the tip. The short arm starts
  // concurrent and gains collinearity at its tip. Equality grouping above
  // remains concise; a grouped membership takes its latest constituent rank.
  function height(label) {
    if (label === 'P₁∩P₂∩P₃≠{0}') return 0;
    if (label === 'dim(L₁+L₂+L₃)≤2') return 1;
    if (label.indexOf('⊂') < 0) return 3;
    const target = label.split('⊂')[1];
    if (target === 'P₁') return 0;
    return label.indexOf('L₁⊂') === 0 ? 1 : 2;
  }
  const ordered=labels.map((label, index) => ({ label, index, height: height(label) }))
    .sort((a, b) => a.height - b.height || a.index - b.index).map(entry => entry.label);
  // Image facts follow the existing stratum order; source arm order is fixed.
  if (data.chamberId && data.chamberId !== 'default' && data.imageIncidences) {
    data.imageIncidences.forEach((image,i)=>{
      if(!image)return;
      const pg=points.filter(g=>g.some(j=>image.points[j]));
      const lg=lines.filter(g=>!g.includes(i)&&g.some(j=>image.planes[j])&&
        !pg.some(p=>p.some(j=>g.some(k=>flag('incident',j,k)))));
      const targets=pg.map(g=>name('L',g[0])).concat(lg.map(g=>name('P',g[0])));
      if(targets.length)ordered.push('im(ϕ'+subs[i]+')⊂'+targets.join('∩'));
    });
  }
  return ordered;
}
