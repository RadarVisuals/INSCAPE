import test from 'node:test';
import assert from 'node:assert/strict';
import { validReception, saveReceptionSelection } from './receptionPresentation.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { addImageModule, saveImageModule } from '../../imageModule/imageModuleSession.js';
import { validImageModules } from '../../imageModule/imageModule.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from './profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from './profileDocumentV9Reconciliation.js';
import { createProfileDocumentV9AssetResolver } from './profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
const profile = `0x${'1'.repeat(40)}`;
const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[0].id);
function fixture() {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addImageModule(store, profile);
  const empty = store.getDraft().imageModules[0];
  assert.ok(saveImageModule(store, profile, empty, { ...empty, visibility: 'PUBLIC', sides: [{ id: 'side:one', asset, crop: { x: .3, y: .5, zoom: 2 },
    transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } }] }));
  return { store, storage, fail: value => { fail = value; } };
}
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });
test('reception crops round-trip without modifying canvas crop, source, orientation or legacy data', () => {
  const { store, storage } = fixture(), legacy = store.getDraft(), original = legacy.imageModules[0];
  assert.equal(Object.hasOwn(publish(legacy).imageModules[0].sides[0], 'receptionCrop'), false);
  const next = structuredClone(original); next.sides[0].receptionCrop = { x: .7, y: .4, zoom: 2.4 };
  assert.ok(saveImageModule(store, profile, original, next));
  const saved = store.getDraft(), document = publish(saved);
  assert.deepEqual(document.imageModules[0].sides, next.sides);
  assert.deepEqual(next.sides[0].crop, original.sides[0].crop);
  assert.deepEqual(next.sides[0].asset, original.sides[0].asset);
  assert.deepEqual(next.sides[0].transform, original.sides[0].transform);
  assert.equal(countProfileDocumentV9Assets(document), countProfileDocumentV9Assets(publish(legacy)));
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document).imageModules[0], next);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), saved);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), legacy); assert.ok(store.redo()); assert.deepEqual(store.getDraft(), saved);
});
test('curation is explicit, ordered, restored and filters private or deleted modules from publication', () => {
  const { store } = fixture();
  const id = store.getDraft().imageModules[0].id;
  const privateId = addImageModule(store, profile);
  assert.ok(saveReceptionSelection(store, profile, undefined, [id, privateId, 'image:deleted', 'display:primary']));
  const document = publish(store.getDraft());
  assert.deepEqual(document.reception.items, [id, 'display:primary']);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(document).reception, document.reception);
  assert.ok(saveReceptionSelection(store, profile, store.getDraft().reception, []));
  assert.deepEqual(publish(store.getDraft()).reception.items, []);
  const invalid = structuredClone(document); invalid.reception.items.push(privateId);
  assert.throws(() => assertValidProfileDocumentV9(invalid));
});
test('selection rejects stale, wrong-profile and failed writes without changing saved content', () => {
  const f = fixture(), id = f.store.getDraft().imageModules[0].id;
  assert.equal(saveReceptionSelection(f.store, `0x${'2'.repeat(40)}`, undefined, [id]), false);
  assert.ok(saveReceptionSelection(f.store, profile, undefined, [id]));
  const before = f.store.getDraft();
  assert.equal(saveReceptionSelection(f.store, profile, undefined, []), false);
  f.fail(true); assert.equal(saveReceptionSelection(f.store, profile, before.reception, []), false);
  assert.deepEqual(f.store.getDraft(), before);
});
test('invalid crop and curation values cannot enter draft or public image records', () => {
  const { store } = fixture(), item = store.getDraft().imageModules[0];
  for (const crop of [{ x: 0, y: .5, zoom: 5 }, { x: NaN, y: .5, zoom: 1 }, { x: .5, y: .5, zoom: 1, other: true }, 'crop']) {
    const next = structuredClone(item); next.sides[0].receptionCrop = crop;
    assert.equal(validImageModules([next]), false);
    const { visibility, ...published } = next; assert.equal(validImageModules([published], true), false);
  }
  for (const value of [{ version: 1, items: ['image:a', 'image:a'] }, { version: 2, items: [] }, { version: 1, items: ['../file'] }, { version: 1, items: [], extra: true }]) assert.equal(validReception(value), false);
});
