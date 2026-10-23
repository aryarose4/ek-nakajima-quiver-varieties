import assert from 'assert';
import {source} from './continuity-features.mjs';
(async function(){
 const {cotangentGlyphStyle:style}=await import(source('element-render.js'));
 const glyph={coefficients:[[0,0],[0,1],[1,0]],phaseCorrelations:[[0,0],[0,1],[1,0]],magnitudes:[1,1,0]};
 const gray=style(glyph,0,false,.2);
 assert.strictEqual(gray.opacity,1,'nonzero physical block survives vanishing phase correlation');
 assert(gray.color.includes('0%'),'undefined phase is gray');
 assert.strictEqual(style(glyph,2,false).opacity,0,'actual zero block is invisible despite nonzero correlation');
 assert.notStrictEqual(style(glyph,1,false).color,gray.color,'complex correlation supplies phase hue');
 assert.strictEqual(style({coefficients:[[1,0]]},0,false,.2).opacity,.2,'legacy coefficients retain object visibility');
 assert.strictEqual(style({coefficients:[[0,0]]},0,false).opacity,0,'legacy zero coefficients remain invisible');
 console.log('Intrinsic glyph rendering: physical size, gray zero correlation, phase hue, legacy visibility passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
