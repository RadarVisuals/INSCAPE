import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft, assertValidSystemWorkflowDraft } from './systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Validation.js';
import { createOwnerDraftFromPublishedProfile } from '../../profileDocument/storage/ownerDraftReconciliation.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { REMOVED_ARTWORK_PRESENTATION_KEYS } from './removedArtworkPresentation.js';
import { canonicalSerializeProfileDocumentV9, isCanonicalProfileDocumentV9Bytes } from '../../profileDocument/domain/profileDocumentV9Serialization.js';
import { createLuksoPublishedProfileRepository, PUBLISHED_PROFILE_STATUS } from '../../profileDocument/storage/luksoPublishedProfileRepository.js';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { keccak256 } from 'viem';

test('old presentation fields preserve immutable published bytes while new drafts and publications omit them', async () => {
  const profileAddress = '0x' + '1'.repeat(40);
  const draft = createEmptySystemWorkflowDraft(profileAddress, { generateId: () => 'home' });
  const legacy = { mat: { enabled: false, color: '#000000', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    frameId: 'DOSSIER', backing: { enabled: true, color: '#123456' }, transparencyMode: 'OPAQUE' };
  const artwork = { id: 'a', stableAssetId: OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id, column: 0, row: 0, columnSpan: 4, rowSpan: 4,
    layer: 0, navigationOrder: 0, crop: null, visibility: 'PUBLIC', locked: false, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };
  draft.grids[0].placements = [{ ...artwork, ...legacy }];
  draft.grids.find(grid => grid.id === 'grid:world-cover').placements = [{ ...artwork, id: 'cover', ...legacy }];
  const before = structuredClone(draft);
  const normalized = assertValidSystemWorkflowDraft(draft);
  assert.deepEqual(draft, before);
  assert.deepEqual(normalized.grids[0].placements[0], artwork);
  const published = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: draft, assetRecords: OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS });
  // Exercise old public bytes too, including the separately nested cover.
  Object.assign(published.grids[0].placements[0], legacy);
  Object.assign(published.metadata.worldCover.grid.placements[0], legacy);
  const publicBefore = structuredClone(published);
  const parsed = assertValidProfileDocumentV9(published);
  assert.deepEqual(published, publicBefore);
  assert.deepEqual(parsed, publicBefore, 'published content must survive validation exactly');
  const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
  const oldText = JSON.stringify(sorted(publicBefore));
  const bytes = new TextEncoder().encode(oldText);
  assert.equal(canonicalSerializeProfileDocumentV9(parsed), oldText);
  assert.equal(isCanonicalProfileDocumentV9Bytes(parsed, bytes), true);
  const pointer = encodeDataSourceWithHash({ method: 'keccak256(utf8)', data: keccak256(bytes) }, 'ipfs://QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw');
  const repository = createLuksoPublishedProfileRepository({ dataReader: async () => pointer,
    fetchImpl: async () => new Response(bytes, { headers: { 'content-type': 'application/json' } }), ipfsGateway: 'https://gateway.test/ipfs/' });
  const result = await repository.resolve(profileAddress);
  assert.equal(result.status, PUBLISHED_PROFILE_STATUS.RESOLVED);
  assert.equal(result.document.metadata.worldCover.grid.placements[0].asset.stableAssetId, artwork.stableAssetId);
  const restored = createOwnerDraftFromPublishedProfile(parsed);
  for (const grid of restored.grids) for (const placement of grid.placements) {
    for (const key of REMOVED_ARTWORK_PRESENTATION_KEYS) assert.equal(Object.hasOwn(placement, key), false);
  }
  assert.deepEqual(restored.grids[0].placements[0].transform, artwork.transform);
  assert.equal(restored.grids[0].placements[0].stableAssetId, artwork.stableAssetId);
  const invalid = structuredClone(before); invalid.grids[0].placements[0].mat.enabled = true;
  assert.throws(() => assertValidSystemWorkflowDraft(invalid), /removed artwork/);
});
