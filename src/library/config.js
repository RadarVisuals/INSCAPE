export const LUKSO_CHAIN_ID = 42;
export const DEFAULT_PROFILE_ADDRESS = '0xf3C189819Fd5b042f692983bFbFD57ab607ee709';
export const LUKSO_INDEXER_URL = import.meta.env?.VITE_LUKSO_INDEXER_URL
  || 'https://envio.lukso-mainnet.universal.tech/v1/graphql';
export const IPFS_GATEWAY_URL = import.meta.env?.VITE_IPFS_GATEWAY_URL
  || 'https://api.universalprofile.cloud/ipfs/';
export const LIBRARY_PAGE_SIZE = 24;

export function normalizeProfileAddress(value) {
  const candidate = String(value || '').trim();
  return /^0x[a-fA-F0-9]{40}$/.test(candidate) ? candidate.toLowerCase() : null;
}

export function resolveLibraryProfile(locationLike = globalThis.location) {
  const fallback = DEFAULT_PROFILE_ADDRESS.toLowerCase();
  try {
    return normalizeProfileAddress(new URLSearchParams(locationLike?.search || '').get('profile')) || fallback;
  } catch {
    return fallback;
  }
}
