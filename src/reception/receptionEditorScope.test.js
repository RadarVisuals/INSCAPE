import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from './receptionEditorScope.js';
import { addShape, editShape } from '../shapes/shapeSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { moveWorkbenchSelection } from '../systemWorkflow/moveWorkbenchSelection.js';
import { receptionModuleWindow, withReceptionModuleWindow } from './receptionEditorDocument.js';
import { layerIds } from '../systemWorkflow/domain/artworkLayers.js';
import { validReception, projectReception } from '../profileDocument/domain/receptionPresentation.js';
import { addTextModule, saveTextModuleResult, changeTextFrames } from '../text/textSession.js';
import { createReceptionExample } from '../../design-system/lab/receptionExample.js';
import { editWorkbenchGroups } from '../systemWorkflow/workbenchGroupSession.js';
import { openWorkbenchIndex } from '../systemWorkflow/workbenchIndexSession.js';
import { addImageModule } from '../imageModule/imageModuleSession.js';

const fixtureRoots = new WeakMap();
function setCell(scope, id, patch) {
  const root = fixtureRoots.get(scope), draft = root.getDraft();
  assert.equal(root.commitCompletedOperation({ ...draft, reception: { ...draft.reception,
    cells: draft.reception.cells.map(cell => cell.id === id ? { ...cell, ...patch } : cell) } },
  { expectedGeneration: root.getGeneration(), historyLabel: 'Prepare cell fixture' }), true);
}
const profile = '0x' + '6'.repeat(40);
function fixture({ earlyRead = false, measureText } = {}) {
  const data = new Map(); let failure = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failure) throw Error('storage full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  let scope;
  if (earlyRead) root.subscribe(() => scope?.getSnapshot());
  addShape(root, profile, { position: { left: 900, top: 700 }, size: { width: 200, height: 160 } });
  const canvas = structuredClone(root.getSnapshot());
  scope = createReceptionEditorScope(root, { measureText });
  fixtureRoots.set(scope, root);
  return { root, scope, storage, canvas, fail: value => { failure = value; } };
}
const canvasPart = ({ reception: _reception, ...rest }) => rest;
const rectangle = (scope, left = 100) => addShape(scope, profile, { position: { left, top: 120 }, size: { width: 320, height: 240 } });

test('single-line cell choice persists, publishes and undoes without changing authored geometry', () => {
  const { root, scope, storage, fail, canvas } = fixture();
  const id = rectangle(scope); scope.turnShapeIntoCell(id);
  const before = structuredClone(scope.getReception());
  const change = enabled => scope.editBento('cellSingleLine', [id, enabled], scope.getGeneration());
  change(true);
  const accepted = structuredClone(scope.getReception());
  assert.equal(accepted.cells[0].singleLine, true);
  assert.deepEqual(accepted.workbench, before.workbench);
  assert.equal(projectReception(accepted).cells[0].singleLine, true);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().reception, accepted);
  assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getReception(), accepted);
  assert.throws(() => change('yes'));
  assert.deepEqual(scope.getReception(), accepted);
  fail(true); assert.throws(() => change(false)); fail(false);
  assert.deepEqual(scope.getReception(), accepted); assert.deepEqual(canvasPart(root.getDraft()), canvasPart(canvas));
  scope.release();
});

test('stacked order and automatic height preferences persist with Undo and reload', () => {
  const { root, scope, storage, canvas } = fixture();
  const first = rectangle(scope), second = rectangle(scope, 600);
  scope.turnShapeIntoCell(first); scope.turnShapeIntoCell(second);
  const before = structuredClone(scope.getReception());
  scope.setCellMobileOrder([second, first]);
  assert.deepEqual(scope.getReception().cells.map(cell => cell.id), [second, first]);
  assert.equal(scope.getReception().stackOrder, 'manual');
  scope.setCellMobile(second, { height: 180 });
  assert.equal(scope.getReception().cells[0].mobile.autoHeight, false);
  scope.setCellMobile(second, { autoHeight: true });
  const accepted = structuredClone(scope.getReception());
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().reception, accepted);
  assert.deepEqual(canvasPart(root.getDraft()), canvasPart(canvas));
  assert.ok(scope.undo()); assert.equal(scope.getReception().cells[0].mobile.autoHeight, false);
  assert.ok(scope.undo()); assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before);
  scope.release();
});

function membershipFixture() {
  const state = fixture(), { scope } = state, source = rectangle(scope), target = rectangle(scope, 600);
  scope.turnShapeIntoCell(source); scope.turnShapeIntoCell(target); scope.setEditingCell(source);
  const image = addImageModule(scope, profile, { position: { left: 120, top: 150 }, size: { width: 160, height: 100 },
    artwork: createReceptionExample().imageModules[0].artwork });
  const text = addTextModule(scope, profile, null, { visibility: 'PUBLIC' }), remaining = rectangle(scope, 160);
  scope.setEditingCell(null);
  scope.editBento('anchorMembers', [source, [image, text, remaining], { alignX: 'center', alignY: 'center', paddingX: 0, paddingY: 0 }], scope.getGeneration());
  setCell(scope, source, { fitText: [text], mobile: { columns: 2, height: 240, placements: [
    { id: text, window: { left: 10, top: 20, width: 100, height: 40 } },
  ] } });
  return { ...state, source, target, image, text, remaining };
}

test('explicit cell transfer preserves native identity, relative geometry and remaining artwork through Undo and reload', () => {
  const { root, scope, storage, canvas, source, target, image, text, remaining } = membershipFixture();
  const before = structuredClone(scope.getReception()), frame = id => receptionModuleWindow(scope.getReception(), id);
  const oldImage = frame(image), oldText = frame(text), oldRemaining = frame(remaining);
  scope.editBento('moveMembers', [[text, image], target], scope.getGeneration());
  const after = structuredClone(scope.getReception());
  for (const key of ['imageModules', 'texts', 'shapes']) assert.deepEqual(after[key], before[key]);
  const cell = after.cells.find(cell => cell.id === target), origin = after.cells.find(cell => cell.id === source);
  assert.deepEqual(cell.members, layerIds(before.artworkLayers).filter(id => [image, text].includes(id)));
  assert.deepEqual(cell.fitText, [text]); assert.deepEqual(origin.members, [remaining]);
  assert.equal(origin.memberAnchors, undefined); assert.deepEqual(origin.mobile.placements, []);
  assert.equal(cell.mobile.placements, undefined); assert.deepEqual(frame(remaining), oldRemaining);
  assert.equal(frame(image).left - oldImage.left, frame(text).left - oldText.left);
  assert.equal(frame(image).top - oldImage.top, frame(text).top - oldText.top);
  const bounds = frame(target), members = [frame(image), frame(text)];
  assert.ok(Math.abs((Math.min(...members.map(r => r.left)) + Math.max(...members.map(r => r.left + r.width))) / 2 - bounds.left - bounds.width / 2) < 1e-9);
  const order = layerIds(after.artworkLayers);
  assert.ok([image, text].every(id => order.indexOf(target) < order.indexOf(id)));
  assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getReception(), after);
  const generation = scope.getGeneration();
  scope.editBento('moveMembers', [[image, text], target], generation);
  assert.equal(scope.getGeneration(), generation, 'moving to the current cell is a no-op');
  scope.release();
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), after); reopened.release();
});

test('cell transfer rejects stale, locked, invalid and failed operations without partial ownership changes', () => {
  const { scope, fail, source, target, image, remaining } = membershipFixture();
  let before = structuredClone(scope.getReception()), generation = scope.getGeneration();
  const move = (ids, destination = target, expected = scope.getGeneration()) => scope.editBento('moveMembers', [ids, destination], expected);
  fail(true); assert.throws(() => move([image]), /saved/); fail(false);
  assert.deepEqual(scope.getReception(), before); assert.equal(scope.getGeneration(), generation);
  assert.throws(() => move([source]), /backgrounds/);
  assert.throws(() => move([image], 'shape:missing'), /destination/);
  assert.throws(() => move([image, image]), /Select/);
  assert.deepEqual(scope.getReception(), before);
  setCell(scope, source, { lockedMembers: [remaining] }); before = structuredClone(scope.getReception());
  assert.throws(() => move([image]), /Unlock/, 'releasing a shared anchor also respects its locked companion');
  assert.throws(() => move([image], target, generation), /changed/);
  assert.deepEqual(scope.getReception(), before);
  setCell(scope, source, { lockedMembers: [image] }); before = structuredClone(scope.getReception());
  assert.throws(() => move([image], null), /Unlock/); assert.deepEqual(scope.getReception(), before);
  scope.release(); assert.throws(() => move([image]), /active/);
});

test('releasing a cell member keeps its location and authored visibility, respects standalone size and can be undone', () => {
  const { root, scope, source, text } = membershipFixture();
  const candidate = root.getDraft();
  candidate.reception.shapes.find(shape => shape.id === source).visibility = 'PRIVATE';
  candidate.reception = withReceptionModuleWindow(candidate.reception, text, { left: 120, top: 160, width: 80, height: 24 });
  // This explicitly free label has no placement constraint to restore on release.
  candidate.reception.cells.find(cell => cell.id === source).memberAnchors = [];
  assert.equal(root.commitCompletedOperation(candidate, { expectedGeneration: root.getGeneration() }), true);
  const before = structuredClone(scope.getReception());
  scope.editBento('moveMembers', [[text], null], scope.getGeneration());
  const after = scope.getReception();
  assert.equal(after.cells.some(cell => cell.members.includes(text)), false);
  assert.deepEqual(receptionModuleWindow(after, text), { left: 120, top: 160, width: 180, height: 24 });
  assert.deepEqual(after.texts, before.texts, 'explicit transfer preserves authored publication flags');
  assert.ok(projectReception(after).texts.some(item => item.id === text));
  scope.undo(); assert.deepEqual(scope.getReception(), before); scope.release();
});

test('cell editing has one observable owner and deletion does not reactivate it on Undo', () => {
  const { scope } = fixture(), cell = rectangle(scope); scope.turnShapeIntoCell(cell);
  const observed = [], unsubscribe = scope.subscribe(() => observed.push(scope.getEditingCell()));
  scope.setEditingCell(cell); assert.equal(observed.at(-1), cell);
  removeWorkbenchModule(scope, profile, 'shape', scope.getSnapshot().shapes.find(item => item.id === cell));
  assert.equal(observed.at(-1), null);
  scope.undo(); assert.equal(scope.getEditingCell(), null);
  const independent = rectangle(scope); assert.equal(scope.getCells()[0].members.includes(independent), false);
  scope.setEditingCell(cell); const member = rectangle(scope);
  assert.equal(scope.getCells()[0].members.includes(member), true);
  scope.setEditingCell(null); assert.equal(observed.at(-1), null);
  const count = observed.length; unsubscribe(); scope.setEditingCell(cell);
  assert.equal(observed.length, count); scope.release();
});

test('anchoring, free placement and clipping share native Reception history without touching the canvas', () => {
  const { root, scope, canvas } = fixture(), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const first = addImageModule(scope, profile), second = rectangle(scope, 140);
  scope.setEditingCell(null);
  const placement = { alignX: 'center', alignY: 'center', paddingX: 12, paddingY: 8 };
  scope.editBento('anchorMembers', [cell, [first, second], placement], scope.getGeneration());
  const anchored = structuredClone(scope.getReception()), original = receptionModuleWindow(anchored, first);
  moveWorkbenchSelection(scope, profile, [{ id: first, left: original.left + 20, top: original.top }], scope.getSnapshot().workbench);
  assert.equal(scope.getCells()[0].memberAnchors, undefined);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), anchored);
  assert.deepEqual(receptionModuleWindow(scope.getReception(), first), original);
  assert.equal(scope.redo(), true); assert.equal(scope.getCells()[0].memberAnchors, undefined);
  scope.editBento('cellClip', [cell, false], scope.getGeneration());
  assert.equal(scope.getCells()[0].clipContent, false);
  assert.equal(scope.undo(), true); assert.equal(scope.getCells()[0].clipContent, undefined);
  assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas));
  scope.release();
});

test('cell placement rejects locked members and stale scope generations without changing saved anchors', () => {
  const { scope } = fixture(), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell); const child = rectangle(scope);
  scope.setEditingCell(null);
  const placement = { alignX: 'left', alignY: 'top', paddingX: 4, paddingY: 6 };
  scope.editBento('anchorMembers', [cell, [child], placement], scope.getGeneration());
  const stale = scope.getGeneration(); setCell(scope, cell, { lockedMembers: [child] });
  const saved = scope.getReception();
  assert.throws(() => scope.editBento('anchorMembers', [cell, [child], null], scope.getGeneration()), /Unlock/);
  assert.throws(() => scope.editBento('anchorMembers', [cell, [child], placement], stale), /changed/);
  assert.deepEqual(scope.getReception(), saved); scope.release();
});

test('deletion invalidates editing before immediate Undo without any subscriber or intermediate read', () => {
  const { scope } = fixture(), cell = rectangle(scope); scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const expected = scope.getSnapshot().shapes.find(item => item.id === cell);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', expected), true);
  assert.equal(scope.undo(), true); assert.equal(scope.getEditingCell(), null); scope.release();
});

test('deleting a private cell removes Image, Text and Shape atomically through failure, Undo, Redo and reload', () => {
  const { scope, storage, fail } = fixture(), cell = rectangle(scope); scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const image = addImageModule(scope, profile, { position: { left: 120, top: 140 }, size: { width: 220, height: 180 }, artwork: createReceptionExample().imageModules[0].artwork });
  const text = addTextModule(scope, profile, null, { visibility: 'PUBLIC' });
  const shape = rectangle(scope), privateText = addTextModule(scope, profile);
  const candidate = scope.getDraft();
  for (const key of ['imageModules', 'shapes']) candidate[key] = candidate[key].map(item => ({ ...item, visibility: item.id === cell ? 'PRIVATE' : 'PUBLIC' }));
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration() }), true);
  const before = structuredClone(scope.getReception()), expected = before.shapes.find(item => item.id === cell);
  const publicIds = value => ['imageModules', 'texts', 'shapes'].flatMap(key => projectReception(value)[key].map(item => item.id));
  assert.deepEqual(publicIds(before), []);
  fail(true); assert.equal(removeWorkbenchModule(scope, profile, 'shape', expected), false);
  assert.deepEqual(scope.getReception(), before); fail(false);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', expected), true);
  const after = structuredClone(scope.getReception());
  for (const id of [image, text, shape, privateText]) {
    const key = ['imageModules', 'texts', 'shapes'].find(key => before[key].some(item => item.id === id));
    assert.equal(after[key].some(item => item.id === id), false);
    assert.equal(after.workbench[key].some(item => item.id === id), false);
    assert.equal(layerIds(after.artworkLayers).includes(id), false);
  }
  assert.deepEqual(publicIds(after), []);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getReception(), after);
  scope.release();
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().reception, after);
});

test('shared Editor Display defaults never become Reception edits or undo history', () => {
  const { scope } = fixture(), id = rectangle(scope), before = structuredClone(scope.getReception());
  const candidate = scope.getDraft(), presentation = structuredClone(candidate.workbench);
  presentation.display.shortcut.visible = true; presentation.displays = [];
  candidate.workbench = structuredClone(presentation);
  candidate.workbench.shapes.find(item => item.id === id).window.left += 50;
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration(), historyPresentation: presentation }), true);
  assert.equal(receptionModuleWindow(scope.getReception(), id).left, receptionModuleWindow(before, id).left + 50);
  assert.deepEqual(scope.getReception().workbench.display, before.workbench.display);
  assert.equal(Object.hasOwn(scope.getReception().workbench, 'displays'), Object.hasOwn(before.workbench, 'displays'));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before); scope.release();
});

test('explicit Image drop authors the target cell atomically without changing the editing cell', () => {
  const { scope, root, canvas, fail } = fixture(), target = rectangle(scope), other = rectangle(scope, 600);
  scope.turnShapeIntoCell(target); scope.turnShapeIntoCell(other); scope.setEditingCell(other);
  const dropStore = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(target, candidate, options) };
  const placed = { position: { left: 140, top: 150 }, size: { width: 220, height: 180 }, artwork: createReceptionExample().imageModules[0].artwork };
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
  const side = createReceptionExample().imageModules[0].artwork;
  candidate.imageModules.push({ id: 'image:delayed', name: 'Delayed Image', width: 100, height: 100, visibility: 'PUBLIC', artwork: side });
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




test('stale native commits, cross-document commands and failed saves never partially mutate Reception', () => {
  const { scope, root, canvas, fail } = fixture(), id = rectangle(scope), before = scope.getDraft(), generation = scope.getGeneration();
  scope.turnShapeIntoCell(id);
  assert.equal(scope.commitCompletedOperation(before, { expectedGeneration: generation }), false);
  assert.equal(scope.getLastCommitFailure(), 'stale');
  const saved = structuredClone(scope.getReception());
  const invalid = scope.getDraft(); invalid.grids.push({ title: 'Wrong document' });
  assert.equal(scope.commitCompletedOperation(invalid), false);
  assert.equal(scope.getLastCommitFailure(), 'reception_command');
  fail(true); assert.throws(() => rectangle(scope, 200), /could not be saved/u);
  assert.deepEqual(scope.getReception(), saved); assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas));
  fail(false); scope.release();
  assert.equal(scope.commitCompletedOperation(before), false);
  assert.equal(scope.getLastCommitFailure(), 'editor_unavailable');
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


test('deleting a cell removes its children and undo restores the complete cell', () => {
  const { scope } = fixture(), cell = rectangle(scope), child = rectangle(scope, 140);
  scope.turnShapeIntoCell(cell); setCell(scope, cell, { members: [child] });
  const before = receptionModuleWindow(scope.getReception(), child);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', scope.getSnapshot().shapes.find(item => item.id === cell)), true);
  assert.equal(scope.getCells().length, 0); assert.equal(receptionModuleWindow(scope.getReception(), child), null);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getCells()[0].members, [child]);
  assert.deepEqual(receptionModuleWindow(scope.getReception(), child), before); scope.release();
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
  scope.turnShapeIntoCell(cell); setCell(scope, cell, { members: [child] }); setCell(scope, cell, { lockedMembers: [child] });
  const locked = scope.getSnapshot().shapes.find(item => item.id === child);
  assert.throws(() => editShape(scope, profile, locked, { color: '#ffffff' }), /could not be saved/u);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', locked), false);
  assert.equal(scope.getLastCommitFailure(), 'locked');
  const candidate = scope.getDraft(); candidate.workbench.shapes.find(item => item.id === cell).window.left += 30;
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration() }), true);
  assert.equal(receptionModuleWindow(scope.getReception(), child).left, 180);
  assert.equal(scope.getLastCommitFailure(), null);
  setCell(scope, cell, { lockedMembers: [] });
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

test('Reception conversion failures retain their reason and unsaved Text without changing history', () => {
  const { scope, root, canvas, fail } = fixture({ earlyRead: true }), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const id = addTextModule(scope, profile), expected = scope.getSnapshot().texts.find(item => item.id === id);
  setCell(scope, cell, { lockedMembers: [id], fitText: [] });
  const before = structuredClone(scope.getReception()), history = scope.getHistory();
  const edited = { ...expected, article: { ...expected.article, title: 'Keep my unsaved writing' } };
  const result = saveTextModuleResult(scope, profile, expected, edited);
  assert.deepEqual(result, { saved: false, reason: 'locked', message: 'Unlock this layer before editing it. Your unsaved text is still here.' });
  assert.deepEqual(scope.getReception(), before); assert.deepEqual(scope.getHistory(), history);
  assert.equal(edited.article.title, 'Keep my unsaved writing');
  setCell(scope, cell, { lockedMembers: [] });
  assert.equal(scope.getLastCommitFailure(), null);
  fail(true);
  assert.equal(saveTextModuleResult(scope, profile, expected, edited).reason, 'write_failed');
  fail(false);
  assert.equal(saveTextModuleResult(scope, profile, expected, edited).saved, true);
  assert.equal(scope.getLastCommitFailure(), null);
  assert.deepEqual(canvasPart(root.getSnapshot()), canvasPart(canvas));
  scope.release();
});

test('new cell Text keeps a useful fixed frame while typing without a DOM fitter', () => {
  const { scope, root, storage } = fixture({ measureText: () => ({ width: 80, height: 32 }) }), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const id = addTextModule(scope, profile), frame = receptionModuleWindow(scope.getReception(), id);
  assert.deepEqual(frame, { left: 124, top: 160, width: 272, height: 160 });
  assert.equal(scope.getCells()[0].fitText?.includes(id) || false, false);
  const expected = scope.getSnapshot().texts.find(x => x.id === id);
  const article = { ...expected.article, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A useful line width remains while typing.' }] }] } };
  assert.equal(saveTextModuleResult(scope, profile, expected, { ...expected, article }).saved, true);
  assert.deepEqual(receptionModuleWindow(scope.getReception(), id), frame);
  assert.equal(scope.undo(), true);
  scope.editBento('fitText', [cell, id, true], scope.getGeneration());
  assert.equal(scope.getCells()[0].fitText.includes(id), true, 'content-hugging remains an explicit option');
  assert.equal(scope.undo(), true); assert.deepEqual(receptionModuleWindow(scope.getReception(), id), frame);
  scope.release();
  const loaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.deepEqual(receptionModuleWindow(loaded.getSnapshot().reception, id), frame);
  assert.equal(root.getDraft().reception.cells[0].fitText?.includes(id) || false, false);
});

test('an empty or zero-sized fit measurement retains the usable writing frame', () => {
  for (const measured of [{ width: 0, height: 24 }, { width: 24, height: 0 }]) {
    const { scope } = fixture({ measureText: () => measured }), cell = rectangle(scope);
    scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
    const id = addTextModule(scope, profile), before = receptionModuleWindow(scope.getReception(), id);
    scope.editBento('fitText', [cell, id, true], scope.getGeneration());
    assert.deepEqual(receptionModuleWindow(scope.getReception(), id), before);
    assert.equal(scope.getCells()[0].fitText.includes(id), true); scope.release();
  }
});

test('cell deletion removes locked members and prunes mixed groups without touching unrelated artwork or canvas', () => {
  const { scope, root, canvas, storage } = fixture();
  const first = rectangle(scope), second = rectangle(scope, 600), child = rectangle(scope, 140), survivor = rectangle(scope, 640), outside = rectangle(scope, 1100);
  scope.turnShapeIntoCell(first); scope.turnShapeIntoCell(second);
  setCell(scope, first, { members: [child], lockedMembers: [child] });
  setCell(scope, second, { members: [survivor] });
  const grouped = scope.getDraft();
  grouped.artworkLayers = [...grouped.artworkLayers.filter(id => ![child, survivor, outside].includes(id)),
    { id: 'composition:mixed', name: 'Mixed artwork', children: [child, survivor, outside] }];
  assert.equal(scope.commitCompletedOperation(grouped, { expectedGeneration: scope.getGeneration() }), true);
  const before = structuredClone(scope.getReception()), shapeRecord = id => before.shapes.find(item => item.id === id);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', shapeRecord(child)), false, 'direct deletion still respects the child lock');
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', shapeRecord(first)), true);
  const after = structuredClone(scope.getReception());
  assert.equal(after.shapes.some(item => [first, child].includes(item.id)), false);
  assert.deepEqual(after.cells.map(cell => cell.id), [second]);
  assert.deepEqual(after.artworkLayers.find(item => item.id === 'composition:mixed').children, [survivor, outside]);
  assert.deepEqual(after.shapes.find(item => item.id === outside), shapeRecord(outside));
  assert.deepEqual(receptionModuleWindow(after, outside), receptionModuleWindow(before, outside));
  assert.deepEqual(canvasPart(root.getDraft()), canvasPart(canvas));
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft().reception, after);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getReception(), after);
  scope.release();
});

test('Studio Canvas and Bento start the same named composition with isolated layers, cells, history and reload', () => {
  const { root, scope: profileScope, storage, fail } = fixture();
  const profileCell = rectangle(profileScope);
  profileScope.turnShapeIntoCell(profileCell);
  const profileBento = structuredClone(profileScope.getReception());
  profileScope.release();
  const original = root.readWorkbench(root.getWorkbenchId());
  const canvasId = root.createWorkbench('Illustration', { layout: 'canvas' });
  assert.ok(canvasId);
  const canvas = createReceptionEditorScope(root, { documentId: canvasId });
  assert.equal(canvas.getWorkbenchId(), canvasId);
  assert.deepEqual(canvas.getCells(), []);
  const freeId = rectangle(canvas, 45);
  const frame = structuredClone(receptionModuleWindow(canvas.getReception(), freeId));
  const cellId = rectangle(canvas, 560);
  canvas.turnShapeIntoCell(cellId);
  canvas.setEditingCell(cellId);
  const member = rectangle(canvas, 570);
  assert.deepEqual(canvas.getCells()[0].members, [member]);
  assert.deepEqual(receptionModuleWindow(canvas.getReception(), freeId), frame);
  const checkpoint = structuredClone(canvas.getReception());
  assert.deepEqual(canvas.getBackupSnapshot().workbenches.find(item => item.id === canvasId).content.composition, checkpoint);
  fail(true);
  assert.equal(root.createWorkbench('Failed', { layout: 'bento' }), false);
  assert.equal(canvas.isCurrent(), true);
  assert.deepEqual(canvas.getReception(), checkpoint);
  fail(false);
  const bentoId = root.createWorkbench('Index', { layout: 'bento' });
  assert.ok(bentoId);
  assert.equal(canvas.isCurrent(), false);
  assert.equal(canvas.undo(), false);
  canvas.release();
  const bento = createReceptionEditorScope(root, { documentId: bentoId });
  assert.ok(bento.getCells().length > 1);
  const bentoFree = rectangle(bento, 90);
  assert.ok(bento.getReception().shapes.some(shape => shape.id === bentoFree));
  assert.equal(bento.getCells().some(cell => cell.members.includes(bentoFree)), false);
  assert.equal(bento.undo(), true);
  assert.equal(bento.getReception().shapes.some(shape => shape.id === bentoFree), false);
  bento.release();
  assert.equal(root.switchWorkbench(canvasId), true);
  const returned = createReceptionEditorScope(root, { documentId: canvasId });
  assert.deepEqual(returned.getReception(), checkpoint);
  assert.equal(returned.undo(), true);
  assert.deepEqual(returned.getCells()[0].members, []);
  assert.equal(returned.redo(), true);
  assert.deepEqual(returned.getReception(), checkpoint);
  const reloaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.deepEqual(reloaded.readWorkbench(canvasId).draft.composition, checkpoint);
  assert.deepEqual(reloaded.readWorkbench(original.id), original);
  assert.deepEqual(reloaded.getSnapshot().reception, profileBento);
  returned.release();
});

test('adopting a saved free canvas keeps its identity, native frames, layers, private art and Undo', () => {
  const { root, scope, storage, fail } = fixture();
  scope.release();
  const id = root.createWorkbench('Original canvas');
  const legacy = root.getWorkbenchScope();
  const a = rectangle(legacy, 61), b = rectangle(legacy, 510);
  const image = addImageModule(legacy, profile, { position: { left: 75, top: 92 }, size: { width: 220, height: 180 },
    artwork: createReceptionExample().imageModules[0].artwork });
  const before = root.getDraft();
  const saved = { ...before, artworkLayers: [{ id: 'composition:ink', name: 'Ink', children: [b, a] }, image],
    shapes: before.shapes.map(shape => shape.id === a ? { ...shape, visibility: 'PRIVATE' } : shape) };
  assert.ok(root.commitCompletedOperation(saved, { expectedGeneration: root.getGeneration() }));
  const name = root.readWorkbench(id).name;
  fail(true);
  assert.equal(root.enableCurrentWorkbenchCells(), false);
  assert.deepEqual(root.getDraft(), saved);
  fail(false);
  assert.equal(root.enableCurrentWorkbenchCells(), true);
  assert.equal(root.getWorkbenchId(), id);
  assert.equal(root.readWorkbench(id).name, name);
  const native = createReceptionEditorScope(root, { documentId: id });
  assert.deepEqual(native.getSnapshot().imageModules, saved.imageModules);
  assert.deepEqual(native.getSnapshot().workbench.imageModules, saved.workbench.imageModules);
  assert.deepEqual(native.getSnapshot().shapes, saved.shapes);
  assert.deepEqual(native.getSnapshot().artworkLayers, saved.artworkLayers);
  for (const shape of saved.workbench.shapes)
    assert.deepEqual(receptionModuleWindow(native.getReception(), shape.id), shape.window);
  assert.ok(!projectReception(native.getReception()).shapes.some(shape => shape.id === a));
  native.turnShapeIntoCell(b);
  assert.ok(native.undo());
  assert.equal(native.getCells().length, 0);
  assert.ok(native.undo());
  native.release();
  assert.deepEqual(root.getDraft(), saved);
  assert.ok(root.undo());
  assert.deepEqual(root.getDraft(), before);
  assert.ok(root.redo());
  assert.ok(root.redo());
  assert.equal(root.getDraft().composition?.version, 3);
  const restored = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(restored.getWorkbenchId(), id);
  assert.deepEqual(restored.getDraft().composition, root.getDraft().composition);
});

test('an advanced Display canvas retains its original editable record and rejects incompatible adoption', () => {
  const { root, scope, canvas } = fixture();
  scope.release();
  const before = root.getDraft();
  assert.throws(() => root.enableCurrentWorkbenchCells(), /uses Display/);
  assert.deepEqual(root.getDraft(), before);
  assert.deepEqual(root.getDraft().grids, canvas.grids);
});

test('a first Studio session opens a mixed canvas while preserving an existing draft on subsequent loads', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage, initialStudio: true });
  assert.equal(data.size, 0);
  assert.deepEqual(root.getSnapshot().composition.cells, []);
  const native = createReceptionEditorScope(root, { documentId: root.getWorkbenchId() });
  const id = rectangle(native, 20);
  native.turnShapeIntoCell(id);
  native.release();
  assert.equal(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getSnapshot().composition.cells[0].id, id);
});


test('a Canvas starter can use full canvas modules under the same name, ID and undo history', () => {
  const { root, scope: profileScope, storage, fail } = fixture();
  assert.equal(root.enableCurrentCanvasModules(), false);
  profileScope.release();
  const id = root.createWorkbench('Modules', { layout: 'canvas' });
  const scope = createReceptionEditorScope(root, { documentId: id });
  const shape = rectangle(scope, 320);
  const before = root.getDraft();
  scope.turnShapeIntoCell(shape);
  assert.equal(root.enableCurrentCanvasModules(), false);
  assert.ok(scope.undo());
  fail(true);
  assert.equal(root.enableCurrentCanvasModules(), false);
  assert.deepEqual(root.getDraft(), before);
  fail(false);
  assert.ok(root.enableCurrentCanvasModules());
  scope.release();
  assert.equal(root.getWorkbenchId(), id);
  assert.equal(root.readWorkbench(id).name, 'Modules');
  assert.deepEqual(root.getDraft().workbench, before.composition.workbench);
  assert.deepEqual(root.getDraft().shapes, before.composition.shapes);
  assert.deepEqual(root.getDraft().artworkLayers, before.composition.artworkLayers);
  assert.ok(root.undo());
  assert.deepEqual(root.getDraft(), before);
  assert.ok(root.redo());
  const canvas = root.getWorkbenchScope();
  openWorkbenchIndex(canvas, profile);
  const group = editWorkbenchGroups(canvas, profile, { type: 'create', name: 'Shapes', memberIds: [shape] });
  assert.throws(() => root.enableCurrentWorkbenchCells(), /workspace groups or a camera index/);
  const reloaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage }).readWorkbench(id);
  assert.equal(reloaded.name, 'Modules');
  assert.equal(reloaded.draft.workbenchIndex.open, true);
  assert.equal(reloaded.draft.workbenchGroups[0].id, group);
  assert.deepEqual(reloaded.draft.workbenchGroups[0].memberIds, [shape]);
});
