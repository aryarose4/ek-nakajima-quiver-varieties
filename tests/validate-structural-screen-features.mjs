import assert from 'assert';
import {structuralDefects} from './structural-screen-features.mjs';
const matrix=()=>Array.from({length:3},()=>[false,false,false]);
function fixture(){return {data:{linePresent:[true,true,true],pointEqual:matrix(),lineEqual:matrix(),incident:matrix(),collinear:false,concurrent:false},layout:{points:[[0,0],[0,0],[0,0]],pointOpacities:[1,1,1],lineOpacities:[1,1,1],lines:[[[0,0],[1,0]],[[0,1],[1,1]],[[0,2],[1,2]]]}};}
assert.deepStrictEqual(structuralDefects(fixture()),[]);
// A full-weight source plane can disappear from the camera despite all
// incidence/equality flags being false. This was the outgoing Krylov failure.
const collapsed=fixture();collapsed.layout.lines[0]=[[0,0],[0,0]];
assert.deepStrictEqual(structuralDefects(collapsed),['degenerate line 0']);
for(const value of [NaN,Infinity,-Infinity]){const d=fixture();d.layout.lines[1][0][0]=value;assert.deepStrictEqual(structuralDefects(d),['nonfinite line 1']);}
// Genuine partial-source loss and negligible ink retain their prior behavior.
collapsed.data.linePresent[0]=false;assert.deepStrictEqual(structuralDefects(collapsed),[]);
collapsed.data.linePresent[0]=true;collapsed.layout.lineOpacities[0]=1e-6;assert.deepStrictEqual(structuralDefects(collapsed),[]);
collapsed.layout.lineOpacities[0]=2e-6;assert.deepStrictEqual(structuralDefects(collapsed),['degenerate line 0']);
console.log('Structural screen visibility guards passed.');
