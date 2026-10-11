import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { editWorkbenchGroups } from './workbenchGroupSession.js';
import { validWorkbenchGroups, workbenchMemberIds, workbenchGroupWindowIds } from './domain/workbenchGroups.js';
import { validateSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { addShape } from '../shapes/shapeSession.js';
import { addDisplayModule, createDisplayModuleSession } from './displayModuleSession.js';
import { removeWorkbenchModule } from './removeWorkbenchModule.js';
import { moveWorkbenchGroup } from './moveWorkbenchGroup.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { createArticle } from '../text/domain/article.js';
import { createTextPresentation } from '../profileDocument/domain/workbenchPresentation.js';
const profile = `0x${'1'.repeat(40)}`;
function fixture() {
  const values = new Map(); let fail = false, writes = 0;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); writes++; } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const a = addShape(store, profile), b = addShape(store, profile);
  const create = (memberIds = [a, b], name = 'Lunar Desert') => editWorkbenchGroups(store, profile, { type: 'create', name, memberIds });
  const group = () => store.getSnapshot().workbenchGroups[0];
  const edit = (type, more = {}) => editWorkbenchGroups(store, profile, { type, id: group().id, expected: group(), ...more });
  return { store, storage, values, a, b, create, group, edit, fail: value => { fail = value; }, writes: () => writes };
}
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });

test('old drafts read without rewriting; group creation, rename, membership and ungroup are reversible without layout edits', () => {
  const f = fixture(), before = f.store.getDraft(), writes = f.writes();
  newStore(f).getDraft(); assert.equal(f.writes(), writes); assert.equal(Object.hasOwn(before, 'workbenchGroups'), false);
  f.create(); const grouped = f.store.getDraft();
  assert.deepEqual(grouped.workbench, before.workbench);
  assert.deepEqual(grouped.shapes, before.shapes);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft(), before); assert.ok(f.store.redo());
  f.edit('rename', { name: '  Chapter one  ' }); assert.equal(f.group().name, 'Chapter one');
  f.edit('members', { memberIds: [f.b, f.a] }); assert.deepEqual(f.group().memberIds, [f.b, f.a]);
  f.edit('members', { memberIds: [f.b] }); assert.deepEqual(f.group().memberIds, [f.b]);
  assert.ok(f.store.undo()); assert.deepEqual(f.group().memberIds, [f.b, f.a]);
  assert.deepEqual(newStore(f).getDraft(), f.store.getDraft());
  f.edit('ungroup'); assert.equal(f.store.getDraft().workbenchGroups.length, 0);
  assert.ok(f.store.undo()); assert.equal(f.group().name, 'Chapter one');
});
const newStore = f => createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage });

test('membership has one owner and rejects overlaps, nested or missing members, malformed records and limits', () => {
  const f = fixture(); f.create(); const before = f.store.getDraft();
  for (const memberIds of [[f.a], ['shape:missing'], [f.group().id], [f.a, f.a]]) assert.throws(() => f.create(memberIds));
  const current = f.group();
  for (const name of ['', 'x'.repeat(49), 'bad\u0000name']) assert.throws(() => f.edit('rename', { name }));
  for (const bad of [null, {}, [{ ...current, extra: true }], [{ ...current, memberIds: null }],
    Array.from({ length: 33 }, (_, i) => ({ id: `workbench-group:${i}`, name: 'Empty', memberIds: [] }))]) {
    assert.equal(validateSystemWorkflowDraft({ ...before, workbenchGroups: bad }).valid, false);
  }
  assert.deepEqual(f.store.getDraft(), before);
  assert.equal(validWorkbenchGroups([{ id: 'workbench-group:empty', name: 'Empty', memberIds: [] }], before), true);
});

test('empty groups can be filled, and failed writes or obsolete profile/group edits do not change saved state or history', () => {
  const f = fixture(); f.create([]); f.edit('members', { memberIds: [f.a] });
  const original = f.group(); f.edit('rename', { name: 'Updated' });
  assert.throws(() => editWorkbenchGroups(f.store, profile, { type: 'rename', id: original.id, expected: original, name: 'Stale' }));
  const before = f.store.getDraft(), history = f.store.getHistory();
  f.fail(true); assert.throws(() => f.edit('members', { memberIds: [f.a, f.b] }), /could not be saved/);
  assert.deepEqual(f.store.getDraft(), before); assert.deepEqual(f.store.getHistory(), history);
  f.fail(false); assert.throws(() => editWorkbenchGroups(f.store, `0x${'2'.repeat(40)}`, { type: 'create', name: 'Wrong profile', memberIds: [] }));
  f.values.set([...f.values.keys()][0], JSON.stringify({ ...before, workbenchGroups: [] }));
  assert.throws(() => f.edit('rename', { name: 'External conflict' }), /could not be saved/);
});

test('deleting a module removes only its membership in the same undo operation; closing a window does not', () => {
  const f = fixture(); f.create(); const before = f.store.getDraft();
  assert.ok(removeWorkbenchModule(f.store, profile, 'shape', before.shapes[0]));
  assert.deepEqual(f.group().memberIds, [f.b]);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft(), before);
  const closed = f.store.getDraft(); closed.workbench.shapes[0].open = false;
  assert.ok(f.store.commitCompletedOperation(closed, { expectedGeneration: f.store.getGeneration() }));
  assert.deepEqual(f.group().memberIds, [f.a, f.b]);
});

test('group movement commits positions together, preserves module content and undoes together', () => {
  const f = fixture(); f.create(); const before = f.store.getDraft(), writes = f.writes();
  moveWorkbenchGroup(f.store, profile, [{ id: f.a, left: 900, top: 850 }, { id: f.b, left: 924, top: 874 }], before.workbench);
  assert.equal(f.writes(), writes + 1);
  assert.deepEqual(f.store.getDraft().shapes, before.shapes); assert.deepEqual(f.store.getDraft().workbenchGroups, before.workbenchGroups);
  assert.equal(f.store.getDraft().workbench.shapes[1].window.left, 924);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft(), before); assert.ok(f.store.redo());
  const moved = f.store.getDraft(); f.fail(true);
  assert.throws(() => moveWorkbenchGroup(f.store, profile, [{ id: f.a, left: 800, top: 850 }], moved.workbench));
  assert.deepEqual(f.store.getDraft(), moved);
});

test('additional Displays still validate and edit; local group names and membership never enter public snapshots', () => {
  const f = fixture(), old = publish(f.store.getDraft());
  const display = addDisplayModule(f.store, 'LANDSCAPE');
  f.create([display, f.a], 'Private grouping title');
  assert.equal(validateSystemWorkflowDraft(f.store.getDraft()).valid, true);
  const session = createDisplayModuleSession(f.store, display); session.createGrid();
  const current = f.store.getDraft(), published = publish(current);
  assert.equal(JSON.stringify(published).includes('Private grouping title'), false);
  assert.equal(Object.hasOwn(published, 'workbenchGroups'), false);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(old, current);
  assert.deepEqual(restored.workbenchGroups, current.workbenchGroups);
  assert.equal(Object.hasOwn(reconcileSystemWorkflowDraftFromProfileDocumentV9(old), 'workbenchGroups'), false);
});

test('linked Text windows resolve to one module membership and reselect all of its frames', () => {
  const f = fixture(), draft = f.store.getDraft();
  draft.texts = [{ id: 'text:story', article: createArticle('Story'), visibility: 'PUBLIC' }];
  draft.workbench.texts = [{ ...createTextPresentation('text:story'), frames: [{ id: 'text-frame:next', window: { left: 900, top: 80, width: 300, height: 200 } }] }];
  assert.deepEqual(workbenchMemberIds(draft, ['text:story', 'text-frame:next']), ['text:story']);
  assert.deepEqual(workbenchGroupWindowIds(draft, { memberIds: ['text:story'] }), ['text:story', 'text-frame:next']);
});

test('stack location is optional, bounded, undoable and independent of every member layout', () => {
  const f = fixture(); f.create(); const before = f.store.getDraft();
  f.edit('position', { position: { left: 1500, top: 1300 } });
  const stacked = f.store.getDraft();
  assert.deepEqual(stacked.workbench, before.workbench);
  assert.deepEqual(stacked.shapes, before.shapes);
  assert.deepEqual(newStore(f).getDraft(), stacked);
  for (const position of [{ left: NaN, top: 8 }, { left: 8, top: -1 }, { left: 4000, top: 8 }, { left: 8, top: 8, extra: 1 }]) {
    assert.throws(() => f.edit('position', { position }));
    assert.deepEqual(f.store.getDraft(), stacked);
  }
  f.edit('position', { position: { left: 1600, top: 1400 } });
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft(), stacked);
  f.edit('position', { position: null }); assert.equal(Object.hasOwn(f.group(), 'position'), false);
  assert.ok(f.store.undo()); assert.deepEqual(f.store.getDraft(), stacked);
  f.fail(true); assert.throws(() => f.edit('position', { position: { left: 100, top: 100 } }));
  assert.deepEqual(f.store.getDraft(), stacked);
  assert.equal(JSON.stringify(publish(stacked)).includes('workbench-group:'), false);
});
