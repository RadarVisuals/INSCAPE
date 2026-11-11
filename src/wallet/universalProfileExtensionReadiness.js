const UNIVERSAL_PROFILE_EXTENSION_RDNS = 'cloud.universalprofile';

const connectorMatchesUniversalProfile = (connector) => {
  if (!connector) return false;
  if (connector.id === UNIVERSAL_PROFILE_EXTENSION_RDNS) return true;
  if (typeof connector.id === 'string' && connector.id.includes(UNIVERSAL_PROFILE_EXTENSION_RDNS)) return true;
  if (connector.rdns === UNIVERSAL_PROFILE_EXTENSION_RDNS) return true;
  return Array.isArray(connector.rdns) && connector.rdns.includes(UNIVERSAL_PROFILE_EXTENSION_RDNS);
};

const hasUniversalProfileConnector = (wagmiConfig) =>
  Array.isArray(wagmiConfig?.connectors) &&
  wagmiConfig.connectors.some(connectorMatchesUniversalProfile);

const discoverUniversalProfileProvider = ({ windowObject, timeoutMs }) =>
  new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    const finish = (providerDetail = null) => {
      if (settled) return;
      settled = true;
      windowObject.removeEventListener('eip6963:announceProvider', onAnnouncement);
      if (timeoutId !== null) clearTimeout(timeoutId);
      resolve(providerDetail);
    };

    const onAnnouncement = (event) => {
      if (event?.detail?.info?.rdns === UNIVERSAL_PROFILE_EXTENSION_RDNS) {
        finish(event.detail);
      }
    };

    windowObject.addEventListener('eip6963:announceProvider', onAnnouncement);
    timeoutId = setTimeout(() => finish(), timeoutMs);
    const requestEvent = typeof windowObject.Event === 'function'
      ? new windowObject.Event('eip6963:requestProvider')
      : new Event('eip6963:requestProvider');
    windowObject.dispatchEvent(requestEvent);
  });

export async function ensureUniversalProfileExtensionConnector({
  wagmiConfig,
  windowObject = typeof window === 'undefined' ? null : window,
  timeoutMs = 500
} = {}) {
  if (!wagmiConfig || !windowObject) return false;
  if (hasUniversalProfileConnector(wagmiConfig)) return true;

  const providerDetail = await discoverUniversalProfileProvider({ windowObject, timeoutMs });
  if (!providerDetail) return false;
  if (hasUniversalProfileConnector(wagmiConfig)) return true;

  const connectorStore = wagmiConfig._internal?.connectors;
  if (
    typeof connectorStore?.providerDetailToConnector !== 'function' ||
    typeof connectorStore?.setup !== 'function' ||
    typeof connectorStore?.setState !== 'function'
  ) {
    return false;
  }

  const connector = connectorStore.setup(
    connectorStore.providerDetailToConnector(providerDetail)
  );
  connectorStore.setState((connectors) =>
    connectors.some(connectorMatchesUniversalProfile)
      ? connectors
      : [...connectors, connector]
  );

  return hasUniversalProfileConnector(wagmiConfig);
}

export { UNIVERSAL_PROFILE_EXTENSION_RDNS };
