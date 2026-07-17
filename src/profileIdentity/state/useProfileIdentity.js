import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { normalizeProfileAddress } from '../../library/config.js';
import { createProfileIdentity } from '../domain/profileIdentity.js';
import { getProfileIdentityCache } from './profileIdentityService.js';
export function useProfileIdentity(address, { sourceMode = 'LIVE' } = {}) { const normalized = normalizeProfileAddress(address); const cache = useMemo(() => getProfileIdentityCache(sourceMode), [sourceMode]); const identity = useSyncExternalStore((listener) => normalized ? cache.subscribe(normalized, listener) : () => {}, () => normalized ? cache.get(normalized) : null, () => normalized ? cache.get(normalized) : null); useEffect(() => { if (normalized) cache.resolve(normalized).catch(() => {}); }, [cache, normalized]); return identity || (normalized ? createProfileIdentity(normalized, { source: sourceMode }) : null); }
