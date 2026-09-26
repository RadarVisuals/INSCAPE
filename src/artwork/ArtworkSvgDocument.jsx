import { useEffect, useRef, useState } from 'react';
import { readSvgArtwork } from '../public/ownerSystemWorkflow/LibraryArtworkImage.jsx';
import './artworkSvg.css';

export default function ArtworkSvgDocument({ src, title = 'Interactive artwork', className = '', stretch = false, paintOnly = false, onReady }) {
  const frame = useRef(null);
  const inspection = useRef(null), nextRequest = useRef(0);
  const readyCallback = useRef(onReady); readyCallback.current = onReady;
  const [hostReady, setHostReady] = useState(false);
  const [document, setDocument] = useState(null);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const releaseInspection = () => {
    const current = inspection.current;
    if (!current) return;
    inspection.current = null;
    clearTimeout(current.timer); current.resolve(false);
    current.window.postMessage({ type: 'inscape:release-artwork' }, '*');
  };
  useEffect(() => releaseInspection, [src, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    setStatus('loading'); setDocument(null);
    const timer = setTimeout(() => controller.abort(), 15000);
    readSvgArtwork(src, controller.signal).then(svg => {
      if (stretch) { svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.setAttribute('preserveAspectRatio', 'none'); }
      if (!disposed) setDocument({ src, text: new XMLSerializer().serializeToString(svg) });
    }).catch(() => { if (!disposed) setStatus('failed'); }).finally(() => clearTimeout(timer));
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [src, attempt, stretch]);
  useEffect(() => {
    const loaded = event => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'inscape:artwork-prepared') {
        const current = inspection.current;
        if (current?.window === event.source && current.requestId === event.data.requestId) {
          clearTimeout(current.timer); current.resolve(true);
        }
      } else if (event.data?.type === 'inscape:artwork-loaded') {
        const window = event.source;
        setStatus('ready');
        readyCallback.current?.({
          releaseInspection,
          prepareInspection() {
            if (frame.current?.contentWindow !== window) return Promise.resolve(false);
            if (inspection.current?.window === window) return inspection.current.promise;
            releaseInspection();
            const current = { window, requestId: ++nextRequest.current };
            current.promise = new Promise(resolve => { current.resolve = resolve; });
            // A failed or unresponsive optimization must not prevent opening.
            current.timer = setTimeout(() => current.resolve(false), 1500);
            inspection.current = current;
            window.postMessage({ type: 'inscape:prepare-artwork', requestId: current.requestId }, '*');
            return current.promise;
          },
        });
      }
    };
    addEventListener('message', loaded);
    return () => removeEventListener('message', loaded);
  }, []);
  useEffect(() => {
    if (!hostReady || document?.src !== src) return undefined;
    frame.current.contentWindow.postMessage({ type: 'inscape:artwork-source', svg: document.text }, '*');
    const timer = setTimeout(() => setStatus(current => current === 'loading' ? 'failed' : current), 15000);
    return () => clearTimeout(timer);
  }, [hostReady, document, src]);
  return <>
    <iframe key={attempt} ref={frame} className={`artwork-svg-document ${className}`} tabIndex={paintOnly ? -1 : undefined}
      style={paintOnly ? { pointerEvents: 'none' } : undefined}
      src="/.netlify/functions/artwork-document" title={title} onLoad={() => setHostReady(true)}
      sandbox="allow-scripts" referrerPolicy="no-referrer"
      allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" />
    {status !== 'ready' && <span className="artwork-svg-status" role="status">
      {status === 'loading' ? 'Loading artwork…' : <button type="button" style={{ pointerEvents: 'auto' }}
        onClick={() => { setHostReady(false); setAttempt(value => value + 1); }}>Artwork unavailable — retry</button>}
    </span>}
  </>;
}
