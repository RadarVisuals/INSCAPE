import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { resizeWorkbenchCanvas } from './workbenchAreaSession.js';
import { DEFAULT_WORKBENCH_AREA, fitWorkbenchArea, resizeWorkbenchArea, validWorkbenchArea, workbenchArea, workbenchAreaBounds } from './domain/workbenchArea.js';
import { clampWorkbenchPosition, projectWorkbenchBounds } from '../public/ownerSystemWorkflow/workbenchSpace.js';
import { workbenchCreationPlacement } from '../public/ownerSystemWorkflow/workbenchCreationGeometry.js';
import { imageDropGeometry } from '../imageModule/imageDropGeometry.js';
import { resizeImageGeometry } from '../imageModule/imageWindowGeometry.js';
import { createDefaultWorkbenchPresentation, isValidWorkbenchPresentation } from '../profileDocument/domain/workbenchPresentation.js';
import { addShape } from '../shapes/shapeSession.js';
import { addTextModule } from '../text/textSession.js';
import { addKeeperDock } from '../keeper/keeperSession.js';
import { editWorkbenchGroups } from './workbenchGroupSession.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
const profile = `0x${'3'.repeat(40)}`;
function fixture() {
  const values = new Map(); let fail = false;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('full'); values.set(key, value); } };
  return { storage, fail: value => { fail = value; }, store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
}
const resize = (store, area, presentation) => resizeWorkbenchCanvas(store, profile, store.getGeneration(), area, presentation);

test('canvas edge resizing rounds and bounds only the requested axes; fitting adds no margin and preserves content', () => {
  assert.deepEqual(resizeWorkbenchArea(DEFAULT_WORKBENCH_AREA, 'e', { x: 151.6, y: -999 }), { left: 0, top: 0, width: 2152, height: 4000 });
  assert.deepEqual(resizeWorkbenchArea(DEFAULT_WORKBENCH_AREA, 'se', { x: -9000, y: 20000 }), { left: 0, top: 0, width: 1, height: 16384 });
  const frames = [{ left: 100, top: 50, width: 700, height: 480 }, { left: 1400.5, top: 640, width: 90, height: 90 }];
  const before = structuredClone(frames);
  assert.deepEqual(fitWorkbenchArea(frames), { left: 100, top: 50, width: 1391, height: 680 });
  assert.deepEqual(frames, before); assert.equal(fitWorkbenchArea([]), null);
  assert.throws(() => fitWorkbenchArea([{ left: 16300, top: 0, width: 800, height: 20 }]));
});

test('all four canvas edges and corners keep their opposite anchors, including negative positions', () => {
  const area = { left: -100, top: 80, width: 500, height: 300 };
  for (const edge of ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se']) {
    const changed = resizeWorkbenchArea(area, edge, { x: -40, y: 25 });
    assert.equal(changed.left, edge.includes('w') ? -140 : -100, edge);
    assert.equal(changed.top, edge.includes('n') ? 105 : 80, edge);
    assert.equal(changed.left + changed.width, edge.includes('e') ? 360 : 400, edge);
    assert.equal(changed.top + changed.height, edge.includes('s') ? 405 : 380, edge);
    assert.ok(validWorkbenchArea(changed));
  }
  assert.deepEqual(resizeWorkbenchArea(area, 'nw', { x: 10000, y: 10000 }), { left: 399, top: 379, width: 1, height: 1 });
  const expanded = resizeWorkbenchArea(area, 'nw', { x: -50000, y: -50000 });
  assert.equal(expanded.width, 16384); assert.equal(expanded.height, 16384);
  assert.equal(expanded.left + expanded.width, 400); assert.equal(expanded.top + expanded.height, 380);
  assert.deepEqual(workbenchAreaBounds(area), { left: -92, top: 88, right: 392, bottom: 372 });
  assert.deepEqual(fitWorkbenchArea([{ left: -12, top: -8, width: 32, height: 20 }]), { left: -12, top: -8, width: 32, height: 20 });
  assert.equal(validWorkbenchArea({ left: -16385, top: 0, width: 100, height: 100 }), false);
  assert.equal(validWorkbenchArea({ left: 16300, top: 0, width: 100, height: 100 }), false);
});

test('area is optional on existing layouts; invalid dimensions and extra fields are rejected', () => {
  const old = createDefaultWorkbenchPresentation();
  assert.ok(isValidWorkbenchPresentation(old)); assert.deepEqual(workbenchArea(old), DEFAULT_WORKBENCH_AREA);
  for (const area of [null, {}, { width: 0, height: 4000 }, { width: 256.5, height: 4000 }, { width: 2000, height: Infinity },
    { width: 2000, height: 16385 }, { width: 2000, height: 4000, scale: 1 }]) {
    assert.equal(validWorkbenchArea(area), false); assert.equal(isValidWorkbenchPresentation({ ...old, area }), false);
  }
});

test('resize saves once, reloads and undoes without changing module content or existing outlying positions', () => {
  const { store, storage } = fixture();
  const id = addShape(store, profile, { position: { left: 1400, top: 2000 } });
  const group = editWorkbenchGroups(store, profile, { type: 'create', name: 'Group', memberIds: [id] });
  editWorkbenchGroups(store, profile, { type: 'position', id: group, expected: store.getDraft().workbenchGroups[0], position: { left: 1700, top: 3600 } });
  const before = store.getDraft(), generation = store.getGeneration();
  assert.ok(resize(store, { width: 600, height: 500 }));
  const after = store.getDraft(), { area, ...layout } = after.workbench;
  assert.deepEqual(layout, before.workbench); assert.deepEqual(after.shapes, before.shapes); assert.deepEqual(after.workbenchGroups, before.workbenchGroups);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), after);
  assert.equal(store.getHistory().undo, 'Resize canvas');
  assert.equal(store.getGeneration(), generation + 1);
  assert.equal(resize(store, area), false); assert.equal(store.getGeneration(), generation + 1);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), before);
  assert.ok(store.redo()); assert.deepEqual(store.getDraft(), after);
});

test('live layout capture, publication and restoration retain canvas size without scaling text or shapes', () => {
  const { store } = fixture(); addShape(store, profile); addTextModule(store, profile, { position: { left: 120, top: 80 } });
  const before = store.getDraft(), live = structuredClone(before.workbench);
  live.shapes[0].window.left = 1000;
  resize(store, { left: -200, top: 300, width: 3200, height: 1800 }, live);
  const draft = store.getDraft();
  assert.deepEqual(draft.texts, before.texts); assert.deepEqual(draft.workbench.texts, before.workbench.texts);
  assert.equal(draft.workbench.shapes[0].window.left, 1000);
  const doc = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });
  assert.deepEqual(doc.workbench.area, { left: -200, top: 300, width: 3200, height: 1800 });
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).workbench.area, doc.workbench.area);
  assert.ok(resize(store, { ...doc.workbench.area, left: -100 }), 'changing only the origin is saved');
  assert.equal(store.getDraft().workbench.area.left, -100);
  assert.deepEqual(store.getDraft().shapes, draft.shapes);
  assert.ok(store.undo()); assert.deepEqual(store.getDraft(), draft);
});

test('failed persistence, stale gestures and obsolete profiles leave saved geometry and undo history unchanged', () => {
  const f = fixture(), before = f.store.getDraft(), generation = f.store.getGeneration(), history = f.store.getHistory();
  f.fail(true); assert.throws(() => resize(f.store, { width: 3000, height: 2000 }), /could not be saved/);
  assert.deepEqual(f.store.getDraft(), before); assert.deepEqual(f.store.getHistory(), history);
  f.fail(false); resize(f.store, { width: 3000, height: 2000 }); const saved = f.store.getDraft();
  assert.throws(() => resizeWorkbenchCanvas(f.store, profile, generation, { width: 4000, height: 2000 }), /changed/);
  assert.throws(() => resizeWorkbenchCanvas(f.store, 'other', f.store.getGeneration(), { width: 4000, height: 2000 }), /profile/);
  assert.deepEqual(f.store.getDraft(), saved);
});

test('placement, drawing, image drops and resizing use the new per-axis boundary beyond the old width', () => {
  const bounds = workbenchAreaBounds({ width: 5000, height: 1200 });
  assert.deepEqual(clampWorkbenchPosition({ left: 4900, top: 1150 }, { width: 200, height: 100 }, bounds), { left: 4792, top: 1092 });
  assert.deepEqual(projectWorkbenchBounds(.5, { x: -100, y: 20 }, bounds), { left: -96, top: 24, right: 2396, bottom: 616 });
  const placed = workbenchCreationPlacement({ x: 2300, y: 200 }, { x: 3300, y: 1500 }, { scale: 1, offset: { x: 0, y: 0 } }, true, bounds);
  assert.equal(placed.position.left, 2300); assert.equal(placed.position.top + placed.size.height, 1192);
  const drop = imageDropGeometry({ width: 100, height: 100 }, { x: 3000, y: 500 }, { left: 0, top: 0, width: 5000, height: 1200 }, 1, { x: 0, y: 0 }, 1, bounds);
  assert.equal(drop.destination.position.left, 2950);
  const resized = resizeImageGeometry({ left: 3000, top: 100 }, { width: 100, height: 100 }, 'se', { x: 3000, y: 2000 }, undefined, bounds);
  assert.deepEqual(resized.size, { width: 1992, height: 1092 }, 'each corner dimension reaches its independent area boundary');
  const widened = resizeImageGeometry({ left: 3000, top: 100 }, { width: 100, height: 100 }, 'e', { x: 3000, y: 0 }, undefined, bounds);
  assert.deepEqual(widened.size, { width: 1992, height: 100 }, 'the side handle still reaches the independent width boundary');
});

test('new modules and stacks can use an expanded canvas and respect a smaller height', () => {
  const { store } = fixture(); resize(store, { width: 5000, height: 1000 });
  const shape = addShape(store, profile, { position: { left: 3000, top: 800 } });
  addTextModule(store, profile, { position: { left: 3500, top: 900 } });
  addKeeperDock(store, profile, { position: { left: 4000, top: 900 } });
  const layout = store.getDraft().workbench;
  assert.equal(layout.shapes[0].window.left, 3000); assert.equal(layout.shapes[0].window.top + layout.shapes[0].window.height, 992);
  assert.equal(layout.texts[0].window.left, 3500); assert.equal(layout.texts[0].window.top + layout.texts[0].window.height, 992);
  assert.equal(Object.hasOwn(layout, 'keeperDocks'), false, 'Keeper is a screen utility, outside authored canvas geometry');
  assert.equal(store.getDraft().keeperDocks.length, 1, 'the profile still owns its Keeper record');
  const id = editWorkbenchGroups(store, profile, { type: 'create', name: 'Group', memberIds: [shape] });
  editWorkbenchGroups(store, profile, { type: 'position', id, expected: store.getDraft().workbenchGroups[0], position: { left: 4500, top: 700 } });
  editWorkbenchGroups(store, profile, { type: 'position', id, expected: store.getDraft().workbenchGroups[0], position: { left: 4500, top: 900 } });
  assert.deepEqual(store.getDraft().workbenchGroups[0].position, { left: 4500, top: 900 }, 'an existing stack may cross the crop boundary');
  assert.throws(() => editWorkbenchGroups(store, profile, { type: 'position', id, expected: store.getDraft().workbenchGroups[0], position: { left: 16384, top: 900 } }), /editing limits/);
});

test('negative artwork positions remain recoverable through save, publication, restore and canvas resize', () => {
  const { store, storage } = fixture();
  addShape(store, profile);
  const draft = store.getDraft();
  draft.workbench.shapes[0].window.left = -120;
  draft.workbench.shapes[0].window.top = -80;
  assert.ok(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration(), historyLabel: 'Move across canvas edge' }));
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().workbench, draft.workbench);
  const doc = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: store.getDraft(), assetRecords: [] });
  assert.deepEqual(doc.workbench.shapes[0].window, draft.workbench.shapes[0].window);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, store.getDraft()).workbench.shapes, draft.workbench.shapes);
  resize(store, { width: 256, height: 256 });
  assert.deepEqual(store.getDraft().workbench.shapes, draft.workbench.shapes);
  assert.deepEqual(fitWorkbenchArea([draft.workbench.shapes[0].window]), draft.workbench.shapes[0].window);
  const bad = structuredClone(draft.workbench); bad.shapes[0].window.left = -16385;
  assert.equal(isValidWorkbenchPresentation(bad), false);
});
