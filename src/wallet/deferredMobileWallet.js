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

// Reserve navigation during the tap, then let the SDK's connection handler own
// approval, return-to-page recovery and the pending-request toast.
export async function prepareMobileWalletOnDemand(view) {
  if (view.isConnecting) return null;
  const tab = window.open('', '_blank');
  if (!tab) return null;
  view.isConnecting = true;
  view.connectingRdns = view.walletConnectConnector?.rdns;
  try {
    if (!view._pendingWalletConnect && !view.prewarmConnectPromise) {
      await view.prewarmWalletConnectUri();
    }
    if (view.isConnected) return tab;
    // Removal can happen while getProvider() is still downloading. The SDK's
    // disconnectedCallback ran before this late listener was registered.
    const pending = view.prewarmResult;
    pending?.provider.off('display_uri', pending.handler);
    view.prewarmResult = null;
    view.prewarmConnectPromise?.catch(() => {});
    view.prewarmConnectPromise = null;
    view.prewarmUriPromise = null;
  } catch (error) {
    if (view.isConnected) view.dispatchEvent(new CustomEvent('on-error', { detail: { error }, bubbles: true, composed: true }));
  }
  tab.close();
  view.isConnecting = false;
  view.connectingRdns = undefined;
  return null;
}
