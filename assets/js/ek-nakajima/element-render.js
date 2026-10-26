// Balanced flags use hue for cross-incidence; legacy charts use phase.
import { flagDiagram, cotangentGlyphs, branchDisplayGauge, centralDisplayGauge } from "./flag-diagram.js";
import { balancedTensorDiagram } from './weighted-balanced-diagram.js';
import { incidenceIndicators } from './incidence-indicators.js';

const LINE = ["P₁", "P₂", "P₃"];
const ARROW_LENGTH = 16;

// Draw each solved frame as a whole. Independent screen-coordinate easing
// does not preserve projective incidence, and can collapse unoriented lines.
// Geometry, classifications and cotangent glyphs must share the same frame.

// Missing opacity arrays retain the legacy full-strength drawing.
export function objectOpacity(layout, kind, index) {
  const values = layout && layout[kind + 'Opacities'];
  return values ? Math.max(0, Math.min(1, Number.isFinite(values[index]) ? values[index] : 0)) : 1;
}

// React to mathematical incidence gains between existing objects.
export function newIncidenceHighlights(previous, current) {
  const points = [];
  if (!previous || !previous.valid || !current || !current.valid) return { points, concurrency: false };
  const present = (kind, i) => (!previous[kind + 'Present'] || previous[kind + 'Present'][i]) &&
    (!current[kind + 'Present'] || current[kind + 'Present'][i]);
  for (let i = 0; i < 3; i++) {
    if (!present('point', i)) continue;
    const gained = [0, 1, 2].some(j => j !== i &&
      ((present('line', j) && current.incident[i][j] && !previous.incident[i][j]) ||
       (present('point', j) && current.pointEqual[i][j] && !previous.pointEqual[i][j])));
    if (gained || ([0, 1, 2].every(j => present('point', j)) && current.collinear && !previous.collinear)) points.push(i);
  }
  return { points, concurrency: [0, 1, 2].every(j => present('line', j)) && current.concurrent && !previous.concurrent };
}

export function incidenceFlashStrength(elapsed) {
  return elapsed >= 0 && elapsed < 750 ? Math.pow(Math.sin(Math.PI * elapsed / 750), 2) : 0;
}

export function newCotangentIncidenceHighlights(previous,current,glyphs) {
  const before=previous&&previous.cotangentIncidences,after=current&&current.cotangentIncidences;
  if(!previous||!previous.valid||!current||!current.valid||!before||!after)return [];
  const result=[];
  after.forEach((event,i)=>{
    if(!event||!before[i]||!glyphs[i]||!glyphs[i].magnitudes)return;
    const gained=['points','planes'].some(kind=>event[kind].some((v,j)=>v&&!before[i][kind][j]));
    // c13 ends at its own marked point P_i; c23 ends at q = im(K_i).
    // Equal images on different branches still have distinct drawn arrows.
    // The tangent c12 arrow does not depict this image incidence.
    const magnitudes=glyphs[i].magnitudes;
    if(gained&&event.points[i]&&magnitudes[1]>1e-12)result.push(3*i+1);
    if(gained&&magnitudes[2]>1e-12)result.push(3*i+2);
  });
  return result;
}

// Fixed pixel lengths: geometry indicates the matrix component, not magnitude.
// The tensor layout supplies oriented line endpoints from its dual affine
// gauge. Keep these sides fixed as targets pass a point or approach it:
// c12 approaches along the tangent, c13 along the normal, c23 opposite it.
export function cotangentArrowGeometry(point, line, target) {
  const d=line[1].map((v,j)=>v-line[0][j]),length=Math.hypot(...d);
  if(length<1e-8)return [null,null,null];
  const tangent=d.map(v=>v/length),normal=[-tangent[1],tangent[0]];
  function arrow(p,offset,gap) {
    return {start:p.map((v,j)=>v+offset[j]*(gap+ARROW_LENGTH)),end:p.map((v,j)=>v+offset[j]*gap)};
  }

  // Five pixels clears the line stroke and the tangent arrow's head, leaving
  // a small gap on the same side as the perpendicular arrow at this point.
  const tangentAnchor=point.map((v,j)=>v+5*normal[j]);
  return [arrow(tangentAnchor,tangent,9),arrow(point,normal,8),
    target?arrow(target,normal.map(v=>-v),3):null];
}

export function cotangentArrowColor(z, dark) {
  const magnitude=Math.hypot(z[0],z[1]);
  if(magnitude<1e-10)return null;
  const hue=(210+Math.atan2(z[1],z[0])*180/Math.PI+360)%360;
  return 'hsl('+hue+', '+85*magnitude/(1+magnitude)+'%, '+(dark?55:28)+'%)';
}

// A short smooth fade reaches full opacity at magnitude .05.
export function cotangentArrowOpacity(z) {
  const magnitude=Math.hypot(z[0],z[1]);
  const u=Math.min(1,magnitude/.05);
  return u*u*(3-2*u);
}

// Intrinsic block size controls ink independently of its complex correlation.
// A zero correlation has no phase, so a nonzero block remains visible in gray.
export function cotangentGlyphStyle(glyph,index,dark,visibility=1) {
  const z=(glyph.phaseCorrelations||glyph.coefficients)[index];
  if(glyph.phaseConfidence) {
    const m=glyph.magnitudes[index],confidence=glyph.phaseConfidence[index];
    const hue=Math.hypot(...z)>0?(210+Math.atan2(z[1],z[0])*180/Math.PI+360)%360:0;
    return {color:'hsl('+hue+', '+(85*m/(1+m)*confidence)+'%, '+(dark?55:28)+'%)',
      opacity:cotangentArrowOpacity([m,0])};
  }
  if(glyph.magnitudes) return {
    color:cotangentArrowColor(z,dark)||('hsl(0, 0%, '+(dark?55:28)+'%)'),
    opacity:cotangentArrowOpacity([glyph.magnitudes[index],0])
  };
  return {color:cotangentArrowColor(z,dark),opacity:cotangentArrowOpacity(z)*visibility};
}

function guideOpacity(layout,key) {
  return layout[key]===undefined?1:Math.max(0,Math.min(1,Number.isFinite(layout[key])?layout[key]:0));
}

// Shared by the canvas and the atlas integration checks.
export function elementFrame(view) {
  if (view && view.balancedRep) {
    const frame=balancedTensorDiagram(view.balancedRep, { previous: view.previous });
    if(frame.data)frame.data.chamberId=view.chamberId;
    return frame;
  }
  let data = view && view.incidence ? view.incidence : null;
  let operators = view && view.cotangentOperators;
  if (data && data.valid && view.branchGauge) {
    const gauged = branchDisplayGauge(data, operators, { ...view.branchGauge, firstLine: view.firstLine });
    data = gauged.data; operators = gauged.operators;
  }
  const layout = data && data.valid ? flagDiagram(data, { compact: true,
    concurrencyProgress: view.concurrencyProgress, realFlags: view.realFlags,
    firstLine: view.firstLine, centralFlow: view.centralFlow }) : null;
  if (data && data.valid && view.centralFlow) {
    const gauged = centralDisplayGauge(data, operators, view.centralFlow);
    data = gauged.data; operators = gauged.operators;
  }
  return { data, layout, glyphs: cotangentGlyphs(data, operators, view && view.concurrencyProgress) };
}

// All phases collapse at the two poles. Inside the chart, hue determines
// phase modulo 2π; the shared saturation keeps equal phases the same color.
export function phaseColor(phase, compactRadius, dark) {
  const r = Math.max(0, Math.min(1, compactRadius));
  const saturation = 70 * 4 * r * (1 - r);
  const angle = Number.isFinite(phase) ? phase : 0;
  const hue = ((210 + angle * 180 / Math.PI) % 360 + 360) % 360;
  return "hsl(" + hue + ", " + saturation + "%, " + (dark ? 70 : 40) + "%)";
}

function balancedPhaseColor(phase, vector, dark) {
  const strength = Math.min(1, Math.hypot(vector[0], vector[1]));
  const hue = ((210 + (phase || 0) * 180 / Math.PI) % 360 + 360) % 360;
  return 'hsl(' + hue + ', ' + 70 * strength + '%, ' + (dark ? 70 : 40) + '%)';
}

function incidenceColor(hue, strength, dark) {
  return 'hsl(' + (hue === null ? 0 : hue) + ', ' + 85 * strength + '%, ' + (dark ? 70 : 40) + '%)';
}

export function makeElementView(host, opts) {
  opts = opts || {};
  const pageFont = () => typeof getComputedStyle === 'function' ? getComputedStyle(host).fontFamily :
    (typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(host).fontFamily : 'sans-serif');
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.cursor = "default";
  if (canvas.setAttribute) {
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Flag incidence. A dot matching another line's hue indicates numerical incidence. A dot incident to both other lines is neutral. Own-line hue need not match. Boundary arrows mark points outside the projective viewport. Cotangent arrows encode three matrix components; hue shows phase and saturation shows magnitude.");
  }
  host.appendChild(canvas);
  let showYData = true;
  const yToggleLabel = document.createElement('label');
  yToggleLabel.style.position = 'absolute';
  yToggleLabel.style.top = '10px';
  yToggleLabel.style.left = '10px';
  yToggleLabel.style.display = 'flex';
  yToggleLabel.style.alignItems = 'center';
  yToggleLabel.style.gap = '5px';
  yToggleLabel.style.fontSize = '12px';
  yToggleLabel.style.fontFamily = 'inherit';
  yToggleLabel.style.cursor = 'pointer';
  const yToggle = document.createElement('input');
  yToggle.id = 'ek-y-data';
  yToggle.type = 'checkbox';
  yToggle.checked = true;
  yToggle.addEventListener('change', function () { showYData = yToggle.checked; draw(); });
  yToggleLabel.appendChild(yToggle);
  const yToggleText = document.createElement('span');
  yToggleText.textContent = 'y data';
  yToggleLabel.appendChild(yToggleText);
  host.appendChild(yToggleLabel);
  const indicators = document.createElement('div');
  indicators.className = 'ek-incidence-indicators';
  Object.assign(indicators.style, { position: 'absolute', top: '8px', right: '8px',
    left: '90px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    gap: '3px', pointerEvents: 'none', fontSize: '.78em', fontFamily: 'inherit' });
  indicators.setAttribute('aria-label', 'Numerical Flag Incidences');
  host.appendChild(indicators);
  let indicatorKey = null;
  const ctx = canvas.getContext ? canvas.getContext("2d") : null;
  const status = document.createElement("div");
  status.className = "ek-elem-status";
  status.style.position = "absolute";
  status.style.bottom = "8px";
  status.style.left = "12px";
  status.style.right = "12px";
  status.style.fontSize = "12px";
  status.style.fontFamily = 'inherit';
  status.style.pointerEvents = "none";
  status.style.display = "none";
  host.appendChild(status);
  let data = null;
  let layout = null;
  let glyphs = [];
  let statusKind = "";
  let flashStarts = [-Infinity, -Infinity, -Infinity, -Infinity];
  let arrowFlashStarts=Array(9).fill(-Infinity);
  let animationFrame = null;

  function palette() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const p = opts.getPalette ? opts.getPalette() || {} : {};
    return {
      dark: dark,
      text: p.caption || (dark ? "#c0c6cf" : "#505762"),
      point: dark ? "#e5e8ed" : "#303740",
      background: dark ? "#20242b" : "#ffffff",
    };
  }

  function draw() {
    canvas.setAttribute('data-snap-transition', 'false');
    const pal = palette();
    const indicatorLabels = incidenceIndicators(layout && layout.valid ? data : null);
    const nextIndicatorKey = String(pal.dark) + ':' + indicatorLabels.join('|');
    if (indicatorKey !== nextIndicatorKey) {
      indicatorKey = nextIndicatorKey;
      indicators.textContent = '';
      indicatorLabels.forEach(text => {
      const badge = document.createElement('div');
      badge.textContent = text;
      if(text.indexOf('im(ϕ')===0) {
        badge.style.pointerEvents='auto';
        badge.setAttribute('role','note');
        badge.setAttribute('title','ϕᵢ = xᵢ⁽²⁾yᵢ⁽²⁾ = AᵢBᵢ; im(ϕᵢ) is the full operator image in ℂ³.');
        badge.setAttribute('aria-label',text+'. ϕᵢ = xᵢ⁽²⁾yᵢ⁽²⁾ = AᵢBᵢ; full operator image in ℂ³.');
      }
      Object.assign(badge.style, { padding: '1px 7px', border: '1px solid #a67c00',
        borderRadius: '6px', background: pal.dark ? '#453a19' : '#f6ecc2',
        color: pal.dark ? '#e8c84a' : '#7a5c00', fontWeight: '600', maxWidth: '100%',
        boxSizing: 'border-box', fontFamily: 'inherit' });
      indicators.appendChild(badge);
      });
    }
    yToggleLabel.style.color = pal.text;
    canvas.setAttribute('data-y-data', String(showYData));
    status.style.color = statusKind === "error" ? "#d64545" : "#b27c22";
    if (!ctx) return;
    const w = host.clientWidth || 0;
    const h = host.clientHeight || 0;
    if (w <= 0 || h <= 0) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!data || !data.valid || !layout || !layout.valid) {
      ctx.fillStyle = pal.text;
      ctx.font = '13px ' + pageFont();
      ctx.textAlign = "center";
      ctx.fillText("Incidence unavailable", w / 2, h / 2);
      return;
    }
    const scale = Math.max(1, Math.min(w / 2 - 36, h / 2 - 27));
    function pixel(p) { return [w / 2 + p[0] * scale, h / 2 - p[1] * scale]; }
    const now = Date.now();
    const flashing = flashStarts.map((start, i) => now - start < 750 ? i : -1).filter(i => i >= 0);
    const flashingArrows=showYData?arrowFlashStarts.map((start,i)=>now-start<750?i:-1).filter(i=>i>=0):[];
    canvas.setAttribute('data-cotangent-flash',flashingArrows.join(','));
    canvas.setAttribute('data-incidence-flash', flashing.join(','));
    function glow(p, index, color, opacity) {
      const strength = incidenceFlashStrength(now - flashStarts[index]);
      if (!strength || !opacity) return;
      ctx.globalAlpha = .8 * strength * opacity;
      ctx.shadowColor = color; ctx.shadowBlur = 18;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = .7 * strength * opacity;
      ctx.fillStyle = pal.dark ? '#ffffff' : '#fff6cc';
      ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.lineCap = "round";
    ctx.font = 'bold 13px ' + pageFont();
    ctx.textAlign = "left";
    if (layout.transversal) {
      const a = pixel(layout.transversal[0]), b = pixel(layout.transversal[1]);
      ctx.strokeStyle = pal.text; ctx.lineWidth = 1; ctx.globalAlpha = 0.25 * guideOpacity(layout,'transversalOpacity');
      if (ctx.setLineDash) ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = objectOpacity(layout, 'line', i);
      const a = pixel(layout.lines[i][0]);
      const b = pixel(layout.lines[i][1]);
      const color = layout.incidenceColors ? incidenceColor(layout.incidenceColors.lineHues[i], layout.incidenceColors.lineStrengths[i], pal.dark) : layout.phaseVectors ? balancedPhaseColor(layout.linePhases[i], layout.phaseVectors[i], pal.dark) :
        phaseColor(layout.linePhases[i], layout.compactRadius, pal.dark);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      let coincidentBefore = 0;
      for (let j = 0; j < i; j++) if (data.lineEqual && data.lineEqual[i][j]) coincidentBefore++;
      const t = 0.05 + coincidentBefore * 0.1;
      ctx.fillStyle = color;
      ctx.fillText(LINE[i], a[0] + (b[0] - a[0]) * t + 5, a[1] + (b[1] - a[1]) * t - 6);
    }
    ctx.globalAlpha = 1;
    if (ctx.setLineDash) ctx.setLineDash([]);
    if (layout.concurrencyPoint) {
      const q = pixel(layout.concurrencyPoint);
      const opacity = guideOpacity(layout,'concurrencyOpacity') * Math.min(...[0, 1, 2].map(i => objectOpacity(layout, 'line', i)));
      glow(q, 3, pal.point, opacity);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = pal.point;
      ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = pal.point; ctx.lineWidth = 1; ctx.globalAlpha = 0.45 * opacity;
      ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < 3; i++) {
      const pointOpacity = objectOpacity(layout, 'point', i);
      const lineOpacity = objectOpacity(layout, 'line', i);
      const p = pixel(layout.points[i]);
      const marker = layout.pointMarkers && layout.pointMarkers[i];
      let groupIndex = 0;
      for (let j = 0; j < i; j++) {
        if (data.pointEqual && data.pointEqual[i][j]) groupIndex++;
      }
      ctx.strokeStyle = layout.incidenceColors ? incidenceColor(layout.incidenceColors.pointHues[i], layout.incidenceColors.pointStrengths[i], pal.dark) : layout.pointPhaseVectors ? balancedPhaseColor(layout.pointPhases[i], layout.pointPhaseVectors[i], pal.dark) : pal.point;
      const marks=marker&&marker.clipped&&marker.boundaryPair?marker.boundaryPair:[{point:layout.points[i],direction:marker&&marker.direction,weight:1}];
      marks.forEach(mark=>glow(pixel(mark.point),i,ctx.strokeStyle,pointOpacity*mark.weight));
      ctx.globalAlpha = pointOpacity;
      ctx.lineWidth = 2;
      if (marker && marker.clipped) {
        marks.forEach(mark=>{
        const p=pixel(mark.point),d=[mark.direction[0],-mark.direction[1]];
        ctx.globalAlpha=pointOpacity*mark.weight;
        ctx.beginPath();
        ctx.moveTo(p[0] - 8 * d[0] - 4 * d[1], p[1] - 8 * d[1] + 4 * d[0]);
        ctx.lineTo(p[0], p[1]);
        ctx.lineTo(p[0] - 8 * d[0] + 4 * d[1], p[1] - 8 * d[1] - 4 * d[0]);
        ctx.stroke();
        });
      } else {
        ctx.beginPath(); ctx.arc(p[0], p[1], 4 + 3 * groupIndex, 0, Math.PI * 2);
        if (groupIndex === 0) { ctx.fillStyle = pal.background; ctx.fill(); }
        ctx.stroke();
      }
      // Tangential and normal arrows distinguish the three cotangent blocks.
      const glyph = glyphs[i];
      const target=layout.cotangentTargets&&layout.cotangentTargets[i];
      const arrows=cotangentArrowGeometry(p,layout.lines[i].map(pixel),target&&target.point?pixel(target.point):null);
      if(showYData&&glyph)glyph.coefficients.forEach((z,k)=>{
        const anchors=k<2?marks:[{point:layout.points[i],weight:1}];
        anchors.forEach(mark=>{
        const style=cotangentGlyphStyle(glyph,k,pal.dark,Math.min(pointOpacity,lineOpacity));
        const color=style.color,arrow=k<2?cotangentArrowGeometry(pixel(mark.point),layout.lines[i].map(pixel),null)[k]:arrows[k];
        if(!color||!arrow)return;
        const direction=arrow.end.map((v,j)=>(v-arrow.start[j])/ARROW_LENGTH);
        const perpendicular=[-direction[1],direction[0]];
        ctx.strokeStyle=color;ctx.lineWidth=4/3;ctx.globalAlpha=style.opacity*mark.weight;
        const pulse=incidenceFlashStrength(now-arrowFlashStarts[3*i+k]);
        ctx.shadowColor=color;ctx.shadowBlur=18*pulse;
        ctx.lineWidth+=2*pulse;
        ctx.beginPath();ctx.moveTo(...arrow.start);ctx.lineTo(...arrow.end);
        for(const side of [-1,1]) {
          ctx.moveTo(...arrow.end);
          ctx.lineTo(...arrow.end.map((v,j)=>v-(10/3)*direction[j]+side*2*perpendicular[j]));
        }
        ctx.stroke();
        ctx.shadowBlur=0;
        });
      });
      ctx.globalAlpha=1;
    }
    if ((flashing.length || flashingArrows.length) && animationFrame === null && typeof requestAnimationFrame === 'function') {
      animationFrame = requestAnimationFrame(function () { animationFrame = null; draw(); });
    }
  }

  function setData(view) {
    const frame = elementFrame(view);
    canvas.setAttribute('data-frame-source', frame.source || (view && view.balancedRep ? 'balanced-tensors' : 'legacy-flags'));
    canvas.setAttribute('data-frame-valid', String(!!(frame.data && frame.data.valid && frame.layout && frame.layout.valid)));
    const highlights = newIncidenceHighlights(data, frame.data);
    const arrowHighlights=newCotangentIncidenceHighlights(data,frame.data,frame.glyphs||[]);
    const now = Date.now();
    if (!frame.data || !frame.data.valid) {
      arrowFlashStarts.fill(-Infinity);
      flashStarts = [-Infinity, -Infinity, -Infinity, -Infinity];
      canvas.setAttribute('data-incidence-flash', '');
    } else {
      arrowFlashStarts=arrowFlashStarts.map((start,index)=>{
        const g=frame.glyphs[Math.floor(index/3)];
        return g&&g.magnitudes&&g.magnitudes[index%3]>1e-12?start:-Infinity;
      });
      const reduced=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(showYData&&!reduced)arrowHighlights.forEach(i=>{if(now-arrowFlashStarts[i]>=750)arrowFlashStarts[i]=now;});
      for (let i = 0; i < 3; i++) {
        if (objectOpacity(frame.layout, 'point', i) === 0) flashStarts[i] = -Infinity;
      }
      if ([0, 1, 2].some(i => objectOpacity(frame.layout, 'line', i) === 0)) flashStarts[3] = -Infinity;
      highlights.points.concat(highlights.concurrency ? [3] : []).forEach(i => {
        // Do not prolong an active pulse when several incidences arrive together.
        if (now - flashStarts[i] >= 750) flashStarts[i] = now;
      });
    }
    data = frame.data; layout = frame.layout; glyphs = frame.glyphs;
    draw();
    return frame;
  }
  function setStatus(text, kind) {
    const failed = kind === "error" || kind === "warn";
    status.textContent = failed && text != null ? String(text) : "";
    status.style.display = status.textContent ? "block" : "none";
    statusKind = kind || "";
    draw();
  }
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(draw);
    ro.observe(host);
  } else if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", draw);
  }
  setData(null);
  return {
    setData: setData, setStatus: setStatus, refreshTheme: draw, resize: draw,
    getCamera: function () { return { azimuth: 0, elevation: 0, zoom: 1 }; },
  };
}
