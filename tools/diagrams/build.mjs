// Node 12+, no dependencies. Requires pdflatex (standalone/TikZ) and pdftocairo.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../assets/img/ek-nakajima');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ek-quivers-'));
fs.mkdirSync(out, { recursive: true });
try {
  for (const name of ['e6', 'e7', 'e8']) {
    for (const [theme, rgb] of [['light', '40,44,52'], ['dark', '224,224,230']]) {
      fs.writeFileSync(path.join(temp, name + '.tex'), fs.readFileSync(path.join(here, name + '.tex'), 'utf8').replace('CDCOLOR', rgb));
      execFileSync('pdflatex', ['-interaction=nonstopmode', '-halt-on-error', name + '.tex'], { cwd: temp, stdio: 'pipe' });
      execFileSync('pdftocairo', ['-svg', name + '.pdf', path.join(out, name + '_' + theme + '.svg')], { cwd: temp, stdio: 'pipe' });
      console.log('built ' + name + '_' + theme + '.svg');
    }
  }
} catch (error) {
  console.error('LaTeX build failed; logs retained at ' + temp);
  if (error.stdout) console.error(error.stdout.toString());
  throw error;
}
// Remove only this process's temporary files; Node 12 lacks fs.rmSync.
for (const file of fs.readdirSync(temp)) fs.unlinkSync(path.join(temp, file));
fs.rmdirSync(temp);
