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
  return labels;
}
