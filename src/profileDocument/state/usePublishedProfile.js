import { useEffect, useSyncExternalStore } from 'react';
import { publishedProfileResolutionStore } from './publishedProfileResolutionStore.js';

export function usePublishedProfile(address, store = publishedProfileResolutionStore) {
  const state = useSyncExternalStore((listener) => store.subscribe(address, listener), () => store.get(address), () => store.get(address));
  useEffect(() => { store.resolve(address).catch(() => {}); }, [address, store]);
  return state;
}
