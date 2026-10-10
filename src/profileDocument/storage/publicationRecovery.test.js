import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicationJournal, publicationJournalKey } from './publicationJournal.js';
import { createPublicationRecovery } from './publicationRecovery.js';
import { createCanonicalPublication } from '../domain/profileDocumentPublication.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';

const profile = `0x${'1'.repeat(40)}`;
const other = `0x${'2'.repeat(40)}`;
const hash = `0x${'a'.repeat(64)}`;
const uri = 'ipfs://QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
function setup() {
  const entries = new Map();
  const storage = { getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
  const journal = createPublicationJournal({ getStorage: () => storage, now: () => 1 });
  const document = buildProfileDocumentV9({ profileAddress: profile, assetRecords: [],
    profileIdentity: { name: 'Test' }, documentId: 'profile:publication', revision: 1, createdAt: 1, exportedAt: 2,
    systemWorkflowDraft: createEmptySystemWorkflowDraft(profile, { generateId: () => 'home' }) });
  const artifact = createCanonicalPublication(document);
  return { entries, storage, journal, artifact, verified: { artifact, uri } };
}

test('journal survives a new instance, scopes by profile and retains only bounded public references', () => {
  const { journal, storage, verified } = setup();
  const reserved = journal.reserve({ ...verified, walletClient: { secret: 'never persist' } });
  const saved = journal.update(reserved, { transactionHash: hash, status: 'SUBMITTED' });
  const reloaded = createPublicationJournal({ getStorage: () => storage });
  assert.deepEqual(reloaded.read(profile), saved);
  assert.equal(reloaded.read(other), null);
  assert.ok(storage.getItem(publicationJournalKey(profile)).length < 1024);
  assert.doesNotMatch(storage.getItem(publicationJournalKey(profile)), /secret|wallet|snapshot|grids/i);
  assert.throws(() => reloaded.reserve(verified), /previous publication/);
  assert.throws(() => journal.remove(reserved), /another window/);
  reloaded.remove(saved);
  assert.equal(journal.read(profile), null);
});

test('unavailable, full, corrupt and cross-profile storage fail closed without overwriting', () => {
  const { journal, storage, entries, verified } = setup();
  for (const raw of ['broken json', 'x'.repeat(2049), JSON.stringify({ version: 1, profileAddress: other })]) {
    storage.setItem(publicationJournalKey(profile), raw);
    assert.throws(() => journal.reserve(verified));
    assert.equal(storage.getItem(publicationJournalKey(profile)), raw);
  }
  entries.clear();
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => journal.reserve(verified), /quota/);
  assert.throws(() => createPublicationJournal({ getStorage: () => { throw new Error('blocked'); } }).read(profile), /blocked/);
});

test('recovery requires both the exact receipt hash and the matching public document', async () => {
  const { journal, verified, artifact } = setup();
  const record = journal.update(journal.reserve(verified), { transactionHash: hash, status: 'SUBMITTED' });
  let receipt = { transactionHash: hash, status: 'success' };
  let resolved = { status: 'RESOLVED', document: artifact.document };
  const recover = createPublicationRecovery({ publicClient: { getTransactionReceipt: async () => receipt }, resolvePublished: async () => resolved });
  assert.equal((await recover(record)).status, 'PUBLISHED');
  receipt = { transactionHash: `0x${'b'.repeat(64)}`, status: 'success' };
  assert.equal((await recover(record)).status, 'UNKNOWN');
  receipt = { transactionHash: hash, status: 'reverted' };
  assert.equal((await recover(record)).status, 'FAILED');
  receipt.status = 'success';
  resolved = { status: 'ERROR' };
  assert.equal((await recover(record)).status, 'UNKNOWN');
  resolved = { status: 'RESOLVED', document: { ...artifact.document, profile: { ...artifact.document.profile, address: other } } };
  assert.equal((await recover(record)).status, 'UNKNOWN');
});

test('missing receipts can be rechecked, while hashless interruptions never issue network or wallet calls', async () => {
  const { journal, verified } = setup();
  const record = journal.reserve(verified);
  let reads = 0;
  const recover = createPublicationRecovery({ publicClient: { getTransactionReceipt: async () => { reads += 1; throw new Error('offline'); } }, resolvePublished: () => assert.fail('No document read without receipt') });
  assert.equal((await recover(record)).status, 'UNKNOWN');
  assert.equal(reads, 0);
  const submitted = journal.update(record, { transactionHash: hash, status: 'SUBMITTED' });
  assert.equal((await recover(submitted)).status, 'UNKNOWN');
  assert.equal((await recover(submitted)).status, 'UNKNOWN');
  assert.equal(reads, 2);
  assert.deepEqual(journal.read(profile), submitted);
});
