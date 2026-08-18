import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { keccak256 } from 'viem';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { parseProfileDocumentV9Json } from '../domain/profileDocumentV9Validation.js';
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
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  const pointer = encodeDataSourceWithHash({ method: 'keccak256(bytes)', data: keccak256(bytes) }, `ipfs://${CID}`);
  return createLuksoPublishedProfileRepository({
    dataReader: async () => pointer,
    documentParser: parseProfileDocumentV9Json,
    fetchImpl: async () => stream(bytes),
    ipfsGateway: 'https://gateway.test/ipfs/',
  });
}

test('resolver seam can consume exact v9 bytes while preserving profile authority and routing behavior', async () => {
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

test('v9 resolver parser rejects a hash-valid v8-shaped document without migration', async () => {
  const result = await repositoryFor({ documentType: 'OS_UNDERNEATH_PROFILE', version: 8 }).resolve(PROFILE);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.INVALID);
  assert.equal(result.errorCode, 'INVALID_DOCUMENT');
});
