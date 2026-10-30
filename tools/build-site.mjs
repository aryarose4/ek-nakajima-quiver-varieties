// Dependency-free Node 12+ Pages packaging. Never publish the repository root.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');

function checkedFile(relative) {
  const absolute = path.resolve(ROOT, relative);
  if (!absolute.startsWith(ROOT + path.sep)) throw new Error('Path outside repository: ' + relative);
  let current = ROOT;
  for (const part of path.relative(ROOT, absolute).split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink refused: ' + current);
  }
  if (!fs.statSync(absolute).isFile()) throw new Error('Expected regular file: ' + relative);
  return absolute;
}

// Only static ES-module references are used by this widget. Worker source
// modules contain generated, self-contained strings, not module imports.
export function imports(source) {
  const result = [];
  const pattern = /(?:\bimport\s+(?:[^;'"`]*?\s+from\s*)?|\bexport\s+[^;'"`]*?\s+from\s*)['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(source))) {
    if (!/^\.\.?\//.test(match[1])) throw new Error('Non-local module import: ' + match[1]);
    result.push(match[1]);
  }
  return result;
}

export function htmlReferences(source) {
  const result = [];
  // Restrict scanning to tags: bundled JavaScript includes strings resembling attributes.
  source = source.replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1');
  const tags = source.match(/<(?:script|link|img|a)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const pattern = /\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/gi;
    let match;
    while ((match = pattern.exec(tag))) {
      if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(match[1])) result.push(match[1].split(/[?#]/)[0]);
    }
  }
  return result.filter(Boolean);
}

function removeOutput() {
  // Fixed destination, checked before recursion; no caller-supplied deletion paths.
  if (path.dirname(OUT) !== ROOT || path.basename(OUT) !== '_site') throw new Error('Unsafe output path');
  try { fs.lstatSync(OUT); } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  function remove(entry) {
    const stat = fs.lstatSync(entry);
    if (stat.isSymbolicLink()) throw new Error('Output symlink refused: ' + entry);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(entry)) remove(path.join(entry, name));
      fs.rmdirSync(entry);
    } else fs.unlinkSync(entry);
  }
  remove(OUT);
}

export function buildSite() {
  // Regenerate the download and embedded worker sources before finding the graph.
  execFileSync(process.execPath, [checkedFile('tools/build-single.mjs')], { cwd: ROOT, stdio: 'pipe' });
  const files = new Set(['index.html', 'ek-nakajima.html', 'LICENSE',
    'assets/js/ek-nakajima/lib/LICENSE', 'THIRD_PARTY_NOTICES.txt']);
  function visit(relative) {
    relative = relative.split(path.sep).join('/');
    if (files.has(relative)) return;
    if (!relative.startsWith('assets/')) throw new Error('Runtime dependency outside assets: ' + relative);
    const absolute = checkedFile(relative);
    files.add(relative);
    if (relative.endsWith('.js') && !relative.endsWith('-worker-source.js') && !relative.includes('/lib/')) {
      for (const dependency of imports(fs.readFileSync(absolute, 'utf8'))) {
        visit(path.normalize(path.join(path.dirname(relative), dependency)));
      }
    }
  }
  for (const reference of htmlReferences(fs.readFileSync(checkedFile('index.html'), 'utf8'))) {
    if (reference.startsWith('/')) throw new Error('Root-absolute URL breaks project Pages: ' + reference);
    const relative = path.normalize(reference).split(path.sep).join('/');
    if (!files.has(relative)) visit(relative);
  }
  // widget.js chooses these six URLs dynamically when theme or tab changes.
  for (const type of ['e6', 'e7', 'e8']) for (const theme of ['light', 'dark']) {
    visit('assets/img/ek-nakajima/' + type + '_' + theme + '.svg');
  }
  // Validate the complete allowlist before clearing any previous package.
  for (const relative of files) checkedFile(relative);
  removeOutput();
  fs.mkdirSync(OUT);
  for (const relative of Array.from(files).sort()) {
    const destination = path.join(OUT, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(checkedFile(relative), destination);
  }
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  console.log('Packaged ' + (files.size + 1) + ' files in _site/');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildSite();
