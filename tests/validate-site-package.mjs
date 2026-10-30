// Run normally to rebuild and exercise cleanup; --check-only checks an existing artifact.
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSite, htmlReferences, imports } from '../tools/build-site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
if (!process.argv.includes('--check-only')) {
  buildSite();
  // A previously published accidental file must not survive a rebuild.
  fs.mkdirSync(path.join(OUT, 'sim'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'sim', 'private-fixture.txt'), 'stale');
  fs.writeFileSync(path.join(OUT, 'e7-prototype.html'), 'stale');
  buildSite();
}

const files = [];
function walk(directory) {
  for (const name of fs.readdirSync(directory)) {
    const absolute = path.join(directory, name);
    const stat = fs.lstatSync(absolute);
    assert(!stat.isSymbolicLink(), 'Artifact contains symlink: ' + absolute);
    if (stat.isDirectory()) walk(absolute);
    else {
      assert(stat.isFile(), 'Artifact contains non-file: ' + absolute);
      files.push(path.relative(OUT, absolute).split(path.sep).join('/'));
    }
  }
}
walk(OUT);
const roots = ['index.html', 'ek-nakajima.html', 'LICENSE', '.nojekyll', 'THIRD_PARTY_NOTICES.txt'];
for (const name of roots) assert(files.includes(name), 'Missing publication file: ' + name);
assert(files.includes('assets/js/ek-nakajima/lib/LICENSE'), 'Missing vendored license');
const logoPath = 'assets/img/ek_nakajima_logo.svg';
assert(files.includes(logoPath), 'Missing SVG logo');
assert(!files.includes('assets/img/Star-Shaped_Quiver.jpg'), 'Obsolete logo exposed in runtime package');
assert(fs.readFileSync(path.join(OUT, logoPath)).equals(fs.readFileSync(path.join(ROOT, logoPath))),
  'Published logo differs from source');
const download = fs.readFileSync(path.join(OUT, 'ek-nakajima.html'), 'utf8');
const logoURI = 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(ROOT, logoPath)).toString('base64');
assert(download.includes('href="' + logoURI + '"'), 'Download favicon must embed SVG logo');
assert(download.includes('src="' + logoURI + '"'), 'Download header must embed SVG logo');
assert(!download.includes('Star-Shaped_Quiver.jpg'), 'Download references obsolete logo');
for (const name of files) {
  assert(roots.includes(name) || name.startsWith('assets/'), 'Unexpected published root: ' + name);
  assert(!/(^|\/)(?:dev|sim|tests|tools|journal|\.git|\.github|\.worktrees)(\/|$)/.test(name), 'Private content: ' + name);
  assert(!/prototype|AGENTS\.md|README\.md/i.test(name), 'Development content: ' + name);
}

function requireLocal(from, reference) {
  assert(!reference.startsWith('/'), 'Root-absolute URL breaks project Pages: ' + reference);
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), reference));
  assert(!target.startsWith('../'), 'Reference escapes artifact: ' + reference);
  assert(files.includes(target), from + ' references missing ' + target);
  return target;
}
const reachable = new Set(roots.concat(['assets/js/ek-nakajima/lib/LICENSE']));
function visit(name) {
  if (reachable.has(name)) return;
  reachable.add(name);
  if (name.endsWith('.js') && !name.endsWith('-worker-source.js') && !name.includes('/lib/')) {
    for (const reference of imports(fs.readFileSync(path.join(OUT, name), 'utf8'))) {
      visit(requireLocal(name, reference));
    }
  }
}
for (const name of ['index.html', 'ek-nakajima.html']) {
  for (const reference of htmlReferences(fs.readFileSync(path.join(OUT, name), 'utf8'))) {
    visit(requireLocal(name, reference));
  }
}
for (const type of ['e6', 'e7', 'e8']) for (const theme of ['light', 'dark']) {
  visit(requireLocal('index.html', 'assets/img/ek-nakajima/' + type + '_' + theme + '.svg'));
}
for (const name of files) assert(reachable.has(name), 'Unneeded asset exposed: ' + name);
assert.strictEqual(fs.readFileSync(path.join(OUT, 'ek-nakajima.html'), 'utf8'),
  fs.readFileSync(path.join(ROOT, 'ek-nakajima.html'), 'utf8'), 'Download differs from regenerated bundle');
console.log('PASS: ' + files.length + ' publication files; local references, graph closure, notices and exclusions verified');
