import assert from 'assert';
import {source,glyphFeatures,distance} from './continuity-features.mjs';
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
 const features=(m,target)=>glyphFeatures({glyphs:[{coefficients:[[0,0],[0,0],[0,0]],magnitudes:[0,0,m]}],layout:{cotangentTargets:[{point:target}],pointOpacities:[1],lineOpacities:[1]}});
 assert.strictEqual(distance(features(0,[0,0]),features(0,[.5,.5])),0,'invisible target motion contributes no ink');
 assert(distance(features(1,[0,0]),features(1,[.5,.5]))>.1,'visible physical block retains target motion');
 assert(distance(features(1e-8,[0,0]),features(1e-8,[.5,.5]))<1e-8,'target contribution vanishes continuously');
 console.log('Intrinsic glyph rendering: physical size, gray zero correlation, phase hue, legacy visibility passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
