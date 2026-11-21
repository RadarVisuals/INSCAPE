// Keep Wagmi's connector and event handling; defer only its eager setup.
export function deferMobileWallet(factory) {
  return parameters => config => {
    const connector = factory(parameters)(config);
    let ready;
    return {
      ...connector,
      setup() {},
      async getProvider(options) {
        const provider = await connector.getProvider(options);
        if (!ready) {
          ready = Promise.resolve(connector.setup?.()).catch(error => {
            ready = undefined;
            throw error;
          });
        }
        await ready;
        return provider;
      },
    };
  };
}

const preparations = new WeakMap();

function clearPreparation(view) {
  const pending = view.prewarmResult;
  pending?.provider.off('display_uri', pending.handler);
  view.prewarmResult = null;
  view.prewarmConnectPromise?.catch(() => {});
  view.prewarmConnectPromise = null;
  view.prewarmUriPromise = null;
  view.prewarmedDeepLink = '';
}

export function cancelMobileWalletPreparation(view) {
  preparations.get(view)?.cancel();
}

// The first tap prepares a link in the existing modal. A fresh second tap lets
// the SDK open that link synchronously, preserving mobile user activation.
// Never reserve about:blank and navigate it after downloading the provider.
export function prepareMobileWalletOnDemand(view) {
  if (view.isConnecting || preparations.has(view)) return false;
  if ((view.prewarmedDeepLink && view.prewarmConnectPromise) || view._pendingWalletConnect) return true;
  view.isConnecting = true;
  view.connectingRdns = view.walletConnectConnector?.rdns;
  let cancel, timer;
  const interrupted = new Promise((_, reject) => {
    cancel = () => reject(new Error('Mobile connection preparation cancelled.'));
    timer = setTimeout(() => reject(new Error('The UP! App connection could not be prepared. Please try again.')), 20000);
  });
  const preparation = { cancel };
  preparations.set(view, preparation);
  let abandoned = false;
  const ready = (async () => {
    if (!view.prewarmConnectPromise) await view.prewarmWalletConnectUri();
    if (abandoned || !view.isConnected) {
      clearPreparation(view);
      return;
    }
    if (!view.prewarmConnectPromise || !view.prewarmUriPromise) throw new Error('The UP! App connection is unavailable. Please try again.');
    await Promise.race([view.prewarmUriPromise, view.prewarmConnectPromise, interrupted]);
    if (!view.prewarmedDeepLink) throw new Error('No UP! App connection link was received. Please try again.');
  })();
  // Do not let a retry race a provider download that cannot be aborted. A late
  // SDK result must be cleaned before this same view starts another attempt.
  void ready.finally(() => {
    if (preparations.get(view) === preparation) preparations.delete(view);
  }).catch(() => {});
  void Promise.race([ready, interrupted]).catch(error => {
    abandoned = true;
    clearPreparation(view);
    if (view.isConnected) view.dispatchEvent(new CustomEvent('on-error', { detail: { error }, bubbles: true, composed: true }));
  }).finally(() => {
    clearTimeout(timer);
    view.isConnecting = false;
    view.connectingRdns = undefined;
  });
  return false;
}
