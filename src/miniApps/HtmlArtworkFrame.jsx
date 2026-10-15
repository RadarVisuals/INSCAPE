import { useEffect, useRef, useState } from 'react';
import { useArtworkVisibility } from '../artwork/useArtworkVisibility.js';

// HTML owns its animation and controls. The Workbench owns only the frame's
// bounds/lifecycle; this surface never creates a wallet or mini-app bridge.
export default function HtmlArtworkFrame({ url, name }) {
  const viewport = useRef(null);
  const visible = useArtworkVisibility(viewport);
  return <div ref={viewport} className="html-artwork-viewport">
    {visible && <HtmlArtworkDocument key={url.href} url={url} name={name} />}
  </div>;
}

function HtmlArtworkDocument({ url, name }) {
  const frame = useRef(null);
  const [attempt, setAttempt] = useState(0), [status, setStatus] = useState('loading');
  useEffect(() => {
    setStatus('loading');
    const timeout = setTimeout(() => setStatus(current => current === 'loading' ? 'failed' : current), 20000);
    const message = event => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== 'inscape:html-artwork-status') return;
      if (event.data.status === 'ready') setStatus('loaded');
      if (event.data.status === 'failed') setStatus('failed');
    };
    window.addEventListener('message', message);
    return () => { clearTimeout(timeout); window.removeEventListener('message', message); };
  }, [attempt]);
  const loaded = () => {
    // onLoad confirms only the document navigation, not a third-party animation.
    // Files may report their own preparation failure through the narrow status signal.
    setStatus(current => current === 'loading' ? 'loaded' : current);
    frame.current?.contentWindow.postMessage({ type: 'inscape:html-artwork-visibility', visible: true }, '*');
  };
  return <>
    <iframe key={attempt} ref={frame} title={`${name} HTML artwork`} src={url.href}
      className="html-artwork-frame" sandbox="allow-scripts" referrerPolicy="no-referrer"
      allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; clipboard-read 'none'; clipboard-write 'none'"
      onLoad={loaded} />
    {status !== 'loaded' && <div className="html-artwork-status" role="status">
      <span>{status === 'loading' ? 'Opening artwork…' : 'Artwork unavailable.'}</span>
      {status === 'failed' && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}
    </div>}
  </>;
}
