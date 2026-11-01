// Local measurement media only. Original Keeper art and live Keeper motion are untouched.
export const LOOP_MS = Math.round(2 * Math.PI * 900);
export const FRAME_COUNT = Math.ceil(LOOP_MS * 30 / 1000);
export const FRAME_TIMES = Array.from({ length: FRAME_COUNT }, (_, i) => Math.round(i * 1000 / 30));

export function svgStudy(source, { mode = 'raf', fps = 0, paused = false, legacy = false } = {}) {
  if (mode === 'static') return source;
  const groups = [...source.matchAll(/<g id="(tentacle-\d)"[^>]*data-center-x="([^"]+)" data-center-y="([^"]+)"/g)];
  let css = '';
  if (mode === 'css') {
    const times = fps === 60 ? Array.from({ length: Math.ceil(LOOP_MS*60/1000) }, (_, i) => Math.round(i*1000/60)) : FRAME_TIMES;
    css = '<style>' + groups.map(([_, id, x, y], index) => {
      const keys = [...times, LOOP_MS].map(t => `${t / LOOP_MS * 100}%{transform:rotate(${Math.sin(t / 900 + index) * 9}deg)}`).join('');
      return `#${id}{transform-box:view-box;transform-origin:${x}px ${y}px;animation:motion${index} ${LOOP_MS}ms steps(1,end) infinite}@keyframes motion${index}{${keys}}`;
    }).join('') + '</style>';
  }
  // The legacy selector reproduces the old measurement defect only for comparison.
  const script = `<script><![CDATA[
    window.perfTicks=0;window.perfCallbacks=0;window.perfMode=${JSON.stringify(mode)};
    const limbs=[...document.querySelectorAll(${JSON.stringify(legacy ? '[id^=tentacle-]' : 'g[id^="tentacle-"][data-center-x][data-center-y]')})];
    window.perfTargetCount=limbs.length;
    let frame=0,previousBucket=-1,elapsed=0,started=performance.now(),playing=false;
    function pose(t){limbs.forEach((g,i)=>g.setAttribute('transform','rotate('+Math.sin(t/900+i)*9+' '+g.dataset.centerX+' '+g.dataset.centerY+')'));}
    window.perfPose=pose;
    function tick(now){if(!playing)return;window.perfCallbacks++;const t=elapsed+now-started,bucket=${fps} ? Math.floor(t*${fps}/1000):window.perfCallbacks;
      if(bucket!==previousBucket){previousBucket=bucket;pose(t);window.perfTicks++;}frame=requestAnimationFrame(tick);}
    window.perfControl=action=>{
      if(${JSON.stringify(mode)}==='css'){document.getAnimations().forEach(a=>action==='pause'?a.pause():a.play());return;}
      if(action==='pause'&&playing){elapsed+=performance.now()-started;playing=false;cancelAnimationFrame(frame);}
      if(action==='resume'&&!playing){started=performance.now();playing=true;frame=requestAnimationFrame(tick);}
    };
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>window.perfControl(document.hidden||reduced.matches?'pause':'resume');
    document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
    addEventListener('pagehide',()=>{window.perfControl('pause');document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);},{once:true});
    ${paused ? "window.perfControl('pause');pose(0);" : 'sync();'}
  ]]></script>`;
  return source.replace('</svg>', css + script + '</svg>');
}

export function webpStudy(bytes, poster) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><title>WebP loop comparison — flattened test copy</title><image width="2048" height="2048" href="data:image/webp;base64,${bytes.toString('base64')}"/><script><![CDATA[
    window.perfMode='webp';const image=document.querySelector('image'),source=image.getAttribute('href'),poster='data:image/webp;base64,${poster.toString('base64')}';
    window.perfControl=action=>image.setAttribute('href',action==='pause'?poster:source);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>window.perfControl(document.hidden||reduced.matches?'pause':'resume');
    document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
    addEventListener('pagehide',()=>{document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);},{once:true});
  ]]></script></svg>`;
}
