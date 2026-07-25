export const LUKSO_CHAIN_ID = 42;
export const LUKSO_INDEXER_URL = import.meta.env?.VITE_LUKSO_INDEXER_URL
  || 'https://envio.lukso-mainnet.universal.tech/v1/graphql';
export const CHILLWHALES_INDEXER_URL = import.meta.env?.VITE_CHILLWHALES_INDEXER_URL
  || 'https://indexer.chillwhales.dev/v1/graphql';
const DEFAULT_IPFS_GATEWAY_URL = 'https://api.universalprofile.cloud/ipfs/';

export function normalizePublicHttpsEndpoint(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    parsed.hash = '';
    parsed.pathname = `${parsed.pathname.replace(/\/+$/u, '') || ''}/`;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizePublicHttpsEndpointList(value) {
  const seen = new Set();
  return String(value || '').split(/[\n,]/u).map(normalizePublicHttpsEndpoint).filter((endpoint) => {
    if (!endpoint || seen.has(endpoint)) return false;
    seen.add(endpoint); return true;
  }).join(',');
}

export const IPFS_GATEWAY_URL = normalizePublicHttpsEndpoint(import.meta.env?.VITE_IPFS_GATEWAY_URL)
  || DEFAULT_IPFS_GATEWAY_URL;
export const PROFILE_DOCUMENT_IPFS_GATEWAY_URL = normalizePublicHttpsEndpoint(
  import.meta.env?.VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL
) || IPFS_GATEWAY_URL;
export const LUKSO_RPC_URL = import.meta.env?.VITE_LUKSO_RPC_URL || 'https://rpc.mainnet.lukso.network';
export const LUKSO_RPC_FALLBACK_URLS = import.meta.env?.VITE_LUKSO_RPC_FALLBACK_URLS || '';
export const PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS = normalizePublicHttpsEndpointList(
  import.meta.env?.VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS
);
export const LIBRARY_PAGE_SIZE = 24;

export function normalizeProfileAddress(value) {
  const candidate = String(value || '').trim();
  return /^0x[a-fA-F0-9]{40}$/.test(candidate) ? candidate.toLowerCase() : null;
}

export function resolveLibraryProfile(locationLike = globalThis.location) {
  try {
    return normalizeProfileAddress(new URLSearchParams(locationLike?.search || '').get('profile'));
  } catch {
    return null;
  }
}

export function resolveWorkspaceProfile(hostProfileAddress, locationLike = globalThis.location) {
  return normalizeProfileAddress(hostProfileAddress) || resolveLibraryProfile(locationLike);
}
