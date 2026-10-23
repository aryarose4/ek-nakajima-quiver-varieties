// Exercise the complete production-view continuity battery in every initial
// positive-beta neighbor and one chamber reached by two successive crossings.
import assert from 'assert';
import {spawnSync} from 'child_process';
import {fileURLToPath} from 'url';
const runner=fileURLToPath(new URL('./validate-parameter-continuity.mjs',import.meta.url));
let solves=0,cases=0;
for(const path of ['0','1','2','3','4','1,1']){
  const result=spawnSync(process.execPath,[runner,'--chamber-path='+path],{encoding:'utf8',maxBuffer:20*1024*1024});
  const lines=(result.stdout||'').trim().split('\n');
  let report;
  try{report=JSON.parse(lines[lines.length-1]);}catch(_){throw Error('Continuity path '+path+': '+result.stdout+' '+result.stderr);}
  assert.strictEqual(result.status,0,'Continuity path '+path+': '+JSON.stringify(report.failures)+' '+result.stderr);
  assert.strictEqual(report.failures.length,0);
  solves+=report.solves;cases+=report.cases;
  console.log('Continuity path '+path+': '+report.cases+' cases, '+report.solves+' strict solves passed.');
}
console.log('Multichamber continuity: '+cases+' cases, '+solves+' strict solves; r/theta/t/phi, all beta coordinates, wall collars, production lines/dots/glyphs/arrows.');
