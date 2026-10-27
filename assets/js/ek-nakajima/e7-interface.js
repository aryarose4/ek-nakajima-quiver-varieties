import { E7_DEFAULT_BETA, betaToE7Levels } from './e7-core.js';
import { E7_WORKER_SOURCE } from './e7-worker-source.js';
import { makeRepresentationReadout } from './representation-readout.js';
import { makeE7View } from './e7-render.js';

// Owns E7 resources; switching tabs invalidates every outstanding callback.
export function makeE7Interface(options) {
  const {right, incidenceFrame, matrixHost, setBusy} = options;
  let active=false, view=null, worker=null, revision=0, solving=false, queued=null, lastKey=null;
  let result=null, mode='balanced', chart='north', beta=E7_DEFAULT_BETA.slice();
  const drawing=document.createElement('div');
  drawing.style.cssText='position:absolute;inset:0;display:none';incidenceFrame.appendChild(drawing);
  const readoutHost=document.createElement('div');readoutHost.style.display='none';matrixHost.appendChild(readoutHost);
  const matrices=makeRepresentationReadout(readoutHost,{type:'E7'});
  const panel=document.createElement('div');panel.className='ek-panel ek-e7-parameters';panel.style.display='none';right.appendChild(panel);
  const heading=document.createElement('div');heading.className='ek-sec';heading.textContent='Parameters';panel.appendChild(heading);
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 18px';panel.appendChild(grid);
  const controls=[];
  ['A1','A2','A3','B1','B2','B3','C2'].forEach((name,i)=>{
    const row=document.createElement('div');row.className='ek-mod';row.style.minWidth='0';
    const label=document.createElement('label');label.htmlFor='ek-e7-beta-'+i;label.textContent='β';label.style.whiteSpace='nowrap';
    const sub=document.createElement('sub');sub.textContent=String(i<3?1:i<6?2:3);label.appendChild(sub);
    const sup=document.createElement('sup');sup.textContent='('+String(i<6?i%3+1:1)+')';label.appendChild(sup);
    const input=document.createElement('input');input.type='range';input.id=label.htmlFor;input.className='ek-slider';input.min='0';input.max='1';input.step='any';input.value=String(beta[i]);input.style.minWidth='60px';
    const number=document.createElement('span');number.className='ek-readout';
    function refresh(){number.textContent=Number(input.value).toFixed(5);}
    input.addEventListener('input',()=>{beta[i]=Number(input.value);refresh();lastKey=null;options.onChange();});
    row.appendChild(label);row.appendChild(input);row.appendChild(number);grid.appendChild(row);refresh();controls.push({input,refresh});
  });
  const reset=document.createElement('button');reset.type='button';reset.className='ek-btn';reset.textContent='Reset Fixture';reset.style.marginTop='10px';panel.appendChild(reset);
  reset.addEventListener('click',()=>{beta=E7_DEFAULT_BETA.slice();controls.forEach((c,i)=>{c.input.value=String(beta[i]);c.refresh();});lastKey=null;options.onChange();});
  const note=document.createElement('div');note.className='ek-cap';note.style.textAlign='left';note.textContent='Central sphere only (p = 0); core sphere sizes are schematic. Other β values may leave this stable chart; successful solves require both moment-map residuals to pass.';panel.appendChild(note);
  const info=document.createElement('div');info.className='ek-panel';info.style.cssText='display:none;font-size:.8em;color:var(--ek-box-tx)';options.left.appendChild(info);
  const legend=document.createElement('div');legend.innerHTML='<span style="color:#ff9b71">Flag A</span> · <span style="color:#71b7ff">Flag B</span> · <span style="color:#b5dd7c">Short Line</span>';info.appendChild(legend);
  const frameNote=document.createElement('div');info.appendChild(frameNote);
  const frameControls=document.createElement('div');frameControls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0';info.appendChild(frameControls);
  const frameLabel=document.createElement('span');frameLabel.textContent='Transported Display Frame';frameControls.appendChild(frameLabel);
  const resetFrame=document.createElement('button');resetFrame.className='ek-btn';resetFrame.type='button';resetFrame.textContent='Reset Frame';frameControls.appendChild(resetFrame);
  resetFrame.addEventListener('click',()=>{stop();options.onChange();});
  const transportNote=document.createElement('div');transportNote.textContent='The display frame is transported between charts.';info.appendChild(transportNote);
  const projection=document.createElement('div');info.appendChild(projection);
  const diagnostics=document.createElement('div');diagnostics.style.marginTop='6px';diagnostics.setAttribute('role','status');info.appendChild(diagnostics);
  function refreshMatrices(){matrices.setData(result && (mode==='complex'?result.rawRep:result.rep));}
  function stop(){revision++;queued=null;solving=false;if(worker)worker.terminate();worker=null;lastKey=null;setBusy(false);}
  function start(request){
    solving=true;setBusy(true);incidenceFrame.setAttribute('aria-busy','true');incidenceFrame.setAttribute('data-balanced','pending');
    incidenceFrame.setAttribute('data-requested-levels',JSON.stringify(betaToE7Levels(request.beta)));
    worker.postMessage(request);
  }
  function ensureWorker(){
    if(worker)return;
    const url=URL.createObjectURL(new Blob([E7_WORKER_SOURCE],{type:'text/javascript'}));
    try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
    const capturedWorker=worker;
    worker.onmessage=event=>{
      if(capturedWorker!==worker)return;
      solving=false;const data=event.data;
      if(active && data.id===revision){
        setBusy(false);incidenceFrame.setAttribute('aria-busy','false');
        const next=data.result;
        if(data.error || !next || !next.success){
          result=null;refreshMatrices();if(view)view.setData(null);
          incidenceFrame.setAttribute('data-balanced','false');
          diagnostics.textContent='Balanced representation unavailable: '+(data.error || next && next.reason || 'solver failed')+(next?' · μR '+next.realNorm.toExponential(2)+' · μC '+next.complexNorm.toExponential(2):'');
        }else{
          result=next;refreshMatrices();const geometry=view.setData(next.rep);
          incidenceFrame.setAttribute('data-balanced','true');incidenceFrame.setAttribute('data-real-residual',String(next.realNorm));incidenceFrame.setAttribute('data-complex-residual',String(next.complexNorm));incidenceFrame.setAttribute('data-displayed-parameters',JSON.stringify(data.parameters));
          incidenceFrame.setAttribute('data-displayed-levels',JSON.stringify(data.levels));
          projection.textContent=geometry.isReal?'Real slice: literal affine projective flags.':'Complex flags: selected real-coefficient slices; the 3D picture is not a faithful projection of complex lines or planes.';
          diagnostics.textContent='μR '+next.realNorm.toExponential(2)+' · μC '+next.complexNorm.toExponential(2)+' · Complex incidence '+geometry.maxIncidenceNorm.toExponential(2)+'. '+geometry.intersections.map(x=>x.label+': '+x.dimension).join(' · ')+'. Intersection dimensions are complex vector dimensions.';
          frameNote.textContent=data.chart+' affine frame · '+geometry.flags.map(f=>f.name+': '+f.status).join(' · ');
        }
      }
      if(active && queued){const next=queued;queued=null;start(next);}
    };
    worker.onerror=event=>{if(capturedWorker!==worker)return;stop();incidenceFrame.setAttribute('aria-busy','false');incidenceFrame.setAttribute('data-balanced','false');result=null;refreshMatrices();if(view)view.setData(null);diagnostics.textContent='E7 worker failed: '+event.message;};
  }
  return {
    setActive(value){active=value;stop();panel.style.display=value?'':'none';info.style.display=value?'':'none';readoutHost.style.display=value?'':'none';drawing.style.display=value?'':'none';if(value){incidenceFrame.setAttribute('data-balanced','false');incidenceFrame.setAttribute('data-wall-approximation','false');incidenceFrame.setAttribute('data-requested-levels',JSON.stringify(betaToE7Levels(beta)));incidenceFrame.setAttribute('data-displayed-levels','');if(!view)view=makeE7View(drawing);}if(view)view.setVisible(value);},
    update(parameters){
      if(!active)return;
      const {r,theta}=parameters;
      // Bounded atlas coordinates avoid singular seeds at either compact pole.
      if(chart==='north' && r>.6)chart='south';
      else if(chart==='south' && r<.4)chart='north';
      const radius=chart==='north'?r/(1-r):(1-r)/r, angle=chart==='north'?theta:-theta;
      const base=[radius*Math.cos(angle),radius*Math.sin(angle)];
      const key=JSON.stringify({chart,base,beta});if(key===lastKey)return;lastKey=key;
      try{
        ensureWorker();const request={id:++revision,chart,base,beta:beta.slice(),parameters};
        if(solving){queued=request;setBusy(true);}else start(request);
      }catch(error){diagnostics.textContent='E7 solver unavailable: '+error.message;setBusy(false);}
    },
    setMode(value){mode=value;refreshMatrices();},
    resize(){if(view)view.resize();},refreshTheme(){if(view)view.refreshTheme();},
    getBeta(){return beta.slice();}
  };
}
