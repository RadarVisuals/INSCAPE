// Diagnostic fixture only. No real profile storage, wallet or production hooks.
const params = new URLSearchParams(location.search), variant = params.get('variant') || 'compact';
const startupEvents=[];
addEventListener('message',e=>{if(typeof e.data?.type==='string'&&e.data.type.startsWith('inscape:'))startupEvents.push({at:performance.now(),type:e.data.type});});
document.addEventListener('load',e=>{if(e.target?.tagName==='IFRAME')startupEvents.push({at:performance.now(),load:e.target.getAttribute('src')});},true);
addEventListener('error',e=>startupEvents.push({at:performance.now(),error:e.message}));
setTimeout(()=>fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'workbench-startup-'+Date.now(),result:{events:startupEvents,status:[...document.querySelectorAll('.artwork-svg-status')].map(e=>e.textContent)}})}),22000);
const bar = document.createElement('div');
bar.style.cssText='position:fixed;z-index:2147483647;right:16px;top:10px;padding:8px;background:#fff;color:#111;border:1px solid #444;font:13px system-ui;max-width:460px';
bar.innerHTML='<strong>Lokale navigatiemeting — '+variant+'</strong> <button id="nav-run">Meet zoomen + schuiven</button> <button id="drag-run">Meet slepen (12 s)</button><div id="nav-status" role="status">Alleen testgegevens in geheugen.</div>';
document.body.append(bar);
const status=bar.querySelector('#nav-status'), wait=ms=>new Promise(r=>setTimeout(r,ms));
const camera=host=>Object.fromEntries(['scale','x','y'].map(k=>[k,Number(host.getAttribute('data-workbench-camera-'+k))]));
let runNumber=0;
async function measure(manual=false){
 const host=document.querySelector('[data-workbench-camera-scale]');if(!host){status.textContent='Camera nog niet klaar';return;}
 const buttons=[...bar.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 status.textContent=manual?'Sleep de Workbench met Spatie ingedrukt; meting begint over 4 seconden.':'Start over 8 seconden; tijdens de meting blijft deze tab in beeld.';
 await wait(manual?4000:8000);
 const result={variant,manual,wallStart:Date.now(),timeOrigin:performance.timeOrigin,frames:[],inputs:[],longTasks:[],longFrames:[],visibility:[],cameraStart:camera(host),writesBefore:window.workbenchPerf.writes.length,
  content:window.workbenchPerf.numbers,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},readiness:{loading:document.querySelectorAll('.artwork-svg-status').length,frames:document.querySelectorAll('.artwork-svg-document').length},errors:[]};
 let active=true,frame=0,last=performance.now();const observers=[];
 for(const type of ['longtask','long-animation-frame'])if(PerformanceObserver.supportedEntryTypes.includes(type)){
  const o=new PerformanceObserver(list=>{for(const e of list.getEntries()){
   const item=e.toJSON();if(type==='long-animation-frame')item.scripts=[...(e.scripts||[])].map(s=>s.toJSON());
   result[type==='longtask'?'longTasks':'longFrames'].push(item);
  }});o.observe({type,buffered:false});observers.push(o);
 }
 const visibility=()=>result.visibility.push({at:performance.now(),hidden:document.hidden});document.addEventListener('visibilitychange',visibility);
 const error=e=>result.errors.push({message:e.message});addEventListener('error',error);
 status.textContent='Meting loopt…';
 const record=t=>{if(!active)return;result.frames.push({at:t,interval:t-last,camera:camera(host),hidden:document.hidden});last=t;frame=requestAnimationFrame(record);};frame=requestAnimationFrame(record);
 if(manual)await wait(12000);
 else {
  const rect=host.getBoundingClientRect(),x=rect.left+rect.width*.48,y=rect.top+rect.height*.45;
  // Real production wheel handlers; synthetic inputs, not hardware latency.
  const phases=[['zoom-out',90,true,0,5],['pan-left-up',90,false,8,6],['pan-right-down',90,false,-8,-6],['zoom-in',90,true,0,-5]];
  for(let round=0;round<2;round++)for(const [phase,count,ctrlKey,dx,dy] of phases){
   const before=camera(host),start=performance.now();let cost=0;
   for(let i=0;i<count;i++){
    await new Promise(requestAnimationFrame);const t=performance.now();
    host.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey,deltaX:dx,deltaY:dy,clientX:x,clientY:y}));cost+=performance.now()-t;
   }
   result.inputs.push({phase,round,count,start,end:performance.now(),handlerTotalMs:cost,before,after:camera(host)});
  }
 }
 active=false;cancelAnimationFrame(frame);await wait(80);observers.forEach(o=>o.disconnect());document.removeEventListener('visibilitychange',visibility);removeEventListener('error',error);
 result.wallEnd=Date.now();result.cameraEnd=camera(host);result.writesAfter=window.workbenchPerf.writes.length;
 result.readinessEnd={loading:document.querySelectorAll('.artwork-svg-status').length,frames:document.querySelectorAll('.artwork-svg-document').length};
 const id='navigation-'+variant+'-'+(manual?'drag':'wheel')+'-'+(++runNumber)+'-'+Date.now();
 const response=await fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,result})});
 const gaps=result.frames.slice(1).map(x=>x.interval).sort((a,b)=>a-b);
 status.textContent=(response.ok?'Opgeslagen':'Opslaan mislukt')+': '+gaps.length+' frames; p95 '+gaps[Math.floor(gaps.length*.95)]?.toFixed(1)+' ms; maximum '+gaps.at(-1)?.toFixed(1)+' ms; '+result.longTasks.length+' lange taken.';
 buttons.forEach(b=>b.disabled=false);
}
bar.querySelector('#nav-run').onclick=()=>measure().catch(e=>{status.textContent=e.message;});
bar.querySelector('#drag-run').onclick=()=>measure(true).catch(e=>{status.textContent=e.message;});
