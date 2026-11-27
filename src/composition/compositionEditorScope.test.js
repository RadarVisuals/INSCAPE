import { projectWorkbenchDraft } from '../systemWorkflow/domain/workbenchCollection.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { drawCompositionBentoCell } from './compositionCellDrawing.js';
import { createCompositionEditorScope } from './compositionEditorScope.js';
import { addKeeperDock } from '../keeper/keeperSession.js';
import { addShape, editShape } from '../shapes/shapeSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';
import { moveWorkbenchSelection } from '../systemWorkflow/moveWorkbenchSelection.js';
import { compositionModuleWindow, withCompositionModuleWindow } from './compositionEditorDocument.js';
import { cellLayerOutline } from '../public/ownerSystemWorkflow/workbenchLayerOutline.js';
import { editArtworkLayers } from '../systemWorkflow/artworkLayerSession.js';
import { layerIds, layerMembers } from '../systemWorkflow/domain/artworkLayers.js';
import { validCompositionArtwork as validComposition, projectCompositionEditorDocument as projectComposition } from './compositionEditorDocument.js';
import { addTextModule, saveTextModuleResult, changeTextFrames } from '../text/textSession.js';
import { createCompositionExample } from '../../design-system/lab/compositionExample.js';
import { editWorkbenchGroups } from '../systemWorkflow/workbenchGroupSession.js';
import { openWorkbenchIndex } from '../systemWorkflow/workbenchIndexSession.js';
import { addImageModule } from '../imageModule/imageModuleSession.js';

const fixtureRoots = new WeakMap();
function setCell(scope, id, patch) {
  const root = fixtureRoots.get(scope), draft = root.getDraft();
  assert.equal(root.commitCompletedOperation({ ...draft,
    cells: draft.cells.map(cell => cell.id === id ? { ...cell, ...patch } : cell) },
  { expectedGeneration: root.getGeneration(), historyLabel: 'Prepare cell fixture' }), true);
}
const profile = '0x' + '6'.repeat(40);
function fixture({ earlyRead = false, measureText } = {}) {
  const data = new Map(); let failure = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failure) throw Error('storage full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  let scope;
  if (earlyRead) root.subscribe(() => scope?.getSnapshot());
  const canvas = profileFields(structuredClone(root.getSnapshot()));
  scope = createCompositionEditorScope(root, { measureText });
  fixtureRoots.set(scope, root);
  return { root, scope, storage, canvas, fail: value => { failure = value; } };
}
const profileFields = ({ profileAddress, draftVersion, identityPresentation, appearance }) => ({ profileAddress, draftVersion, identityPresentation, appearance });

test('a shared Keeper edit belongs to the profile and expires with its composition editor', () => {
  const { root, scope } = fixture();
  addKeeperDock(root, profile);
  const [record] = scope.keeper.records();
  const composition = root.getSnapshot().shapes;
  assert.ok(scope.keeper.save(record, { name: 'Companion' }));
  const [renamed] = root.getSnapshot().keeperDocks;
  assert.equal(renamed.id, record.id);
  assert.equal(renamed.name, 'Companion');
  assert.deepEqual(root.getSnapshot().shapes, composition);
  assert.equal(scope.keeper.remove(record), false);
  scope.release();
  const reopened = createCompositionEditorScope(root);
  assert.equal(scope.keeper.remove(renamed), false);
  assert.equal(scope.keeper.save(renamed, { name: 'Stale edit' }), false);
  assert.deepEqual(reopened.keeper.records(), [renamed]);
  assert.ok(reopened.keeper.remove(renamed));
  assert.ok(reopened.undo());
  assert.deepEqual(reopened.keeper.records(), [renamed]);
  reopened.release();
});
const rectangle = (scope, left = 100) => addShape(scope, profile, { position: { left, top: 120 }, size: { width: 320, height: 240 } });

test('duplicate a marquee or a group containing a cell in one history step', () => {
  const { scope, storage } = fixture(), a = rectangle(scope), b = rectangle(scope, 600), art = rectangle(scope, 180);
  scope.turnShapeIntoCell(a);
  setCell(scope, a, { members: [art], slides: [[art]], swipeDirection: 'up' });
  const group = { id: 'composition:copy-test', name: 'Pair', children: [a, b], stackPosition: { left: 20, top: 30 } };
  const beforeGroup = scope.getComposition();
  const copy = ids => scope.duplicateLayers(ids, { x: 60, y: 70 }, undefined, scope.getGeneration());
  const plain = copy([a, b]);
  assert.ok(plain.every(id => typeof id === 'string' && ![a, b].includes(id)));
  assert.ok(scope.getComposition().artworkLayers.every(layer => typeof layer === 'string'));
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), beforeGroup);
  const draft = scope.getDraft();
  draft.artworkLayers = [group, art];
  assert.ok(scope.commitCompletedOperation(draft, { expectedGeneration: scope.getGeneration() }));
  const before = scope.getComposition(), [cellCopy, shapeCopy] = copy([a, b]), after = scope.getComposition();
  const clone = after.cells.find(c => c.id === cellCopy);
  assert.deepEqual(clone.slides, [clone.members]); assert.notEqual(clone.members[0], art);
  assert.equal(clone.swipeDirection, 'up');
  assert.deepEqual(after.artworkLayers.find(layer => layer.children?.includes(cellCopy)).children, [cellCopy, shapeCopy]);
  assert.deepEqual(after.artworkLayers.find(layer => layer.children?.includes(cellCopy)).stackPosition, { left: 80, top: 100 });
  for (const [id, newId] of [[a, cellCopy], [b, shapeCopy], [art, clone.members[0]]]) {
    const frame = compositionModuleWindow(before, id);
    assert.deepEqual(compositionModuleWindow(after, id), frame);
    assert.deepEqual(compositionModuleWindow(after, newId), { ...frame, left: frame.left + 60, top: frame.top + 70 });
  }
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), after);
  scope.release();
});

test('duplicating the first linked slide inserts independent artwork before later slides in one history step', () => {
  const { scope, storage } = fixture();
  const a = rectangle(scope), b = rectangle(scope, 600);
  for (const id of [a, b]) scope.turnShapeIntoCell(id);
  const left = rectangle(scope, 150), right = rectangle(scope, 640), later = rectangle(scope, 160);
  setCell(scope, a, { members: [left, later] });
  setCell(scope, b, { members: [right] });
  const edit = (action, args) => scope.editBento(action, args, scope.getGeneration());
  edit('slides', [a, 'link', b]);
  edit('slides', [a, 'assign', 1, later]);
  const before = scope.getComposition();
  edit('duplicateSlide', [a, 0]);
  const after = scope.getComposition();
  for (const [i, source] of [left, right].entries()) {
    const cell = after.cells[i], [copy] = cell.slides[0];
    assert.equal(cell.slides[0].length, 1);
    assert.ok(!before.cells[i].members.includes(copy));
    assert.deepEqual(cell.slides[1], before.cells[i].slides[0]);
    assert.deepEqual(compositionModuleWindow(after, copy), compositionModuleWindow(before, source));
  }
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), after);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), after);
  scope.release();
});

test('linked slides keep layers, frames and private assignments scoped across history and reload', () => {
  const { scope, storage } = fixture(), a = rectangle(scope), b = rectangle(scope, 600), art = rectangle(scope, 180);
  for (const cell of [a, b]) scope.turnShapeIntoCell(cell);
  setCell(scope, a, { members: [art] });
  const before = scope.getComposition(), edit = (id, ...args) => scope.editBento('slides', [id, ...args], scope.getGeneration());
  edit(a, 'link', b);
  const linked = scope.getComposition();
  assert.deepEqual(linked.cells.map(cell => cell.slides), [[[]], [[]]]);
  assert.equal(linked.cells[0].swipeLink, linked.cells[1].swipeLink);
  assert.deepEqual(linked.workbench, before.workbench);
  for (const direction of ['up', 'right', 'down', 'left', 'up']) {
    edit(a, 'direction', direction);
    assert.equal(scope.getCells()[0].swipeDirection || 'left', direction);
    assert.equal(scope.getCells()[1].swipeDirection, undefined);
  }
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), linked);
  assert.ok(scope.redo()); assert.equal(projectComposition(scope.getComposition()).cells[0].swipeDirection, 'up');
  scope.showSlide(b, 1); scope.setEditingCell(b);
  const caption = rectangle(scope, 650), caption2 = rectangle(scope, 660);
  edit(a, 'assign', 1, art);
  assert.deepEqual(scope.getComposition().cells.map(cell => cell.slides), [[[art]], [[caption, caption2]]]);
  assert.throws(() => edit(a, 'remove'), /Move the layers/);
  edit(a, 'add');
  assert.deepEqual(scope.getComposition().cells.map(cell => cell.slides.length), [2, 2]);
  edit(a, 'remove');
  const saved = scope.getComposition();
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), saved);
  const privateCopy = structuredClone(saved);
  privateCopy.shapes.find(shape => shape.id === caption).visibility = 'PRIVATE';
  assert.deepEqual(projectComposition(privateCopy).cells[1].slides, [[caption2]]);
  edit(a, 'unlink'); assert.ok(scope.getCells().every(cell => !cell.swipeLink));
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), saved);
  assert.ok(scope.redo()); assert.deepEqual(scope.getCells()[1].slides, [[caption, caption2]]);
  scope.release();
});

test('single-line cell choice persists, publishes and undoes without changing authored geometry', () => {
  const { root, scope, storage, fail, canvas } = fixture();
  const id = rectangle(scope); scope.turnShapeIntoCell(id);
  const before = structuredClone(scope.getComposition());
  const change = enabled => scope.editBento('cellSingleLine', [id, enabled], scope.getGeneration());
  change(true);
  const accepted = structuredClone(scope.getComposition());
  assert.equal(accepted.cells[0].singleLine, true);
  assert.deepEqual(accepted.workbench, before.workbench);
  assert.equal(projectComposition(accepted).cells[0].singleLine, true);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), accepted);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), accepted);
  assert.throws(() => change('yes'));
  assert.deepEqual(scope.getComposition(), accepted);
  fail(true); assert.throws(() => change(false)); fail(false);
  assert.deepEqual(scope.getComposition(), accepted); assert.deepEqual(profileFields(root.getDraft()), profileFields(canvas));
  scope.release();
});

test('saved responsive arrangement survives ordinary editing, Undo, Redo and reload', () => {
  const { root, scope, storage, canvas } = fixture();
  const first = rectangle(scope), second = rectangle(scope, 600);
  scope.turnShapeIntoCell(first); scope.turnShapeIntoCell(second);
  const draft = root.getDraft();
  const [a, b] = draft.cells;
  const arranged = { ...draft, stackOrder: 'manual',
    cells: [{ ...b, mobile: { ...b.mobile, height: 180, autoHeight: false } }, a] };
  assert.ok(root.commitCompletedOperation(arranged, { expectedGeneration: root.getGeneration() }));
  const before = structuredClone(scope.getComposition());
  rectangle(scope, 1100);
  assert.deepEqual(scope.getComposition().cells, arranged.cells);
  assert.equal(scope.getComposition().stackOrder, 'manual');
  const edited = structuredClone(scope.getComposition());
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo());
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), edited);
  assert.deepEqual(profileFields(root.getDraft()), profileFields(canvas));
  scope.release();
});

function membershipFixture() {
  const state = fixture(), { scope } = state, source = rectangle(scope), target = rectangle(scope, 600);
  scope.turnShapeIntoCell(source); scope.turnShapeIntoCell(target); scope.setEditingCell(source);
  const image = addImageModule(scope, profile, { position: { left: 120, top: 150 }, size: { width: 160, height: 100 },
    artwork: createCompositionExample().imageModules[0].artwork });
  const text = addTextModule(scope, profile, null, { visibility: 'PUBLIC' }), remaining = rectangle(scope, 160);
  scope.setEditingCell(null);
  scope.editBento('anchorMembers', [source, [image, text, remaining], { alignX: 'center', alignY: 'center', paddingX: 0, paddingY: 0 }], scope.getGeneration());
  setCell(scope, source, { fitText: [text], mobile: { columns: 2, height: 240, placements: [
    { id: text, window: { left: 10, top: 20, width: 100, height: 40 } },
  ] } });
  return { ...state, source, target, image, text, remaining };
}

test('cell outline selects whole saved groups across different owners and inside one cell', () => {
  for (const placement of ['free', 'other cell', 'same cell']) {
    const { scope } = fixture(), first = rectangle(scope), second = rectangle(scope, 600);
    scope.turnShapeIntoCell(first); scope.turnShapeIntoCell(second);
    scope.setEditingCell(first);
    const a = rectangle(scope, 120);
    scope.setEditingCell(placement === 'other cell' ? second : placement === 'same cell' ? first : null);
    const b = rectangle(scope, 180);
    const before = structuredClone(scope.getComposition());
    const edit = action => editArtworkLayers(scope, profile, action);
    edit({ type: 'group', ids: [a, b], id: 'composition:pair', name: 'Pair' });
    const grouped = structuredClone(scope.getComposition());
    const owners = new Map(grouped.cells.flatMap(cell => cell.members.map(id => [id, cell.id])));
    const { outline, blockOwners } = cellLayerOutline(grouped.artworkLayers, owners);
    const row = outline.get(placement === 'same cell' ? first : undefined).find(layer => layer.id === 'composition:pair');
    assert.deepEqual(layerMembers(row), [a, b]);
    assert.equal([...outline.values()].flat().filter(layer => layer.id === row.id).length, 1);
    assert.equal(blockOwners.get(a), row.id);
    if (placement !== 'same cell') assert.ok(outline.get(first).includes(a));
    if (placement === 'other cell') assert.ok(outline.get(second).includes(b));
    edit({ type: 'ungroup', id: row.id });
    assert.deepEqual(scope.getComposition(), before);
    assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), grouped);
    assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), before);
    scope.release();
  }
});

test('explicit cell transfer preserves native identity, relative geometry and remaining artwork through Undo and reload', () => {
  const { root, scope, storage, canvas, source, target, image, text, remaining } = membershipFixture();
  const before = structuredClone(scope.getComposition()), frame = id => compositionModuleWindow(scope.getComposition(), id);
  const oldImage = frame(image), oldText = frame(text), oldRemaining = frame(remaining);
  scope.editBento('moveMembers', [[text, image], target], scope.getGeneration());
  const after = structuredClone(scope.getComposition());
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
  assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getComposition(), after);
  const generation = scope.getGeneration();
  scope.editBento('moveMembers', [[image, text], target], generation);
  assert.equal(scope.getGeneration(), generation, 'moving to the current cell is a no-op');
  scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
});

test('cell transfer rejects stale, locked, invalid and failed operations without partial ownership changes', () => {
  const { scope, fail, source, target, image, remaining } = membershipFixture();
  let before = structuredClone(scope.getComposition()), generation = scope.getGeneration();
  const move = (ids, destination = target, expected = scope.getGeneration()) => scope.editBento('moveMembers', [ids, destination], expected);
  fail(true); assert.throws(() => move([image]), /saved/); fail(false);
  assert.deepEqual(scope.getComposition(), before); assert.equal(scope.getGeneration(), generation);
  assert.throws(() => move([source]), /backgrounds/);
  assert.throws(() => move([image], 'shape:missing'), /destination/);
  assert.throws(() => move([image, image]), /Select/);
  assert.deepEqual(scope.getComposition(), before);
  setCell(scope, source, { lockedMembers: [remaining] }); before = structuredClone(scope.getComposition());
  assert.throws(() => move([image]), /Unlock/, 'releasing a shared anchor also respects its locked companion');
  assert.throws(() => move([image], target, generation), /changed/);
  assert.deepEqual(scope.getComposition(), before);
  setCell(scope, source, { lockedMembers: [image] }); before = structuredClone(scope.getComposition());
  assert.throws(() => move([image], null), /Unlock/); assert.deepEqual(scope.getComposition(), before);
  scope.release(); assert.throws(() => move([image]), /active/);
});

test('releasing a cell member keeps its location and authored visibility, respects standalone size and can be undone', () => {
  const { root, scope, source, text } = membershipFixture();
  let candidate = root.getDraft();
  candidate.shapes.find(shape => shape.id === source).visibility = 'PRIVATE';
  candidate = withCompositionModuleWindow(candidate, text, { left: 120, top: 160, width: 80, height: 24 });
  // This explicitly free label has no placement constraint to restore on release.
  candidate.cells.find(cell => cell.id === source).memberAnchors = [];
  assert.equal(root.commitCompletedOperation(candidate, { expectedGeneration: root.getGeneration() }), true);
  const before = structuredClone(scope.getComposition());
  scope.editBento('moveMembers', [[text], null], scope.getGeneration());
  const after = scope.getComposition();
  assert.equal(after.cells.some(cell => cell.members.includes(text)), false);
  assert.deepEqual(compositionModuleWindow(after, text), { left: 120, top: 160, width: 180, height: 24 });
  assert.deepEqual(after.texts, before.texts, 'explicit transfer preserves authored publication flags');
  assert.ok(projectComposition(after).texts.some(item => item.id === text));
  scope.undo(); assert.deepEqual(scope.getComposition(), before); scope.release();
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

test('anchoring, free placement and clipping share native Composition history while retaining profile data', () => {
  const { root, scope, canvas } = fixture(), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const first = addImageModule(scope, profile), second = rectangle(scope, 140);
  scope.setEditingCell(null);
  const placement = { alignX: 'center', alignY: 'center', paddingX: 12, paddingY: 8 };
  scope.editBento('anchorMembers', [cell, [first, second], placement], scope.getGeneration());
  const anchored = structuredClone(scope.getComposition()), original = compositionModuleWindow(anchored, first);
  moveWorkbenchSelection(scope, profile, [{ id: first, left: original.left + 20, top: original.top }], scope.getSnapshot().workbench);
  assert.equal(scope.getCells()[0].memberAnchors, undefined);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), anchored);
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), first), original);
  assert.equal(scope.redo(), true); assert.equal(scope.getCells()[0].memberAnchors, undefined);
  scope.editBento('cellClip', [cell, false], scope.getGeneration());
  assert.equal(scope.getCells()[0].clipContent, false);
  assert.equal(scope.undo(), true); assert.equal(scope.getCells()[0].clipContent, undefined);
  assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas));
  scope.release();
});

test('cell placement rejects locked members and stale scope generations without changing saved anchors', () => {
  const { scope } = fixture(), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell); const child = rectangle(scope);
  scope.setEditingCell(null);
  const placement = { alignX: 'left', alignY: 'top', paddingX: 4, paddingY: 6 };
  scope.editBento('anchorMembers', [cell, [child], placement], scope.getGeneration());
  const stale = scope.getGeneration(); setCell(scope, cell, { lockedMembers: [child] });
  const saved = scope.getComposition();
  assert.throws(() => scope.editBento('anchorMembers', [cell, [child], null], scope.getGeneration()), /Unlock/);
  assert.throws(() => scope.editBento('anchorMembers', [cell, [child], placement], stale), /changed/);
  assert.deepEqual(scope.getComposition(), saved); scope.release();
});

test('deletion invalidates editing before immediate Undo without any subscriber or intermediate read', () => {
  const { scope } = fixture(), cell = rectangle(scope); scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const expected = scope.getSnapshot().shapes.find(item => item.id === cell);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', expected), true);
  assert.equal(scope.undo(), true); assert.equal(scope.getEditingCell(), null); scope.release();
});

test('deleting a private cell removes Image, Text and Shape atomically through failure, Undo, Redo and reload', () => {
  const { scope, storage, fail } = fixture(), cell = rectangle(scope); scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const image = addImageModule(scope, profile, { position: { left: 120, top: 140 }, size: { width: 220, height: 180 }, artwork: createCompositionExample().imageModules[0].artwork });
  const text = addTextModule(scope, profile, null, { visibility: 'PUBLIC' });
  const shape = rectangle(scope), privateText = addTextModule(scope, profile);
  const candidate = scope.getDraft();
  for (const key of ['imageModules', 'shapes']) candidate[key] = candidate[key].map(item => ({ ...item, visibility: item.id === cell ? 'PRIVATE' : 'PUBLIC' }));
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration() }), true);
  const before = structuredClone(scope.getComposition()), expected = before.shapes.find(item => item.id === cell);
  const publicIds = value => ['imageModules', 'texts', 'shapes'].flatMap(key => projectComposition(value)[key].map(item => item.id));
  assert.deepEqual(publicIds(before), []);
  fail(true); assert.equal(removeWorkbenchModule(scope, profile, 'shape', expected), false);
  assert.deepEqual(scope.getComposition(), before); fail(false);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', expected), true);
  const after = structuredClone(scope.getComposition());
  for (const id of [image, text, shape, privateText]) {
    const key = ['imageModules', 'texts', 'shapes'].find(key => before[key].some(item => item.id === id));
    assert.equal(after[key].some(item => item.id === id), false);
    assert.equal(after.workbench[key].some(item => item.id === id), false);
    assert.equal(layerIds(after.artworkLayers).includes(id), false);
  }
  assert.deepEqual(publicIds(after), []);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getComposition(), after);
  scope.release();
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), after);
});

test('Composition geometry changes add only the intended edit to history', () => {
  const { scope } = fixture(), id = rectangle(scope), before = structuredClone(scope.getComposition());
  const candidate = scope.getDraft(), presentation = structuredClone(candidate.workbench);
  candidate.workbench = structuredClone(presentation);
  candidate.workbench.shapes.find(item => item.id === id).window.left += 50;
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration(), historyPresentation: presentation }), true);
  assert.equal(compositionModuleWindow(scope.getComposition(), id).left, compositionModuleWindow(before, id).left + 50);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before); scope.release();
});

test('explicit Image drop authors the target cell atomically without changing the editing cell', () => {
  const { scope, root, canvas, fail } = fixture(), target = rectangle(scope), other = rectangle(scope, 600);
  scope.turnShapeIntoCell(target); scope.turnShapeIntoCell(other); scope.setEditingCell(other);
  const dropStore = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(target, candidate, options) };
  const placed = { position: { left: 140, top: 150 }, size: { width: 220, height: 180 }, artwork: createCompositionExample().imageModules[0].artwork };
  const before = structuredClone(scope.getComposition());
  fail(true); assert.throws(() => addImageModule(dropStore, profile, placed), /could not be saved/u);
  assert.deepEqual(scope.getComposition(), before); fail(false);
  const id = addImageModule(dropStore, profile, placed);
  assert.deepEqual(scope.getCells().find(cell => cell.id === target).members, [id]);
  assert.deepEqual(scope.getCells().find(cell => cell.id === other).members, []);
  assert.equal(scope.getEditingCell(), other);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getCells().find(cell => cell.id === target).members, [id]);
  const saved = structuredClone(scope.getComposition());
  assert.equal(scope.commitInCell('shape:missing', scope.getDraft()), false);
  assert.deepEqual(scope.getComposition(), saved);
  assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas)); scope.release();
});

test('a delayed explicit cell creation cannot commit after its document generation changes', async () => {
  const { scope } = fixture(), target = rectangle(scope);
  scope.turnShapeIntoCell(target);
  const candidate = scope.getDraft(), expectedGeneration = scope.getGeneration();
  const side = createCompositionExample().imageModules[0].artwork;
  candidate.imageModules.push({ id: 'image:delayed', name: 'Delayed Image', width: 100, height: 100, visibility: 'PUBLIC', artwork: side });
  candidate.workbench.imageModules.push({ id: 'image:delayed', open: true, position: { left: 140, top: 150 } });
  await Promise.resolve();
  rectangle(scope, 600);
  const saved = structuredClone(scope.getComposition());
  assert.equal(scope.commitInCell(target, candidate, { expectedGeneration, historyLabel: 'Add Image' }), false);
  assert.deepEqual(scope.getComposition(), saved);
  assert.deepEqual(scope.getCells()[0].members, []); scope.release();
});

test('native rectangle conversion keeps exact appearance and geometry and keeps the same document and profile', () => {
  const { root, scope, canvas, storage } = fixture(), id = rectangle(scope);
  editShape(scope, profile, scope.getSnapshot().shapes[0], { color: '#123456', opacity: .4 });
  const before = structuredClone(scope.getSnapshot());
  assert.equal(scope.turnShapeIntoCell(id), id);
  assert.deepEqual(scope.getSnapshot().shapes, before.shapes);
  assert.deepEqual(scope.getSnapshot().workbench, before.workbench);
  assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas));
  assert.equal(scope.getWorkbenchId(), root.getWorkbenchId());
  assert.equal(scope.getCells()[0].id, id);
  assert.equal(validComposition(root.getSnapshot()), true);
  assert.equal(scope.undo(), true); assert.equal(scope.getCells().length, 0);
  assert.equal(scope.redo(), true); assert.equal(scope.getCells().length, 1);
  scope.release();
  const loaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(loaded.getSnapshot().cells[0].id, id);
});




test('stale native commits, cross-document commands and failed saves never partially mutate Composition', () => {
  const { scope, root, canvas, fail } = fixture(), id = rectangle(scope), before = scope.getDraft(), generation = scope.getGeneration();
  scope.turnShapeIntoCell(id);
  assert.equal(scope.commitCompletedOperation(before, { expectedGeneration: generation }), false);
  assert.equal(scope.getLastCommitFailure(), 'stale');
  const saved = structuredClone(scope.getComposition());
  const invalid = scope.getDraft(); invalid.grids = [{ title: 'Wrong document' }];
  assert.equal(scope.commitCompletedOperation(invalid, { expectedGeneration: scope.getGeneration() }), false);
  assert.equal(scope.getLastCommitFailure(), 'invalid');
  fail(true); assert.throws(() => rectangle(scope, 200), /could not be saved/u);
  assert.deepEqual(scope.getComposition(), saved); assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas));
  fail(false); scope.release();
  assert.equal(scope.commitCompletedOperation(before), false);
  assert.equal(scope.getLastCommitFailure(), 'editor_unavailable');
});

test('native live presentation is stored in Composition undo history in the shared document', () => {
  const { scope, root, canvas } = fixture(), id = rectangle(scope);
  const live = structuredClone(scope.getSnapshot().workbench); live.shapes[0].window.left = 270;
  scope.turnShapeIntoCell(id, live);
  assert.equal(scope.undo(), true);
  assert.equal(scope.getSnapshot().workbench.shapes[0].window.left, 270);
  assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas));
  const candidate = scope.getDraft(); candidate.shapes = []; candidate.workbench.shapes = []; candidate.artworkLayers = [];
  assert.equal(scope.commitCompletedOperation(candidate, { expectedGeneration: scope.getGeneration(), historyPresentation: live, historyLabel: 'Delete native shape' }), true);
  assert.equal(scope.undo(), true); assert.equal(scope.getSnapshot().workbench.shapes[0].window.left, 270);
  assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas)); scope.release();
});


test('deleting a cell removes its children and undo restores the complete cell', () => {
  const { scope } = fixture(), cell = rectangle(scope), child = rectangle(scope, 140);
  scope.turnShapeIntoCell(cell); setCell(scope, cell, { members: [child] });
  const before = compositionModuleWindow(scope.getComposition(), child);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', scope.getSnapshot().shapes.find(item => item.id === cell)), true);
  assert.equal(scope.getCells().length, 0); assert.equal(compositionModuleWindow(scope.getComposition(), child), null);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getCells()[0].members, [child]);
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), child), before); scope.release();
});

test('native default additions fit inside the edited cell while explicitly placed artwork keeps its position', () => {
  const { scope } = fixture(), cell = rectangle(scope, 900);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const text = addTextModule(scope, profile), shape = addShape(scope, profile);
  const bounds = compositionModuleWindow(scope.getComposition(), cell);
  for (const id of [text, shape]) {
    const frame = compositionModuleWindow(scope.getComposition(), id);
    assert.ok(scope.getCells()[0].members.includes(id));
    assert.ok(frame.left >= bounds.left && frame.top >= bounds.top);
    assert.ok(frame.left + frame.width <= bounds.left + bounds.width);
    assert.ok(frame.top + frame.height <= bounds.top + bounds.height);
  }
  const explicit = rectangle(scope, 920);
  assert.equal(compositionModuleWindow(scope.getComposition(), explicit).left, 920);
  assert.equal(Object.hasOwn(scope.getSnapshot(), 'grids'), false);
  assert.equal(Object.hasOwn(scope.getSnapshot(), 'displays'), false);
  scope.release();
});

test('a cell lock protects its frame and contents list while allowing a child lock to be toggled', () => {
  const { scope } = fixture(), cell = rectangle(scope), child = rectangle(scope, 150);
  scope.turnShapeIntoCell(cell); setCell(scope, cell, { members: [child] });
  const before = scope.getComposition();
  scope.setArtworkLocks([cell, child], true);
  const moved = scope.getDraft();
  moved.workbench.shapes.find(shape => shape.id === cell).window.left += 24;
  assert.equal(scope.commitCompletedOperation(moved, { expectedGeneration: scope.getGeneration() }), false);
  assert.equal(scope.getLastCommitFailure(), 'locked');
  scope.setArtworkLocks([child], false);
  assert.deepEqual(scope.getComposition().cells, before.cells);
  scope.setArtworkLocks([cell], false);
  assert.deepEqual(scope.getComposition(), before);
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
  assert.equal(compositionModuleWindow(scope.getComposition(), child).left, 180);
  assert.equal(scope.getLastCommitFailure(), null);
  setCell(scope, cell, { lockedMembers: [] });
  assert.doesNotThrow(() => editShape(scope, profile, scope.getSnapshot().shapes.find(item => item.id === child), { color: '#ffffff' }));
  scope.release();
});

test('native Text retry merges into the latest saved Composition without overwriting unrelated cells or profile data', () => {
  const { scope, root, storage, canvas } = fixture(), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); const id = addTextModule(scope, profile), expected = scope.getSnapshot().texts.find(item => item.id === id);
  const edited = { ...expected, article: { ...expected.article, title: 'Recovered text' } };
  const key = systemWorkflowDraftKey(profile), external = JSON.parse(storage.getItem(key));
  const composition = external;
  composition.cells[0].mobile.height = 480; storage.setItem(key, JSON.stringify(external));
  assert.equal(saveTextModuleResult(scope, profile, expected, edited).saved, false);
  assert.equal(saveTextModuleResult(scope, profile, expected, edited, { retry: true }).saved, true);
  assert.equal(scope.getCells()[0].mobile.height, 480);
  assert.equal(scope.getSnapshot().texts.find(item => item.id === id).article.title, 'Recovered text');
  assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas)); scope.release();
});


test('linked and paginated Text retain their content and history in the same composition', () => {
  const { scope, storage } = fixture(), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell);
  const id = addTextModule(scope, profile), expected = scope.getSnapshot().texts.find(item => item.id === id);
  const before = scope.getSnapshot(), presentation = before.workbench.texts.find(item => item.id === id);
  const frames = [{ id: 'text-frame:continued', window: { left: 500, top: 100, width: 400, height: 300 } }];
  changeTextFrames(scope, profile, expected, presentation, frames);
  assert.deepEqual(scope.getSnapshot().workbench.texts.find(item => item.id === id).frames, frames);
  assert.equal(saveTextModuleResult(scope, profile, expected, { ...expected, pagination: 'pages' }).saved, true);
  const saved = scope.getSnapshot();
  assert.ok(scope.undo()); assert.ok(scope.undo()); assert.deepEqual(scope.getSnapshot(), before);
  assert.ok(scope.redo()); assert.ok(scope.redo()); assert.deepEqual(scope.getSnapshot(), saved);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getSnapshot(), saved);
  scope.release();
});

test('Cell edit failures retain their reason and unsaved Text without changing history', () => {
  const { scope, root, canvas, fail } = fixture({ earlyRead: true }), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const id = addTextModule(scope, profile), expected = scope.getSnapshot().texts.find(item => item.id === id);
  setCell(scope, cell, { lockedMembers: [id], fitText: [] });
  const before = structuredClone(scope.getComposition()), history = scope.getHistory();
  const edited = { ...expected, article: { ...expected.article, title: 'Keep my unsaved writing' } };
  const result = saveTextModuleResult(scope, profile, expected, edited);
  assert.deepEqual(result, { saved: false, reason: 'locked', message: 'Unlock this layer before editing it. Your unsaved text is still here.' });
  assert.deepEqual(scope.getComposition(), before); assert.deepEqual(scope.getHistory(), history);
  assert.equal(edited.article.title, 'Keep my unsaved writing');
  setCell(scope, cell, { lockedMembers: [] });
  assert.equal(scope.getLastCommitFailure(), null);
  fail(true);
  assert.equal(saveTextModuleResult(scope, profile, expected, edited).reason, 'write_failed');
  fail(false);
  assert.equal(saveTextModuleResult(scope, profile, expected, edited).saved, true);
  assert.equal(scope.getLastCommitFailure(), null);
  assert.deepEqual(profileFields(root.getSnapshot()), profileFields(canvas));
  scope.release();
});

test('new cell Text keeps a useful fixed frame while typing without a DOM fitter', () => {
  const { scope, root, storage } = fixture({ measureText: () => ({ width: 80, height: 32 }) }), cell = rectangle(scope);
  scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
  const id = addTextModule(scope, profile), frame = compositionModuleWindow(scope.getComposition(), id);
  assert.deepEqual(frame, { left: 124, top: 160, width: 272, height: 160 });
  assert.equal(scope.getCells()[0].fitText?.includes(id) || false, false);
  const expected = scope.getSnapshot().texts.find(x => x.id === id);
  const article = { ...expected.article, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A useful line width remains while typing.' }] }] } };
  assert.equal(saveTextModuleResult(scope, profile, expected, { ...expected, article }).saved, true);
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), id), frame);
  assert.equal(scope.undo(), true);
  scope.editBento('fitText', [cell, id, true], scope.getGeneration());
  assert.equal(scope.getCells()[0].fitText.includes(id), true, 'content-hugging remains an explicit option');
  assert.equal(scope.undo(), true); assert.deepEqual(compositionModuleWindow(scope.getComposition(), id), frame);
  scope.release();
  const loaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.deepEqual(compositionModuleWindow(loaded.getSnapshot(), id), frame);
  assert.equal(root.getDraft().cells[0].fitText?.includes(id) || false, false);
});

test('an empty or zero-sized fit measurement retains the usable writing frame', () => {
  for (const measured of [{ width: 0, height: 24 }, { width: 24, height: 0 }]) {
    const { scope } = fixture({ measureText: () => measured }), cell = rectangle(scope);
    scope.turnShapeIntoCell(cell); scope.setEditingCell(cell);
    const id = addTextModule(scope, profile), before = compositionModuleWindow(scope.getComposition(), id);
    scope.editBento('fitText', [cell, id, true], scope.getGeneration());
    assert.deepEqual(compositionModuleWindow(scope.getComposition(), id), before);
    assert.equal(scope.getCells()[0].fitText.includes(id), true); scope.release();
  }
});

test('cell deletion removes locked members and prunes mixed groups without touching unrelated artwork or profile data', () => {
  const { scope, root, canvas, storage } = fixture();
  const first = rectangle(scope), second = rectangle(scope, 600), child = rectangle(scope, 140), survivor = rectangle(scope, 640), outside = rectangle(scope, 1100);
  scope.turnShapeIntoCell(first); scope.turnShapeIntoCell(second);
  setCell(scope, first, { members: [child], lockedMembers: [child] });
  setCell(scope, second, { members: [survivor] });
  const grouped = scope.getDraft();
  grouped.artworkLayers = [...grouped.artworkLayers.filter(id => ![child, survivor, outside].includes(id)),
    { id: 'composition:mixed', name: 'Mixed artwork', children: [child, survivor, outside] }];
  assert.equal(scope.commitCompletedOperation(grouped, { expectedGeneration: scope.getGeneration() }), true);
  const before = structuredClone(scope.getComposition()), shapeRecord = id => before.shapes.find(item => item.id === id);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', shapeRecord(child)), false, 'direct deletion still respects the child lock');
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', shapeRecord(first)), true);
  const after = structuredClone(scope.getComposition());
  assert.equal(after.shapes.some(item => [first, child].includes(item.id)), false);
  assert.deepEqual(after.cells.map(cell => cell.id), [second]);
  assert.deepEqual(after.artworkLayers.find(item => item.id === 'composition:mixed').children, [survivor, outside]);
  assert.deepEqual(after.shapes.find(item => item.id === outside), shapeRecord(outside));
  assert.deepEqual(compositionModuleWindow(after, outside), compositionModuleWindow(before, outside));
  assert.deepEqual(profileFields(root.getDraft()), profileFields(canvas));
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), after);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getComposition(), after);
  scope.release();
});

test('Studio Canvas and Bento start the same named composition with isolated layers, cells, history and reload', () => {
  const { root, scope: firstScope, storage, fail } = fixture();
  const firstCell = rectangle(firstScope);
  firstScope.turnShapeIntoCell(firstCell);
  const firstComposition = structuredClone(firstScope.getComposition());
  firstScope.release();
  const original = root.readWorkbench(root.getWorkbenchId());
  const canvasId = root.createWorkbench('Illustration', { layout: 'canvas' });
  assert.ok(canvasId);
  const canvas = createCompositionEditorScope(root, { documentId: canvasId });
  assert.equal(canvas.getWorkbenchId(), canvasId);
  assert.deepEqual(canvas.getCells(), []);
  const freeId = rectangle(canvas, 45);
  const frame = structuredClone(compositionModuleWindow(canvas.getComposition(), freeId));
  const cellId = rectangle(canvas, 560);
  canvas.turnShapeIntoCell(cellId);
  canvas.setEditingCell(cellId);
  const member = rectangle(canvas, 570);
  assert.deepEqual(canvas.getCells()[0].members, [member]);
  assert.deepEqual(compositionModuleWindow(canvas.getComposition(), freeId), frame);
  const checkpoint = structuredClone(canvas.getComposition());
  assert.deepEqual(projectWorkbenchDraft(canvas.getBackupSnapshot(), canvasId), checkpoint);
  fail(true);
  assert.equal(root.createWorkbench('Failed', { layout: 'bento' }), false);
  assert.equal(canvas.isCurrent(), true);
  assert.deepEqual(canvas.getComposition(), checkpoint);
  fail(false);
  const bentoId = root.createWorkbench('Index', { layout: 'bento' });
  assert.ok(bentoId);
  assert.equal(canvas.isCurrent(), false);
  assert.equal(canvas.undo(), false);
  canvas.release();
  const bento = createCompositionEditorScope(root, { documentId: bentoId });
  assert.ok(bento.getCells().length > 1);
  const bentoFree = rectangle(bento, 90);
  assert.ok(bento.getComposition().shapes.some(shape => shape.id === bentoFree));
  assert.equal(bento.getCells().some(cell => cell.members.includes(bentoFree)), false);
  assert.equal(bento.undo(), true);
  assert.equal(bento.getComposition().shapes.some(shape => shape.id === bentoFree), false);
  bento.release();
  assert.equal(root.switchWorkbench(canvasId), true);
  const returned = createCompositionEditorScope(root, { documentId: canvasId });
  assert.deepEqual(returned.getComposition(), checkpoint);
  assert.equal(returned.undo(), true);
  assert.deepEqual(returned.getCells()[0].members, []);
  assert.equal(returned.redo(), true);
  assert.deepEqual(returned.getComposition(), checkpoint);
  const reloaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.deepEqual(reloaded.readWorkbench(canvasId).draft, checkpoint);
  assert.deepEqual(reloaded.readWorkbench(original.id), original);
  assert.deepEqual(reloaded.getSnapshot(), checkpoint);
  assert.deepEqual(reloaded.readWorkbench(original.id).draft, firstComposition);
  returned.release();
});

test('adding a cell to a saved free canvas keeps its identity, native frames, layers, private art and Undo', () => {
  const { root, scope, storage, fail } = fixture();
  scope.release();
  const id = root.createWorkbench('Original canvas');
  const legacy = root.getWorkbenchScope();
  const a = rectangle(legacy, 61), b = rectangle(legacy, 510);
  const image = addImageModule(legacy, profile, { position: { left: 75, top: 92 }, size: { width: 220, height: 180 },
    artwork: createCompositionExample().imageModules[0].artwork });
  const before = root.getDraft();
  const saved = { ...before, artworkLayers: [{ id: 'composition:ink', name: 'Ink', children: [b, a] }, image],
    shapes: before.shapes.map(shape => shape.id === a ? { ...shape, visibility: 'PRIVATE' } : shape) };
  assert.ok(root.commitCompletedOperation(saved, { expectedGeneration: root.getGeneration() }));
  const name = root.readWorkbench(id).name;
  const native = createCompositionEditorScope(root, { documentId: id });
  const generation = native.getGeneration();
  const cellId = 'shape:first-cell';
  const args = [cellId, { left: 200, top: 300, width: 200, height: 180 }, 'right'];
  const place = () => native.editBento('drawCell', args, generation);
  assert.deepEqual(root.getDraft(), saved);
  fail(true);
  assert.throws(place, /could not be saved/);
  assert.deepEqual(root.getDraft(), saved);
  fail(false);
  assert.equal(place(), true);
  assert.throws(place, /changed/);
  assert.equal(native.isCurrent(), true);
  assert.equal(root.getWorkbenchId(), id);
  assert.equal(root.readWorkbench(id).name, name);
  assert.deepEqual(native.getSnapshot().imageModules, saved.imageModules);
  assert.deepEqual(native.getSnapshot().workbench.imageModules, saved.workbench.imageModules);
  assert.deepEqual(native.getSnapshot().shapes.filter(item => item.id !== cellId), saved.shapes);
  assert.deepEqual(native.getSnapshot().artworkLayers, [...saved.artworkLayers, cellId]);
  assert.deepEqual(native.getCells().map(cell => cell.id), [cellId]);
  for (const shape of saved.workbench.shapes)
    assert.deepEqual(compositionModuleWindow(native.getComposition(), shape.id), shape.window);
  assert.ok(!projectComposition(native.getComposition()).shapes.some(shape => shape.id === a));
  assert.ok(native.undo());
  native.release();
  assert.deepEqual(root.getDraft(), saved);
  assert.ok(root.undo());
  assert.deepEqual(root.getDraft(), before);
  assert.ok(root.redo());
  assert.ok(root.redo());
  assert.equal(Object.hasOwn(root.getDraft(), 'composition'), false);
  assert.equal(root.getDraft().cells[0].id, cellId);
  const restored = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(restored.getWorkbenchId(), id);
  assert.deepEqual(restored.getDraft(), root.getDraft());
});

test('placing the first cell and undoing it retain the live Canvas image position', () => {
  const { root, scope } = fixture();
  scope.release();
  root.createWorkbench('Cached layout');
  addImageModule(root.getWorkbenchScope(), profile, { position: { left: 75, top: 92 }, size: { width: 220, height: 180 } });
  const saved = root.getDraft();
  const live = structuredClone(saved.workbench);
  live.imageModules[0].position = { left: 180, top: 260 };
  const native = createCompositionEditorScope(root);
  const args = ['shape:first-cell', { left: 500, top: 300, width: 200, height: 180 }, 'right'];
  assert.deepEqual(root.getDraft(), saved);
  assert.ok(native.editBento('drawCell', args, native.getGeneration(), live));
  assert.deepEqual(root.getDraft().workbench.imageModules, live.imageModules);
  assert.ok(root.undo());
  assert.deepEqual(root.getDraft(), { ...saved, workbench: live });
});

test('a first Studio session opens a mixed canvas while preserving an existing draft on subsequent loads', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage, generateGridId: () => { throw new Error('Studio tried to create a Display grid'); } });
  assert.equal(Object.hasOwn(root.getSnapshot(), 'grids'), false);
  assert.equal(data.size, 0);
  assert.deepEqual(root.getSnapshot().cells, []);
  const native = createCompositionEditorScope(root, { documentId: root.getWorkbenchId() });
  const id = rectangle(native, 20);
  native.turnShapeIntoCell(id);
  native.release();
  assert.equal(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getSnapshot().cells[0].id, id);
});


for (const layout of ['canvas', 'bento']) test(`a ${layout} starter retains every module capability before and after cells`, () => {
  const { root, scope: firstScope, storage } = fixture();
  firstScope.release();
  const id = root.createWorkbench('Modules', { layout });
  const scope = createCompositionEditorScope(root, { documentId: id });
  assert.equal(scope.getSnapshot(), root.getSnapshot());
  const shape = rectangle(scope, 320);
  const group = editWorkbenchGroups(scope, profile, { type: 'create', name: 'Shapes', memberIds: [shape] });
  openWorkbenchIndex(scope, profile);
  const before = scope.getSnapshot();
  scope.turnShapeIntoCell(shape);
  assert.equal(scope.isCurrent(), true);
  assert.equal(scope.getSnapshot(), root.getSnapshot());
  assert.ok(scope.undo()); assert.deepEqual(scope.getSnapshot(), before);
  assert.ok(scope.redo());
  const reloaded = createSystemWorkflowDraftStore({ profileAddress: profile, storage }).readWorkbench(id);
  assert.equal(reloaded.name, 'Modules');
  assert.equal(reloaded.draft.workbenchIndex.open, true);
  assert.equal(reloaded.draft.workbenchGroups[0].id, group);
  assert.deepEqual(reloaded.draft.workbenchGroups[0].memberIds, [shape]);
  assert.ok(reloaded.draft.cells.some(cell => cell.id === shape));
  scope.release();
});
