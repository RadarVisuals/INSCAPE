export const STANDALONE_WALLET_STORAGE_KEY = 'inscape-up';

// This is only a loading hint, never identity or authoring authority. The
// existing connector still reconnects and verifies every returning session.
// Unknown/unreadable state retains the connector's own recovery behavior.
export function hasPersistedStandaloneConnection(readStorage = () => window.localStorage) {
  try {
    const raw = readStorage().getItem(`${STANDALONE_WALLET_STORAGE_KEY}.store`);
    if (raw === null) return false;
    const state = JSON.parse(raw)?.state;
    return !(state?.current === null && Array.isArray(state?.connections?.value)
      && state.connections.value.length === 0);
  } catch { return true; }
}

// Own only loading/acquisition lifetime; the wallet session owns providers,
// reconnect and authority. A failed import/acquisition can be retried by Connect.
export function createStandaloneWalletLoader(options, {
  load = () => import('./standaloneWalletSession.js'),
} = {}) {
  let pending = null;
  let acquisition = null;
  let released = false;
  return {
    getSession() {
      if (released) return Promise.resolve(null);
      if (pending) return pending;
      pending = load().then(({ acquireStandaloneWalletSession }) => {
        if (released) return null;
        acquisition = acquireStandaloneWalletSession(options);
        return acquisition.session;
      }).then(session => released ? null : session).catch(error => {
        acquisition?.release();
        acquisition = null;
        pending = null;
        throw error;
      });
      return pending;
    },
    release() {
      if (released) return;
      released = true;
      acquisition?.release();
    },
  };
}
