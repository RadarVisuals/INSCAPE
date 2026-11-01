import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from './receptionEditorScope.js';
import { addShape, editShape } from '../shapes/shapeSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { receptionModuleWindow } from './receptionEditorDocument.js';
import { validReception } from '../profileDocument/domain/receptionPresentation.js';
import { addTextModule, saveTextModuleResult, changeTextFrames } from '../text/textSession.js';
import { createReceptionExample } from '../../design-system/lab/receptionExample.js';
import { addImageModule } from '../imageModule/imageModuleSession.js';

const profile = '0x' + '6'.repeat(40);
function fixture() {
  const data = new Map(); let failure = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failure) throw Error('storage full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addShape(root, profile, { position: { left: 900, top: 700 }, size: { width: 200, height: 160 } });
  const canvas = structuredClone(root.getSnapshot()), scope = createReceptionEditorScope(root);
  return { root, scope, storage, canvas, fail: value => { failure = value; } };
}
const canvasPart = ({ reception: _reception, ...rest }) => rest;
const rectangle = (scope, left = 100) => addShape(scope, profile, { position: { left, top: 120 }, size: { width: 320, height: 240 } });

test('explicit Image drop authors the target cell atomically without changing the editing cell', () => {
  const { scope, root, canvas, fail } = fixture(), target = rectangle(scope), other = rectangle(scope, 600);
  scope.turnShapeIntoCell(target); scope.turnShapeIntoCell(other); scope.setEditingCell(other);
  const dropStore = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(target, candidate, options) };
  const placed = { position: { left: 140, top: 150 }, size: { width: 220, height: 180 }, side: createReceptionExample().imageModules[0].sides[0] };
  const before = structuredClone(scope.getReception());
  fail(true); assert.throws(() => addImageModule(dropStore, profile, placed), /could not be saved/u);
  assert.deepEqual(scope.getReception(), before); fail(false);
  const id = addImageModule(dropStore, profile, placed);
  assert.deepEqual(scope.getCells().find(cell => cell.id === target).members, [id]);
  assert.deepEqual(scope.getCells().find(cell => cell.id === other).members, []);
  assert.equal(scope.getEditingCell(), other);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getCells().find(cell => cell.id === target).members, [id]);
  const saved = structuredClone(scope.getReception());
  assert.equal(scope.commitInCell('shape:missing', scope.getDraft()), false);
  assert.deepEqual(scope.getReception(), saved);
  assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas)); scope.release();
});

test('a delayed explicit cell creation cannot commit after its document generation changes', async () => {
  const { scope } = fixture(), target = rectangle(scope);
  scope.turnShapeIntoCell(target);
  const candidate = scope.getDraft(), expectedGeneration = scope.getGeneration();
  const side = createReceptionExample().imageModules[0].sides[0];
  candidate.imageModules.push({ id: 'image:delayed', name: 'Delayed Image', width: 100, height: 100, visibility: 'PUBLIC', sides: [side] });
  candidate.workbench.imageModules.push({ id: 'image:delayed', open: true, position: { left: 140, top: 150 } });
  await Promise.resolve();
  rectangle(scope, 600);
  const saved = structuredClone(scope.getReception());
  assert.equal(scope.commitInCell(target, candidate, { expectedGeneration, historyLabel: 'Add Image' }), false);
  assert.deepEqual(scope.getReception(), saved);
  assert.deepEqual(scope.getCells()[0].members, []); scope.release();
});

test('native rectangle conversion keeps exact appearance and geometry and does not change the active canvas', () => {
  const { root, scope, canvas, storage } = fixture(), id = rectangle(scope);
  editShape(scope, profile, scope.getSnapshot().shapes[0], { color: '#123456', opacity: .4 });
  const before = structuredClone(scope.getSnapshot());
  assert.equal(scope.turnShapeIntoCell(id), id);
  assert.deepEqual(scope.getSnapshot().shapes, before.shapes);
  assert.deepEqual(scope.getSnapshot().workbench, before.workbench);
  assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas));
  assert.equal(scope.getWorkbenchId(), 'reception');
  assert.equal(scope.getCells()[0].id, id);
  assert.equal(validReception(root.getSnapshot().reception), true);
  assert.equal(scope.undo(), true); assert.equal(scope.getCells().length, 0);
  assert.equal(scope.redo(), true); assert.equal(scope.getCells().length, 1);
  scope.release();
  const loaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(loaded.getSnapshot().reception.cells[0].id, id);
});

test('membership preserves visible layer geometry, keeps it above the cell, and native new artwork joins the open cell', () => {
  const { scope } = fixture(), child = rectangle(scope, 150), cell = rectangle(scope, 100);
  scope.turnShapeIntoCell(cell); const frame = receptionModuleWindow(scope.getReception(), child);
  scope.putInCell(cell, [child]);
  assert.deepEqual(scope.getCells()[0].members, [child]);
  assert.ok(scope.getSnapshot().artworkLayers.indexOf(child) > scope.getSnapshot().artworkLayers.indexOf(cell));
  assert.deepEqual(receptionModuleWindow(scope.getReception(), child), frame);
  scope.setEditingCell(cell); const added = rectangle(scope, 180);
  assert.ok(scope.getCells()[0].members.includes(added));
  assert.throws(() => scope.turnShapeIntoCell(child), /Remove this shape/u);
  scope.removeFromCell([child]); assert.deepEqual(receptionModuleWindow(scope.getReception(), child), frame);
  assert.equal(scope.getCells()[0].members.includes(child), false); scope.release();
});

test('stale native commits, cross-document commands and failed saves never partially mutate Reception', () => {
  const { scope, root, canvas, fail } = fixture(), id = rectangle(scope), before = scope.getDraft(), generation = scope.getGeneration();
  scope.turnShapeIntoCell(id);
  assert.equal(scope.commitCompletedOperation(before, { expectedGeneration: generation }), false);
  const saved = structuredClone(scope.getReception());
  const invalid = scope.getDraft(); invalid.grids.push({ title: 'Wrong document' });
  assert.equal(scope.commitCompletedOperation(invalid), false);
  fail(true); assert.throws(() => rectangle(scope, 200), /could not be saved/u);
  assert.deepEqual(scope.getReception(), saved); assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas));
  fail(false); scope.release();
  assert.equal(scope.commitCompletedOperation(before), false);
});

test('native live presentation is stored in Reception undo history without changing canvas geometry', () => {
  const { scope, root, canvas } = fixture(), id = rectangle(scope);
  const live = structuredClone(scope.getSnapshot().workbench); live.shapes[0].window.left = 270;
  scope.turnShapeIntoCell(id, live);
  assert.equal(scope.undo(), true);
  assert.equal(scope.getSnapshot().workbench.shapes[0].window.left, 270);
  assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas));
  const candidate = scope.getDraft(); candidate.shapes = []; candidate.workbench.shapes = []; candidate.artworkLayers = [];
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration(), historyPresentation: live, historyLabel: 'Delete native shape' }), true);
  assert.equal(scope.undo(), true); assert.equal(scope.getSnapshot().workbench.shapes[0].window.left, 270);
  assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas)); scope.release();
});

test('coupled cells keep child geometry together, spacing moves contents, and unlink preserves the arrangement', () => {
  const { scope } = fixture(), first = rectangle(scope, 100), second = rectangle(scope, 500), child = rectangle(scope, 520);
  scope.turnShapeIntoCell(first); scope.turnShapeIntoCell(second); scope.putInCell(second, [child]);
  scope.coupleCells([first, second], 'row');
  const group = scope.getCellGroups()[0], before = receptionModuleWindow(scope.getReception(), child);
  scope.setCellGroupGap(group.id, 116);
  assert.equal(receptionModuleWindow(scope.getReception(), child).left, before.left + 100);
  const candidate = scope.getDraft(); candidate.workbench.shapes.find(item => item.id === first).window.top += 50;
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration() }), true);
  assert.equal(receptionModuleWindow(scope.getReception(), second).top, 170);
  assert.equal(receptionModuleWindow(scope.getReception(), child).top, 170);
  const arranged = structuredClone(scope.getSnapshot().workbench); scope.unlinkCells(second);
  assert.deepEqual(scope.getSnapshot().workbench, arranged); assert.deepEqual(scope.getCellGroups(), []); scope.release();
});

test('deleting a cell prunes its membership while retaining independent child artwork, and undo restores it', () => {
  const { scope } = fixture(), cell = rectangle(scope), child = rectangle(scope, 140);
  scope.turnShapeIntoCell(cell); scope.putInCell(cell, [child]);
  const before = receptionModuleWindow(scope.getReception(), child);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', scope.getSnapshot().shapes.find(item => item.id === cell)), true);
  assert.equal(scope.getCells().length, 0); assert.deepEqual(receptionModuleWindow(scope.getReception(), child), before);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getCells()[0].members, [child]); scope.release();
});

test('native default additions fit inside the edited cell while explicitly placed artwork keeps its position', () => {
  const { scope } = fixture(), cell = rectangle(scope, 900);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const text = addTextModule(scope, profile), shape = addShape(scope, profile);
  const bounds = receptionModuleWindow(scope.getReception(), cell);
  for (const id of [text, shape]) {
    const frame = receptionModuleWindow(scope.getReception(), id);
    assert.ok(scope.getCells()[0].members.includes(id));
    assert.ok(frame.left >= bounds.left && frame.top >= bounds.top);
    assert.ok(frame.left + frame.width <= bounds.left + bounds.width);
    assert.ok(frame.top + frame.height <= bounds.top + bounds.height);
  }
  const explicit = rectangle(scope, 920);
  assert.equal(receptionModuleWindow(scope.getReception(), explicit).left, 920);
  assert.deepEqual(scope.getSnapshot().grids, []); assert.deepEqual(scope.getSnapshot().displays, []);
  scope.release();
});

test('locked children reject direct changes but travel with the whole cell and can be unlocked', () => {
  const { scope } = fixture(), cell = rectangle(scope), child = rectangle(scope, 150);
  scope.turnShapeIntoCell(cell); scope.putInCell(cell, [child]); scope.setCellLayerLocked(cell, child, true);
  const locked = scope.getSnapshot().shapes.find(item => item.id === child);
  assert.throws(() => editShape(scope, profile, locked, { color: '#ffffff' }), /could not be saved/u);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', locked), false);
  const candidate = scope.getDraft(); candidate.workbench.shapes.find(item => item.id === cell).window.left += 30;
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration() }), true);
  assert.equal(receptionModuleWindow(scope.getReception(), child).left, 180);
  scope.setCellLayerLocked(cell, child, false);
  assert.doesNotThrow(() => editShape(scope, profile, scope.getSnapshot().shapes.find(item => item.id === child), { color: '#ffffff' }));
  scope.release();
});

test('native Text retry merges into the latest saved Reception without overwriting unrelated cells or canvas', () => {
  const { scope, root, storage, canvas } = fixture(), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); const id = addTextModule(scope, profile), expected = scope.getSnapshot().texts.find(item => item.id === id);
  const edited = { ...expected, article: { ...expected.article, title: 'Recovered text' } };
  const key = systemWorkflowDraftKey(profile), external = JSON.parse(storage.getItem(key));
  const reception = external.shared?.reception || external.reception;
  reception.cells[0].mobile.height = 480; storage.setItem(key, JSON.stringify(external));
  assert.equal(saveTextModuleResult(scope, profile, expected, edited).saved, false);
  assert.equal(saveTextModuleResult(scope, profile, expected, edited, { retry: true }).saved, true);
  assert.equal(scope.getCells()[0].mobile.height, 480);
  assert.equal(scope.getSnapshot().texts.find(item => item.id === id).article.title, 'Recovered text');
  assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas)); scope.release();
});

test('undoing initial activation preserves the old document while native preview still reads a complete projected document', () => {
  const { root, scope } = fixture(); scope.release();
  const old = createReceptionExample();
  assert.equal(root.commitCompletedOperation({ ...root.getDraft(), reception: old }, { expectedGeneration: root.getGeneration() }), true);
  const reopened = createReceptionEditorScope(root);
  assert.equal(reopened.undo(), true); assert.deepEqual(root.getSnapshot().reception, old);
  assert.equal(reopened.getReception().version, 3); assert.equal(reopened.getCells().length, 1);
  assert.equal(reopened.getReception().imageModules[0].id, old.imageModules[0].id);
  assert.equal(validReception(reopened.getReception()), true); reopened.release();
});

test('deleting a coupled middle cell closes its gap and carries the remaining cell content', () => {
  const { scope } = fixture(), first = rectangle(scope, 100), middle = rectangle(scope, 450), last = rectangle(scope, 800), child = rectangle(scope, 820);
  for (const id of [first, middle, last]) scope.turnShapeIntoCell(id);
  scope.putInCell(last, [child]); scope.coupleCells([first, middle, last], 'row');
  const before = receptionModuleWindow(scope.getReception(), child);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', scope.getSnapshot().shapes.find(item => item.id === middle)), true);
  assert.deepEqual(scope.getCellGroups()[0].members, [first, last]);
  assert.equal(receptionModuleWindow(scope.getReception(), last).left, 436);
  assert.equal(receptionModuleWindow(scope.getReception(), child).left, before.left - 336);
  scope.release();
});

test('Reception rejects advanced Text flow atomically while retaining the ordinary article', () => {
  const { scope } = fixture(), id = addTextModule(scope, profile), expected = scope.getSnapshot().texts.find(item => item.id === id);
  const before = structuredClone(scope.getReception()), presentation = scope.getSnapshot().workbench.texts.find(item => item.id === id);
  assert.throws(() => changeTextFrames(scope, profile, expected, presentation,
    [{ id: 'text-frame:continued', window: { left: 500, top: 100, width: 400, height: 300 } }]), /could not be saved/u);
  assert.equal(saveTextModuleResult(scope, profile, expected, { ...expected, pagination: 'pages' }).saved, false);
  assert.equal(saveTextModuleResult(scope, profile, expected, { ...expected, sceneLink: { mode: 'sections', displayId: 'display:primary' } }).saved, false);
  assert.deepEqual(scope.getReception(), before);
  assert.equal(saveTextModuleResult(scope, profile, expected, { ...expected, article: { ...expected.article, title: 'Ordinary article still edits' } }).saved, true);
  scope.release();
});
