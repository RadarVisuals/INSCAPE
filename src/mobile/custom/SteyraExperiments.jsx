import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, Layers } from 'lucide-react';
import './steyraExperiments.css';

const layers = ['01-bottom.svg', '02-pattern.svg', '03-pattern.svg', '04-shadow.svg', '05-highlight.webp', '06-artwork.webp', '07-details.svg'];
export default function SteyraExperiments({ onClose }) {
  const [split, setSplit] = useState(false), [pinned, setPinned] = useState(false), [phase, setPhase] = useState('art');
  const [landscapeReady, setLandscapeReady] = useState(false), [failed, setFailed] = useState(false), [attempt, retry] = useState(0);
  const surface = useRef(null), composition = useRef(null), hold = useRef(null), transition = useRef(null), point = useRef(null), button = useRef(null);
  const leaving = phase === 'leaving', inside = phase === 'inside';
  const clearHold = () => { clearTimeout(hold.current); hold.current = null; };
  useEffect(() => () => { clearTimeout(hold.current); clearTimeout(transition.current); }, []);
  function closeEye() {
    if (phase === 'art') { onClose(); return; }
    clearTimeout(transition.current); setPhase('leaving');
    transition.current = setTimeout(() => { setPhase('art'); button.current?.focus(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1300);
  }
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); closeEye(); } };
    const host = surface.current; host?.focus(); host?.addEventListener('keydown', key);
    return () => host?.removeEventListener('keydown', key);
  }, [phase]);
  function enter() {
    if (split || !landscapeReady) return;
    const host = surface.current.getBoundingClientRect(), source = composition.current.getBoundingClientRect();
    const x = source.left - host.left + source.width * .5, y = source.top - host.top + source.height * .55;
    surface.current.style.setProperty('--eye-dx', `${host.width / 2 - x}px`);
    surface.current.style.setProperty('--eye-dy', `${host.height / 2 - y}px`);
    surface.current.style.setProperty('--eye-scale', Math.hypot(host.width, host.height) / Math.max(2, source.width * .031));
    setPhase('entering');
    transition.current = setTimeout(() => setPhase('inside'), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1500);
  }
  function up() { clearHold(); point.current = null; if (!pinned) setSplit(false); }
  return <div ref={surface} tabIndex={-1} className={`mobile-experiments mobile-eye-${phase}`} aria-label="Steyra experiments">
    <div className="mobile-experiment-source" ref={composition}>
      <div className={`mobile-layer-composition ${split ? 'mobile-layers-open' : ''}`}
        onPointerDown={event => {
          if (phase !== 'art') return;
          event.currentTarget.setPointerCapture(event.pointerId); point.current = { x: event.clientX, y: event.clientY };
          hold.current = setTimeout(() => setSplit(true), 350);
        }} onPointerMove={event => {
          if (!point.current) return;
          const r = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty('--layer-x', Math.max(-1, Math.min(1, (event.clientX - r.left) / r.width * 2 - 1)));
          event.currentTarget.style.setProperty('--layer-y', Math.max(-1, Math.min(1, (event.clientY - r.top) / r.height * 2 - 1)));
        }} onPointerUp={up} onPointerCancel={up}>
        <div className="mobile-layer-stack" key={attempt}>{layers.map((file, i) => <div className="mobile-artwork-layer" key={file} style={{ '--layer': i }}><img src={`/assets/mobile-experiments/layer-demo/${file}`} alt="" draggable={false} onError={() => setFailed(true)} /></div>)}</div>
      </div>
    </div>
    <div className="mobile-experiment-landscape" aria-hidden={!inside}>
      <img key={attempt} src="/assets/mobile-experiments/mountains.jpg" alt="Madeira mountain ridges in mist, photographed by Colin Watts" onLoad={() => setLandscapeReady(true)} onError={() => setFailed(true)} />
      {inside && <p>Madeira, in the mist<br /><small>Sample photography · Colin Watts / Unsplash</small></p>}
    </div>
    <footer>{phase === 'art' ? <>
      <button onClick={onClose}><ArrowLeft />Profile</button>
      <button onClick={() => { setPinned(!pinned); setSplit(!pinned); }} aria-pressed={split}><Layers />{split ? 'Close layers' : '7 layers'}</button>
      <button ref={button} disabled={split || !landscapeReady} onClick={enter}><Eye />Through the eye</button>
    </> : <button disabled={leaving} onClick={closeEye}><ArrowLeft />{leaving ? 'Returning…' : 'Back through the eye'}</button>}</footer>
    {phase === 'art' && <p className="mobile-experiment-note">The world inside · Seven-layer study<br />Hold, then drag to look between layers.</p>}
    {failed && <p className="mobile-experiment-error" role="status">Some experiment media could not load. <button onClick={() => { setFailed(false); retry(n => n + 1); }}>Retry</button></p>}
  </div>;
}
