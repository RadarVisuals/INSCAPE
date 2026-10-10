import { useCallback, useSyncExternalStore } from 'react';
import { subscribeTextRecovery, textRecoveryRevision, textRecoveries } from './textEditRecovery.js';

export default function useTextRecovery(store, profile) {
  useSyncExternalStore(useCallback(listener => subscribeTextRecovery(store, listener), [store]),
    useCallback(() => textRecoveryRevision(store), [store]));
  return textRecoveries(store, profile);
}
