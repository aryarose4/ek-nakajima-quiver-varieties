import { readFileSync } from 'fs';
import assert from 'assert';
const source = readFileSync(new URL('../assets/js/ek-nakajima/e6-levels.js', import.meta.url), 'utf8');
import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')).then(m => {
  const fixture = m.e6RootWallAudit(m.E6_FIXTURE_LEVELS);
  assert.strictEqual(fixture.roots.length, 72);
  assert.strictEqual(fixture.walls.length, 4);
  assert.strictEqual(fixture.regular, false);
  const regular = m.e6RootWallAudit(m.E6_REGULAR_LEVELS);
  assert.strictEqual(regular.regular, true);
  assert.ok(Math.abs(regular.minAbsWeight - 1 / 15) < 1e-12);
  for (const root of fixture.roots) {
    assert.ok(fixture.roots.some(other => other.center === 3 - root.center &&
      other.middle.every((x, i) => x === 2 - root.middle[i]) &&
      other.outer.every((x, i) => x === 1 - root.outer[i])));
  }
  // Integer arithmetic independently checks regularity of gamma2=21/10.
  for (const root of regular.roots) {
    const exactThirtyWeight = -212 * root.center + 90 * root.outer.reduce((a,b) => a+b,0) +
      30 * root.middle[0] + 63 * root.middle[1] + 90 * root.middle[2];
    assert.notStrictEqual(exactThirtyWeight, 0);
    assert.ok(Math.abs(exactThirtyWeight / 30 - root.weight) < 1e-12);
  }
  assert.throws(() => m.e6RootWallAudit([[3,1],[3,NaN],[3,3]]), RangeError);
  console.log('E6 levels: 72 real roots audited; frozen walls and nearby regular chamber verified.');
}).catch(error => { console.error(error); process.exitCode = 1; });

