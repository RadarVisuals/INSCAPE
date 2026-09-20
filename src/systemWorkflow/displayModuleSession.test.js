import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { addDisplayModule, createDisplayModuleSession, setDisplayModuleFormat } from './displayModuleSession.js';
import { PRIMARY_DISPLAY_ID } from './domain/displayModules.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';

const profile = '0x001048331cd14cef40dd5da644a738e7324fe691';
function fixture() {
  const records = new Map();
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  return { store, storage };
}

test('render snapshots retain unchanged media, reject mutation and follow accepted edits and history', () => {
  const { store } = fixture();
  const session = createDisplayModuleSession(store, PRIMARY_DISPLAY_ID);
  const before = session.getSnapshot();
  const root = store.getSnapshot();
  session.selectGrid(before.draft.grids.at(-1).id);
  assert.equal(session.getSnapshot().draft, before.draft);
  assert.equal(store.getSnapshot(), root);
  assert.throws(() => { before.draft.grids[0].title = 'mutated'; }, TypeError);
  const candidate = session.getState().draft;
  candidate.grids[0].title = 'detached';
  assert.notEqual(session.getSnapshot().draft.grids[0].title, 'detached');
  session.createGrid();
  const edited = session.getSnapshot();
  assert.notEqual(edited.draft, before.draft);
  assert.equal(edited.draft.grids.length, before.draft.grids.length + 1);
  assert.equal(before.draft.grids, root.grids);
  assert.ok(store.undo());
  assert.deepEqual(session.getSnapshot().draft.grids, before.draft.grids);
  assert.ok(session.getSnapshot().draft.grids.some(g => g.id === session.getSnapshot().selectedGridId));
  assert.ok(store.redo());
  assert.deepEqual(session.getSnapshot().draft.grids, edited.draft.grids);
  const accepted = store.getSnapshot();
  assert.equal(store.commitCompletedOperation(store.getDraft(), { expectedGeneration: -1 }), false);
  assert.equal(store.getSnapshot(), accepted, 'rejected operations cannot replace the render snapshot');
  const otherProfile = '0x2222222222222222222222222222222222222222';
  assert.ok(store.setProfileAddress(otherProfile));
  assert.equal(session.getSnapshot().draft.profileAddress, otherProfile);
  assert.notEqual(session.getSnapshot().draft, edited.draft);
  assert.equal(edited.draft.profileAddress, profile, 'older views remain immutable after account changes');
});

test('snapshot projection cannot outlive removal of its Display or an unavailable reload', () => {
  const { store, storage } = fixture();
  const id = addDisplayModule(store);
  const session = createDisplayModuleSession(store, id);
  session.getSnapshot();
  const draft = store.getDraft();
  assert.ok(store.commitCompletedOperation({ ...draft, displays: [] }, { expectedGeneration: store.getGeneration() }));
  assert.throws(() => session.getSnapshot(), /no longer available/);
  storage.getItem = () => { throw new Error('unavailable'); };
  store.reload();
  assert.throws(() => store.getSnapshot(), /unavailable/);
  assert.throws(() => store.getDraft(), /unavailable/);
});
test('Display sessions edit independently through one storage generation', () => {
  const { store, storage } = fixture();
  const original = store.getDraft();
  const id = addDisplayModule(store, 'PORTRAIT');
  const primary = createDisplayModuleSession(store, PRIMARY_DISPLAY_ID);
  const portrait = createDisplayModuleSession(store, id);
  portrait.createGrid();
  assert.equal(store.getDraft().grids.length, original.grids.length);
  assert.equal(store.getDraft().displays[0].grids.length, 3);
  primary.createGrid();
  assert.equal(store.getDraft().grids.length, 3);
  assert.equal(store.getDraft().displays[0].grids.length, 3);
  assert.deepEqual(portrait.getState().draft.geometry, { columns: 18, rows: 32 });
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), store.getDraft());
});
test('Portrait changes preserve artwork geometry and old drafts need no rewrite', () => {
  const { store } = fixture();
  const session = createDisplayModuleSession(store, PRIMARY_DISPLAY_ID);
  session.placeAsset({ gridId: session.getState().selectedGridId, stableAssetId: '42:0x1111111111111111111111111111111111111111:0x01', nativeWidth: 800, nativeHeight: 400 });
  const original = store.getDraft();
  assert.equal(Object.hasOwn(original, 'displays'), false);
  setDisplayModuleFormat(store, PRIMARY_DISPLAY_ID, 'PORTRAIT');
  assert.deepEqual(store.getDraft().grids, original.grids);
  assert.deepEqual(store.getDraft().geometry, { columns: 18, rows: 32 });
  const generation = store.getGeneration();
  setDisplayModuleFormat(store, PRIMARY_DISPLAY_ID, 'PORTRAIT');
  assert.equal(store.getGeneration(), generation);
});
test('Publication omits private instances and recovers public orientation plus private work', () => {
  const { store } = fixture();
  const id = addDisplayModule(store, 'PORTRAIT');
  let draft = store.getDraft();
  const build = input => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: input });
  assert.deepEqual(build(draft).displays, []);
  draft.displays[0].visibility = 'PUBLIC';
  const published = build(draft);
  assert.equal(published.displays[0].id, id);
  assert.deepEqual(published.displays[0].artboard, { aspectWidth: 9, aspectHeight: 16 });
  assert.equal(published.displays[0].grids.some(grid => grid.id === 'grid:world-cover'), false);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(published);
  assert.deepEqual(restored.displays[0].geometry, draft.displays[0].geometry);
  assert.equal(restored.displays[0].grids.length, draft.displays[0].grids.length);
  const invalid = structuredClone(published); invalid.displays.push(structuredClone(invalid.displays[0]));
  assert.equal(validateProfileDocumentV9(invalid).valid, false);
});

test('an obsolete module session cannot recreate removed content', () => {
  const { store } = fixture();
  const id = addDisplayModule(store);
  const session = createDisplayModuleSession(store, id);
  const draft = store.getDraft();
  store.commitCompletedOperation({ ...draft, displays: [] }, { expectedGeneration: store.getGeneration() });
  const before = store.getDraft();
  assert.throws(() => session.createGrid(), /no longer available/);
  assert.deepEqual(store.getDraft(), before);
});

test('recovery retains private Grids from an omitted Display', () => {
  const { store } = fixture();
  const id = addDisplayModule(store);
  const draft = store.getDraft();
  draft.displays[0].visibility = 'PUBLIC';
  draft.displays[0].grids[0].visibility = 'PRIVATE';
  const published = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft });
  assert.deepEqual(published.displays, []);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(published, draft);
  assert.equal(restored.displays[0].id, id);
  assert.equal(restored.displays[0].grids[0].visibility, 'PRIVATE');
});
