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
import { addImageModule } from '../imageModule/imageModuleSession.js';

const fixtureRoots = new WeakMap();
function setCell(scope, id, patch) {
  const root = fixtureRoots.get(scope), draft = root.getDraft();
  assert.equal(root.commitCompletedOperation({ ...draft, reception: { ...draft.reception,
    cells: draft.reception.cells.map(cell => cell.id === id ? { ...cell, ...patch } : cell) } },
  { expectedGeneration: root.getGeneration(), historyLabel: 'Prepare cell fixture' }), true);
}
const profile = '0x' + '6'.repeat(40);
function fixture() {
  const data = new Map(); let failure = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failure) throw Error('storage full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  addShape(root, profile, { position: { left: 900, top: 700 }, size: { width: 200, height: 160 } });
  const canvas = structuredClone(root.getSnapshot()), scope = createReceptionEditorScope(root);
  fixtureRoots.set(scope, root);
  return { root, scope, storage, canvas, fail: value => { failure = value; } };
}
const canvasPart = ({ reception: _reception, ...rest }) => rest;
const rectangle = (scope, left = 100) => addShape(scope, profile, { position: { left, top: 120 }, size: { width: 320, height: 240 } });

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

test('deleting a private cell keeps Image, Text and Shape private atomically through failure, Undo, Redo and reload', () => {
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
    assert.deepEqual(after[key].find(item => item.id === id), { ...before[key].find(item => item.id === id), visibility: 'PRIVATE' });
    const previousWindow = receptionModuleWindow(before, id);
    assert.deepEqual(receptionModuleWindow(after, id), key === 'texts'
      ? { ...previousWindow, width: Math.max(180, previousWindow.width), height: Math.max(24, previousWindow.height) }
      : previousWindow, 'released content keeps its position and meets the standalone Text minimum');
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
  presentation.display.shortcut.visible = true; presentation.displays = []; presentation.miniApps = [];
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


test('deleting a cell prunes its membership while retaining independent child artwork, and undo restores it', () => {
  const { scope } = fixture(), cell = rectangle(scope), child = rectangle(scope, 140);
  scope.turnShapeIntoCell(cell); setCell(scope, cell, { members: [child] });
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
  scope.turnShapeIntoCell(cell); setCell(scope, cell, { members: [child] }); setCell(scope, cell, { lockedMembers: [child] });
  const locked = scope.getSnapshot().shapes.find(item => item.id === child);
  assert.throws(() => editShape(scope, profile, locked, { color: '#ffffff' }), /could not be saved/u);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', locked), false);
  const candidate = scope.getDraft(); candidate.workbench.shapes.find(item => item.id === cell).window.left += 30;
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration() }), true);
  assert.equal(receptionModuleWindow(scope.getReception(), child).left, 180);
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
