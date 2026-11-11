import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { uploadProfileDocument } from '../src/profileDocument/storage/profileDocumentUploadClient.js';
import { createPinProfileDocumentHandler } from '../netlify/functions/pin-profile-document.mjs';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { memoryQuotaStore, uploadTestContext, uploadTestPolicy, uploadTestVerifier,
  UPLOAD_TEST_NOW, UPLOAD_TEST_ORIGIN } from './fixtures/publicationUpload.mjs';

const PROFILE = `0x${'1'.repeat(40)}`;
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';

test('local single-artwork Image publishes through challenge, signature and hosted upload without rewriting bytes', async () => {
  const draft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' });
  const asset = createProfileDocumentV9AssetResolver(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
    { compactContentReference: false })(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id);
  draft.imageModules = [{ id: 'image:publication', name: 'Artwork', width: 400, height: 400,
    visibility: 'PUBLIC', artwork: { id: 'artwork:publication', asset, crop: null,
      transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } } }];
  const document = buildProfileDocumentV9({ profileAddress: PROFILE, assetRecords: [],
    createdAt: 1, exportedAt: 2, systemWorkflowDraft: draft });
  const origin = 'http://localhost:5173';
  const context = uploadTestContext(document);
  const store = memoryQuotaStore();
  let uploadedBytes;
  const responses = [];
  const handler = createPinProfileDocumentHandler({ now: () => UPLOAD_TEST_NOW,
    getPolicy: uploadTestPolicy, getQuotaStore: () => store, verifySignature: uploadTestVerifier(PROFILE),
    getJwt: () => 'synthetic-test-credential', fetchImpl: async (_url, init) => {
      uploadedBytes = await init.body.get('file').text();
      return Response.json({ data: { cid: CID } });
    } });
  const result = await uploadProfileDocument(document, { origin,
    endpoint: `${UPLOAD_TEST_ORIGIN}/api/profile-publications`, getContext: () => context,
    now: () => UPLOAD_TEST_NOW, fetchImpl: async (url, init) => {
      const response = await handler(new Request(url, { ...init,
        headers: { ...init.headers, origin } }));
      responses.push({ status: response.status, origin: response.headers.get('access-control-allow-origin') });
      return response;
    } });
  assert.deepEqual(responses, [{ status: 200, origin }, { status: 201, origin }]);
  assert.equal(result.cid, CID);
  assert.equal(uploadedBytes, result.artifact.text);
  assert.deepEqual(JSON.parse(uploadedBytes).imageModules[0].artwork, document.imageModules[0].artwork);
});
