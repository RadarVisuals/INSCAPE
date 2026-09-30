import test from 'node:test';
import assert from 'node:assert/strict';
import { addShape, editShape, reorderShape, prepareShapeResize } from './shapeSession.js';
import { validShapes } from './shapes.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { commitWorkbenchSelectionResize } from '../systemWorkflow/resizeWorkbenchSelection.js';
import { captureWorkbenchPresentation } from '../public/ownerSystemWorkflow/workbenchPresentationCapture.js';
import { loadWorkbenchLayout, saveWorkbenchLayout } from '../public/ownerSystemWorkflow/workbenchLayoutStorage.js';
const profile = `0x${'1'.repeat(40)}`;
function fixture() {
  const entries = new Map(); let fail = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); entries.set(key, value); } };
  return { store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }), storage, fail: value => { fail = value; } };
}
const build = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });

test('Optional Shape grain preserves old flat records and survives edit, undo, duplicate, reload and publication', () => {
  const { store, storage } = fixture(); addShape(store, profile);
  const legacy = store.getDraft(), oldDocument = build(legacy);
  assert.ok(validShapes(legacy.shapes)); assert.equal(Object.hasOwn(legacy.shapes[0], 'grain'), false);
  editShape(store, profile, legacy.shapes[0], { grain: .65 });
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), legacy); assert.ok(store.redo());
  addShape(store, profile, null, store.getDraft().shapes[0]);
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft();
  assert.deepEqual(reopened.shapes.map(item => item.grain), [.65, .65]);
  const published = build(reopened);
  assert.deepEqual(published.shapes.map(item => item.grain), [.65, .65]);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(published, reopened).shapes, reopened.shapes);
  assert.equal(Object.hasOwn(reconcileSystemWorkflowDraftFromProfileDocumentV9(oldDocument).shapes[0], 'grain'), false);
  for (const grain of [-.01, 1.01, null, '0.5', NaN]) {
    assert.throws(() => editShape(store, profile, store.getDraft().shapes[0], { grain }));
    const invalid = structuredClone(published); invalid.shapes[0].grain = grain;
    assert.equal(validateProfileDocumentV9(invalid).valid, false);
  }
  editShape(store, profile, store.getDraft().shapes[0], { grain: 0 });
  assert.equal(store.getDraft().shapes[0].grain, 0);
});

test('Shape creation, duplication, order, colour and dimensions survive undo and reload', () => {
  const { store, storage } = fixture(), before = store.getDraft();
  const first = addShape(store, profile, { position: { left: 450.5, top: 320.25 } });
  assert.deepEqual(store.getDraft().workbench.shapes[0].window, { left: 450.5, top: 320.25, width: 288, height: 288 });
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before); assert.ok(store.redo());
  editShape(store, profile, store.getDraft().shapes[0], { color: '#ff6600', opacity: .4 });
  const duplicate = addShape(store, profile, null, store.getDraft().shapes[0]);
  assert.deepEqual(store.getDraft().workbench.shapes[1].window, { left: 474.5, top: 344.25, width: 288, height: 288 });
  assert.equal(store.getDraft().shapes[1].color, '#ff6600');
  reorderShape(store, profile, duplicate, 'back');
  assert.deepEqual(store.getDraft().shapes.map(item => item.id), [duplicate, first]);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft().shapes.map(item => item.id), [first, duplicate]); assert.ok(store.redo());
  const expected = store.getDraft().shapes[0];
  assert.ok(commitWorkbenchSelectionResize([{ store, profileAddress: profile, expected, id: duplicate, layoutKey: 'shapes', prepare: prepareShapeResize,
    left: 500, top: 300, width: 8, height: 1500 }]));
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.deepEqual(reopened.getDraft(), store.getDraft());
  assert.ok(removeWorkbenchModule(store, profile, 'shape', expected));
  assert.equal(store.getDraft().workbench.shapes.length, 1); assert.ok(store.undo());
  assert.equal(store.getDraft().workbench.shapes.length, 2);
});

test('Shape publication retains order and geometry, excludes private shapes, and restores old documents safely', () => {
  const { store } = fixture(), old = build(store.getDraft());
  addShape(store, profile); addShape(store, profile); addShape(store, profile);
  editShape(store, profile, store.getDraft().shapes[1], { visibility: 'PRIVATE' });
  const current = store.getDraft(), doc = build(current);
  assert.deepEqual(doc.shapes.map(item => item.id), [current.shapes[0].id, current.shapes[2].id]);
  assert.equal(doc.workbench.shapes.length, 2); assert.ok(validShapes(doc.shapes, true));
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, current);
  assert.equal(restored.shapes.length, 3); assert.equal(restored.shapes[2].visibility, 'PRIVATE');
  const fromOld = reconcileSystemWorkflowDraftFromProfileDocumentV9(old, current);
  assert.deepEqual(fromOld.shapes, current.shapes.map(item => ({ ...item, visibility: 'PRIVATE' })));
  assert.deepEqual(fromOld.workbench.shapes, current.workbench.shapes);
  const invalid = structuredClone(doc); invalid.workbench.shapes[0].id = 'shape:missing';
  assert.equal(validateProfileDocumentV9(invalid).valid, false);
});

test('Shape operations reject failed storage, stale content and wrong profile without changing saved work', () => {
  const f = fixture(); addShape(f.store, profile); const initial = f.store.getDraft(), expected = initial.shapes[0];
  f.fail(true); assert.throws(() => editShape(f.store, profile, expected, { color: '#ffffff' }));
  assert.throws(() => addShape(f.store, profile)); assert.deepEqual(f.store.getDraft(), initial);
  f.fail(false); assert.throws(() => addShape(f.store, `0x${'2'.repeat(40)}`));
  editShape(f.store, profile, expected, { color: '#ffffff' });
  assert.throws(() => editShape(f.store, profile, expected, { opacity: .2 }));
  assert.throws(() => editShape(f.store, profile, f.store.getDraft().shapes[0], { color: 'url(evil)' }));
  assert.equal(f.store.getDraft().shapes[0].opacity, 1);
});

test('Live shape layouts are captured once and removed membership cannot return through the local layout cache', () => {
  const { store, storage } = fixture(); addShape(store, profile);
  const draft = store.getDraft(), id = draft.shapes[0].id;
  const live = { id, open: true, window: { left: 800, top: 900, width: 48, height: 600 } };
  const layout = captureWorkbenchPresentation({ layout: draft.workbench, shapes: draft.shapes, shapePresentations: { [id]: live },
    hasPrimaryDisplay: false, identityOpen: false }).value;
  assert.deepEqual(layout.shapes, [live]);
  assert.ok(saveWorkbenchLayout(profile, draft, layout, {}, storage));
  assert.deepEqual(loadWorkbenchLayout(profile, draft, storage).layout.shapes, [live]);
  assert.deepEqual(loadWorkbenchLayout(profile, { ...draft, shapes: [] }, storage).layout.shapes, []);
});
