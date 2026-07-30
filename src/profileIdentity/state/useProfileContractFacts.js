import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { normalizeProfileAddress } from '../../library/config.js';
import { luksoProfileContractRepository } from '../data/luksoProfileContractRepository.js';
import { createProfileContractFacts } from '../domain/profileContractFacts.js';
import { ProfileContractFactsCache } from './profileContractFactsCache.js';

export const profileContractFactsCache = new ProfileContractFactsCache({ repository: luksoProfileContractRepository });

export function useProfileContractFacts(address, { enabled = true } = {}) {
  const normalizedAddress = normalizeProfileAddress(address);
  const cache = useMemo(() => profileContractFactsCache, []);
  const facts = useSyncExternalStore(
    (listener) => normalizedAddress ? cache.subscribe(normalizedAddress, listener) : () => {},
    () => normalizedAddress ? cache.get(normalizedAddress) : null,
    () => normalizedAddress ? cache.get(normalizedAddress) : null
  );
  useEffect(() => {
    if (!normalizedAddress || !enabled) return undefined;
    const timer = setTimeout(() => cache.resolve(normalizedAddress).catch(() => {}), 0);
    return () => clearTimeout(timer);
  }, [cache, enabled, normalizedAddress]);
  return facts || (normalizedAddress ? createProfileContractFacts(normalizedAddress) : null);
}
