import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { subscribeTextRecovery, textRecoveryRevision, textRecoveries } from './textEditRecovery.js';

export default function useTextRecovery(store, profile) {
  useSyncExternalStore(useCallback(listener => subscribeTextRecovery(store, listener), [store]),
    useCallback(() => textRecoveryRevision(store), [store]));
  const pending = textRecoveries(store, profile);
  useEffect(() => {
    if (!pending.length) return;
    const guard = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [pending.length]);
  return pending;
}
