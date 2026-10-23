// Keep adaptive search and structural cases in the normal battery. The larger
// --extended scan remains available for investigating the full chamber graph.
import assert from 'assert';
import {spawnSync} from 'child_process';
import {fileURLToPath} from 'url';
const scanner=fileURLToPath(new URL('./scan-adaptive-camera-continuity.mjs',import.meta.url));
for(const args of [['--steps=32','--incidence'],['--critical','--incidence'],['--strata','--incidence'],['--synthetic']]){
  const result=spawnSync(process.execPath,[scanner,...args],{encoding:'utf8',maxBuffer:20*1024*1024});
  assert.strictEqual(result.status,0,'Adaptive camera '+args.join(' ')+': '+result.stdout+' '+result.stderr);
  const lines=result.stdout.trim().split('\n'),report=JSON.parse(lines[lines.length-1]);
  console.log('Adaptive camera '+args.join(' ')+': '+(report.solves===undefined?report.syntheticFamilies+' algebraic flag families':report.solves+' strict solves')+' passed.');
}
