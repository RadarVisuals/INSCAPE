import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { editWorkbenchGroups } from '../../systemWorkflow/workbenchGroupSession.js';
import { addShape } from '../../shapes/shapeSession.js';
import { addDisplayModule, createDisplayModuleSession } from '../../systemWorkflow/displayModuleSession.js';
import { buildProfileDocumentV9 } from './profileDocumentV9Builder.js';
import { validateProfileDocumentV9, parseProfileDocumentV9Json } from './profileDocumentV9Validation.js';
import { canonicalSerializeProfileDocumentV9, profileDocumentV9CanonicalHash } from './profileDocumentV9Serialization.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from './profileDocumentV9Reconciliation.js';

const profile = `0x${'1'.repeat(40)}`;
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft });
function fixture() {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const a = addShape(store, profile), b = addShape(store, profile), c = addShape(store, profile);
  const create = (name, memberIds) => editWorkbenchGroups(store, profile, { type: 'create', name, memberIds });
  const edit = (id, type, values) => editWorkbenchGroups(store, profile, { id, type, expected: store.getDraft().workbenchGroups.find(group => group.id === id), ...values });
  return { store, a, b, c, create, edit, fail: value => { fail = value; } };
}

test('groups are private by default and preserve old canonical bytes; visibility is explicit and undoable', () => {
  const f = fixture(), before = publish(f.store.getDraft());
  const id = f.create('Secret studio notes', [f.a, f.b]);
  assert.equal(canonicalSerializeProfileDocumentV9(publish(f.store.getDraft())), canonicalSerializeProfileDocumentV9(before));
  f.edit(id, 'visibility', { visibility: 'PUBLIC' });
  const after = publish(f.store.getDraft());
  assert.equal(after.workbenchGroups[0].name, 'Secret studio notes');
  assert.notEqual(profileDocumentV9CanonicalHash(before), profileDocumentV9CanonicalHash(after));
  assert.deepEqual(parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(after)), after);
  assert.ok(f.store.undo()); assert.deepEqual(publish(f.store.getDraft()), before);
  assert.ok(f.store.redo()); assert.deepEqual(publish(f.store.getDraft()), after);
  const saved = f.store.getDraft(), history = f.store.getHistory();
  f.fail(true); assert.throws(() => f.edit(id, 'visibility', { visibility: 'PRIVATE' }), /could not be saved/);
  assert.deepEqual(f.store.getDraft(), saved); assert.deepEqual(f.store.getHistory(), history);
  f.fail(false); assert.throws(() => f.edit(id, 'visibility', { visibility: 'everyone' }));
});

test('public groups include only projected members and never leak private groups, private member names or empty covers', () => {
  const f = fixture(), mixed = f.create('Public story', [f.a, f.b]);
  f.create('Private notebook', [f.c]); f.edit(mixed, 'visibility', { visibility: 'PUBLIC' });
  f.edit(mixed, 'position', { position: { left: 450, top: 600 } });
  const draft = f.store.getDraft();
  draft.shapes.find(shape => shape.id === f.b).visibility = 'PRIVATE';
  draft.shapes.find(shape => shape.id === f.b).name = 'Secret member';
  const published = publish(draft), json = canonicalSerializeProfileDocumentV9(published);
  assert.deepEqual(published.workbenchGroups, [{ id: mixed, name: 'Public story', visibility: 'PUBLIC', memberIds: [f.a], position: { left: 450, top: 600 } }]);
  for (const secret of ['Private notebook', 'Secret member', f.b]) assert.equal(json.includes(secret), false);
  const before = structuredClone(draft); publish(draft); assert.deepEqual(draft, before);
  draft.shapes.find(shape => shape.id === f.a).visibility = 'PRIVATE';
  assert.equal(Object.hasOwn(publish(draft), 'workbenchGroups'), false, 'no eligible members means no published title or preview');
});

test('strict public validation rejects private, empty, overlapping, unknown and malformed groups', () => {
  const f = fixture(), id = f.create('Public story', [f.a]); f.edit(id, 'visibility', { visibility: 'PUBLIC' });
  const published = publish(f.store.getDraft()), good = published.workbenchGroups[0];
  for (const groups of [null, {}, [{ ...good, visibility: 'PRIVATE' }], [{ ...good, visibility: undefined }],
    [{ ...good, memberIds: [] }], [{ ...good, memberIds: ['shape:missing'] }], [{ ...good, memberIds: [f.a, f.a] }],
    [good, { ...good, id: 'workbench-group:second' }], [{ ...good, position: { left: 4000, top: 2 } }], [{ ...good, privateCount: 99 }]]) {
    assert.equal(validateProfileDocumentV9({ ...published, workbenchGroups: groups }).valid, false);
  }
  assert.equal(validateProfileDocumentV9({ ...published, workbenchGroups: [] }).valid, true);
});

test('additional Displays validate independently of root group references', () => {
  const f = fixture(), display = addDisplayModule(f.store, 'LANDSCAPE');
  createDisplayModuleSession(f.store, display).createGrid();
  const id = f.create('Mixed modules', [display, f.a]); f.edit(id, 'visibility', { visibility: 'PUBLIC' });
  const draft = f.store.getDraft(), module = draft.displays.find(item => item.id === display);
  module.visibility = 'PUBLIC'; module.grids.filter(grid => grid.id !== 'grid:inscape-world-cover').forEach(grid => { grid.visibility = 'PUBLIC'; });
  const published = publish(draft);
  assert.deepEqual(published.workbenchGroups[0].memberIds, [display, f.a]);
  assert.equal(validateProfileDocumentV9(published).valid, true);
});

test('restore retains private organization and private members without promoting them into a public snapshot', () => {
  const f = fixture(), publicId = f.create('Public story', [f.a, f.b]), privateId = f.create('Local notes', [f.c]);
  f.edit(publicId, 'visibility', { visibility: 'PUBLIC' });
  const current = f.store.getDraft(); current.shapes.find(shape => shape.id === f.b).visibility = 'PRIVATE';
  const published = publish(current), restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(published, current);
  assert.deepEqual(restored.workbenchGroups.find(group => group.id === publicId).memberIds, [f.a, f.b]);
  assert.deepEqual(restored.workbenchGroups.find(group => group.id === privateId), current.workbenchGroups.find(group => group.id === privateId));
  assert.deepEqual(publish(restored).workbenchGroups, published.workbenchGroups);
  const fresh = reconcileSystemWorkflowDraftFromProfileDocumentV9(published);
  assert.deepEqual(fresh.workbenchGroups, published.workbenchGroups);
  const hidden = structuredClone(current); hidden.workbenchGroups[0].visibility = 'PRIVATE';
  const protectedRestore = reconcileSystemWorkflowDraftFromProfileDocumentV9(published, hidden);
  assert.deepEqual(protectedRestore.workbenchGroups.find(group => group.id === publicId), hidden.workbenchGroups[0]);
  assert.equal(Object.hasOwn(publish(protectedRestore), 'workbenchGroups'), false);
  const without = structuredClone(published); delete without.workbenchGroups;
  const withdrawn = reconcileSystemWorkflowDraftFromProfileDocumentV9(without, current);
  assert.equal(withdrawn.workbenchGroups.find(group => group.id === publicId).visibility, 'PRIVATE');
  assert.deepEqual(current.workbenchGroups[0].memberIds, [f.a, f.b]);
});

test('restoring a public regrouping transfers public members while keeping withdrawn local groups private', () => {
  const f = fixture(), oldId = f.create('Old public group', [f.a, f.b]);
  f.edit(oldId, 'visibility', { visibility: 'PUBLIC' });
  const current = f.store.getDraft(), document = publish(current);
  document.workbenchGroups = [{ id: 'workbench-group:new', name: 'New route', visibility: 'PUBLIC', memberIds: [f.a, f.b] }];
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document, current);
  assert.deepEqual(restored.workbenchGroups.find(group => group.id === 'workbench-group:new'), document.workbenchGroups[0]);
  assert.deepEqual(restored.workbenchGroups.find(group => group.id === oldId).memberIds, []);
  assert.equal(restored.workbenchGroups.find(group => group.id === oldId).visibility, 'PRIVATE');
  assert.deepEqual(publish(restored).workbenchGroups, document.workbenchGroups);
});

test('restore fails without dropping private groups when the combined group limit would be exceeded', () => {
  const f = fixture(), id = f.create('Published route', [f.a]); f.edit(id, 'visibility', { visibility: 'PUBLIC' });
  const document = publish(f.store.getDraft()), current = f.store.getDraft();
  current.workbenchGroups = Array.from({ length: 32 }, (_, i) => ({ id: 'workbench-group:private-' + i, name: 'Local ' + i, memberIds: [] }));
  const before = structuredClone(current);
  assert.throws(() => reconcileSystemWorkflowDraftFromProfileDocumentV9(document, current), /32-group limit/);
  assert.deepEqual(current, before);
});
