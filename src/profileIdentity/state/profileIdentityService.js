import { lsp3ProfileIdentityRepository } from '../data/lsp3ProfileIdentityRepository.js';
import { fixtureProfileIdentityRepository } from '../data/fixtureProfileIdentityRepository.js';
import { ProfileIdentityCache } from './profileIdentityCache.js';
export const liveProfileIdentityCache = new ProfileIdentityCache({ repository: lsp3ProfileIdentityRepository });
// Keep review identities available to Vite development and direct Node tests,
// while allowing the production build to discard the fixture repository.
export const fixtureProfileIdentityCache = import.meta.env?.PROD ? null : new ProfileIdentityCache({ repository: fixtureProfileIdentityRepository });
export function getProfileIdentityCache(sourceMode = 'LIVE') { return !import.meta.env?.PROD && sourceMode === 'FIXTURE' ? fixtureProfileIdentityCache : liveProfileIdentityCache; }
export function primeProfileIdentities(signals, sourceMode) { const cache = getProfileIdentityCache(sourceMode); [...new Set((signals || []).map((signal) => signal.counterparty).filter(Boolean))].forEach((address) => { cache.resolve(address).catch(() => {}); }); }
