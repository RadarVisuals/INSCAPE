import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9Asset } from '../domain/profileDocumentV9Asset.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import {
  createOwnerDraftFromPublishedProfile,
  reconcileOwnerDraftWithPublishedProfile,
} from './ownerDraftReconciliation.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const retiredTrackingKey = profile => `inscape.owner-publication-baseline.v1:${profile}`;

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
  const source = {
      id: ASSET, chainId: 42, contractAddress: '0x2222222222222222222222222222222222222222',
      tokenId: '0x01', standard: 'LSP8', name: 'Published asset', description: '', collectionName: null,
      originalImageUrl: 'https://example.com/art.png', imageUrl: null, thumbnailUrl: null,
      imageWidth: 100, imageHeight: 100, creators: [], attributes: [],
    };
  draft.imageModules = [{ id: 'image:work', name: title, visibility: 'PUBLIC', width: 100, height: 100,
    artwork: { id: 'artwork:work', crop: null, transform: { mirrorX: false, mirrorY: false, quarterTurns: 0 },
      asset: buildProfileDocumentV9Asset(source, ASSET) } }];
  return buildProfileDocumentV9({
    createdAt: 1, exportedAt: revision + 1, profileAddress: PROFILE, profileIdentity: {}, revision,
    systemWorkflowDraft: draft,
  });
}

test('a published v9 document reconstructs a valid editable owner draft', () => {
  const draft = createOwnerDraftFromPublishedProfile(publication());
  assert.equal(draft.profileAddress, PROFILE);
  assert.equal(draft.imageModules[0].name, 'PUBLISHED HOME');
  assert.equal(draft.imageModules[0].artwork.asset.stableAssetId, ASSET);
  assert.equal(draft.imageModules[0].width, 100);
});

test('single-Workbench public reconciliation cannot replace any local composition in a collection', () => {
  const storage = memoryStorage();
  const store = createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage });
  store.createWorkbench('Private studies');
  const before = storage.getItem(systemWorkflowDraftKey(PROFILE));
  const result = reconcileOwnerDraftWithPublishedProfile({ document: publication(3), profileAddress: PROFILE, storage, store });
  assert.equal(result.status, 'LOCAL_CHANGES_PRESERVED');
  assert.equal(storage.getItem(systemWorkflowDraftKey(PROFILE)), before);
  assert.equal(store.listWorkbenches().length, 2);
});

test('a baseline-less origin preserves its existing local draft', () => {
  const old = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'old-home' });
  old.identityPresentation.alias = 'OLD LOCAL';
  const storage = memoryStorage({ [systemWorkflowDraftKey(PROFILE)]: JSON.stringify(old) });
  const store = createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage });
  const result = reconcileOwnerDraftWithPublishedProfile({ document: publication(), profileAddress: PROFILE, storage, store });
  assert.equal(result.status, 'LOCAL_CHANGES_PRESERVED');
  assert.equal(store.getDraft().identityPresentation.alias, 'OLD LOCAL');
});

test('local edits survive a newer publication until explicitly restored', () => {
  const storage = memoryStorage();
  const store = createSystemWorkflowDraftStore({
    generateGridId: () => 'initial-home',
    profileAddress: PROFILE,
    storage,
  });
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document: publication(), profileAddress: PROFILE, storage, store }).status,
    'HYDRATED_FROM_PUBLISHED');
  const edited = store.getDraft();
  edited.imageModules[0].name = 'UNPUBLISHED LOCAL EDIT';
  assert.equal(store.commitCompletedOperation(edited, { expectedGeneration: store.getGeneration() }), true);
  const result = reconcileOwnerDraftWithPublishedProfile({
    document: publication(2, 'NEWER PUBLISHED HOME'), profileAddress: PROFILE, storage, store,
  });
  assert.equal(result.status, 'LOCAL_CHANGES_PRESERVED');
  assert.equal(store.getDraft().imageModules[0].name, 'UNPUBLISHED LOCAL EDIT');
});

test('obsolete tracking metadata is never consulted to replace existing private work', () => {
  for (const denied of [false, true]) {
    const old = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'private' });
    const raw = JSON.stringify(old);
    const storage = memoryStorage({ [systemWorkflowDraftKey(PROFILE)]: raw, [retiredTrackingKey(PROFILE)]: '{broken' });
    const read = storage.getItem;
    if (denied) storage.getItem = key => { if (key === retiredTrackingKey(PROFILE)) throw Error('Denied'); return read(key); };
    const store = createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage });
    const result = reconcileOwnerDraftWithPublishedProfile({ document: publication(), profileAddress: PROFILE, storage, store });
    assert.equal(result.status, 'LOCAL_CHANGES_PRESERVED');
    assert.equal(storage.records.get(systemWorkflowDraftKey(PROFILE)), raw);
  }
});

test('initial hydration needs only the canonical save and never overwrites later edits', () => {
  const storage = memoryStorage();
  const write = storage.setItem;
  storage.setItem = (key, value) => { if (key === retiredTrackingKey(PROFILE)) throw Error('Denied'); write(key, value); };
  const store = createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage });
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document: publication(), profileAddress: PROFILE, storage, store }).status, 'HYDRATED_FROM_PUBLISHED');
  assert.equal(storage.getItem(retiredTrackingKey(PROFILE)), null);
  const edited = store.getDraft(); edited.imageModules[0].name = 'Private edits';
  store.commitCompletedOperation(edited, { expectedGeneration: store.getGeneration() });
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document: publication(2), profileAddress: PROFILE, storage, store }).status, 'LOCAL_CHANGES_PRESERVED');
  assert.equal(store.getDraft().imageModules[0].name, 'Private edits');
});

test('the storage restoration path retains alternate media and dimensions', () => {
  const document = publication();
  document.imageModules[0].artwork.asset.media = { type: 'image', url: 'https://example.com/alternate.png', width: 900, height: 600 };
  const storage = memoryStorage();
  const store = createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage });
  reconcileOwnerDraftWithPublishedProfile({ document, profileAddress: PROFILE, storage, store });
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage }).getDraft().imageModules[0].artwork.asset.media,
    { type: 'image', url: 'https://example.com/alternate.png', width: 900, height: 600 });
});

test('removing the local draft allows initial hydration again', () => {
  const storage = memoryStorage();
  const initialStore = createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage });
  reconcileOwnerDraftWithPublishedProfile({ document: publication(), profileAddress: PROFILE, storage, store: initialStore });
  storage.removeItem(systemWorkflowDraftKey(PROFILE));
  const store = createSystemWorkflowDraftStore({ profileAddress: PROFILE, storage });
  assert.equal(reconcileOwnerDraftWithPublishedProfile({ document: publication(), profileAddress: PROFILE, storage, store }).status,
    'HYDRATED_FROM_PUBLISHED');
  assert.equal(store.getDraft().imageModules[0].name, 'PUBLISHED HOME');
});
