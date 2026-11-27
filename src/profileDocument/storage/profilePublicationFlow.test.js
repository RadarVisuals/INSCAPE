import assert from 'node:assert/strict';
import test from 'node:test';
import { keccak256 } from 'viem';
import { createBlankWorkbenchDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9Asset } from '../domain/profileDocumentV9Asset.js';
import { filledAssets, filledProfile } from '../../systemWorkflow/fixtures/reviewPublicationAssets.js';
import { createArticle } from '../../text/domain/article.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { createCanonicalPublication, encodeProfileDocumentVerifiableUri, publicationContentFingerprint } from '../domain/profileDocumentPublication.js';
import { INSCAPE_PROFILE_DOCUMENT_KEY } from '../domain/inscapeProfileDocumentKey.js';
import { resolvePublicCanvasTarget } from '../components/profileOverviewModel.js';
import { uploadProfileDocument } from './profileDocumentUploadClient.js';
import { createProfileDocumentPublisher } from './profileDocumentPublisher.js';
import { createLuksoPublishedProfileRepository } from './luksoPublishedProfileRepository.js';
import { createPinProfileDocumentHandler } from '../../../netlify/functions/pin-profile-document.mjs';
import { memoryQuotaStore, uploadTestContext, uploadTestPolicy, uploadTestVerifier, UPLOAD_TEST_NOW } from '../../../scripts/fixtures/publicationUpload.mjs';
import { createWorkbenchCollection, appendWorkbench } from '../../systemWorkflow/domain/workbenchCollection.js';
import { buildCanvasPublication, canvasPublicationCandidates, resolvePublicationBaseline } from '../domain/canvasPublication.js';

const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const ORIGIN = 'https://publication-flow.invalid';

for (const collectionMode of [false, true]) test(`current mixed modules pass upload, CID, publication and read-back (collection: ${collectionMode})`, async () => {
  // Exercise the real application boundaries; only Pinata, RPC and wallet I/O
  // are replaced. No external upload or transaction can occur in this test.
  const draft = createBlankWorkbenchDraft(filledProfile);
  const build = () => buildProfileDocumentV9({ profileAddress: filledProfile,
    systemWorkflowDraft: draft, assetRecords: filledAssets, createdAt: 1, exportedAt: 2 });
  const asset = buildProfileDocumentV9Asset(filledAssets[0], filledAssets[0].id);
  draft.imageModules = [{ id: 'image:flow', name: 'Published image', width: 640, height: 480, visibility: 'PUBLIC',
    artwork: { id: 'artwork:flow', asset: structuredClone(asset),
      crop: { x: .25, y: .75, zoom: 2 }, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } } }];
  draft.texts = [{ id: 'text:flow', article: createArticle('Published essay'), visibility: 'PUBLIC' },
    { id: 'text:private', article: createArticle('Private fixture'), visibility: 'PRIVATE' }];
  draft.shapes = [{ id: 'shape:flow', name: 'Backdrop', color: '#123456', opacity: .6, grain: .2, visibility: 'PUBLIC' }];
  const before = structuredClone(draft);
  const record = appendWorkbench(createWorkbenchCollection(draft), 'workbench:second', 'Second composition', draft);
  // Exercise the replacement with a real, hash-matching IPFS document whose
  // retired metadata makes it invalid under the current profile schema.
  const gatewayUrl = 'https://publication-gateway.invalid/ipfs/';
  const oldCid = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQx';
  const oldBytes = new TextEncoder().encode(JSON.stringify({ ...build(), revision: 8, metadata: {} }));
  let uploadedBytes;
  let pointer = collectionMode ? encodeProfileDocumentVerifiableUri(oldCid, keccak256(oldBytes)) : '0x';
  const gateway = async url => {
    if (url === gatewayUrl + oldCid) return new Response(oldBytes);
    assert.equal(url, gatewayUrl + CID);
    return new Response(uploadedBytes, { headers: { 'content-type': 'application/json' } });
  };
  const repository = createLuksoPublishedProfileRepository({ ipfsGateway: gatewayUrl,
    fetchImpl: gateway, dataReader: async () => pointer });
  const baseline = await repository.resolve(filledProfile);
  if (collectionMode) assert.equal(baseline.errorCode, 'INVALID_DOCUMENT');
  const previousDocument = resolvePublicationBaseline(baseline, filledProfile, { replaceInvalid: collectionMode });
  const document = collectionMode ? buildCanvasPublication({ candidates: canvasPublicationCandidates({ record, assetRecords: filledAssets }),
    selectedIds: ['workbench:main', 'workbench:second'], includeShared: true, previousDocument }) : build();
  if (collectionMode) assert.equal(document.revision, 1);
  const artifact = createCanonicalPublication(document);
  assert.doesNotMatch(artifact.text, /Private fixture|filled-private|text:private/);
  assert.equal(Object.hasOwn(document, 'displays'), false);
  assert.deepEqual(document.imageModules[0].artwork, draft.imageModules[0].artwork);
  assert.equal(document.texts.length, 1);
  assert.equal(document.shapes.length, 1);

  let uploadCalls = 0, walletCalls = 0, signatureCalls = 0;
  const uploadContext = uploadTestContext(document);
  const { account: controller, signMessage } = uploadContext.walletClient;
  assert.notEqual(controller.toLowerCase(), filledProfile.toLowerCase());
  uploadContext.walletClient.signMessage = async request => {
    assert.equal(request.account, controller);
    signatureCalls += 1;
    return signMessage(request);
  };
  const store = memoryQuotaStore();
  const handler = createPinProfileDocumentHandler({ now: () => UPLOAD_TEST_NOW, getPolicy: () => uploadTestPolicy(),
    getQuotaStore: () => store, verifySignature: uploadTestVerifier(filledProfile),
    getJwt: () => 'test-only-credential', fetchImpl: async (url, init) => {
    assert.equal(url, 'https://uploads.pinata.cloud/v3/files');
    uploadCalls += 1;
    uploadedBytes = new Uint8Array(await init.body.get('file').arrayBuffer());
    assert.deepEqual(uploadedBytes, artifact.bytes);
    return Response.json({ data: { cid: CID } }, { status: 201 });
  } });
  const uploaded = await uploadProfileDocument(document, { origin: ORIGIN, now: () => UPLOAD_TEST_NOW, getContext: () => uploadContext,
    fetchImpl: async (url, init) =>
    handler(new Request(new URL(url, ORIGIN), { ...init, headers: { ...init.headers, origin: ORIGIN } })) });
  assert.equal(uploaded.ipfsUri, `ipfs://${CID}`);
  assert.equal(uploadCalls, 1);

  const transactionHash = `0x${'a'.repeat(64)}`;
  const context = { ownerAuthoringEnabled: true, isWalletConnected: true, isHostProfileOwner: true, chainId: 42,
    hostProfileAddress: filledProfile, workspaceProfileAddress: filledProfile, viewedProfileAddress: filledProfile,
    provider: {}, publicationContextGeneration: 1, snapshotGeneration: 1, draftGeneration: 1, cidGeneration: 1,
    cidInput: CID, snapshotArtifactHash: artifact.hash, snapshotContentFingerprint: publicationContentFingerprint(document),
    draftFingerprint: publicationContentFingerprint(document), snapshotStale: false,
    walletClient: { account: controller, writeContract: async call => {
      assert.equal(call.account, controller);
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
  assert.equal(signatureCalls, 1);
  assert.equal(published.result.status, 'RESOLVED');
  assert.deepEqual(published.result.document, document);
  if (collectionMode) assert.equal(published.result.document.canvases[0].name, 'Second composition');
  for (const moduleId of ['image:flow', 'text:flow']) {
    assert.deepEqual(resolvePublicCanvasTarget(published.result.document, { moduleId }), { moduleId });
  }
  assert.equal(resolvePublicCanvasTarget(published.result.document, { moduleId: 'text:private' }), null);
  assert.deepEqual(draft, before, 'publication does not mutate the authored draft');
});
