import assert from 'node:assert/strict';
import test from 'node:test';
import { createFilledDisplayDraft, filledAssets, filledProfile } from '../../systemWorkflow/fixtures/displayFilledFixture.js';
import { createArticle } from '../../text/domain/article.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { createCanonicalPublication, publicationContentFingerprint } from '../domain/profileDocumentPublication.js';
import { INSCAPE_PROFILE_DOCUMENT_KEY } from '../domain/inscapeProfileDocumentKey.js';
import { publicReadingPages } from '../components/profileOverviewModel.js';
import { uploadProfileDocument } from './profileDocumentUploadClient.js';
import { createProfileDocumentPublisher } from './profileDocumentPublisher.js';
import { createLuksoPublishedProfileRepository } from './luksoPublishedProfileRepository.js';
import { createPinProfileDocumentHandler } from '../../../netlify/functions/pin-profile-document.mjs';

const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const ORIGIN = 'https://publication-flow.invalid';

test('current mixed modules pass the deployed upload handler, CID verification, publication and reader together', async () => {
  // Exercise the real application boundaries; only Pinata, RPC and wallet I/O
  // are replaced. No external upload or transaction can occur in this test.
  const draft = createFilledDisplayDraft();
  const build = () => buildProfileDocumentV9({ profileAddress: filledProfile,
    systemWorkflowDraft: draft, assetRecords: filledAssets, createdAt: 1, exportedAt: 2 });
  const asset = build().grids[0].placements.find(placement => placement.asset.media.type === 'image').asset;
  draft.imageModules = [{ id: 'image:flow', name: 'Two-sided work', width: 640, height: 480, visibility: 'PUBLIC',
    sides: ['front', 'back'].map(id => ({ id: `side:${id}`, asset: structuredClone(asset),
      crop: { x: .25, y: .75, zoom: 2 }, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } })) }];
  draft.texts = [{ id: 'text:flow', article: createArticle('Published essay'), visibility: 'PUBLIC' },
    { id: 'text:private', article: createArticle('Private fixture'), visibility: 'PRIVATE' }];
  draft.shapes = [{ id: 'shape:flow', name: 'Backdrop', color: '#123456', opacity: .6, grain: .2, visibility: 'PUBLIC' }];
  const before = structuredClone(draft);
  const document = build();
  const artifact = createCanonicalPublication(document);
  assert.doesNotMatch(artifact.text, /Private fixture|filled-private|text:private/);
  assert.equal(document.displays.length, 1);
  assert.equal(document.imageModules[0].sides.length, 2);
  assert.equal(document.texts.length, 1);
  assert.equal(document.shapes.length, 1);

  let uploadedBytes, uploadCalls = 0, walletCalls = 0, pointer = '0x';
  const handler = createPinProfileDocumentHandler({ getJwt: () => 'test-only-credential', fetchImpl: async (url, init) => {
    assert.equal(url, 'https://uploads.pinata.cloud/v3/files');
    uploadCalls += 1;
    uploadedBytes = new Uint8Array(await init.body.get('file').arrayBuffer());
    assert.deepEqual(uploadedBytes, artifact.bytes);
    return Response.json({ data: { cid: CID } }, { status: 201 });
  } });
  const uploaded = await uploadProfileDocument(document, { fetchImpl: async (url, init) =>
    handler(new Request(new URL(url, ORIGIN), { ...init, headers: { ...init.headers, origin: ORIGIN } })) });
  assert.equal(uploaded.ipfsUri, `ipfs://${CID}`);
  assert.equal(uploadCalls, 1);

  const gateway = async url => {
    assert.equal(url, `https://publication-gateway.invalid/ipfs/${CID}`);
    return new Response(uploadedBytes, { headers: { 'content-type': 'application/json' } });
  };
  const repository = createLuksoPublishedProfileRepository({ ipfsGateway: 'https://publication-gateway.invalid/ipfs/',
    fetchImpl: gateway, dataReader: async () => pointer });
  const transactionHash = `0x${'a'.repeat(64)}`;
  const context = { ownerAuthoringEnabled: true, isWalletConnected: true, isHostProfileOwner: true, chainId: 42,
    hostProfileAddress: filledProfile, workspaceProfileAddress: filledProfile, viewedProfileAddress: filledProfile,
    provider: {}, publicationContextGeneration: 1, snapshotGeneration: 1, draftGeneration: 1, cidGeneration: 1,
    cidInput: CID, snapshotArtifactHash: artifact.hash, snapshotContentFingerprint: publicationContentFingerprint(document),
    draftFingerprint: publicationContentFingerprint(document), snapshotStale: false,
    walletClient: { account: `0x${'3'.repeat(40)}`, writeContract: async call => {
      assert.equal(call.address, filledProfile);
      assert.equal(call.functionName, 'setData');
      assert.equal(call.args[0], INSCAPE_PROFILE_DOCUMENT_KEY);
      pointer = call.args[1]; walletCalls += 1; return transactionHash;
    } },
    publicClient: { waitForTransactionReceipt: async ({ hash }) => {
      assert.equal(hash, transactionHash); return { status: 'success' };
    } },
  };
  const publisher = createProfileDocumentPublisher({ getContext: () => context, fetchImpl: gateway,
    ipfsGateway: 'https://publication-gateway.invalid/ipfs/', resolvePublished: repository.resolve });
  const verified = await publisher.verifyCid(document, uploaded.cid);
  assert.equal(walletCalls, 0, 'upload and CID verification do not request a wallet write');
  const published = await publisher.publish(verified);
  assert.equal(walletCalls, 1);
  assert.equal(published.result.status, 'RESOLVED');
  assert.deepEqual(published.result.document, document);
  const pages = publicReadingPages(published.result.document);
  assert.equal(pages.filter(page => page.kind === 'composition').length, 2);
  assert.equal(pages.filter(page => page.kind === 'image').length, 2);
  assert.equal(pages.filter(page => page.kind === 'text').length, 1);
  assert.deepEqual(draft, before, 'publication does not mutate the authored draft');
});
