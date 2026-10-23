// Separate runner entry keeps both chambers in the normal validation battery.
process.argv.push('--adjacent');
import('./validate-parameter-continuity.mjs').catch(error=>{
  console.error(error);process.exitCode=1;
});
