import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { canonicalSerializeProfileDocumentV9 } from '../domain/profileDocumentV9Serialization.js';
import { uploadProfileDocument } from './profileDocumentUploadClient.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const document = buildProfileDocumentV9({
  profileAddress: PROFILE, assetRecords: [], profileIdentity: { name: 'Upload client test' },
  createdAt: 1, exportedAt: 2,
  systemWorkflowDraft: createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' }),
});

test('upload client sends canonical bytes and validates the returned CID', async () => {
  let request;
  const result = await uploadProfileDocument(document, { fetchImpl: async (url, init) => {
    request = { url, init };
    return Response.json({ cid: CID }, { status: 201 });
  } });
  assert.equal(request.url, '/api/profile-publications');
  assert.equal(request.init.headers['content-type'], 'application/json');
  assert.equal(request.init.body, result.artifact.text);
  assert.equal(request.init.body, canonicalSerializeProfileDocumentV9(document));
  assert.equal(result.cid, CID);
  assert.equal(result.ipfsUri, `ipfs://${CID}`);
});

test('upload client does not accept a successful response without a valid CID', async () => {
  await assert.rejects(() => uploadProfileDocument(document, { fetchImpl: async () => Response.json({ cid: 'bad' }, { status: 201 }) }), /invalid IPFS CID/i);
});

test('upload client rejects v1-v8 and malformed payloads before the publication endpoint', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return Response.json({ cid: CID }, { status: 201 }); };
  for (let version = 1; version <= 8; version += 1) {
    await assert.rejects(() => uploadProfileDocument({ ...document, version }, { fetchImpl }));
  }
  for (const malformed of [null, {}, { documentType: 'INSCAPE_PROFILE', version: 9 }]) {
    await assert.rejects(() => uploadProfileDocument(malformed, { fetchImpl }));
  }
  assert.equal(calls, 0);
});

