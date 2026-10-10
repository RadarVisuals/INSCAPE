import { LUKSO_INDEXER_URL, normalizeProfileAddress } from '../../library/config.js';
import { selectProfileAvatar } from '../../profileIdentity/domain/profileIdentity.js';
import { isPublishedProfilePointerValue } from '../../profileDocument/storage/luksoPublishedProfileRepository.js';
import { INSCAPE_PROFILE_DOCUMENT_KEY } from '../../profileDocument/domain/inscapeProfileDocumentKey.js';

// DataChanged is the indexed ERC725Y publication event. The emitter address is
// the Universal Profile; custom keys are not populated in the profile_id field.
export const PROFILE_DIRECTORY_QUERY = `query InscapeDirectory($key: String!, $limit: Int!, $offset: Int!) {
  DataChanged(
    distinct_on: address
    where: { key: { _eq: $key } }
    order_by: [{ address: asc }, { blockNumber: desc }, { logIndex: desc }]
    limit: $limit
    offset: $offset
  ) {
    address
    value
    blockNumber
    logIndex
    transactionHash
  }
}`;

export const PROFILE_DIRECTORY_IDENTITIES_QUERY = `query InscapeDirectoryProfiles($addresses: [String!]!) {
  Profile(where: { id: { _in: $addresses } }) {
    id
    name
    fullName
    profileImages(where: { error: { _is_null: true } } order_by: { width: asc }) {
      width
      src
      url
      verified
    }
  }
}`;

const clean = (value, limit = 80) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, limit)
  : '';

function normalizeIndexerProfile(profile) {
  const address = normalizeProfileAddress(profile?.id);
  if (!address) return null;
  return { address, name: clean(profile.name) || clean(profile.fullName) || null,
    avatarUrl: selectProfileAvatar(profile.profileImages), isUniversalProfile: true,
    status: 'PUBLISHED', source: 'LUKSO Envio Indexer' };
}

export function createLuksoProfileDiscoveryRepository({ endpoint = LUKSO_INDEXER_URL, fetchImpl = globalThis.fetch,
  directoryPageSize = 200, maximumDirectoryPages = 50, cacheTtlMs = 60_000, now = () => Date.now() } = {}) {
  const request = async (query, variables, signal) => {
    const response = await fetchImpl(endpoint, { method: 'POST', signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }) });
    if (!response.ok) throw new Error(`LUKSO indexer responded ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(payload.errors[0]?.message || 'INSCAPE directory failed');
    return payload.data;
  };
  let cachedProfiles = null; let cachedAt = 0;
  return { source: 'LUKSO Envio Indexer', async list({ signal } = {}) {
    if (cachedProfiles && now() - cachedAt < cacheTtlMs) return cachedProfiles.map((profile) => ({ ...profile }));
    const indexedPublications = [];
    for (let page = 0; page < maximumDirectoryPages; page += 1) {
      const directory = await request(PROFILE_DIRECTORY_QUERY,
        { key: INSCAPE_PROFILE_DOCUMENT_KEY, limit: directoryPageSize, offset: page * directoryPageSize }, signal);
      if (!Array.isArray(directory?.DataChanged)) throw new Error('Invalid INSCAPE directory response');
      indexedPublications.push(...directory.DataChanged);
      if (directory.DataChanged.length < directoryPageSize) break;
      if (page === maximumDirectoryPages - 1) throw new Error('INSCAPE directory exceeds its safe retrieval bound');
    }
    const publications = indexedPublications.filter((event) => normalizeProfileAddress(event?.address)
      && isPublishedProfilePointerValue(event?.value));
    const addresses = publications.map((event) => normalizeProfileAddress(event.address));
    if (!addresses.length) return [];
    const indexedProfiles = [];
    for (let offset = 0; offset < addresses.length; offset += directoryPageSize) {
      const identities = await request(PROFILE_DIRECTORY_IDENTITIES_QUERY,
        { addresses: addresses.slice(offset, offset + directoryPageSize) }, signal);
      if (!Array.isArray(identities?.Profile)) throw new Error('Invalid INSCAPE identity response');
      indexedProfiles.push(...identities.Profile);
    }
    const byAddress = new Map(indexedProfiles.map(normalizeIndexerProfile).filter(Boolean)
      .map((profile) => [profile.address, profile]));
    const profiles = publications.map((event) => {
      const address = normalizeProfileAddress(event.address); const profile = byAddress.get(address);
      return profile ? { ...profile, publicationBlock: Number(event.blockNumber) || null,
        publicationTransactionHash: clean(event.transactionHash, 66) || null } : null;
    }).filter(Boolean).sort((a, b) => (b.publicationBlock || 0) - (a.publicationBlock || 0));
    cachedProfiles = profiles.map((profile) => ({ ...profile })); cachedAt = now();
    return profiles;
  } };
}

export const luksoProfileDiscoveryRepository = createLuksoProfileDiscoveryRepository();
