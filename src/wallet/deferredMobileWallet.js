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

// Reserve the navigation during the tap, before loading the mobile runtime.
// This preserves the user gesture required by mobile browsers for a new tab.
export async function connectMobileOnDemand(view, connector, makeDeepLink) {
  if (view.isConnecting) return;
  const tab = window.open('', '_blank');
  if (!tab) return;
  view.isConnecting = true;
  view.connectingRdns = connector.rdns;
  view._connectingViaWalletConnect = true;
  view._hasMobileNavigated = true;
  view._connectionDispatched = false;
  let provider;
  const onUri = uri => { tab.location.href = makeDeepLink(uri); };
  try {
    provider = await connector.getProvider();
    provider.on('display_uri', onUri);
    await connector.connect();
    if (!view._connectionDispatched) {
      view._connectionDispatched = true;
      view.dispatchEvent(new CustomEvent('on-connect', { detail: { connector }, bubbles: true, composed: true }));
    }
  } catch (error) {
    tab.close();
    view.dispatchEvent(new CustomEvent('on-error', { detail: { error }, bubbles: true, composed: true }));
  } finally {
    provider?.off('display_uri', onUri);
    view._cancelConnectionWatch();
    view.isConnecting = false;
    view.connectingRdns = undefined;
    view._connectingViaWalletConnect = false;
    view._hasMobileNavigated = false;
  }
}
