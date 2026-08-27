import { getConnection, reconnect, watchConnection } from '@wagmi/core';
import { setupLuksoConnector } from '@lukso/up-modal';
import { resolveStandaloneUniversalProfile } from '../store/universalProfileValidation.js';
import { ensureUniversalProfileExtensionConnector } from './universalProfileExtensionReadiness.js';

export const isEmbeddedApplication = () => typeof window !== 'undefined' && window.parent !== window;

let sharedSessionPromise = null;
let sharedConsumers = 0;
let pendingRelease = null;

export async function createStandaloneWalletSession({ initializeWallet, disposeWallet, beginWalletTransition, onError, onSignInClose }) {
  const connector = await setupLuksoConnector({
    theme: 'light',
    chains: { defaultChainId: 42 },
    connectors: { eoa: false },
    storage: { key: 'inscape-up' },
    onClose: () => onSignInClose?.(),
    onError: (event) => onError?.(event?.detail || new Error('Universal Profile connection failed.'))
  });

  let syncGeneration = 0;
  let disposed = false;
  let showSignInPromise = null;

  const syncConnection = async (connection) => {
    const generation = ++syncGeneration;
    if (disposed) return false;

    if (connection?.status === 'connecting' || connection?.status === 'reconnecting') {
      beginWalletTransition?.();
      return false;
    }

    if (connection?.status !== 'connected' || connection.chainId !== 42 || !connection.connector) {
      disposeWallet();
      return false;
    }

    try {
      const provider = await connection.connector.getProvider();
      if (disposed || generation !== syncGeneration || !provider) return false;
      return initializeWallet({
        provider,
        resolveContextAccounts: resolveStandaloneUniversalProfile
      });
    } catch (error) {
      if (!disposed && generation === syncGeneration) {
        disposeWallet();
        onError?.(error);
      }
      return false;
    }
  };

  // `setupLuksoConnector` restores Wagmi's persisted connector metadata, but
  // does not activate that connection by itself. Reconnect before subscribing
  // so a standalone page refresh keeps the verified Universal Profile session.
  // A stale or revoked authorization must remain a normal disconnected state:
  // the sign-in modal is still available for an explicit reconnect.
  try {
    await reconnect(connector.wagmiConfig);
  } catch (error) {
    onError?.(error);
  }

  const stopWatching = watchConnection(connector.wagmiConfig, {
    onChange: (connection) => { void syncConnection(connection); }
  });
  await syncConnection(getConnection(connector.wagmiConfig));

  return {
    showSignIn: () => {
      if (showSignInPromise) return showSignInPromise;
      showSignInPromise = (async () => {
        await ensureUniversalProfileExtensionConnector({
          wagmiConfig: connector.wagmiConfig
        });
        if (!disposed) connector.showSignInModal();
      })().finally(() => {
        showSignInPromise = null;
      });
      return showSignInPromise;
    },
    dispose() {
      disposed = true;
      syncGeneration += 1;
      stopWatching?.();
      connector.destroyModal();
      disposeWallet();
    }
  };
}

export function acquireStandaloneWalletSession(options) {
  sharedConsumers += 1;
  if (pendingRelease) {
    pendingRelease.cancelled = true;
    pendingRelease = null;
  }
  if (!sharedSessionPromise) sharedSessionPromise = createStandaloneWalletSession(options);

  let released = false;
  return {
    session: sharedSessionPromise,
    release() {
      if (released) return;
      released = true;
      sharedConsumers = Math.max(0, sharedConsumers - 1);
      if (sharedConsumers > 0 || pendingRelease) return;
      const release = { cancelled: false };
      pendingRelease = release;
      queueMicrotask(async () => {
        if (release.cancelled || pendingRelease !== release || sharedConsumers > 0) return;
        pendingRelease = null;
        const sessionPromise = sharedSessionPromise;
        sharedSessionPromise = null;
        const session = await sessionPromise.catch(() => null);
        session?.dispose();
      });
    }
  };
}
