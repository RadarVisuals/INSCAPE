import test from 'node:test';
import assert from 'node:assert/strict';
import { addShape, editShape, reorderShape, prepareShapeResize } from './shapeSession.js';
import { validShapes, createShapePresentation, isShapeCommand } from './shapes.js';
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
function addLegacyTexture(store, placed = {}) {
  const draft = store.getDraft(), id = `shape:${crypto.randomUUID()}`;
  const record = { id, kind: 'texture', texture: { scale: 1 }, color: '#ffffff', opacity: .25, visibility: 'PUBLIC', name: 'Legacy texture' };
  const presentation = createShapePresentation(id);
  presentation.window = { ...presentation.window, ...placed.position, ...placed.size };
  assert.ok(store.commitCompletedOperation({ ...draft, shapes: [...(draft.shapes || []), record],
    workbench: { ...draft.workbench, shapes: [...(draft.workbench?.shapes || []), presentation] } }, { expectedGeneration: store.getGeneration() }));
  return id;
}
const build = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });

test('Grid and noise Texture retain transparent-pattern settings through editing, duplication, resize, undo, reload and publication', () => {
  const { store, storage } = fixture();
  addShape(store, profile);
  const legacy = store.getDraft(), oldDocument = build(legacy);
  for (const kind of ['grid', 'texture']) {
    const before = store.getDraft();
    const placed = { kind, position: { left: 480, top: 240 }, size: { width: 600, height: 400 } };
    const id = kind === 'texture' ? addLegacyTexture(store, placed) : addShape(store, profile, placed);
    let record = store.getDraft().shapes.find(item => item.id === id);
    assert.equal(record.kind, kind);
    assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before); assert.ok(store.redo());
    const settings = kind === 'grid' ? { grid: { spacing: 40, lineWidth: 1.5 } } : { texture: { scale: 2.5 } };
    editShape(store, profile, record, { ...settings, color: '#84aabb', opacity: .65 });
    record = store.getDraft().shapes.find(item => item.id === id);
    const copyId = addShape(store, profile, null, record);
    const copy = store.getDraft().shapes.find(item => item.id === copyId);
    assert.deepEqual(copy[kind], settings[kind]); assert.equal(copy.opacity, .65);
    assert.ok(commitWorkbenchSelectionResize([{ store, profileAddress: profile, expected: copy, id: copyId,
      layoutKey: 'shapes', prepare: prepareShapeResize, left: 100, top: 200, width: 1200, height: 800 }]));
    assert.deepEqual(store.getDraft().shapes.find(item => item.id === copyId)[kind], settings[kind], 'resizing keeps pattern measurements');
    reorderShape(store, profile, copyId, 'back');
    assert.equal(store.getDraft().shapes[0].id, copyId);
    assert.ok(store.undo()); assert.ok(store.redo());
  }
  const draft = store.getDraft(), published = build(draft);
  assert.equal(validateProfileDocumentV9(published).valid, true);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), draft);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(published, draft).shapes, draft.shapes);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(oldDocument).shapes, legacy.shapes);
  assert.deepEqual(draft.shapes.find(item => item.id === legacy.shapes[0].id), legacy.shapes[0], 'legacy rectangle is never rewritten');
  const restoredOld = reconcileSystemWorkflowDraftFromProfileDocumentV9(oldDocument, draft);
  assert.ok(restoredOld.shapes.filter(item => item.kind).every(item => item.visibility === 'PRIVATE'));
  const privateGrid = draft.shapes.find(item => item.kind === 'grid');
  editShape(store, profile, privateGrid, { visibility: 'PRIVATE' });
  const publicOnly = build(store.getDraft());
  assert.ok(!publicOnly.shapes.some(item => item.id === privateGrid.id));
  assert.ok(!publicOnly.workbench.shapes.some(item => item.id === privateGrid.id));
});

test('Pattern validation rejects unknown variants, mixed settings and invalid ranges without saving partial changes', () => {
  const f = fixture();
  assert.throws(() => addShape(f.store, profile, { kind: 'unknown' }));
  const id = addShape(f.store, profile, { kind: 'grid' });
  const before = f.store.getDraft(), expected = before.shapes.find(item => item.id === id);
  const changes = [{ kind: null }, { kind: 'rectangle' }, { kind: 'unknown' }, { grain: .5 }, { texture: { scale: 1 } },
    { grid: null }, { grid: { spacing: 7, lineWidth: 1 } }, { grid: { spacing: 513, lineWidth: 1 } },
    { grid: { spacing: '32', lineWidth: 1 } }, { grid: { spacing: 32, lineWidth: NaN } },
    { grid: { spacing: 32, lineWidth: 0 } }, { grid: { spacing: 32, lineWidth: 4.1 } },
    { grid: { spacing: 32, lineWidth: 1, extra: true } }];
  for (const change of changes) {
    assert.throws(() => editShape(f.store, profile, expected, change));
    assert.deepEqual(f.store.getDraft(), before);
    const published = build(before); Object.assign(published.shapes[0], change);
    assert.equal(validateProfileDocumentV9(published).valid, false);
  }
  const textureId = addLegacyTexture(f.store);
  const texture = f.store.getDraft().shapes.find(item => item.id === textureId);
  for (const scale of [0, .24, 8.01, null, '1', Infinity]) assert.throws(() => editShape(f.store, profile, texture, { texture: { scale } }));
  f.fail(true); const saved = f.store.getDraft();
  assert.throws(() => addShape(f.store, profile, { kind: 'texture' }));
  assert.throws(() => editShape(f.store, profile, texture, { texture: { scale: 2 } }));
  assert.deepEqual(f.store.getDraft(), saved);
});

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

test('drawn rectangles save their size and clamped position together without changing default shapes', () => {
  const { store, storage } = fixture(), before = store.getDraft();
  const id = addShape(store, profile, { position: { left: 3900, top: -10 }, size: { width: 450.5, height: 120.25 } });
  const rectangle = store.getDraft().workbench.shapes.find(item => item.id === id);
  assert.deepEqual(rectangle.window, { left: 3541.5, top: 8, width: 450.5, height: 120.25 });
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
  assert.ok(store.redo());
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), store.getDraft());
  const published = build(store.getDraft());
  assert.deepEqual(published.workbench.shapes[0].window, rectangle.window);
  const defaultId = addShape(store, profile);
  assert.deepEqual(store.getDraft().workbench.shapes.find(item => item.id === defaultId).window,
    { left: 120, top: 120, width: 288, height: 288 });
  const source = store.getDraft().shapes.find(item => item.id === id);
  const duplicateId = addShape(store, profile, { size: { width: 20, height: 20 } }, source);
  const duplicate = store.getDraft().workbench.shapes.find(item => item.id === duplicateId).window;
  assert.equal(duplicate.width, rectangle.window.width);
  assert.equal(duplicate.height, rectangle.window.height);
});

test('drawn rectangle size validation and failed creation never commit a partial shape', () => {
  const f = fixture(), before = f.store.getDraft();
  for (const size of [{ width: 0, height: 40 }, { width: 40, height: 7 }, { width: 3985, height: 40 },
    { width: 40, height: Infinity }, { width: NaN, height: 40 }, { width: '40', height: 40 }]) {
    assert.throws(() => addShape(f.store, profile, { position: { left: 40, top: 50 }, size }));
    assert.deepEqual(f.store.getDraft(), before);
  }
  f.fail(true);
  assert.throws(() => addShape(f.store, profile, { position: { left: 40, top: 50 }, size: { width: 300, height: 80 } }));
  assert.deepEqual(f.store.getDraft(), before);
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

test('Texture is retired from creation, legacy records survive, and multi-selection scaling scales grid cells', () => {
  const { store } = fixture();
  assert.equal(isShapeCommand('shape-texture'), false);
  assert.throws(() => addShape(store, profile, { kind: 'texture' }));
  const id = addShape(store, profile, { kind: 'grid' });
  const expected = store.getDraft().shapes.find(item => item.id === id);
  assert.ok(commitWorkbenchSelectionResize([{ store, profileAddress: profile, expected, id, layoutKey: 'shapes',
    prepare: prepareShapeResize, gridScale: 1.5, left: 200, top: 200, width: 432, height: 432 }]));
  assert.equal(store.getDraft().shapes.find(item => item.id === id).grid.spacing, 36);
  assert.ok(store.undo()); assert.equal(store.getDraft().shapes.find(item => item.id === id).grid.spacing, 24);
  editShape(store, profile, store.getDraft().shapes.find(item => item.id === id), { grid: { spacing: 24, lineWidth: 1, snap: false } });
  assert.equal(build(store.getDraft()).shapes.find(item => item.id === id).grid.snap, false);
});


test('new grids and spacing edits complete cells atomically while existing partial layouts survive reload', () => {
  const { store, storage } = fixture();
  const id = addShape(store, profile, { kind: 'grid', size: { width: 340, height: 420 } });
  assert.deepEqual(store.getDraft().workbench.shapes[0].window, { left: 120, top: 120, width: 360, height: 432 });
  const old = store.getDraft(); old.workbench.shapes[0].window.width = 341;
  assert.ok(store.commitCompletedOperation(old, { expectedGeneration: store.getGeneration() }));
  assert.equal(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().workbench.shapes[0].window.width, 341);
  editShape(store, profile, store.getDraft().shapes[0], { grid: { spacing: 25, lineWidth: 1 } });
  assert.deepEqual(store.getDraft().workbench.shapes[0].window, { left: 120, top: 120, width: 350, height: 450 });
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), old);
  assert.ok(store.redo());
  assert.ok(validateProfileDocumentV9(build(store.getDraft())).valid);
  assert.equal(store.getDraft().shapes[0].id, id);
});
