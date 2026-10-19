import { useEffect, useRef, useState } from 'react';
import { readSvgArtwork } from '../public/ownerSystemWorkflow/LibraryArtworkImage.jsx';
import './artworkSvg.css';

export default function ArtworkSvgDocument({ src, title = 'Interactive artwork', className = '', stretch = false, paintOnly = false, onReady }) {
  const frame = useRef(null);
  const loading = useRef(null);
  const inspection = useRef(null), nextRequest = useRef(0);
  const readyCallback = useRef(onReady); readyCallback.current = onReady;
  const [hostReady, setHostReady] = useState(false);
  const [document, setDocument] = useState(null);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const releaseInspection = () => {
    const current = inspection.current;
    frame.current?.contentWindow.postMessage({ type: 'inscape:release-artwork' }, '*');
    if (!current) return;
    inspection.current = null;
    clearTimeout(current.timer); current.resolve(false);
  };
  useEffect(() => releaseInspection, [src, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    const request = { failed: false, sent: false };
    loading.current = request;
    setStatus('loading'); setDocument(null);
    const fail = () => {
      if (loading.current !== request) return;
      request.failed = true;
      controller.abort(); clearTimeout(request.timer);
      setStatus('failed');
    };
    // Bound the complete attempt, including a host iframe that never loads.
    // Fetch completion alone does not mean the isolated artwork is ready.
    request.timer = setTimeout(fail, 15000);
    readSvgArtwork(src, controller.signal).then(svg => {
      if (stretch) { svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.setAttribute('preserveAspectRatio', 'none'); }
      if (loading.current === request && !request.failed) setDocument({ src, text: new XMLSerializer().serializeToString(svg) });
    }).catch(fail);
    return () => {
      if (loading.current === request) loading.current = null;
      controller.abort(); clearTimeout(request.timer);
    };
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
        const request = loading.current;
        if (!request?.sent || request.failed) return;
        clearTimeout(request.timer);
        const window = event.source;
        setStatus('ready');
        readyCallback.current?.({
          releaseInspection,
          beginInspection() { window.postMessage({ type: 'inscape:inspect-artwork' }, '*'); },
          setPixelScale(scale) { window.postMessage({ type: 'inscape:artwork-density', scale }, '*'); },
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
    const request = loading.current;
    if (!request || request.failed) return undefined;
    request.sent = true;
    frame.current.contentWindow.postMessage({ type: 'inscape:artwork-source', svg: document.text }, '*');
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
