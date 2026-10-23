import { E6_REGULAR_LEVELS, e6BoundedRealRoots } from './e6-levels.js';
import { e6ReflectLevels } from './e6-chamber-transport.js';
import { e6WallTransitionOptions } from './e6-wall-transitions.js';

// Keep the certified chamber reference independent of the live slider defaults.
export const E6_REFERENCE_BETA = E6_REGULAR_LEVELS.map(row => row.map(value => value / 2));
// Distinct interior coordinates keep a single slider from reaching a chamber corner.
export const E6_DEFAULT_BETA = [[1.23, .40], [1.64, 1.41], [1.06, 1.82]];
export const E6_BETA_DISPLAY_MAX = 3;
const MARGIN = 1e-7;
export const E6_DEFAULT_CHAMBER = 'default';
export const E6_ADJACENT_CHAMBER = 'side-zero-second';
export const E6_CROSSING_WORD = [4,1,0,3,0,1,4];
const crossed = [-2/3,-1/3,1/3,2/3,1/3,-1/3];
export function e6CrossedPeriod(beta) { return weight(crossed, flat(beta)); }

const chambers = new Map(), signatures = new Map(), signCache = new Map();
let initialized = false;
export function e6ChamberWord(chamberId = E6_DEFAULT_CHAMBER) {
  if (chamberId === E6_DEFAULT_CHAMBER) return [];
  if (chamberId === E6_ADJACENT_CHAMBER) return E6_CROSSING_WORD.slice();
  if (typeof chamberId==='string' && /^weyl:(?:[0-5]\.)*[0-5]$/.test(chamberId)) return chamberId.slice(5).split('.').map(Number);
  throw new RangeError('Unsupported E6 chamber.');
}
export function e6SourceBeta(beta, chamberId = E6_DEFAULT_CHAMBER) {
  flat(beta);
  return e6ChamberWord(chamberId).reverse().reduce((z,v) => e6ReflectLevels(z,v), beta);
}
function chamberReference(chamberId) {
  return e6ChamberWord(chamberId).reduce((z,v)=>e6ReflectLevels(z,v),E6_REFERENCE_BETA);
}
function chamberSigns(chamberId = E6_DEFAULT_CHAMBER) {
  if(signCache.has(chamberId))return signCache.get(chamberId);
  const ref=flat(chamberReference(chamberId)),result=coefficients.map(c=>Math.sign(weight(c,ref)));
  signCache.set(chamberId,result);return result;
}
// Physical beta is retained by the UI. The solver samples an explicitly
// reported tiny interior collar toward a reference in the selected chamber.
export function e6DisplayBeta(beta, chamberId = E6_DEFAULT_CHAMBER) {
  const desired=chamberSigns(chamberId), values=flat(beta);
  if(values.some(x=>x < -2e-7)||coefficients.some((c,i)=>desired[i]*weight(c,values)<-2e-7))throw new RangeError('Beta outside selected E6 chamber closure.');
  if (values.every(x=>x>0) && coefficients.every((c,i)=>desired[i]*weight(c,values)>=MARGIN*.99)) return beta.map(r=>r.slice());
  const target=flat(chamberReference(chamberId));
  let fraction=0;
  coefficients.forEach((c,i)=>{
    const a=desired[i]*weight(c,values),b=desired[i]*weight(c,target);
    if(a<MARGIN) fraction=Math.max(fraction,(MARGIN-a)/(b-a));
  });
  values.forEach((x,i)=>{if(x<MARGIN)fraction=Math.max(fraction,(MARGIN-x)/(target[i]-x));});
  if(!Number.isFinite(fraction)||fraction>1||fraction<0)throw new RangeError('Cannot sample selected E6 chamber.');
  const out=values.map((x,i)=>x+fraction*(target[i]-x));
  return [out.slice(0,2),out.slice(2,4),out.slice(4,6)];
}
export function e6AtCrossingWall(beta) {
  try { return Math.abs(e6CrossedPeriod(beta)) <= 2e-7 &&
    e6BetaInChamber(e6DisplayBeta(beta), E6_DEFAULT_CHAMBER) &&
    e6BetaInChamber(e6DisplayBeta(beta, E6_ADJACENT_CHAMBER), E6_ADJACENT_CHAMBER); } catch(e) { return false; }
}
const coefficients = e6BoundedRealRoots().map(root => root.outer.reduce((out, value, i) =>
  out.concat([value - root.center / 3, root.middle[i] - 2 * root.center / 3]), []));
function flat(beta) {
  if (!Array.isArray(beta) || beta.length !== 3 || beta.some(row =>
    !Array.isArray(row) || row.length !== 2 || !row.every(Number.isFinite))) {
    throw new RangeError('Expected three finite beta pairs.');
  }
  return [].concat(...beta);
}
function weight(c, values) { return c.reduce((sum, value, i) => sum + value * values[i], 0); }
export function betaToLevels(beta) { flat(beta); return beta.map(row => row.map(value => 2 * value)); }
export function e6BetaInChamber(beta, chamberId) {
  const signs = chamberSigns(chamberId);
  const values = flat(beta);
  return values.every(value => value > 0) && coefficients.every((c, i) => signs[i] * weight(c, values) > 0);
}
// Physical walls are separate from the small interior margin used by drags.
export function e6BetaInterval(beta, index, chamberId) {
  const signs = chamberSigns(chamberId);
  const values = flat(beta);
  if (!Number.isInteger(index) || index < 0 || index >= 6) throw new RangeError('Invalid beta index.');
  let lo = 0, hi = Infinity, safeLo = MARGIN, safeHi = Infinity;
  coefficients.forEach((c, i) => {
    const a = signs[i] * c[index];
    if (Math.abs(a) < 1e-14) return;
    let b = 0;
    c.forEach((value, j) => { if (j !== index) b += signs[i] * value * values[j]; });
    const wall = -b / a;
    const interior = (MARGIN - b) / a;
    if (a > 0) { lo = Math.max(lo, wall); safeLo = Math.max(safeLo, interior); }
    else { hi = Math.min(hi, wall); safeHi = Math.min(safeHi, interior); }
  });
  return { lo, hi, safeLo, safeHi };
}
export function constrainE6Beta(beta, index, requested, chamberId) {
  const copy = beta.map(row => row.slice());
  const iv = e6BetaInterval(beta, index, chamberId);
  if (!Number.isFinite(requested) || iv.safeLo > iv.safeHi) return copy;
  const value = Math.max(iv.safeLo, Math.min(iv.safeHi, requested));
  copy[Math.floor(index / 2)][index % 2] = value;
  return e6BetaInChamber(copy, chamberId) ? copy : beta.map(row => row.slice());
}

let rootWords;
function reflectionWord(coeff) {
  const key=c=>c.map(x=>Math.round(x*3)).join(',');
  if(!rootWords) {
    rootWords=new Map();const queue=[{c:[1,0,0,0,0,0],word:[]}];rootWords.set(key(queue[0].c),[]);
    for(let i=0;i<queue.length;i++)for(let v=0;v<6;v++) {
      const item=queue[i],c=Array.from({length:6},(_,j)=>{
        const e=[0,0,0,0,0,0];e[j]=1;
        return weight(item.c,flat(e6ReflectLevels([e.slice(0,2),e.slice(2,4),e.slice(4,6)],v)));
      });
      if(!rootWords.has(key(c))){const word=[v].concat(item.word);rootWords.set(key(c),word);queue.push({c,word});}
    }
  }
  const word=rootWords.get(key(coeff));if(!word)throw new RangeError('Missing E6 root reflection.');
  return word.concat([4],word.slice().reverse());
}
const signature=beta=>coefficients.map(c=>Math.sign(weight(c,flat(beta)))).join(',');
function registerChamber(beta,word) {
  if(!initialized){initialized=true;signatures.set(signature(E6_REFERENCE_BETA),E6_DEFAULT_CHAMBER);signatures.set(signature(chamberReference(E6_ADJACENT_CHAMBER)),E6_ADJACENT_CHAMBER);}
  const sig=signature(beta);if(signatures.has(sig))return signatures.get(sig);
  const id='weyl:'+word.join('.');chambers.set(id,{beta:beta.map(r=>r.slice())});signatures.set(sig,id);return id;
}
function wallInequality(coefficients) {
  const sides=[[],[]],subscripts=['\u2081','\u2082','\u2083'];
  coefficients.forEach((value,index)=>{
    const coefficient=Math.round(3*value);
    if(!coefficient)return;
    const symbol='\u03b2'+subscripts[Math.floor(index/2)]+'\u207d'+(index%2?'\u00b2':'\u00b9')+'\u207e';
    sides[coefficient>0?0:1].push((Math.abs(coefficient)===1?'':Math.abs(coefficient))+symbol);
  });
  return (sides[0].join('+')||'0')+' > '+(sides[1].join('+')||'0');
}
export function e6ChamberWallOptions(beta,chamberId=E6_DEFAULT_CHAMBER) {
  const sample=e6DisplayBeta(beta,chamberId);
  if(!e6BetaInChamber(sample,chamberId))throw new RangeError('Beta outside selected E6 chamber.');
  registerChamber(E6_REFERENCE_BETA,[]);
  signatures.set(signature(sample),chamberId);
  return e6WallTransitionOptions(sample).map(option=>{
    const period=weight(option.coefficients,flat(beta)),atWall=Math.abs(period)<=2e-7;
    const label=wallInequality(option.coefficients);
    if(option.kind==='coordinate-zero')return Object.assign({},option,{label,period,atWall,canCross:false,targetChamberId:null});
    const word=[];
    e6ChamberWord(chamberId).concat(reflectionWord(option.coefficients)).forEach(v=>{if(word[word.length-1]===v)word.pop();else word.push(v);});
    const targetChamberId=registerChamber(option.crossing.targetBeta,word);
    return Object.assign({},option,{label,period,atWall,canCross:true,canApproach:true,targetChamberId});
  });
}
