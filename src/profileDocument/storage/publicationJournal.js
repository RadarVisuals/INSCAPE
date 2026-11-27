import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../../library/config.js';
import { normalizeProfileDocumentCid } from '../domain/profileDocumentPublication.js';

export function publicationJournalKey(profileAddress) {
  const address = normalizeProfileAddress(profileAddress);
  if (!address) throw new Error('Invalid publication profile');
  return `inscape:publication:v1:${LUKSO_CHAIN_ID}:${address}`;
}

function validate(value, profileAddress) {
  if (value?.version !== 1 || value.chainId !== LUKSO_CHAIN_ID
    || value.profileAddress !== normalizeProfileAddress(profileAddress)
    || !/^0x[\da-f]{64}$/i.test(value.artifactHash)
    || !['SUBMITTING', 'SUBMITTED', 'FAILED'].includes(value.status)
    || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0
    || (value.transactionHash !== null && !/^0x[\da-f]{64}$/i.test(value.transactionHash))
    || (value.status === 'SUBMITTED' && !value.transactionHash)
    || normalizeProfileDocumentCid(value.uri) !== value.uri) {
    throw new Error('The local publication record is invalid; it has been preserved.');
  }
  // Whitelist: never retain snapshots, wallet clients, controller details or provider errors.
  return { version: 1, chainId: LUKSO_CHAIN_ID, profileAddress: value.profileAddress,
    artifactHash: value.artifactHash, uri: value.uri, transactionHash: value.transactionHash,
    status: value.status, createdAt: value.createdAt };
}

export function createPublicationJournal({ getStorage = () => globalThis.localStorage, now = Date.now } = {}) {
  function storage() {
    const target = getStorage();
    if (!target) throw new Error('Local publication recovery storage is unavailable.');
    return target;
  }
  function read(profileAddress) {
    const raw = storage().getItem(publicationJournalKey(profileAddress));
    if (raw === null) return null;
    if (raw.length > 2048) throw new Error('The local publication record is invalid; it has been preserved.');
    return validate(JSON.parse(raw), profileAddress);
  }
  function replace(previous, next) {
    const current = read(previous.profileAddress);
    if (JSON.stringify(current) !== JSON.stringify(previous)) throw new Error('Publication recovery changed in another window. Reopen Publish.');
    const target = storage(); const key = publicationJournalKey(previous.profileAddress);
    if (next === null) target.removeItem(key);
    else target.setItem(key, JSON.stringify(validate(next, previous.profileAddress)));
    return next;
  }
  return {
    read,
    runExclusive(profileAddress, operation) {
      const locks = globalThis.navigator?.locks;
      if (!locks?.request) return operation();
      return locks.request(publicationJournalKey(profileAddress), { ifAvailable: true }, (lock) => {
        if (!lock) throw new Error('Another window is already publishing this profile.');
        return operation();
      });
    },
    reserve(verified) {
      const profileAddress = verified.artifact.document.profile.address;
      if (read(profileAddress)) throw new Error('Check the previous publication before starting another wallet request.');
      const record = validate({ version: 1, chainId: LUKSO_CHAIN_ID, profileAddress,
        artifactHash: verified.artifact.hash, uri: verified.uri, transactionHash: null,
        status: 'SUBMITTING', createdAt: now() }, profileAddress);
      storage().setItem(publicationJournalKey(profileAddress), JSON.stringify(record));
      return record;
    },
    update: (previous, fields) => replace(previous, { ...previous, ...fields }),
    remove: (previous) => replace(previous, null),
  };
}

export const publicationJournal = createPublicationJournal();
