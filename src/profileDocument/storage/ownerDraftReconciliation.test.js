import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import {
  createOwnerDraftFromPublishedProfile,
  reconcileOwnerDraftWithPublishedProfile,
} from './ownerDraftReconciliation.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';

function memoryStorage(initial = {}) {
  const records = new Map(Object.entries(initial));
  return {
    records,
    getItem(key) { return records.has(key) ? records.get(key) : null; },
    setItem(key, value) { records.set(key, value); },
    removeItem(key) { records.delete(key); },
  };
}

function publication(revision = 1, title = 'PUBLISHED HOME') {
  const draft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'published-home' });
  draft.grids[0].title = title;
  draft.grids[0].placements = [{
    id: 'placement:published', stableAssetId: ASSET, column: 2, row: 3, columnSpan: 4, rowSpan: 5,
    layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE',
    mat: { enabled: false, color: '#000000', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
    backing: { enabled: false, color: '#ffffff' }, transparencyMode: 'AUTO', visibility: 'PUBLIC',
    locked: true, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  }];
  return buildProfileDocumentV9({
    assetRecords: [{
      id: ASSET, chainId: 42, contractAddress: '0x2222222222222222222222222222222222222222',
      tokenId: '0x01', standard: 'LSP8', name: 'Published asset', description: '', collectionName: null,
      originalImageUrl: 'https://example.com/art.png', imageUrl: null, thumbnailUrl: null,
      imageWidth: 100, imageHeight: 100, creators: [], attributes: [],
    }],
    createdAt: 1, exportedAt: revision + 1, profileAddress: PROFILE, profileIdentity: {}, revision,
    systemWorkflowDraft: draft,
  });
}

test('a published v9 document reconstructs a valid editable owner draft', () => {
  const draft = createOwnerDraftFromPublishedProfile(publication());
  assert.equal(draft.profileAddress, PROFILE);
  assert.equal(draft.grids[0].title, 'PUBLISHED HOME');
  assert.equal(draft.grids[0].placements[0].stableAssetId, ASSET);
  assert.equal(draft.grids[0].placements[0].locked, false);
});

test('a baseline-less origin replaces its unrelated local draft from the verified publication', () => {
  const old = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'old-home' });
  old.grids[0].title = 'OLD LOCAL';
  const storage = memoryStorage({ [systemWorkflowDraftKey(PROFILE)]: JSON.stringify(old) });
  const store = createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage });
  const result = reconcileOwnerDraftWithPublishedProfile({ document: publication(), profileAddress: PROFILE, storage, store });
  assert.equal(result.status, 'HYDRATED_FROM_PUBLISHED');
  assert.equal(store.getDraft().grids[0].title, 'PUBLISHED HOME');
});

test('post-baseline local edits survive a newer publication until explicitly reconciled', () => {
  const storage = memoryStorage();
  const store = createSystemWorkflowDraftStore({
    generateGridId: () => 'initial-home',
    profileAddress: PROFILE,
    storage,
  });
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document: publication(), profileAddress: PROFILE, storage, store }).status,
    'HYDRATED_FROM_PUBLISHED');
  const edited = store.getDraft();
  edited.grids[0].subtitle = 'UNPUBLISHED LOCAL EDIT';
  assert.equal(store.commitCompletedOperation(edited, { expectedGeneration: store.getGeneration() }), true);
  const result = reconcileOwnerDraftWithPublishedProfile({
    document: publication(2, 'NEWER PUBLISHED HOME'), profileAddress: PROFILE, storage, store,
  });
  assert.equal(result.status, 'LOCAL_CHANGES_PRESERVED');
  assert.equal(store.getDraft().grids[0].subtitle, 'UNPUBLISHED LOCAL EDIT');
});
