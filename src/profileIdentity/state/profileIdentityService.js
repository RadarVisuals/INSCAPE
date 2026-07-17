import { lsp3ProfileIdentityRepository } from '../data/lsp3ProfileIdentityRepository.js';
import { fixtureProfileIdentityRepository } from '../data/fixtureProfileIdentityRepository.js';
import { ProfileIdentityCache } from './profileIdentityCache.js';
export const liveProfileIdentityCache = new ProfileIdentityCache({ repository: lsp3ProfileIdentityRepository });
export const fixtureProfileIdentityCache = new ProfileIdentityCache({ repository: fixtureProfileIdentityRepository });
export function getProfileIdentityCache(sourceMode = 'LIVE') { return sourceMode === 'FIXTURE' ? fixtureProfileIdentityCache : liveProfileIdentityCache; }
export function primeProfileIdentities(signals, sourceMode) { const cache = getProfileIdentityCache(sourceMode); [...new Set((signals || []).map((signal) => signal.counterparty).filter(Boolean))].forEach((address) => { cache.resolve(address).catch(() => {}); }); }
