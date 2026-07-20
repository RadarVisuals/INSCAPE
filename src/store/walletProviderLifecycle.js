const DEFAULT_HANDSHAKE_TIMEOUT_MS = 6000;

function boundedTimeout(milliseconds) {
  let timer;
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('UP Provider handshake timed out'), {
      code: 'PROVIDER_HANDSHAKE_TIMEOUT'
    })), milliseconds);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

async function queryContextAccounts(provider) {
  try {
    const accounts = await provider.request({ method: 'up_contextAccounts' });
    return Array.isArray(accounts) ? accounts : provider.contextAccounts;
  } catch {
    return provider.contextAccounts;
  }
}

export function createWalletProviderLifecycle({ get, set, createProvider, normalizeChainId, supportedChainId }) {
  let active = null;
  let providerGeneration = 0;
  const attachments = new WeakMap();

  const isCurrent = (lifecycle, recoveryGeneration) => active === lifecycle && !lifecycle?.disposed
    && lifecycle.providerGeneration === providerGeneration
    && (recoveryGeneration === undefined || lifecycle.recoveryGeneration === recoveryGeneration);

  const recover = async (reason = 'event') => {
    const lifecycle = active;
    if (!isCurrent(lifecycle)) return false;
    const recoveryGeneration = ++lifecycle.recoveryGeneration;
    get()._failClosedProviderContext();
    set({ provider: lifecycle.provider });
    const timeout = boundedTimeout(lifecycle.handshakeTimeoutMs);
    try {
      const requests = Promise.all([
        lifecycle.provider.request({ method: 'eth_accounts' }),
        lifecycle.provider.request({ method: 'eth_chainId' }),
        queryContextAccounts(lifecycle.provider)
      ]);
      const [accounts, rawChainId, contextAccounts] = await Promise.race([requests, timeout.promise]);
      if (!isCurrent(lifecycle, recoveryGeneration)) return false;
      const chainId = normalizeChainId(rawChainId);
      if (chainId !== supportedChainId) {
        get()._failClosedProviderContext(Object.assign(new Error('UP Provider is not connected to LUKSO mainnet'), {
          code: 'UNSUPPORTED_CHAIN', reason
        }));
        set({ provider: lifecycle.provider });
        return false;
      }
      await get()._applyAuthoritativeProviderContext({
        provider: lifecycle.provider, accounts, contextAccounts, chainId,
        providerGeneration: lifecycle.providerGeneration, recoveryGeneration,
        isCurrent: () => isCurrent(lifecycle, recoveryGeneration)
      });
      return isCurrent(lifecycle, recoveryGeneration);
    } catch (error) {
      if (isCurrent(lifecycle, recoveryGeneration)) {
        get()._failClosedProviderContext(error);
        set({ provider: lifecycle.provider });
      }
      return false;
    } finally {
      timeout.cancel();
    }
  };

  function attach(provider, lifecycle) {
    const existing = attachments.get(provider);
    if (existing) {
      existing.lifecycle = lifecycle;
      lifecycle.attachment = existing;
      return;
    }
    const attachment = {
      lifecycle,
      removalSupported: typeof provider.removeListener === 'function' || typeof provider.off === 'function'
    };
    function handleAccountsChanged() {
      if (isCurrent(attachment.lifecycle)) recover('accountsChanged');
    }
    function handleChainChanged(rawChainId) {
      if (!isCurrent(attachment.lifecycle)) return;
      const supported = normalizeChainId(rawChainId) === supportedChainId;
      if (!supported) {
        // An unsupported payload can close authority, but it can never restore it. It
        // also invalidates a pending supported-chain recovery without querying or prompting.
        attachment.lifecycle.recoveryGeneration += 1;
        get()._failClosedProviderContext(Object.assign(new Error('UP Provider reported an unsupported chain'), {
          code: 'UNSUPPORTED_CHAIN', reason: 'chainChanged:unsupported'
        }));
        set({ provider: attachment.lifecycle.provider });
        return;
      }
      // A supported payload grants nothing: recovery re-queries every authoritative field.
      recover('chainChanged:mainnet');
    }
    function handleContextAccountsChanged() {
      if (isCurrent(attachment.lifecycle)) recover('contextAccountsChanged');
    }
    attachment.listeners = { accountsChanged: handleAccountsChanged, chainChanged: handleChainChanged,
      contextAccountsChanged: handleContextAccountsChanged };
    for (const [event, listener] of Object.entries(attachment.listeners)) provider.on(event, listener);
    attachments.set(provider, attachment);
    lifecycle.attachment = attachment;
  }

  function removeOwnedListeners(lifecycle) {
    const { provider, attachment } = lifecycle;
    if (!attachment?.removalSupported) return false;
    for (const [event, listener] of Object.entries(attachment.listeners)) {
      if (typeof provider.removeListener === 'function') provider.removeListener(event, listener);
      else provider.off(event, listener);
    }
    attachments.delete(provider);
    return true;
  }

  const dispose = () => {
    const lifecycle = active;
    if (!lifecycle) return { disposed: true, listenersRemoved: true, limitation: null };
    if (lifecycle.disposed) return lifecycle.disposalReport;
    lifecycle.disposed = true;
    lifecycle.recoveryGeneration += 1;
    providerGeneration += 1;
    let listenersRemoved = false;
    let limitation = null;
    try { listenersRemoved = removeOwnedListeners(lifecycle); }
    catch (error) { limitation = `Provider listener removal failed: ${String(error?.message || 'unknown error').slice(0, 160)}`; }
    if (!listenersRemoved && !limitation) {
      limitation = 'The provider exposes no off/removeListener API; callbacks remain attached but are generation-inert and reused without duplication.';
    }
    lifecycle.disposalReport = { disposed: true, listenersRemoved, limitation };
    if (active === lifecycle) active = null;
    get()._failClosedProviderContext();
    set((state) => ({ provider: null, providerCleanupLimitation: limitation,
      publicationContextGeneration: state.publicationContextGeneration + 1 }));
    return lifecycle.disposalReport;
  };

  const initialize = (options = {}) => {
    if (!options.provider && active && !active.disposed) return active.readyPromise;
    let provider;
    try { provider = options.provider || createProvider(); }
    catch (error) { set({ initializationError: error }); return Promise.resolve(false); }
    if (active && !active.disposed && active.provider === provider) return active.readyPromise;
    if (active) dispose();
    const lifecycle = {
      provider, disposed: false, providerGeneration: ++providerGeneration, recoveryGeneration: 0,
      handshakeTimeoutMs: options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS,
      readyPromise: null, disposalReport: null, attachment: null
    };
    active = lifecycle;
    try { attach(provider, lifecycle); }
    catch (error) {
      lifecycle.disposed = true; providerGeneration += 1; active = null;
      get()._failClosedProviderContext(error); set({ provider: null });
      return Promise.resolve(false);
    }
    set((state) => ({ provider, providerCleanupLimitation: null, initializationError: null,
      publicationContextGeneration: state.publicationContextGeneration + 1 }));
    lifecycle.readyPromise = recover('initialization');
    return lifecycle.readyPromise;
  };

  return { initialize, dispose, recover, isCurrent, getActive: () => active };
}
