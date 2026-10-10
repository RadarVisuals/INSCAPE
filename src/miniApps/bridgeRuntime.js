import { createUPProviderConnector } from '@lukso/up-provider';
import { miniAppUrl } from './domain/miniApps.js';
import './bridge.css';

// The official connector is a singleton and its request callback has no caller
// identity. Give it one document and one app. The parent owns the scoped grant.
// Destroying this frame also destroys the connector, ports, timers and media.
let started = false;
window.addEventListener('message', function initialize(event) {
  if (started || event.source !== window.parent || event.origin !== location.origin
    || event.data?.type !== 'inscape:mini-app-init' || !event.ports[0]) return;
  const url = miniAppUrl(event.data.url, { hostOrigin: location.origin, allowLocal: import.meta.env.DEV });
  if (!url) return;
  started = true;
  window.removeEventListener('message', initialize);
  const port = event.ports[0];
  let state = event.data.state, channel = null, sequence = 0, loaded = false, dead = false;
  const pending = new Map();
  const frame = document.createElement('iframe');
  frame.title = event.data.name;
  frame.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads';
  frame.referrerPolicy = 'no-referrer';
  frame.allow = `autoplay; fullscreen; microphone ${event.data.microphone ? url.origin : "'none'"}; camera 'none'; geolocation 'none'`;

  const requestParent = request => new Promise((resolve, reject) => {
    if (dead || pending.size >= 16) return reject({ code: -32002, message: 'The host is unavailable or busy.' });
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id); reject({ code: -32002, message: 'Request still unresolved. Check wallet activity before retrying.' });
    }, 120000);
    pending.set(id, { resolve, reject, timer });
    port.postMessage({ type: 'request', id, request });
  });
  const endpoint = {
    async request(request) {
      // Never put an account in the connector's global defaults. In particular,
      // its iframe handshake must not expose accounts before explicit Connect.
      if (request.method === 'eth_accounts') return [];
      if (request.method === 'eth_chainId') return `0x${state.chainId.toString(16)}`;
      if (request.method === 'up_contextAccounts') return state.contextAccounts;
      return requestParent(request);
    },
  };

  // Accept only this app's declared origin and window. The installed connector
  // ignores the normal discovery message when nested; translate that discovery
  // into its supported iframe handshake without changing the mini app client.
  const guard = event => {
    if (!(typeof event.data === 'string' && event.data.startsWith('upProvider:'))
      && !(typeof event.data?.type === 'string' && event.data.type.startsWith('upProvider:'))) return;
    if (event.source !== frame.contentWindow || event.origin !== url.origin) { event.stopImmediatePropagation(); return; }
    if (event.data === 'upProvider:hasProvider') {
      event.stopImmediatePropagation();
      window.dispatchEvent(new MessageEvent('message', { data: 'upProvider:requestIframeProvider',
        source: event.source, origin: event.origin, ports: [...event.ports] }));
    }
  };
  window.addEventListener('message', guard, true);
  const connector = createUPProviderConnector(endpoint, state.rpcUrls);
  const applyState = () => {
    if (dead) return;
    void connector.setChainId(state.chainId);
    void connector.setContextAccounts(state.contextAccounts);
    if (channel) {
      const current = channel;
      // Transport availability and a wallet grant are different facts. Keep the
      // transport enabled with no accounts until the parent grants access.
      // The official client clears context on wallet disconnect; restore that
      // public context after its accounts/disconnect notifications are sent.
      void current.setupChannel(true, state.accounts, state.contextAccounts, state.chainId).then(() => {
        if (!dead && channel === current) void current.send('contextAccountsChanged', state.contextAccounts);
      });
    }
  };
  connector.on('channelCreated', (target, next) => {
    if (target !== frame || next.window !== frame.contentWindow) { next.close(); return; }
    if (channel) {
      state = { ...state, connected: false, accounts: [] };
      port.postMessage({ type: 'navigated' });
    }
    channel?.close(); channel = next;
    // Chain switching is local to this connector in upstream 0.3.7. Keep this
    // mainnet-only host consistent; it never switches the actual user's wallet.
    channel.on('chainChanged', chain => { if (chain !== state.chainId) void connector.setChainId(state.chainId); });
    applyState(); port.postMessage({ type: 'ready' });
  });
  port.onmessage = ({ data }) => {
    if (dead) return;
    if (data.type === 'state') { state = data.state; applyState(); }
    if (data.type === 'response') {
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id); clearTimeout(request.timer);
      if (data.error) request.reject(data.error); else request.resolve(data.result);
    }
  };
  port.start(); applyState();
  frame.addEventListener('load', () => {
    if (loaded) port.postMessage({ type: 'navigated' });
    loaded = true;
  });
  frame.src = url.href;
  document.body.append(frame);
  window.addEventListener('pagehide', () => {
    dead = true; connector.close(); channel?.close(); connector.removeAllListeners();
    window.removeEventListener('message', guard, true);
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject({ code: 4900, message: 'App closed.' }); }
    pending.clear(); port.close(); frame.remove();
  }, { once: true });
});
