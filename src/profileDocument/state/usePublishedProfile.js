import { useEffect, useSyncExternalStore } from 'react';
import { normalizeProfileAddress } from '../../library/config.js';
import { publishedProfileResolutionStore } from './publishedProfileResolutionStore.js';

const NO_PROFILE_CONTEXT = Object.freeze({
  status: 'CONTEXT_REQUIRED',
  address: null,
  document: null,
  errorCode: 'PROFILE_CONTEXT_REQUIRED',
  busy: false
});

export function usePublishedProfile(address, store = publishedProfileResolutionStore) {
  const profileAddress = normalizeProfileAddress(address);
  const state = useSyncExternalStore(
    (listener) => profileAddress ? store.subscribe(profileAddress, listener) : () => {},
    () => profileAddress ? store.get(profileAddress) : NO_PROFILE_CONTEXT,
    () => profileAddress ? store.get(profileAddress) : NO_PROFILE_CONTEXT
  );
  useEffect(() => {
    if (!profileAddress) return undefined;
    store.resolve(profileAddress).catch(() => {});
    return () => store.cancel(profileAddress);
  }, [profileAddress, store]);
  return [state, () => profileAddress ? store.resolve(profileAddress) : Promise.resolve(NO_PROFILE_CONTEXT)];
}
