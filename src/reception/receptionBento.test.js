import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from './receptionEditorScope.js';
import { RECEPTION_LAYOUT_DEFAULTS } from './receptionLayoutGenerator.js';
import { receptionBentoSettings, receptionBentoDividers, resizeReceptionBento, setReceptionBentoSettings } from './receptionBento.js';
import { receptionModuleWindow, withReceptionModuleWindow, validReceptionEditorDocument, projectReceptionEditorDocument } from './receptionEditorDocument.js';
import { addImageModule } from '../imageModule/imageModuleSession.js';
import { createReceptionExample } from '../../design-system/lab/receptionExample.js';
import { addShape, editShape } from '../shapes/shapeSession.js';
import { restoreReceptionEditorDocument } from './receptionEditorDocument.js';
import { receptionCellMerge, receptionCellSplit } from './receptionCellStructure.js';
import { addTextModule } from '../text/textSession.js';
import { editArtworkLayers } from '../systemWorkflow/artworkLayerSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';

const profile = '0x' + '7'.repeat(40);
function fixture(count = 6, seed = 42) {
  const data = new Map(); let failure = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failure) throw Error('Full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage }), scope = createReceptionEditorScope(root);
  scope.generateCellLayout({ ...RECEPTION_LAYOUT_DEFAULTS, count }, seed, scope.getGeneration());
  return { root, scope, storage, fail: value => { failure = value; }, edit: (action, ...args) => scope.editBento(action, args, scope.getGeneration()) };
}
function closed(value) {
  assert.ok(validReceptionEditorDocument(value));
  const { width, height, gap, padding } = receptionBentoSettings(value), area = value.workbench.area;
  const rectangles = value.cells.map(cell => receptionModuleWindow(value, cell.id));
  assert.equal(rectangles.reduce((sum, r) => sum + (r.width + gap) * (r.height + gap), 0), (width - padding * 2 + gap) * (height - padding * 2 + gap));
  for (const [i, a] of rectangles.entries()) {
    assert.ok(a.width >= 80 && a.height >= 80);
    assert.ok(a.left >= area.left + padding && a.top >= area.top + padding);
    assert.ok(a.left + a.width <= area.left + width - padding && a.top + a.height <= area.top + height - padding);
    for (const b of rectangles.slice(i + 1)) assert.ok(a.left + a.width + gap <= b.left || b.left + b.width + gap <= a.left
      || a.top + a.height + gap <= b.top || b.top + b.height + gap <= a.top);
  }
}

function fourCells() {
  const state = fixture(1), first = state.scope.getCells()[0].id;
  state.edit('split', first, 'vertical', 'shape:right');
  state.edit('split', first, 'horizontal', 'shape:bottom-left');
  state.edit('split', 'shape:right', 'horizontal', 'shape:bottom-right');
  return { ...state, first };
}

test('cell deletion fills generated layouts, whole rows and multiple selections without gaps or overlaps', () => {
  for (const count of [3, 6, 10, 16]) for (const seed of [1, 12, 42, 77]) {
    const { scope } = fixture(count, seed), before = structuredClone(scope.getReception());
    const selections = [...before.cells.map(cell => [cell.id]), before.cells.filter((_, i) => i % 2 === 0).map(cell => cell.id),
      before.cells.filter(cell => receptionModuleWindow(before, cell.id).top === receptionModuleWindow(before, before.cells[0].id).top).map(cell => cell.id)];
    for (const ids of selections) {
      editArtworkLayers(scope, profile, { type: 'delete', ids });
      assert.equal(scope.getCells().length, count - ids.length);
      if (scope.getCells().length) closed(scope.getReception());
      assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
    }
    scope.release();
  }
});

test('deleting a spanning cell fills its gap, fits live neighbouring artwork and remains one atomic history operation', () => {
  const { root, scope, edit, fail, storage, first } = fourCells();
  edit('merge', first, 'below');
  const neighbour = 'shape:right', frame = receptionModuleWindow(scope.getReception(), neighbour);
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(neighbour, candidate, opts) };
  const image = addImageModule(target, profile, { side: createReceptionExample().imageModules[0].sides[0],
    position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getReception()), canvases = structuredClone(root.getDraft().workbenches);
  fail(true);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', before.shapes.find(item => item.id === first)), false);
  assert.deepEqual(scope.getReception(), before); fail(false);
  const presentation = structuredClone(scope.getSnapshot().workbench);
  presentation.imageModules.find(item => item.id === image).position.left += 10;
  editArtworkLayers(scope, profile, { type: 'delete', ids: [first] }, scope.getGeneration(), presentation);
  const after = structuredClone(scope.getReception()); closed(after);
  const filled = receptionModuleWindow(after, neighbour), artwork = receptionModuleWindow(after, image);
  assert.equal(artwork.width, filled.width);
  assert.equal(artwork.left, filled.left + 10 * filled.width / frame.width, 'live content transforms with the expanded cell');
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception().cells, before.cells);
  assert.equal(receptionModuleWindow(scope.getReception(), image).left, frame.left + 10);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getReception(), after);
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), after); reopened.release();
  const remaining = scope.getCells().map(cell => cell.id);
  editArtworkLayers(scope, profile, { type: 'delete', ids: remaining });
  assert.equal(scope.getCells().length, 0, 'deleting the final cells leaves an empty canvas');
  assert.ok(scope.getReception().imageModules.some(item => item.id === image), 'cell deletion preserves independent artwork');
  scope.release();
});

test('deletion repairs interlocking spans without losing the remaining cell identities', () => {
  const { scope } = fixture(5), before = structuredClone(scope.getReception()), ids = before.cells.map(cell => cell.id);
  let next = before;
  // A pinwheel has no complete neighbour along any side of its central cell.
  const frames = [[24, 24, 920, 276], [968, 24, 448, 576], [496, 624, 920, 252], [24, 324, 448, 552], [496, 324, 448, 276]];
  for (let i = 0; i < 5; i++) next = withReceptionModuleWindow(next, ids[i], Object.fromEntries(['left', 'top', 'width', 'height'].map((key, j) => [key, frames[i][j]])));
  const draft = scope.getDraft();
  assert.equal(scope.commitCompletedOperation({ ...draft, workbench: next.workbench }, { expectedGeneration: scope.getGeneration() }), true); closed(scope.getReception());
  editArtworkLayers(scope, profile, { type: 'delete', ids: [ids[4]] });
  closed(scope.getReception()); assert.deepEqual(scope.getCells().map(cell => cell.id), ids.slice(0, 4)); scope.release();
});

test('directional merges create spanning cells and split restores rectangular partitions without moving other cells', () => {
  for (const [direction, target, neighbour] of [['below', 'first', 'shape:bottom-left'], ['above', 'shape:bottom-left', 'first'],
    ['right', 'first', 'shape:right'], ['left', 'shape:right', 'first']]) {
    const { scope, edit, first } = fourCells(), before = structuredClone(scope.getReception());
    const id = target === 'first' ? first : target, removed = neighbour === 'first' ? first : neighbour;
    const shape = before.shapes.find(item => item.id === id);
    edit('merge', id, direction);
    const merged = structuredClone(scope.getReception()); closed(merged);
    assert.equal(merged.cells.length, 3); assert.equal(merged.cells.some(cell => cell.id === removed), false);
    assert.deepEqual(merged.shapes.find(item => item.id === id), shape);
    for (const divider of receptionBentoDividers(merged)) closed(resizeReceptionBento(merged, divider.id, divider.position + 20));
    for (const cell of merged.cells.filter(cell => cell.id !== id))
      assert.deepEqual(receptionModuleWindow(merged, cell.id), receptionModuleWindow(before, cell.id));
    assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
    assert.equal(scope.redo(), true); assert.deepEqual(scope.getReception(), merged);
    edit('split', id, ['above', 'below'].includes(direction) ? 'horizontal' : 'vertical'); closed(scope.getReception());
    assert.equal(scope.getCells().length, 4); scope.release();
  }
  const { scope, edit, first } = fourCells();
  edit('merge', first, 'below');
  assert.equal(receptionCellMerge(scope.getReception(), 'shape:right', 'left').reason.includes('rectangle'), true);
  edit('merge', first, 'right'); closed(scope.getReception());
  assert.equal(scope.getCells().length, 1, 'a tall cell can absorb both stacked neighbours');
  scope.release();
});

test('merge preserves native content, locked members, ordering and publication; split carries content into the first half', () => {
  const { root, scope, edit, storage, first } = fourCells(), neighbour = 'shape:bottom-left';
  for (const id of [first, neighbour]) {
    const frame = receptionModuleWindow(scope.getReception(), id);
    const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(id, candidate, opts) };
    addImageModule(target, profile, { side: createReceptionExample().imageModules[0].sides[0],
      position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
    addShape(target, profile, { position: { left: frame.left + 20, top: frame.top + 20 }, size: { width: 100, height: 100 } });
    addTextModule(target, profile, { position: { left: frame.left + 30, top: frame.top + 30 } }, { visibility: 'PUBLIC' });
  }
  const draft = root.getDraft();
  draft.reception.cells = draft.reception.cells.map(cell => [first, neighbour].includes(cell.id) ? { ...cell, lockedMembers: [...cell.members],
    mobile: { ...cell.mobile, referenceWidth: 390, placements: [{ id: cell.members[0], window: { left: 20, top: 30, width: 180, height: 140 } }] } } : cell);
  assert.equal(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }), true);
  const before = structuredClone(scope.getReception()), canvases = structuredClone(root.getDraft().workbenches);
  const members = before.cells.filter(cell => [first, neighbour].includes(cell.id)).flatMap(cell => cell.members);
  edit('merge', first, 'below');
  const merged = structuredClone(scope.getReception()), cell = merged.cells.find(cell => cell.id === first); closed(merged);
  assert.deepEqual(cell.members, members); assert.deepEqual(cell.lockedMembers, members);
  assert.equal(cell.mobile.placements.length, 2); assert.ok(cell.mobile.placements[1].window.top > cell.mobile.placements[0].window.top);
  assert.deepEqual(merged.imageModules, before.imageModules); assert.deepEqual(merged.texts, before.texts);
  for (const id of members) assert.deepEqual(receptionModuleWindow(merged, id), receptionModuleWindow(before, id));
  assert.deepEqual(merged.artworkLayers, before.artworkLayers.filter(id => id !== neighbour));
  assert.ok(validReceptionEditorDocument(projectReceptionEditorDocument(merged), true));
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before); assert.ok(scope.redo());
  edit('split', first, 'horizontal', 'shape:new-half');
  const split = structuredClone(scope.getReception()); closed(split);
  assert.deepEqual(split.cells.find(cell => cell.id === first).members, members);
  assert.deepEqual(split.cells.find(cell => cell.id === 'shape:new-half').members, []);
  const oldFrame = receptionModuleWindow(merged, first), newFrame = receptionModuleWindow(split, first);
  for (const id of members) {
    const old = receptionModuleWindow(merged, id), next = receptionModuleWindow(split, id);
    assert.equal(next.left, old.left); assert.equal(next.width, old.width);
    assert.ok(Math.abs(next.top - (newFrame.top + (old.top - oldFrame.top) * newFrame.height / oldFrame.height)) < 0.001);
    assert.ok(Math.abs(next.height - old.height * newFrame.height / oldFrame.height) <= 0.5);
  }
  assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), merged); assert.ok(scope.redo()); scope.release();
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), split); reopened.release();
});

test('merge and split reject invalid geometry, conflicting content, hidden/private neighbours, capacity and stale saves', () => {
  const { root, scope, edit, fail, first } = fourCells(), before = structuredClone(scope.getReception());
  for (const [action, args] of [['merge', [first, 'below']], ['split', [first, 'horizontal']]]) {
    fail(true); assert.throws(() => edit(action, ...args), /could not be saved/u); fail(false);
    assert.deepEqual(scope.getReception(), before);
    assert.throws(() => scope.editBento(action, args, scope.getGeneration() - 1), /changed/u);
  }
  assert.throws(() => edit('merge', first, 'above'), /no neighbouring/u);
  assert.throws(() => edit('split', first, 'diagonal'), /direction/u);
  const patch = make => { const draft = root.getDraft(); make(draft.reception); assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })); };
  patch(value => { value.cells[0].content = 'profile'; value.cells[1].content = 'links'; });
  assert.throws(() => edit('merge', first, 'below'), /separate profile/u); assert.ok(scope.undo());
  patch(value => { value.cells[1].content = 'profile'; });
  edit('merge', first, 'below'); assert.equal(scope.getCells()[0].content, 'profile'); assert.ok(scope.undo()); assert.ok(scope.undo());
  patch(value => { value.shapes.find(item => item.id === 'shape:bottom-left').visibility = 'PRIVATE'; });
  assert.throws(() => edit('merge', first, 'below'), /publication visibility/u); assert.ok(scope.undo());
  patch(value => { value.workbench.shapes.find(item => item.id === 'shape:bottom-left').open = false; });
  assert.throws(() => edit('merge', first, 'below'), /Show the neighbouring/u); assert.ok(scope.undo());
  patch(value => { value.workbench.shapes.find(item => item.id === first).window.height = 183; });
  assert.ok(receptionCellSplit(scope.getReception(), first, 'horizontal').reason.includes('80')); assert.ok(scope.undo());
  const generation = scope.getGeneration(); scope.release();
  assert.throws(() => scope.editBento('merge', [first, 'below'], generation), /no longer active/u);
  const full = fixture(16); assert.ok(receptionCellSplit(full.scope.getReception(), full.scope.getCells()[0].id, 'vertical').reason.includes('room')); full.scope.release();
});

test('split includes live artwork placement in its history and then scales it once', () => {
  const { scope } = fixture(1), id = scope.getCells()[0].id, frame = receptionModuleWindow(scope.getReception(), id);
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(id, candidate, opts) };
  const child = addShape(target, profile, { position: { left: frame.left + 20, top: frame.top + 20 }, size: { width: 100, height: 100 } });
  const presentation = structuredClone(scope.getSnapshot().workbench);
  presentation.shapes.find(item => item.id === child).window.top += 60;
  const live = presentation.shapes.find(item => item.id === child).window;
  scope.editBento('split', [id, 'horizontal'], scope.getGeneration(), presentation);
  const ratio = receptionModuleWindow(scope.getReception(), id).height / frame.height;
  assert.equal(receptionModuleWindow(scope.getReception(), child).top, frame.top + (live.top - frame.top) * ratio);
  assert.ok(scope.undo()); assert.deepEqual(receptionModuleWindow(scope.getReception(), child), live);
  scope.release();
});

test('merging into a later cell keeps its background behind transferred artwork and preserves artwork blocks', () => {
  const { root, scope, edit, first } = fourCells(), lower = 'shape:bottom-left';
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) };
  const child = addShape(target, profile, { position: { left: 50, top: 50 }, size: { width: 100, height: 100 } });
  const draft = root.getDraft(), rest = draft.reception.artworkLayers.filter(id => ![first, lower, child].includes(id));
  draft.reception.artworkLayers = [{ id: 'composition:test', name: 'Artwork block', children: [first, child] }, lower, ...rest];
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  edit('merge', lower, 'above');
  assert.deepEqual(scope.getReception().artworkLayers, [{ id: 'composition:test', name: 'Artwork block', children: [lower, child] }, ...rest]);
  assert.ok(validReceptionEditorDocument(scope.getReception())); scope.release();
});
test('Frameless Reception and cell outlines persist together without altering native geometry or another canvas', () => {
  const { root, scope, storage, edit, fail } = fixture();
  const shape = scope.getSnapshot().shapes[0], outline = { width: 3, color: '#ffffff', opacity: 1 };
  editShape(scope, profile, shape, { opacity: 0, outline });
  const before = structuredClone(scope.getReception()), workbenches = structuredClone(root.getDraft().workbenches);
  edit('settings', { showFrame: false });
  const value = structuredClone(scope.getReception());
  assert.deepEqual(value, { ...before, showFrame: false });
  assert.deepEqual(root.getDraft().workbenches, workbenches);
  assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before); assert.ok(scope.redo());
  const published = projectReceptionEditorDocument(value);
  assert.ok(validReceptionEditorDocument(published, true)); assert.equal(published.showFrame, false);
  assert.deepEqual(published.shapes[0].outline, outline);
  assert.deepEqual(restoreReceptionEditorDocument(published).shapes[0].outline, outline);
  fail(true); assert.throws(() => edit('settings', { showFrame: true })); assert.deepEqual(scope.getReception(), value); fail(false);
  for (const showFrame of [null, 'false', 0]) {
    assert.throws(() => edit('settings', { showFrame }));
    assert.equal(validReceptionEditorDocument({ ...value, showFrame }), false);
  }
  scope.release();
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), value);
  reopened.generateCellLayout({ ...receptionBentoSettings(value), showFrame: false }, 15, reopened.getGeneration());
  assert.equal(reopened.getReception().showFrame, false); reopened.release();
});

test('Hiding the outer frame preserves fractional rectangles and different cell radii', () => {
  const { scope } = fixture(), value = structuredClone(scope.getReception());
  value.workbench.shapes[0].window.left += .25; value.cells[1].radius = 12;
  assert.deepEqual(setReceptionBentoSettings(value, { showFrame: false }), { ...value, showFrame: false });
  scope.release();
});

test('shared boundaries preserve a closed partition across rows and T junctions', () => {
  for (let count = 2; count <= 16; count++) for (let seed = 0; seed < 10; seed++) {
    const { scope } = fixture(count, seed), source = scope.getReception(), dividers = receptionBentoDividers(source);
    assert.ok(dividers.length);
    for (const d of dividers) for (const position of [d.min - 100, d.position + 37, d.max + 100]) closed(resizeReceptionBento(source, d.id, position));
    scope.release();
  }
  const { scope, edit } = fixture(1);
  edit('settings', { width: 4000, height: 900 });
  for (let i = 1; i < 16; i++) {
    edit('addCell', scope.getCells()[0].id); closed(scope.getReception());
  }
  const before = scope.getReception();
  assert.throws(() => edit('addCell', before.cells[0].id), /room/u); assert.deepEqual(scope.getReception(), before);
  scope.release();
});
test('swap moves cell identities, native image content and relative geometry in one undo without touching canvas', () => {
  const { root, scope, edit } = fixture(), first = scope.getCells()[0].id, second = scope.getCells()[1].id;
  const frame = receptionModuleWindow(scope.getReception(), first), canvas = structuredClone(scope.getSnapshot());
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) };
  const image = addImageModule(target, profile, { side: createReceptionExample().imageModules[0].sides[0],
    position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getReception()), otherCanvas = root.getDraft().workbenches;
  edit('swap', first, second);
  assert.deepEqual(receptionModuleWindow(scope.getReception(), first), receptionModuleWindow(before, second));
  assert.deepEqual(receptionModuleWindow(scope.getReception(), image), receptionModuleWindow(before, second));
  assert.deepEqual(scope.getCells().find(cell => cell.id === first).members, [image]); closed(scope.getReception());
  assert.deepEqual(root.getDraft().workbenches, otherCanvas);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  assert.equal(scope.redo(), true); assert.equal(scope.getCells()[1].id, first);
  assert.equal(canvas.profileAddress, profile); scope.release();
});
test('size, gutter, margin and radius preserve the partition and survive publication and reload', () => {
  const { scope, storage, edit } = fixture(8), before = structuredClone(scope.getReception());
  edit('settings', { width: 1920, height: 1080, gap: 32, padding: 40, radius: 24 });
  const value = structuredClone(scope.getReception()); closed(value);
  assert.deepEqual(value.bento, { gap: 32, padding: 40 }); assert.ok(value.cells.every(cell => cell.radius === 24));
  assert.ok(validReceptionEditorDocument(projectReceptionEditorDocument(value), true));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  assert.equal(scope.redo(), true); scope.release();
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), value); reopened.release();
});
test('existing generator geometry supplies initial spacing without changing saved work', () => {
  const { scope } = fixture(), value = structuredClone(scope.getReception()); delete value.bento;
  assert.deepEqual(receptionBentoSettings(value), { ...RECEPTION_LAYOUT_DEFAULTS, showFrame: true, innerLines: null });
  closed(setReceptionBentoSettings(value, { gap: 12, padding: 16 }));
  assert.equal(value.bento, undefined); scope.release();
});
test('stale gestures, invalid settings, failed storage and released scopes never partially change cells', () => {
  const { scope, edit, fail } = fixture(), before = structuredClone(scope.getReception()), d = receptionBentoDividers(before)[0];
  const generation = scope.getGeneration();
  fail(true); assert.throws(() => edit('resize', d.id, d.position + 10), /could not be saved/u);
  assert.deepEqual(scope.getReception(), before); fail(false);
  assert.throws(() => edit('settings', { width: 320, height: 320, gap: 256 }), /larger bento/u);
  assert.deepEqual(scope.getReception(), before);
  edit('appendRow');
  const changed = scope.getReception();
  assert.throws(() => scope.editBento('resize', [d.id, d.position + 20], generation), /changed/u);
  assert.deepEqual(scope.getReception(), changed);
  scope.release(); assert.throws(() => edit('settings', { radius: 16 }), /no longer active/u);
});

test('adding a cell shares the entire row width, keeps other rows still and carries artwork', () => {
  const { scope, edit, root, storage } = fixture(1);
  edit('addCell', scope.getCells()[0].id); edit('addCell', scope.getCells()[0].id);
  edit('appendRow');
  const first = scope.getCells()[0].id, frame = receptionModuleWindow(scope.getReception(), first);
  const image = addImageModule({ ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) }, profile,
    { side: createReceptionExample().imageModules[0].sides[0], position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getReception()), canvas = root.getDraft().workbenches;
  edit('addCell', first);
  const after = structuredClone(scope.getReception()); closed(after);
  assert.deepEqual(after.workbench.area, before.workbench.area);
  for (const cell of before.cells.slice(0, 3)) {
    assert.ok(receptionModuleWindow(after, cell.id).width < receptionModuleWindow(before, cell.id).width);
    assert.equal(receptionModuleWindow(after, cell.id).height, receptionModuleWindow(before, cell.id).height);
  }
  assert.deepEqual(receptionModuleWindow(after, before.cells.at(-1).id), receptionModuleWindow(before, before.cells.at(-1).id));
  assert.deepEqual(receptionModuleWindow(after, image), receptionModuleWindow(after, first));
  assert.equal(after.cells[3].members.length, 0); assert.deepEqual(root.getDraft().workbenches, canvas);
  assert.ok(validReceptionEditorDocument(projectReceptionEditorDocument(after), true));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getReception(), after); scope.release();
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), after); reopened.release();
});

test('a new bottom row grows only the height and preserves every existing cell and member', () => {
  const { scope, edit, storage } = fixture(6);
  const first = scope.getCells()[0].id, frame = receptionModuleWindow(scope.getReception(), first);
  const image = addImageModule({ ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) }, profile,
    { side: createReceptionExample().imageModules[0].sides[0], position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getReception()); edit('appendRow');
  const after = structuredClone(scope.getReception()); closed(after);
  assert.equal(after.cells.length, before.cells.length + 1);
  for (const id of [...before.cells.map(cell => cell.id), image]) assert.deepEqual(receptionModuleWindow(after, id), receptionModuleWindow(before, id));
  assert.deepEqual(after.cells.slice(0, -1), before.cells);
  assert.equal(after.workbench.area.width, before.workbench.area.width);
  assert.ok(after.workbench.area.height > before.workbench.area.height);
  const last = receptionModuleWindow(after, after.cells.at(-1).id), { gap, padding } = receptionBentoSettings(before);
  assert.equal(last.width, before.workbench.area.width - 2 * padding);
  assert.equal(last.top, before.workbench.area.top + before.workbench.area.height - padding + gap);
  assert.ok(receptionBentoDividers(after).some(d => d.axis === 'y' && d.after.includes(after.cells.at(-1).id)));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getReception(), before);
  assert.equal(scope.redo(), true); scope.release();
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), after); reopened.release();
});

test('adding beside a cell in a T junction preserves the closed band and valid shared edges', () => {
  const { root, scope, edit } = fixture(3), draft = root.getDraft();
  let value = draft.reception;
  const frames = [{ left: 24, top: 24, width: 600, height: 852 },
    { left: 648, top: 24, width: 768, height: 414 }, { left: 648, top: 462, width: 768, height: 414 }];
  value.cells.forEach((cell, index) => { value = withReceptionModuleWindow(value, cell.id, frames[index]); });
  assert.equal(root.commitCompletedOperation({ ...draft, reception: value }, { expectedGeneration: root.getGeneration() }), true);
  edit('addCell', value.cells[1].id);
  const after = scope.getReception(); closed(after);
  assert.deepEqual(after.workbench.area, value.workbench.area);
  assert.equal(receptionModuleWindow(after, after.cells.at(-1).id).height, 852);
  for (const d of receptionBentoDividers(after)) closed(resizeReceptionBento(after, d.id, d.position + 50));
  scope.release();
});

test('row/cell insertion rejects insufficient space, failed storage and stale authority atomically', () => {
  const { scope, edit, fail } = fixture(1);
  edit('settings', { width: 320, height: 7000 }); edit('addCell', scope.getCells()[0].id); edit('appendRow');
  const before = structuredClone(scope.getReception()), generation = scope.getGeneration();
  assert.throws(() => edit('addCell', before.cells[0].id), /too full/u);
  assert.throws(() => edit('appendRow'), /editing limits/u); assert.deepEqual(scope.getReception(), before);
  edit('settings', { width: 1440, height: 900 });
  const current = structuredClone(scope.getReception());
  for (const [action, args] of [['addCell', [before.cells[0].id]], ['appendRow', []]]) {
    fail(true); assert.throws(() => edit(action, ...args), /could not be saved/u); fail(false);
    assert.deepEqual(scope.getReception(), current);
    assert.throws(() => scope.editBento(action, args, generation), /changed/u);
  }
  scope.release(); assert.throws(() => edit('appendRow'), /no longer active/u);
});

test('Bento preserves mixed radii through geometry, replacement and explicit per-cell styling', () => {
  const { scope, edit } = fixture(2);
  const [a, b] = scope.getCells();
  edit('cellRadius', a.id, 12); edit('cellRadius', b.id, 64);
  assert.equal(receptionBentoSettings(scope.getReception()).radius, null);
  edit('settings', { width: 1600, gap: 30 });
  assert.deepEqual(scope.getCells().map(cell => cell.radius), [12, 64]);
  scope.generateCellLayout({ ...RECEPTION_LAYOUT_DEFAULTS, count: 2, radius: 0 }, 8, scope.getGeneration());
  assert.deepEqual(scope.getCells().map(cell => cell.radius), [12, 64]);
  edit('settings', { radius: 28 });
  assert.deepEqual(scope.getCells().map(cell => cell.radius), [28, 28]);
  scope.undo(); assert.deepEqual(scope.getCells().map(cell => cell.radius), [12, 64]);
  scope.release();
});

test('Text creation owns explicit transparent frames and split refuses a half below the native minimum', () => {
  const { scope, edit } = fixture(1);
  edit('settings', { width: 320, height: 320 });
  const cell = scope.getCells()[0].id, frame = receptionModuleWindow(scope.getReception(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  const text = addTextModule(target, profile, { window: frame }, { visibility: 'PUBLIC', appearance: { background: null } });
  assert.deepEqual(receptionModuleWindow(scope.getReception(), text), frame);
  assert.equal(scope.getReception().texts[0].article.appearance.background, null);
  const before = structuredClone(scope.getReception());
  assert.match(receptionCellSplit(before, cell, 'vertical').reason, /Text needs a frame/);
  assert.throws(() => edit('split', cell, 'vertical'), /Text needs a frame/);
  assert.deepEqual(scope.getReception(), before);
  scope.undo(); edit('split', cell, 'vertical');
  const small = receptionModuleWindow(scope.getReception(), cell);
  assert.throws(() => addTextModule(target, profile, { window: small }), /Enlarge the cell/);
  assert.equal(scope.getReception().texts.length, 0);
  scope.release();
});

test('divider clamps to actual Text proportions; settings, swaps and proposals cannot shrink native content below its limits', () => {
  const { scope, edit } = fixture(1);
  const cell = scope.getCells()[0].id;
  edit('split', cell, 'vertical', 'shape:other');
  const frame = receptionModuleWindow(scope.getReception(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  const text = addTextModule(target, profile, { window: frame });
  const edge = receptionBentoDividers(scope.getReception()).find(edge => edge.axis === 'x');
  edit('resize', edge.id, -1000);
  assert.equal(receptionModuleWindow(scope.getReception(), text).width, 180);
  assert.ok(validReceptionEditorDocument(scope.getReception()));
  const before = structuredClone(scope.getReception());
  assert.throws(() => edit('settings', { width: 1200 }), /Text needs/);
  assert.deepEqual(scope.getReception(), before);
  scope.release();
});

test('minimum Image content rejects proportional shrink with a useful error and no history or data loss', () => {
  const { scope, edit } = fixture(1), cell = scope.getCells()[0].id;
  const frame = receptionModuleWindow(scope.getReception(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  addImageModule(target, profile, { side: createReceptionExample().imageModules[0].sides[0], position: { left: frame.left, top: frame.top }, size: { width: 32, height: 32 } });
  const before = structuredClone(scope.getReception()), history = structuredClone(scope.getHistory());
  assert.throws(() => edit('settings', { width: 720, height: 450 }), /Image needs a frame/);
  assert.deepEqual(scope.getReception(), before); assert.deepEqual(scope.getHistory(), history);
  scope.release();
});
