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

test('canvas edge resizing rounds and bounds only the requested axes; fitting keeps a fixed origin and content intact', () => {
  assert.deepEqual(resizeWorkbenchArea(DEFAULT_WORKBENCH_AREA, 'e', { x: 151.6, y: -999 }), { width: 2152, height: 4000 });
  assert.deepEqual(resizeWorkbenchArea(DEFAULT_WORKBENCH_AREA, 'se', { x: -9000, y: 20000 }), { width: 256, height: 16384 });
  const frames = [{ left: 100, top: 50, width: 700, height: 480 }, { left: 1400.5, top: 640, width: 90, height: 90 }];
  const before = structuredClone(frames);
  assert.deepEqual(fitWorkbenchArea(frames), { width: 1539, height: 778 });
  assert.deepEqual(frames, before); assert.equal(fitWorkbenchArea([]), null);
  assert.throws(() => fitWorkbenchArea([{ left: 16300, top: 0, width: 800, height: 20 }]));
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
  resize(store, { width: 3200, height: 1800 }, live);
  const draft = store.getDraft();
  assert.deepEqual(draft.texts, before.texts); assert.deepEqual(draft.workbench.texts, before.workbench.texts);
  assert.equal(draft.workbench.shapes[0].window.left, 1000);
  const doc = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: [] });
  assert.deepEqual(doc.workbench.area, { width: 3200, height: 1800 });
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).workbench.area, doc.workbench.area);
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
  const resized = resizeImageGeometry({ left: 3000, top: 100 }, { width: 100, height: 100 }, 1, 'se', { x: 3000, y: 2000 }, undefined, undefined, bounds);
  assert.deepEqual(resized.size, { width: 1992, height: 1092 });
});

test('new modules and stacks can use an expanded canvas and respect a smaller height', () => {
  const { store } = fixture(); resize(store, { width: 5000, height: 1000 });
  const shape = addShape(store, profile, { position: { left: 3000, top: 800 } });
  addTextModule(store, profile, { position: { left: 3500, top: 900 } });
  addKeeperDock(store, profile, { position: { left: 4000, top: 900 } });
  const layout = store.getDraft().workbench;
  assert.equal(layout.shapes[0].window.left, 3000); assert.equal(layout.shapes[0].window.top + layout.shapes[0].window.height, 992);
  assert.equal(layout.texts[0].window.left, 3500); assert.equal(layout.texts[0].window.top + layout.texts[0].window.height, 992);
  assert.equal(layout.keeperDocks[0].position.left, 4000);
  const id = editWorkbenchGroups(store, profile, { type: 'create', name: 'Group', memberIds: [shape] });
  editWorkbenchGroups(store, profile, { type: 'position', id, expected: store.getDraft().workbenchGroups[0], position: { left: 4500, top: 700 } });
  assert.throws(() => editWorkbenchGroups(store, profile, { type: 'position', id, expected: store.getDraft().workbenchGroups[0], position: { left: 4500, top: 900 } }), /inside the canvas/);
});
