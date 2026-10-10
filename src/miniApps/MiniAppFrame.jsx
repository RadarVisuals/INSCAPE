import { useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, Mic, RefreshCw } from 'lucide-react';
import { useWalletStore } from '../store/useWalletStore.js';
import { createMiniAppWalletSession, miniAppRequestError } from './miniAppWalletSession.js';

export default function MiniAppFrame({ url, name, profileAddress, microphone, onMicrophoneChange, onReload, onConnect }) {
  const frame = useRef(null), connection = useRef(null), port = useRef(null), live = useRef(false);
  const [wallet, setWallet] = useState({ connected: false, canConnect: false });
  const [status, setStatus] = useState('loading');
  useLayoutEffect(() => {
    live.current = true;
    const session = createMiniAppWalletSession({ walletStore: useWalletStore, profileAddress, onChange(state) {
      if (!live.current) return;
      setWallet(state); port.current?.postMessage({ type: 'state', state });
    } });
    connection.current = session; setWallet(session.getState());
    const timeout = setTimeout(() => setStatus(current => current === 'loading' ? 'unavailable' : current), 15000);
    return () => {
      live.current = false; clearTimeout(timeout); session.dispose();
      port.current?.close(); port.current = null; connection.current = null;
    };
  }, [profileAddress]);

  const initialize = () => {
    const session = connection.current;
    if (!session) return;
    // A reloaded host document gets a new capability and no inherited grant.
    session.disconnect(); port.current?.close();
    const transport = new MessageChannel(); port.current = transport.port1;
    transport.port1.onmessage = async ({ data }) => {
      if (!live.current || port.current !== transport.port1) return;
      if (data?.type === 'ready') setStatus('ready');
      if (data?.type === 'navigated') session.disconnect();
      if (data?.type !== 'request' || !Number.isSafeInteger(data.id)) return;
      try {
        const result = await session.request(data.request);
        if (live.current && port.current === transport.port1) transport.port1.postMessage({ type: 'response', id: data.id, result });
      } catch (error) {
        if (live.current && port.current === transport.port1) transport.port1.postMessage({ type: 'response', id: data.id, error: miniAppRequestError(error) });
      }
    };
    transport.port1.start();
    frame.current.contentWindow.postMessage({ type: 'inscape:mini-app-init', url: url.href, name, microphone,
      state: session.getState() }, location.origin, [transport.port2]);
  };
  const embedded = window.parent !== window;
  return <div className="mini-app-content">
    <div className="mini-app-toolbar">
      <a href={url.href} target="_blank" rel="noopener noreferrer" title={`Open ${url.hostname} in a new tab`}><span>{url.hostname}</span><ExternalLink size={12} /></a>
      <button type="button" disabled={status !== 'ready' || !wallet.canConnect && (embedded || !onConnect)}
        onClick={() => wallet.connected ? connection.current.disconnect() : wallet.canConnect ? connection.current.connect() : onConnect?.()}>
        {wallet.connected ? 'Disconnect app' : wallet.canConnect ? 'Connect app' : 'Connect profile'}</button>
      <button type="button" aria-label={microphone ? 'Disable mini app microphone' : 'Enable mini app microphone'} aria-pressed={microphone}
        title="Reload the app with microphone access enabled or disabled. Your browser still asks for permission."
        onClick={() => onMicrophoneChange(!microphone)}><Mic size={14} /><span>Mic</span></button>
      <button type="button" aria-label="Reload mini app" onClick={onReload}><RefreshCw size={14} /></button>
    </div>
    {status !== 'ready' && <div className="mini-app-status" role="status">
      {status === 'loading' ? 'Waiting for the mini app…' : 'Connect through the app’s own controls.'}
    </div>}
    {status === 'ready' && !wallet.canConnect && embedded && <div className="mini-app-status">Connect INSCAPE in its parent page to use your profile here.</div>}
    <iframe ref={frame} title={`${name} mini app host`} src={`${import.meta.env.BASE_URL}mini-app-host.html`}
      onLoad={initialize} className="mini-app-frame" referrerPolicy="no-referrer"
      allow={`autoplay; fullscreen; microphone ${microphone ? `'self' ${url.origin}` : "'none'"}; camera 'none'; geolocation 'none'`} />
  </div>;
}
