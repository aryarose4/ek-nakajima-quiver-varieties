import { readFileSync } from 'fs';
import assert from 'assert';
const cache = {};
function uri(name) {
  if (!cache[name]) {
    const source = readFileSync(new URL('../assets/js/ek-nakajima/' + name, import.meta.url), 'utf8')
      .replace(/(['"])\.\/([^'"]+\.js)\1/g, (_, quote, dependency) => JSON.stringify(uri(dependency)));
    cache[name] = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  }
  return cache[name];
}
Promise.all(['e6-atlas.js', 'element-render.js', 'flag-incidence.js', 'core-math.js'].map(n => import(uri(n))))
  .then(([atlas, render, incidence, m]) => {
    let checks = 0;
    const check = (ok, message) => { checks++; assert.ok(ok, message); };
    function frame(r, sphere, t) {
      const p = atlas.e6AtlasPoint({ r, sphere, theta: 0, t, phi: 0 });
      return render.elementFrame({ ...p.view, incidence: incidence.flagIncidence(p.rep),
        cotangentOperators: p.rep.A.map((A, i) => m.matMul(A, p.rep.B[i])) });
    }
    const flat = f => f.layout.lines.reduce((out, line) => out.concat(...line), []);
    for (const r of [0, 1]) for (const sphere of [0, 1]) {
      const target = frame(r, sphere, 1), near = frame(r, sphere, 1 - 1e-7);
      check(target.layout.valid && near.layout.valid, 'actual renderer accepts atlas endpoint and approaching frame');
      const a = flat(target), b = flat(near);
      check(Math.hypot(...a.map((v, i) => v - b[i])) < 1e-5, 'actual canvas gauge approaches correct sphere endpoint');
      const coefficients = f => f.glyphs.reduce((out, glyph) => out.concat(...glyph.coefficients), []);
      const ka = coefficients(target), kb = coefficients(near);
      check(Math.hypot(...ka.map((v, i) => v - kb[i])) < 1e-5, 'actual canvas cotangent glyphs approach endpoint without a phase jump');
      if (sphere === 0) check(JSON.stringify(target.layout.lines) === JSON.stringify(frame(r, 1, 0).layout.lines),
        'limit button preserves the incidence drawing');
    }
    console.log(`${checks} atlas-render integration checks passed.`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
