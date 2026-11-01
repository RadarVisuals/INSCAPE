import React, { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ProjectedSvgArtwork from '../src/artwork/ProjectedSvgArtwork.jsx';
import { ARTWORK_RETENTION_MS } from '../src/artwork/artworkRetention.js';

// Test-only instrumentation. Source artwork stays intact on disk; both modes
// use this identical copy and the actual production SVG document host.
function probe() {
  const id = Math.random().toString(36).slice(2);
  let draws = 0, uploads = 0, visible = true, first = false;
  const report = reason => top.postMessage({ type: 'retention-probe', id, reason, draws, uploads, visible,
    time: document.getElementById('stage')?.dataset.time, at: performance.now() }, '*');
  for (const type of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
    if (!type) continue;
    const draw = type.prototype.drawElements, upload = type.prototype.texImage2D;
    type.prototype.drawElements = function (...args) {
      draws++; const result = draw.apply(this, args);
      if (!first) { first = true; setTimeout(() => report('first-draw'), 200); }
      return result;
    };
    type.prototype.texImage2D = function (...args) { uploads++; return upload.apply(this, args); };
  }
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'inscape:html-artwork-visibility') return;
    visible = event.data.visible;
    setTimeout(() => report('settled'), 250);
    setTimeout(() => report('later'), 1500);
  });
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 20000) {
  const start = performance.now();
  while (!check()) { if (performance.now() - start > timeout) throw Error('Readiness timed out'); await delay(50); }
}
function Fixture() {
  const [src, setSrc] = useState(null), [mounted, setMounted] = useState(true);
  const [outside, setOutside] = useState(false), [baseline, setBaseline] = useState(false);
  const [version, setVersion] = useState(0);
  const [asset, setAsset] = useState('compact'), [text, setText] = useState('Preparing artwork…');
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(0);
  const stage = useRef(null), messages = useRef([]), readyRef = useRef(0);
  useEffect(() => {
    const receive = event => {
      if (event.data?.type === 'retention-probe') messages.current.push(event.data);
      if (event.data?.type === 'retention-diagnostic') setText(JSON.stringify(event.data));
    };
    addEventListener('message', receive); return () => removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    let cancelled = false, url;
    setSrc(null); setReady(0); readyRef.current = 0; messages.current = [];
    fetch(`/output/nomad-retention/${asset}.svg`).then(r => { if (!r.ok) throw Error('Missing local artwork'); return r.text(); }).then(text => {
      if (cancelled) return;
      const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
      const script = svg.createElementNS('http://www.w3.org/2000/svg', 'script'); script.textContent = `(${probe.toString()})();`;
      svg.documentElement.prepend(script);
      url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
      setSrc(url); setText('Wacht tot de vier Nomads bewegen.');
    }).catch(error => setText(error.message));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [asset]);
  const hostFrames = () => [...stage.current.querySelectorAll('.artwork-svg-document')];
  async function checkLifecycle() {
    setBusy(true); setText(`Lifecycle controleren, inclusief ${ARTWORK_RETENTION_MS / 1000} seconden bewaartijd…`);
    try {
      await until(() => hostFrames().length === 4);
      const initial = hostFrames();
      stage.current.style.transform = 'translateX(-2000px)'; await delay(3200);
      const hiddenCount = hostFrames().length;
      stage.current.style.transform = ''; await delay(500);
      const reused = hostFrames().every((frame, i) => frame === initial[i]);
      stage.current.style.transform = 'translateX(-2000px)'; await delay(ARTWORK_RETENTION_MS + 1000);
      const expired = hostFrames().length === 0;
      stage.current.style.transform = ''; await until(() => hostFrames().length === 4);
      const recreated = hostFrames().every((frame, i) => frame !== initial[i]);
      stage.current.style.transform = 'translateX(-2000px)'; await delay(500);
      setVersion(1); await delay(100); const sourceDisposed = hostFrames().length === 0;
      setVersion(0); await delay(100); const noHiddenReload = hostFrames().length === 0;
      stage.current.style.transform = ''; await until(() => hostFrames().length === 4);
      setMounted(false); await delay(100); const disposed = hostFrames().length === 0;
      setText(JSON.stringify({ lifecycleOnly:true, hiddenCount, reused, expired, recreated, sourceDisposed, noHiddenReload, disposed,
        artworkReady:readyRef.current, pass:hiddenCount===4&&reused&&expired&&recreated&&sourceDisposed&&noHiddenReload&&disposed },null,2));
    } catch(error) { setText(String(error)); }
    finally { setBusy(false); }
  }
  async function run() {
    setBusy(true); setText('Bezig: laden, wegschuiven, terugkomen en zoomen…');
    const gaps = [], tasks = [], cycles = []; let last, raf, observer;
    const sample = time => { if (last) gaps.push(time - last); last = time; raf = requestAnimationFrame(sample); };
    const move = async (from, to, duration = 500) => {
      const start = performance.now();
      await new Promise(resolve => { const step = now => {
        const t = Math.min(1, (now - start) / duration);
        stage.current.style.transform = `translateX(${from + (to - from) * t}px)`;
        if (t < 1) requestAnimationFrame(step); else resolve();
      }; requestAnimationFrame(step); });
    };
    try {
      await until(() => hostFrames().length === 4 && new Set(messages.current.filter(m => m.reason === 'first-draw').map(m => m.id)).size >= 4);
      await delay(800);
      const beforeReady = readyRef.current;
      observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration)));
      observer.observe({ type: 'longtask', buffered: false }); raf = requestAnimationFrame(sample);
      for (let cycle = 0; cycle < 3; cycle++) {
        const before = hostFrames(), start = messages.current.length;
        await move(0, -2000); setOutside(true); await delay(3200);
        const hidden = messages.current.slice(start).filter(m => !m.visible);
        const ids = [...new Set(hidden.map(m => m.id))];
        const paused = ids.length === 4 && ids.every(id => {
          const samples = hidden.filter(m => m.id === id);
          return samples.length >= 2 && samples.at(-1).at - samples.at(-2).at >= 300 && samples.at(-1).draws === samples.at(-2).draws;
        });
        const retained = hostFrames().length;
        setOutside(false); await move(-2000, 0); await delay(3200);
        await until(() => hostFrames().length === 4);
        const after = hostFrames();
        const resumed = ids.length === 4 && ids.every(id => {
          const all = messages.current.slice(start).filter(m => m.id === id);
          const off = all.filter(m => !m.visible).at(-1), on = all.filter(m => m.visible).at(-1);
          return off && on && on.draws > off.draws && on.uploads === off.uploads;
        });
        cycles.push({ cycle, retained, sameFrames: after.filter((frame, i) => frame === before[i]).length, paused, resumedWithoutUploads: resumed });
        // Authored viewport remains fixed; camera scale changes as in navigation.
        stage.current.style.transform = 'scale(.8)'; await delay(200); stage.current.style.transform = ''; await delay(200);
      }
      cancelAnimationFrame(raf); observer.disconnect();
      const sorted = gaps.slice().sort((a,b) => a-b);
      const result = { mode: baseline ? 'dispose' : 'retain', asset, cycles, readyEvents: readyRef.current - beforeReady,
        gaps: { samples: gaps.length, p95: sorted[Math.floor(sorted.length * .95)], max: Math.max(...gaps), over50: gaps.filter(v => v > 50).length },
        longTasks: tasks, documentHidden: document.hidden,
        pass: !baseline && cycles.every(c => c.retained === 4 && c.sameFrames === 4 && c.paused && c.resumedWithoutUploads)
      };
      setText(JSON.stringify(result, null, 2));
      await fetch('/results', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(result) });
    } catch (error) { setText(JSON.stringify({ failed: error.message, ready: readyRef.current, messages: messages.current.slice(-12) }, null, 2)); }
    finally { cancelAnimationFrame(raf); observer?.disconnect(); setOutside(false); if (stage.current) stage.current.style.transform = ''; setBusy(false); }
  }
  return <main style={{ fontFamily:'system-ui', background:'#222', color:'#eee', minHeight:'100vh', padding:20 }}>
    <h1>Nomad — wegschuiven en terugkomen</h1><p>Vier echte SVG-documenten. Alleen tijdelijke testdata; geen wallet of opgeslagen Workbench.</p>
    <label>Bron <select disabled={busy} value={asset} onChange={e => setAsset(e.target.value)}><option value="compact">Twee lagen</option><option value="original">39 lagen</option></select></label>{' '}
    <label><input type="checkbox" checked={baseline} disabled={busy} onChange={e => setBaseline(e.target.checked)} /> Oude aanpak: verwijderen buiten beeld</label>{' '}
    <button disabled={busy || !src} onClick={run}>Test drie keer weg en terug</button>{' '}
    <button disabled={busy || !src || baseline} onClick={checkLifecycle}>Controleer bewaren en opruimen</button>{' '}
    <button disabled={busy} onClick={() => { setOutside(v => !v); stage.current.style.transform = outside ? '' : 'translateX(-2000px)'; }}>Buiten beeld / terug</button>{' '}
    <button disabled={busy} onClick={() => setMounted(v => !v)}>{mounted ? 'Workbench sluiten' : 'Workbench openen'}</button>
    <p>Documenten geladen: <output>{ready}</output></p>
    <div style={{overflow:'hidden',height:360}}><div ref={stage} style={{display:'flex',gap:12,transformOrigin:'center'}}>
      {mounted && src && !(baseline && outside) && Array.from({length:4}, (_,i) => <div key={i} style={{width:220,height:340,position:'relative',flexShrink:0}}>
        <ProjectedSvgArtwork src={src + (version ? '#changed-source' : '')} width={220} height={340} dimensions={{width:220,height:340}} onReady={() => { readyRef.current++; setReady(readyRef.current); }} />
      </div>)}
    </div></div><pre role="status" style={{whiteSpace:'pre-wrap'}}>{text}</pre>
  </main>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture /></StrictMode>);
