import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { validateSystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { canonicalSerializeProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Serialization.js';
import { openMobileModule, updateMobileModule } from './mobileSession.js';
import { createMobilePresentation, validMobilePresentation } from './domain/mobilePresentation.js';
import { MOBILE_FOUNDER_PROFILE } from './domain/customPresentation.js';

const profile = '0x1111111111111111111111111111111111111111';
const contractAddress = '0x2222222222222222222222222222222222222222';
const id = `42:${contractAddress}:0x01`;
const asset = { id, chainId: 42, contractAddress, tokenId: '0x01', standard: 'LSP8', name: 'Source title', description: 'Source description',
  imageUrl: 'https://example.com/asset.webp', imageWidth: 1080, imageHeight: 1920 };
function setup() {
  const map = new Map(), storage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  return { storage, store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
}
test('Mobile is optional; drafts reload and private content never enters publication', () => {
  const { store, storage } = setup(), old = store.getDraft();
  const oldDoc = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: old });
  const oldBytes = canonicalSerializeProfileDocumentV9(oldDoc);
  assert.equal(Object.hasOwn(old, 'mobile'), false);
  assert.equal(validateSystemWorkflowDraft(old).valid, true);
  openMobileModule(store);
  assert.equal(store.getDraft().mobile.visibility, 'PRIVATE');
  updateMobileModule(store, profile, c => ({ ...c, index: { ...c.index, title: 'My work' } }));
  const reloaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft();
  assert.equal(reloaded.mobile.index.title, 'My work');
  assert.deepEqual(reloaded.grids, old.grids);
  assert.equal(Object.hasOwn(buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: reloaded }), 'mobile'), false);
  assert.equal(canonicalSerializeProfileDocumentV9(JSON.parse(oldBytes)), oldBytes);
});
test('public projection resolves source metadata, strips editor state, restores without duplicating assets', () => {
  const { store } = setup(); openMobileModule(store);
  const ref = { stableAssetId: id, selectedMedia: null };
  updateMobileModule(store, profile, c => ({ ...c, visibility: 'PUBLIC', front: { ...c.front, artwork: ref, mask: ref },
    index: { ...c.index, entries: [{ id: 'mobile-entry:first', asset: ref }] } }));
  assert.throws(() => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: store.getDraft() }), /asset/i);
  const doc = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: store.getDraft(), assetRecords: [asset] });
  assert.equal(doc.mobile.index.entries[0].asset.name, 'Source title');
  assert.equal(Object.hasOwn(doc.mobile, 'editor'), false);
  assert.equal(Object.hasOwn(doc.mobile, 'visibility'), false);
  assert.equal(validateProfileDocumentV9(doc).valid, true);
  const recovered = reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, store.getDraft());
  assert.equal(recovered.mobile.front.artwork.stableAssetId, id);
  assert.equal(Object.hasOwn(recovered.mobile.front.artwork, 'name'), false);
  assert.equal(validateSystemWorkflowDraft(recovered).valid, true);
  const legacy = structuredClone(doc); delete legacy.mobile;
  const retained = reconcileSystemWorkflowDraftFromProfileDocumentV9(legacy, store.getDraft());
  assert.equal(retained.mobile.visibility, 'PRIVATE');
  assert.equal(retained.mobile.index.entries.length, 1);
  const tampered = structuredClone(doc); tampered.mobile.editor = { open: true };
  assert.equal(validateProfileDocumentV9(tampered).valid, false);
});
test('failed saves and stale profile actions cannot report success or overwrite the draft', () => {
  const { store, storage } = setup(); openMobileModule(store); const before = store.getDraft();
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(updateMobileModule(store, profile, c => ({ ...c, theme: 'light' })), false);
  assert.deepEqual(store.getDraft(), before);
  assert.equal(updateMobileModule(store, contractAddress, c => ({ ...c, theme: 'light' })), false);
});
test('template boundary rejects scripts, unsupported schemas, duplicate entries, unsafe geometry and URLs', () => {
  for (const mutate of [v => { v.version = 2; }, v => { v.script = 'alert(1)'; }, v => { v.canvas.width = 2000; },
    v => { v.front.positions.name.x = Infinity; }, v => { v.front.image.scale = -1; },
    v => { v.front.artwork = { stableAssetId: id, selectedMedia: { url: 'javascript:alert(1)', width: 10, height: 10 } }; },
    v => { v.index.entries = Array.from({ length: 2 }, () => ({ id: 'mobile-entry:duplicate', asset: { stableAssetId: id, selectedMedia: null } })); }]) {
    const input = createMobilePresentation(); mutate(input); assert.equal(validMobilePresentation(input), false);
  }
});

test('the curated Steyra renderer is scoped to the founder in drafts and publications', () => {
  const { store } = setup(); openMobileModule(store);
  const draft = structuredClone(store.getDraft()); draft.mobile.front.renderer = 'steyra';
  assert.equal(validateSystemWorkflowDraft(draft).valid, false);
  const founder = createSystemWorkflowDraftStore({ profileAddress: MOBILE_FOUNDER_PROFILE, storage: setup().storage });
  openMobileModule(founder);
  assert.equal(updateMobileModule(founder, MOBILE_FOUNDER_PROFILE, c => ({ ...c, visibility: 'PUBLIC', front: { ...c.front, renderer: 'steyra' } })), true);
  const doc = buildProfileDocumentV9({ profileAddress: MOBILE_FOUNDER_PROFILE, systemWorkflowDraft: founder.getDraft() });
  assert.equal(validateProfileDocumentV9(doc).valid, true);
  doc.profile.address = profile;
  assert.equal(validateProfileDocumentV9(doc).valid, false);
});
