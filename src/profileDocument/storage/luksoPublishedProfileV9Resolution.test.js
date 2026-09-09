import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { keccak256 } from 'viem';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { canonicalSerializeProfileDocumentV9 } from '../domain/profileDocumentV9Serialization.js';
import {
  PUBLISHED_PROFILE_STATUS,
  createLuksoPublishedProfileRepository,
} from './luksoPublishedProfileRepository.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';

function stream(bytes) {
  return new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function repositoryFor(document) {
  const text = document?.version === 9 ? canonicalSerializeProfileDocumentV9(document) : JSON.stringify(document);
  const bytes = new TextEncoder().encode(text);
  const pointer = encodeDataSourceWithHash({ method: 'keccak256(utf8)', data: keccak256(bytes) }, `ipfs://${CID}`);
  return createLuksoPublishedProfileRepository({
    dataReader: async () => pointer,
    fetchImpl: async () => stream(bytes),
    ipfsGateway: 'https://gateway.test/ipfs/',
  });
}

test('default resolver consumes exact v9 bytes while preserving profile authority and routing behavior', async () => {
  const draft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  const document = buildProfileDocumentV9({
    assetRecords: [], createdAt: 1, exportedAt: 2, profileAddress: PROFILE,
    profileIdentity: { name: 'Resolved v9' }, systemWorkflowDraft: draft,
  });
  const result = await repositoryFor(document).resolve(PROFILE);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  assert.deepEqual(result.document, document);

  const mismatch = structuredClone(document);
  mismatch.profile.address = '0x3333333333333333333333333333333333333333';
  mismatch.profile.cachedIdentity.address = mismatch.profile.address;
  const mismatchResult = await repositoryFor(mismatch).resolve(PROFILE);
  assert.equal(mismatchResult.status, PUBLISHED_PROFILE_STATUS.INVALID);
  assert.equal(mismatchResult.errorCode, 'PROFILE_MISMATCH');
});

test('v9 resolver parser rejects every hash-valid v1-v8 shape without migration', async () => {
  for (let version = 1; version <= 8; version += 1) {
    const result = await repositoryFor({ documentType: 'OS_UNDERNEATH_PROFILE', version }).resolve(PROFILE);
    assert.equal(result.status, PUBLISHED_PROFILE_STATUS.INVALID);
    assert.equal(result.errorCode, 'INVALID_DOCUMENT');
  }
});

test('v9 resolver rejects hash-valid formatted and reordered documents as noncanonical', async () => {
  const document = buildProfileDocumentV9({
    assetRecords: [], createdAt: 1, exportedAt: 2, profileAddress: PROFILE,
    profileIdentity: { name: 'Canonical v9' },
    systemWorkflowDraft: createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' }),
  });
  const { metadata, ...rest } = document;
  for (const text of [JSON.stringify(document, null, 2), JSON.stringify({ metadata, ...rest })]) {
    assert.notEqual(text, canonicalSerializeProfileDocumentV9(document));
    const bytes = new TextEncoder().encode(text);
    const pointer = encodeDataSourceWithHash({ method: 'keccak256(utf8)', data: keccak256(bytes) }, `ipfs://${CID}`);
    const repository = createLuksoPublishedProfileRepository({
      dataReader: async () => pointer,
      fetchImpl: async () => stream(bytes),
      ipfsGateway: 'https://gateway.test/ipfs/',
    });
    const result = await repository.resolve(PROFILE);
    assert.equal(result.status, PUBLISHED_PROFILE_STATUS.INVALID);
    assert.equal(result.errorCode, 'NON_CANONICAL_DOCUMENT');
  }
});

test('v9 resolver rejects hash-valid UTF-8 BOM-prefixed canonical JSON bytes', async () => {
  const document = buildProfileDocumentV9({
    assetRecords: [], createdAt: 1, exportedAt: 2, profileAddress: PROFILE,
    profileIdentity: { name: 'Canonical v9' },
    systemWorkflowDraft: createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' }),
  });
  const canonicalBytes = new TextEncoder().encode(canonicalSerializeProfileDocumentV9(document));
  const bytes = new Uint8Array(canonicalBytes.byteLength + 3);
  bytes.set([0xef, 0xbb, 0xbf]);
  bytes.set(canonicalBytes, 3);
  const pointer = encodeDataSourceWithHash({ method: 'keccak256(utf8)', data: keccak256(bytes) }, `ipfs://${CID}`);
  const repository = createLuksoPublishedProfileRepository({
    dataReader: async () => pointer,
    fetchImpl: async () => stream(bytes),
    ipfsGateway: 'https://gateway.test/ipfs/',
  });

  const result = await repository.resolve(PROFILE);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.INVALID);
  assert.equal(result.errorCode, 'NON_CANONICAL_DOCUMENT');
});
