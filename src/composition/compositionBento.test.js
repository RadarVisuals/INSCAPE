import { drawnCellArgs, drawOuterCell } from './fixtures/cellDrawing.js';
import { moveCompositionBentoCell, compositionBentoKeyboardTarget } from './compositionBentoInsertion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createCompositionEditorScope } from './compositionEditorScope.js';
import { COMPOSITION_LAYOUT_DEFAULTS } from './compositionLayoutGenerator.js';
import { compositionBentoSettings, compositionBentoDividers, resizeCompositionBento, setCompositionBentoSettings } from './compositionBento.js';
import { compositionModuleWindow, withCompositionModuleWindow, validCompositionEditorDocument, projectCompositionEditorDocument, compositionResponsiveLayout } from './compositionEditorDocument.js';
import { addImageModule, saveImageModule } from '../imageModule/imageModuleSession.js';
import { createCompositionExample } from '../../design-system/lab/compositionExample.js';
import { addShape, editShape } from '../shapes/shapeSession.js';
import { restoreCompositionEditorDocument } from './compositionEditorDocument.js';
import { compositionCellMerge, mergeCompositionCells } from './compositionCellStructure.js';
import { projectCompositionMember } from './editorCellGeometry.js';
import { addTextModule } from '../text/textSession.js';
import { editArtworkLayers } from '../systemWorkflow/artworkLayerSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';

const profile = '0x' + '7'.repeat(40);
function fixture(count = 6, seed = 42) {
  const data = new Map(); let failure = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failure) throw Error('Full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }), scope = createCompositionEditorScope(root);
  let columns = Math.min(4, Math.ceil(Math.sqrt(count)));
  while (count % columns) columns--;
  scope.generateCellLayout({ ...COMPOSITION_LAYOUT_DEFAULTS, columns, rows: count / columns }, seed, scope.getGeneration());
  return { root, scope, storage, fail: value => { failure = value; }, edit: (action, ...args) => scope.editBento(action, args, scope.getGeneration()) };
}
function bounded(value) {
  assert.ok(validCompositionEditorDocument(value));
  const { width, height, gap, padding } = compositionBentoSettings(value), area = value.workbench.area;
  const rectangles = value.cells.map(cell => compositionModuleWindow(value, cell.id));
  for (const [i, a] of rectangles.entries()) {
    assert.ok(a.width >= 80 && a.height >= 24);
    assert.ok(a.left >= area.left + padding && a.top >= area.top + padding);
    assert.ok(a.left + a.width <= area.left + width - padding && a.top + a.height <= area.top + height - padding);
    for (const b of rectangles.slice(i + 1)) assert.ok(a.left + a.width + gap <= b.left || b.left + b.width + gap <= a.left
      || a.top + a.height + gap <= b.top || b.top + b.height + gap <= a.top);
  }
}

function closed(value) {
  bounded(value);
  const { width, height, gap, padding } = compositionBentoSettings(value);
  const rectangles = value.cells.map(cell => compositionModuleWindow(value, cell.id));
  assert.equal(rectangles.reduce((sum, r) => sum + (r.width + gap) * (r.height + gap), 0), (width - padding * 2 + gap) * (height - padding * 2 + gap));
}

// Explicit empty geometry keeps merge/insertion fixtures independent of UI commands.
function seedCellFrames(state, entries) {
  const draft = state.root.getDraft(), value = draft.composition, shape = value.shapes[0], cell = value.cells[0];
  value.shapes = entries.map(([id], index) => ({ ...shape, id, name: 'Cell ' + (index + 1) }));
  value.cells = entries.map(([id]) => ({ ...structuredClone(cell), id, members: [] }));
  value.workbench.shapes = entries.map(([id, window]) => ({ ...value.workbench.shapes[0], id, window }));
  value.artworkLayers = entries.map(([id]) => id);
  assert.ok(state.root.commitCompletedOperation(draft, { expectedGeneration: state.root.getGeneration() }));
  closed(state.scope.getComposition());
}
function fourCells() {
  const state = fixture(1), first = state.scope.getCells()[0].id;
  seedCellFrames(state, [[first, { left: 24, top: 24, width: 684, height: 414 }],
    ['shape:bottom-left', { left: 24, top: 462, width: 684, height: 414 }],
    ['shape:right', { left: 732, top: 24, width: 684, height: 414 }],
    ['shape:bottom-right', { left: 732, top: 462, width: 684, height: 414 }]]);
  return { ...state, first };
}

test('one Bento cell retains overlapping independent Images when one artwork is replaced, including Undo and reload', () => {
  const { scope, storage } = fixture(1), cell = scope.getCells()[0].id;
  const frame = compositionModuleWindow(scope.getComposition(), cell);
  const artwork = createCompositionExample().imageModules[0].artwork;
  const placement = { cellId: cell, artwork, position: { left: frame.left, top: frame.top }, size: { width: Math.round(frame.width), height: Math.round(frame.height) } };
  const first = addImageModule(scope, profile, placement), second = addImageModule(scope, profile, placement);
  const before = scope.getComposition(), current = before.imageModules.find(image => image.id === first);
  const replacement = { ...current, artwork: { ...artwork, id: 'artwork:replacement',
    asset: { ...artwork.asset, media: { ...artwork.asset.media, url: 'https://images.example/replacement.webp' } },
    crop: { x: .3, y: .6, zoom: 2 } } };
  assert.ok(saveImageModule(scope, profile, current, replacement));
  const after = scope.getComposition();
  assert.deepEqual(after.imageModules.find(image => image.id === first), replacement);
  assert.deepEqual(after.cells.find(item => item.id === cell).members, [first, second]);
  assert.deepEqual(after.imageModules.find(image => image.id === second), before.imageModules.find(image => image.id === second));
  assert.deepEqual(after.workbench, before.workbench, 'replacement preserves positions, layer order and overlapping frames');
  assert.deepEqual(compositionModuleWindow(after, first), compositionModuleWindow(after, second));
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), after);
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release(); scope.release();
});

test('cell deletion preserves every surviving frame across generated layouts, whole rows and selections', () => {
  for (const count of [3, 6, 10, 16]) for (const seed of [1, 12, 42, 77]) {
    const { scope } = fixture(count, seed), before = structuredClone(scope.getComposition());
    const selections = [...before.cells.map(cell => [cell.id]), before.cells.filter((_, i) => i % 2 === 0).map(cell => cell.id),
      before.cells.filter(cell => compositionModuleWindow(before, cell.id).top === compositionModuleWindow(before, before.cells[0].id).top).map(cell => cell.id)];
    for (const ids of selections) {
      editArtworkLayers(scope, profile, { type: 'delete', ids });
      assert.equal(scope.getCells().length, count - ids.length);
      if (scope.getCells().length) bounded(scope.getComposition());
      for (const cell of scope.getCells()) assert.deepEqual(compositionModuleWindow(scope.getComposition(), cell.id), compositionModuleWindow(before, cell.id));
      assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
    }
    scope.release();
  }
});

test('deleting a spanning cell preserves its gap and live neighbouring artwork and remains one atomic history operation', () => {
  const { root, scope, edit, fail, storage, first } = fourCells();
  edit('merge', first, 'below');
  const neighbour = 'shape:right', frame = compositionModuleWindow(scope.getComposition(), neighbour);
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(neighbour, candidate, opts) };
  const image = addImageModule(target, profile, { artwork: createCompositionExample().imageModules[0].artwork,
    position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getComposition()), canvases = structuredClone(root.getDraft().workbenches);
  fail(true);
  assert.equal(removeWorkbenchModule(scope, profile, 'shape', before.shapes.find(item => item.id === first)), false);
  assert.deepEqual(scope.getComposition(), before); fail(false);
  const presentation = structuredClone(scope.getSnapshot().workbench);
  presentation.imageModules.find(item => item.id === image).position.left += 10;
  editArtworkLayers(scope, profile, { type: 'delete', ids: [first] }, scope.getGeneration(), presentation);
  const after = structuredClone(scope.getComposition()); bounded(after);
  assert.deepEqual(compositionModuleWindow(after, neighbour), frame);
  const filled = compositionModuleWindow(after, neighbour), artwork = compositionModuleWindow(after, image);
  assert.equal(artwork.width, filled.width);
  assert.ok(Math.abs(artwork.left - (filled.left + 10 * filled.width / frame.width)) < 1e-9, 'live content placement remains unchanged');
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition().cells, before.cells);
  assert.equal(compositionModuleWindow(scope.getComposition(), image).left, frame.left + 10);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getComposition(), after);
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
  const remaining = scope.getCells().map(cell => cell.id);
  editArtworkLayers(scope, profile, { type: 'delete', ids: remaining });
  assert.equal(scope.getCells().length, 0, 'deleting the final cells leaves an empty canvas');
  assert.equal(scope.getComposition().imageModules.some(item => item.id === image), false, 'deleting the owning cell also removes its artwork');
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), after, 'one Undo restores the deleted cells and their artwork');
  scope.release();
});

test('deletion leaves interlocking spans and remaining cell identities unchanged', () => {
  const { scope } = fixture(5), before = structuredClone(scope.getComposition()), ids = before.cells.map(cell => cell.id);
  let next = before;
  // A pinwheel has no complete neighbour along any side of its central cell.
  const frames = [[24, 24, 920, 276], [968, 24, 448, 576], [496, 624, 920, 252], [24, 324, 448, 552], [496, 324, 448, 276]];
  for (let i = 0; i < 5; i++) next = withCompositionModuleWindow(next, ids[i], Object.fromEntries(['left', 'top', 'width', 'height'].map((key, j) => [key, frames[i][j]])));
  const draft = scope.getDraft();
  assert.equal(scope.commitCompletedOperation({ ...draft, workbench: next.workbench }, { expectedGeneration: scope.getGeneration() }), true); closed(scope.getComposition());
  editArtworkLayers(scope, profile, { type: 'delete', ids: [ids[4]] });
  bounded(scope.getComposition());
  for (const id of ids.slice(0, 4)) assert.deepEqual(compositionModuleWindow(scope.getComposition(), id), compositionModuleWindow(next, id));
  assert.deepEqual(scope.getCells().map(cell => cell.id), ids.slice(0, 4)); scope.release();
});

test('directional merges create spanning cells without moving other cells', () => {
  for (const [direction, target, neighbour] of [['below', 'first', 'shape:bottom-left'], ['above', 'shape:bottom-left', 'first'],
    ['right', 'first', 'shape:right'], ['left', 'shape:right', 'first']]) {
    const { scope, edit, first } = fourCells(), before = structuredClone(scope.getComposition());
    const id = target === 'first' ? first : target, removed = neighbour === 'first' ? first : neighbour;
    const shape = before.shapes.find(item => item.id === id);
    edit('merge', id, direction);
    const merged = structuredClone(scope.getComposition()); closed(merged);
    assert.equal(merged.cells.length, 3); assert.equal(merged.cells.some(cell => cell.id === removed), false);
    assert.deepEqual(merged.shapes.find(item => item.id === id), shape);
    for (const divider of compositionBentoDividers(merged)) closed(resizeCompositionBento(merged, divider.id, divider.position + 20));
    for (const cell of merged.cells.filter(cell => cell.id !== id))
      assert.deepEqual(compositionModuleWindow(merged, cell.id), compositionModuleWindow(before, cell.id));
    assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
    assert.equal(scope.redo(), true); assert.deepEqual(scope.getComposition(), merged);
    scope.release();
  }
  const { scope, edit, first } = fourCells();
  edit('merge', first, 'below');
  assert.match(compositionCellMerge(scope.getComposition(), 'shape:right', 'left').reason, /outer boundary/u);
  edit('merge', first, 'right'); closed(scope.getComposition());
  assert.equal(scope.getCells().length, 1, 'a tall cell can absorb both stacked neighbours');
  scope.release();
});

function staggeredCells(gap = 24, transpose = false) {
  const state = fixture(6), draft = state.root.getDraft(), value = draft.composition;
  const frames = [
    { left: 24, top: 24, width: 1000, height: 260 },
    { left: 1024 + gap, top: 24, width: 392 - gap, height: 260 },
    { left: 24, top: 284 + gap, width: 1080, height: 340 },
    { left: 1104 + gap, top: 284 + gap, width: 312 - gap, height: 340 },
    { left: 24, top: 624 + 2 * gap, width: 920, height: 252 - 2 * gap },
    { left: 944 + gap, top: 624 + 2 * gap, width: 472 - gap, height: 252 - 2 * gap },
  ];
  value.bento = { gap, padding: 24 };
  if (transpose) value.workbench.area = { left: 0, top: 0, width: 900, height: 1440 };
  value.cells.forEach((cell, i) => {
    const r = frames[i];
    value.workbench.shapes.find(item => item.id === cell.id).window = transpose
      ? { left: r.top, top: r.left, width: r.height, height: r.width } : r;
  });
  assert.ok(state.root.commitCompletedOperation(draft, { expectedGeneration: state.root.getGeneration() }));
  closed(state.scope.getComposition());
  return { ...state, ids: value.cells.map(cell => cell.id) };
}

test('directional merge aligns staggered neighbouring cells and leaves other rows exact', () => {
  for (const gap of [0, 24]) for (const direction of ['above', 'below', 'left', 'right']) {
    const transpose = ['left', 'right'].includes(direction), reverse = ['above', 'left'].includes(direction);
    const { scope, edit, ids } = staggeredCells(gap, transpose), before = structuredClone(scope.getComposition());
    const selected = ids[reverse ? 2 : 0], removed = ids[reverse ? 0 : 2], cross = transpose ? 'top' : 'left', size = transpose ? 'height' : 'width';
    assert.equal(compositionCellMerge(before, selected, direction).reason, undefined);
    edit('merge', selected, direction);
    const after = structuredClone(scope.getComposition()); closed(after);
    assert.equal(after.cells.length, 5); assert.equal(after.cells.some(cell => cell.id === removed), false);
    assert.equal(compositionModuleWindow(after, selected)[cross], compositionModuleWindow(before, selected)[cross]);
    assert.equal(compositionModuleWindow(after, selected)[size], compositionModuleWindow(before, selected)[size]);
    for (const id of [ids[reverse ? 3 : 1], ...ids.slice(4)])
      assert.deepEqual(compositionModuleWindow(after, id), compositionModuleWindow(before, id));
    assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
    assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), after); scope.release();
  }
});

test('unequal-width merge fits native contents, preserves privacy and saves alignment with the merge atomically', () => {
  const { root, scope, edit, fail, storage, ids } = staggeredCells(), [first, , below, beside] = ids;
  for (const id of [first, below, beside]) {
    const frame = compositionModuleWindow(scope.getComposition(), id);
    const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(id, candidate, opts) };
    addImageModule(target, profile, { artwork: createCompositionExample().imageModules[0].artwork,
      position: { left: frame.left + 10, top: frame.top + 10 }, size: { width: 200, height: 160 } });
    addTextModule(target, profile, { window: { left: frame.left + 20, top: frame.top + 20, width: 240, height: 120 } }, { visibility: 'PUBLIC' });
    addShape(target, profile, { position: { left: frame.left + 30, top: frame.top + 30 }, size: { width: 100, height: 100 } });
  }
  const draft = root.getDraft();
  draft.composition.shapes.find(item => item.id === beside).visibility = 'PRIVATE';
  draft.composition.cells.find(cell => cell.id === below).lockedMembers = [...draft.composition.cells.find(cell => cell.id === below).members];
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  const before = structuredClone(scope.getComposition()), canvases = structuredClone(root.getDraft().workbenches);
  fail(true); assert.throws(() => edit('merge', first, 'below'), /could not be saved/u); fail(false);
  assert.deepEqual(scope.getComposition(), before, 'alignment is not saved separately when the merge cannot be saved');
  edit('merge', first, 'below');
  const after = structuredClone(scope.getComposition()); closed(after);
  const merged = after.cells.find(cell => cell.id === first), lower = before.cells.find(cell => cell.id === below);
  assert.deepEqual(merged.members, [...before.cells[0].members, ...lower.members]);
  assert.deepEqual(merged.lockedMembers, lower.members);
  for (const id of [first, below, beside]) {
    const oldFrame = compositionModuleWindow(before, id);
    const alignedFrame = id === below ? { ...oldFrame, width: 1000 }
      : id === beside ? compositionModuleWindow(after, id) : oldFrame;
    for (const member of before.cells.find(cell => cell.id === id).members) {
      const expected = projectCompositionMember(oldFrame, alignedFrame, compositionModuleWindow(before, member));
      if (member.startsWith('image:')) { expected.width = Math.round(expected.width); expected.height = Math.round(expected.height); }
      assert.deepEqual(compositionModuleWindow(after, member), expected);
    }
  }
  assert.deepEqual(after.texts, before.texts);
  assert.deepEqual(after.artworkLayers, before.artworkLayers.filter(id => id !== below));
  const published = projectCompositionEditorDocument(after);
  assert.ok(validCompositionEditorDocument(published, true));
  for (const id of [beside, ...before.cells.find(cell => cell.id === beside).members])
    assert.equal([...published.shapes, ...published.imageModules, ...published.texts].some(item => item.id === id), false);
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), after); scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
});

test('alignment rejects content size limits and incompatible visibility before changing the layout', () => {
  const { root, scope, ids, edit } = staggeredCells(), below = ids[2];
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(below, candidate, opts) };
  const text = addTextModule(target, profile, { cellId: below, window: { ...compositionModuleWindow(scope.getComposition(), below), width: 80, height: 100 } });
  // New cell Text fits its contents. This boundary case needs a manually sized
  // frame at the native minimum, whose proportional contraction is invalid.
  edit('fitText', below, text, false);
  const minimum = root.getDraft();
  minimum.composition = withCompositionModuleWindow(minimum.composition, text, { ...compositionModuleWindow(minimum.composition, text), width: 1 });
  assert.ok(root.commitCompletedOperation(minimum, { expectedGeneration: root.getGeneration() }));
  const before = structuredClone(scope.getComposition());
  assert.match(compositionCellMerge(before, ids[0], 'below').reason, /size limits/u);
  assert.throws(() => edit('merge', ids[0], 'below'), /size limits/u); assert.deepEqual(scope.getComposition(), before);
  const draft = root.getDraft(); draft.composition.shapes.find(item => item.id === below).visibility = 'PRIVATE';
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  assert.match(compositionCellMerge(scope.getComposition(), ids[0], 'below').reason, /publication visibility/u);
  scope.release();
});

test('a staggered middle cell aligns both edges, making room before contraction', () => {
  const { root, scope, edit } = fixture(6), draft = root.getDraft(), ids = draft.composition.cells.map(cell => cell.id);
  const widths = [[400, 500, 444], [300, 500, 544]];
  for (let row = 0; row < 2; row++) {
    let left = 24;
    for (let column = 0; column < 3; column++) {
      const width = widths[row][column];
      draft.composition.workbench.shapes.find(item => item.id === ids[row * 3 + column]).window = { left, top: 24 + row * 438, width, height: 414 };
      left += width + 24;
    }
  }
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  const lower = ids[4], target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(lower, candidate, opts) };
  const text = addTextModule(target, profile, { window: { ...compositionModuleWindow(scope.getComposition(), lower), width: 180, height: 100 } });
  const before = structuredClone(scope.getComposition());
  edit('merge', ids[1], 'below');
  const after = scope.getComposition(); closed(after);
  assert.deepEqual(compositionModuleWindow(after, ids[1]), { left: 448, top: 24, width: 500, height: 852 });
  assert.equal(compositionModuleWindow(after, text).left, compositionModuleWindow(before, text).left + 100);
  assert.equal(compositionModuleWindow(after, text).width, 180);
  assert.equal(compositionModuleWindow(after, ids[3]).width, 400);
  assert.equal(compositionModuleWindow(after, ids[5]).width, 444);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before); scope.release();
});

test('available merges keep generated partitions closed without mutating the proposal input', () => {
  let alignedCount = 0;
  for (const count of [3, 6, 10, 16]) for (const seed of [1, 12, 42, 77]) {
    const { scope } = fixture(count, seed), before = structuredClone(scope.getComposition());
    for (const cell of before.cells) for (const direction of ['above', 'below', 'left', 'right']) {
      const plan = compositionCellMerge(before, cell.id, direction);
      if (plan.reason) continue;
      if (plan.aligned !== before) alignedCount++;
      closed(mergeCompositionCells(before, cell.id, direction));
    }
    assert.deepEqual(scope.getComposition(), before); scope.release();
  }
  assert.ok(alignedCount > 0);
});

test('merge preserves native content, locked members, ordering, publication and reload', () => {
  const { root, scope, edit, storage, first } = fourCells(), neighbour = 'shape:bottom-left';
  for (const id of [first, neighbour]) {
    const frame = compositionModuleWindow(scope.getComposition(), id);
    const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(id, candidate, opts) };
    addImageModule(target, profile, { artwork: createCompositionExample().imageModules[0].artwork,
      position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
    addShape(target, profile, { position: { left: frame.left + 20, top: frame.top + 20 }, size: { width: 100, height: 100 } });
    addTextModule(target, profile, { position: { left: frame.left + 30, top: frame.top + 30 } }, { visibility: 'PUBLIC' });
  }
  const draft = root.getDraft();
  draft.composition.cells = draft.composition.cells.map(cell => [first, neighbour].includes(cell.id) ? { ...cell, lockedMembers: [...cell.members],
    mobile: { ...cell.mobile, referenceWidth: 390, placements: [{ id: cell.members[0], window: { left: 20, top: 30, width: 180, height: 140 } }] } } : cell);
  assert.equal(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }), true);
  const before = structuredClone(scope.getComposition()), canvases = structuredClone(root.getDraft().workbenches);
  const members = before.cells.filter(cell => [first, neighbour].includes(cell.id)).flatMap(cell => cell.members);
  edit('merge', first, 'below');
  const merged = structuredClone(scope.getComposition()), cell = merged.cells.find(cell => cell.id === first); closed(merged);
  assert.deepEqual(cell.members, members); assert.deepEqual(cell.lockedMembers, members);
  assert.equal(cell.mobile.placements.length, 2); assert.ok(cell.mobile.placements[1].window.top > cell.mobile.placements[0].window.top);
  assert.deepEqual(merged.imageModules, before.imageModules); assert.deepEqual(merged.texts, before.texts);
  for (const id of members) assert.deepEqual(compositionModuleWindow(merged, id), compositionModuleWindow(before, id));
  assert.deepEqual(merged.artworkLayers, before.artworkLayers.filter(id => id !== neighbour));
  assert.ok(validCompositionEditorDocument(projectCompositionEditorDocument(merged), true));
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before); assert.ok(scope.redo());
  scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), merged); reopened.release();
});

test('merge rejects conflicting content, hidden/private neighbours and stale saves', () => {
  const { root, scope, edit, fail, first } = fourCells(), before = structuredClone(scope.getComposition());
  for (const [action, args] of [['merge', [first, 'below']]]) {
    fail(true); assert.throws(() => edit(action, ...args), /could not be saved/u); fail(false);
    assert.deepEqual(scope.getComposition(), before);
    assert.throws(() => scope.editBento(action, args, scope.getGeneration() - 1), /changed/u);
  }
  assert.throws(() => edit('merge', first, 'above'), /no neighbouring/u);
  const patch = make => { const draft = root.getDraft(); make(draft.composition); assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() })); };
  const link = id => ({ id, kind: 'source', source: { profileAddress: profile, canvasId: root.getWorkbenchId(), moduleId: 'text:story' }, destination: null });
  patch(value => {
    value.links = [link('link:left'), link('link:right')];
    value.cells[0].content = 'link:left'; value.cells[1].content = 'link:right';
  });
  assert.throws(() => edit('merge', first, 'below'), /separate linked/u); assert.ok(scope.undo());
  patch(value => { value.links = [link('link:right')]; value.cells[1].content = 'link:right'; });
  edit('merge', first, 'below'); assert.equal(scope.getCells()[0].content, 'link:right'); assert.ok(scope.undo()); assert.ok(scope.undo());
  patch(value => { value.shapes.find(item => item.id === 'shape:bottom-left').visibility = 'PRIVATE'; });
  assert.throws(() => edit('merge', first, 'below'), /publication visibility/u); assert.ok(scope.undo());
  patch(value => { value.workbench.shapes.find(item => item.id === 'shape:bottom-left').open = false; });
  assert.throws(() => edit('merge', first, 'below'), /Show the neighbouring/u); assert.ok(scope.undo());
  const generation = scope.getGeneration(); scope.release();
  assert.throws(() => scope.editBento('merge', [first, 'below'], generation), /no longer active/u);
});

test('adding a cell includes live artwork placement in its history and preserves its size', () => {
  const { scope } = fixture(1), id = scope.getCells()[0].id, frame = compositionModuleWindow(scope.getComposition(), id);
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(id, candidate, opts) };
  const child = addShape(target, profile, { position: { left: frame.left + 20, top: frame.top + 20 }, size: { width: 100, height: 100 } });
  const presentation = structuredClone(scope.getSnapshot().workbench);
  presentation.shapes.find(item => item.id === child).window.left += 60;
  const live = presentation.shapes.find(item => item.id === child).window;
  drawOuterCell(scope, 'right', undefined, presentation);
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), id), frame);
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), child), live);
  assert.ok(scope.undo()); assert.deepEqual(compositionModuleWindow(scope.getComposition(), child), live);
  scope.release();
});

test('merging into a later cell keeps its background behind transferred artwork and preserves artwork blocks', () => {
  const { root, scope, edit, first } = fourCells(), lower = 'shape:bottom-left';
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) };
  const child = addShape(target, profile, { position: { left: 50, top: 50 }, size: { width: 100, height: 100 } });
  const draft = root.getDraft(), rest = draft.composition.artworkLayers.filter(id => ![first, lower, child].includes(id));
  draft.composition.artworkLayers = [{ id: 'composition:test', name: 'Artwork block', children: [first, child] }, lower, ...rest];
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  edit('merge', lower, 'above');
  assert.deepEqual(scope.getComposition().artworkLayers, [{ id: 'composition:test', name: 'Artwork block', children: [lower, child] }, ...rest]);
  assert.ok(validCompositionEditorDocument(scope.getComposition())); scope.release();
});
test('Frameless Composition and cell outlines persist together without altering native geometry or another canvas', () => {
  const { root, scope, storage, edit, fail } = fixture();
  const shape = scope.getSnapshot().shapes[0], outline = { width: 3, color: '#ffffff', opacity: 1 };
  editShape(scope, profile, shape, { opacity: 0, outline });
  const before = structuredClone(scope.getComposition()), workbenches = structuredClone(root.getDraft().workbenches);
  edit('settings', { showFrame: false });
  const value = structuredClone(scope.getComposition());
  assert.deepEqual(value, { ...before, showFrame: false });
  assert.deepEqual(root.getDraft().workbenches, workbenches);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before); assert.ok(scope.redo());
  const published = projectCompositionEditorDocument(value);
  assert.ok(validCompositionEditorDocument(published, true)); assert.equal(published.showFrame, false);
  assert.deepEqual(published.shapes[0].outline, outline);
  assert.deepEqual(restoreCompositionEditorDocument(published).shapes[0].outline, outline);
  fail(true); assert.throws(() => edit('settings', { showFrame: true })); assert.deepEqual(scope.getComposition(), value); fail(false);
  for (const showFrame of [null, 'false', 0]) {
    assert.throws(() => edit('settings', { showFrame }));
    assert.equal(validCompositionEditorDocument({ ...value, showFrame }), false);
  }
  scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), value);
  reopened.generateCellLayout({ ...COMPOSITION_LAYOUT_DEFAULTS, ...compositionBentoSettings(value), showFrame: false }, 15, reopened.getGeneration());
  assert.equal(reopened.getComposition().showFrame, false); reopened.release();
});

test('Hiding the outer frame preserves fractional rectangles and different cell radii', () => {
  const { scope } = fixture(), value = structuredClone(scope.getComposition());
  value.workbench.shapes[0].window.left += .25; value.cells[1].radius = 12;
  assert.deepEqual(setCompositionBentoSettings(value, { showFrame: false }), { ...value, showFrame: false });
  scope.release();
});

test('shared boundaries preserve a closed partition across rows and T junctions', () => {
  for (let count = 2; count <= 16; count++) for (let seed = 0; seed < 10; seed++) {
    const { scope } = fixture(count, seed), source = scope.getComposition(), dividers = compositionBentoDividers(source);
    assert.ok(dividers.length);
    for (const d of dividers) for (const position of [d.min - 100, d.position + 37, d.max + 100]) closed(resizeCompositionBento(source, d.id, position));
    scope.release();
  }
  const { scope, edit } = fixture(1);
  edit('settings', { width: 400, height: 900 });
  for (let i = 1; i < 16; i++) {
    drawOuterCell(scope, 'right'); closed(scope.getComposition());
  }
  const before = scope.getComposition();
  assert.throws(() => drawOuterCell(scope, 'right'), /room/u); assert.deepEqual(scope.getComposition(), before);
  scope.release();
});
test('insertion moves the whole cell and native image content in one undo without touching canvas', () => {
  const { root, scope, edit } = fixture(), first = scope.getCells()[0].id, second = scope.getCells()[1].id;
  const frame = compositionModuleWindow(scope.getComposition(), first), canvas = structuredClone(scope.getSnapshot());
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) };
  const image = addImageModule(target, profile, { artwork: createCompositionExample().imageModules[0].artwork,
    position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getComposition()), otherCanvas = root.getDraft().workbenches;
  edit('moveCell', first, { left: compositionModuleWindow(before, second).left, top: compositionModuleWindow(before, second).top });
  assert.equal(compositionModuleWindow(scope.getComposition(), first).width, compositionModuleWindow(before, first).width);
  assert.ok(compositionModuleWindow(scope.getComposition(), first).left < compositionModuleWindow(scope.getComposition(), second).left);
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), image), compositionModuleWindow(scope.getComposition(), first));
  assert.deepEqual(scope.getCells().find(cell => cell.id === first).members, [image]); bounded(scope.getComposition());
  assert.deepEqual(root.getDraft().workbenches, otherCanvas);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); assert.ok(compositionModuleWindow(scope.getComposition(), first).left < compositionModuleWindow(scope.getComposition(), second).left);
  assert.equal(canvas.profileAddress, profile); scope.release();
});
test('size, gutter, margin and radius preserve cell dimensions and survive publication and reload', () => {
  const { scope, storage, edit } = fixture(8), before = structuredClone(scope.getComposition());
  edit('settings', { width: 1920, height: 1080, gap: 32, padding: 40, radius: 24 });
  const value = structuredClone(scope.getComposition()); bounded(value);
  for (const cell of before.cells) {
    assert.equal(compositionModuleWindow(value, cell.id).width, compositionModuleWindow(before, cell.id).width);
    assert.equal(compositionModuleWindow(value, cell.id).height, compositionModuleWindow(before, cell.id).height);
  }
  assert.deepEqual(value.bento, { gap: 32, padding: 40 }); assert.ok(value.cells.every(cell => cell.radius === 24));
  assert.ok(validCompositionEditorDocument(projectCompositionEditorDocument(value), true));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), value); reopened.release();
});
test('existing generator geometry supplies initial spacing without changing saved work', () => {
  const { scope } = fixture(), value = structuredClone(scope.getComposition()); delete value.bento;
  const { columns, rows, ...geometry } = COMPOSITION_LAYOUT_DEFAULTS;
  assert.deepEqual(compositionBentoSettings(value), { ...geometry, count: columns * rows, showFrame: true, innerLines: null, surfaceOpacity: 1, frameOpacity: 1, frameRadius: 0, surface: null, frameColor: null, backgroundColor: null });
  bounded(setCompositionBentoSettings(value, { gap: 12, padding: 16 }));
  assert.equal(value.bento, undefined); scope.release();
});
test('stale gestures, invalid settings, failed storage and released scopes never partially change cells', () => {
  const { scope, edit, fail } = fixture(), before = structuredClone(scope.getComposition()), id = before.cells[0].id;
  const generation = scope.getGeneration();
  fail(true); assert.throws(() => edit('resizeCell', id, 'e', 10, 0), /could not be saved/u);
  assert.deepEqual(scope.getComposition(), before); fail(false);
  assert.throws(() => edit('settings', { gap: 257 }), /Gap must/u);
  assert.deepEqual(scope.getComposition(), before);
  drawOuterCell(scope, 'bottom');
  const changed = scope.getComposition();
  assert.throws(() => scope.editBento('resizeCell', [id, 'e', 20, 0], generation), /changed/u);
  assert.deepEqual(scope.getComposition(), changed);
  scope.release(); assert.throws(() => edit('settings', { radius: 16 }), /no longer active/u);
});

test('adding a full-height column grows the canvas, preserves sizes and carries artwork', () => {
  const { scope, edit, root, storage } = fixture(1);
  const first = scope.getCells()[0].id;
  drawOuterCell(scope, 'right'); drawOuterCell(scope, 'right'); drawOuterCell(scope, 'bottom');
  const frame = compositionModuleWindow(scope.getComposition(), first);
  const image = addImageModule({ ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) }, profile,
    { artwork: createCompositionExample().imageModules[0].artwork, position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getComposition()), canvas = root.getDraft().workbenches, delta = 320 + before.bento.gap;
  drawOuterCell(scope, 'right');
  const after = structuredClone(scope.getComposition()); bounded(after);
  assert.deepEqual(after.workbench.area, { ...before.workbench.area, width: before.workbench.area.width + delta });
  for (const cell of before.cells) {
    assert.deepEqual(compositionModuleWindow(after, cell.id), compositionModuleWindow(before, cell.id));
  }
  assert.deepEqual(compositionModuleWindow(after, image), compositionModuleWindow(before, image));
  assert.deepEqual(after.imageModules, before.imageModules); assert.deepEqual(after.texts, before.texts);
  assert.deepEqual(root.getDraft().workbenches, canvas);
  const added = after.cells.find(cell => !before.cells.some(old => old.id === cell.id));
  assert.deepEqual(added.members, []);
  assert.equal(compositionModuleWindow(after, added.id).left, before.workbench.area.width - before.bento.padding + before.bento.gap);
  assert.ok(validCompositionEditorDocument(projectCompositionEditorDocument(after), true));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getComposition(), after); scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
});

test('a new bottom row extends the canvas without resizing existing rows or contents', () => {
  const { scope, edit, storage } = fixture(6);
  const first = scope.getCells()[0].id, frame = compositionModuleWindow(scope.getComposition(), first);
  const image = addImageModule({ ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) }, profile,
    { artwork: createCompositionExample().imageModules[0].artwork, position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getComposition()); drawOuterCell(scope, 'bottom');
  const after = structuredClone(scope.getComposition()); closed(after);
  assert.equal(after.cells.length, before.cells.length + 1);
  for (const cell of before.cells) {
    const old = compositionModuleWindow(before,cell.id), next = compositionModuleWindow(after,cell.id);
    assert.deepEqual(next,old);
  }
  assert.deepEqual(compositionModuleWindow(after,image),compositionModuleWindow(before,image));
  assert.deepEqual(after.cells.slice(0, -1), before.cells);
  assert.equal(after.workbench.area.width, before.workbench.area.width);
  const last = compositionModuleWindow(after, after.cells.at(-1).id), { gap, padding } = compositionBentoSettings(before);
  assert.equal(last.width, before.workbench.area.width - 2 * padding);
  assert.deepEqual(after.workbench.area, { ...before.workbench.area, height: before.workbench.area.height + last.height + gap });
  assert.equal(last.top + last.height, after.workbench.area.top + after.workbench.area.height - padding);
  assert.ok(compositionBentoDividers(after).some(d => d.axis === 'y' && d.after.includes(after.cells.at(-1).id)));
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
});

test('adding beside a cell in a T junction preserves the closed band and valid shared edges', () => {
  const { root, scope, edit } = fixture(3), draft = root.getDraft();
  let value = draft.composition;
  const frames = [{ left: 24, top: 24, width: 600, height: 852 },
    { left: 648, top: 24, width: 768, height: 414 }, { left: 648, top: 462, width: 768, height: 414 }];
  value.cells.forEach((cell, index) => { value = withCompositionModuleWindow(value, cell.id, frames[index]); });
  assert.equal(root.commitCompletedOperation({ ...draft, composition: value }, { expectedGeneration: root.getGeneration() }), true);
  drawOuterCell(scope, 'right');
  const after = scope.getComposition(); closed(after);
  assert.deepEqual(after.workbench.area, { ...value.workbench.area, width: value.workbench.area.width + 320 + value.bento.gap });
  for (const cell of value.cells) assert.deepEqual(compositionModuleWindow(after, cell.id), compositionModuleWindow(value, cell.id));
  assert.equal(compositionModuleWindow(after, after.cells.at(-1).id).height, 852);
  for (const d of compositionBentoDividers(after)) closed(resizeCompositionBento(after, d.id, d.position + 50));
  scope.release();
});

test('row/cell growth rejects size limits, failed storage and stale authority atomically', () => {
  const { scope, root, edit, fail } = fixture(1);
  const large = root.getDraft(); large.composition.workbench.area = { ...large.composition.workbench.area, width: 16384, height: 16384 };
  assert.ok(root.commitCompletedOperation(large, { expectedGeneration: root.getGeneration() }));
  const before = structuredClone(scope.getComposition()), generation = scope.getGeneration(), history = scope.getHistory();
  assert.throws(() => edit('drawCell', 'shape:overflow-x', {left:16384,top:24,width:320,height:240}, 'right'), /maximum Bento size/);
  assert.throws(() => edit('drawCell', 'shape:overflow-y', {left:24,top:16384,width:320,height:240}, 'bottom'), /maximum Bento size/);
  assert.deepEqual(scope.getComposition(), before); assert.deepEqual(scope.getHistory(), history);
  assert.ok(scope.undo());
  const current = structuredClone(scope.getComposition());
  for (const side of ['right', 'bottom']) {
    const action='drawCell', args=drawnCellArgs(current,side);
    fail(true); assert.throws(() => edit(action, ...args), /could not be saved/u); fail(false);
    assert.deepEqual(scope.getComposition(), current);
    assert.throws(() => scope.editBento(action, args, generation), /changed/u);
  }
  scope.release(); assert.throws(() => edit('drawCell', ...drawnCellArgs(current,'bottom')), /no longer active/u);
});

test('Bento preserves mixed radii through geometry, replacement and explicit per-cell styling', () => {
  const { scope, edit } = fixture(2);
  const [a, b] = scope.getCells();
  edit('cellRadius', a.id, 12); edit('cellRadius', b.id, 64);
  assert.equal(compositionBentoSettings(scope.getComposition()).radius, null);
  edit('settings', { width: 1600, gap: 30 });
  assert.deepEqual(scope.getCells().map(cell => cell.radius), [12, 64]);
  scope.generateCellLayout({ ...COMPOSITION_LAYOUT_DEFAULTS, columns: 2, rows: 1 }, 8, scope.getGeneration());
  assert.deepEqual(scope.getCells().map(cell => cell.radius), [12, 64]);
  edit('settings', { radius: 28 });
  assert.deepEqual(scope.getCells().map(cell => cell.radius), [28, 28]);
  scope.undo(); assert.deepEqual(scope.getCells().map(cell => cell.radius), [12, 64]);
  scope.release();
});

test('adding beside Text keeps its transparent article and supports a narrow native frame', () => {
  const { scope, edit } = fixture(1);
  edit('settings', { width: 320, height: 320 });
  const cell = scope.getCells()[0].id, frame = compositionModuleWindow(scope.getComposition(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  const text = addTextModule(target, profile, { window: frame }, { visibility: 'PUBLIC', appearance: { background: null } });
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), text), frame);
  assert.equal(scope.getComposition().texts[0].article.appearance.background, null);
  const before = structuredClone(scope.getComposition());
  drawOuterCell(scope, 'right');
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), cell), frame);
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), text), frame);
  edit('cellSize', cell, { width: 100 });
  const small = compositionModuleWindow(scope.getComposition(), cell);
  assert.ok(small.width >= 80 && small.width < 180);
  assert.deepEqual(compositionModuleWindow(scope.getComposition(), text), small);
  assert.deepEqual(scope.getComposition().texts, before.texts);
  assert.throws(() => addTextModule(target, profile, { cellId: cell, window: { ...small, width: 79 } }), /Enlarge the cell/);
  assert.equal(scope.getComposition().texts.length, 1);
  scope.release();
});

test('a manually sized text box stays proportional when its cell reaches the minimum width', () => {
  const { scope, edit } = fixture(1);
  const cell = scope.getCells()[0].id;
  drawOuterCell(scope, 'right');
  const frame = compositionModuleWindow(scope.getComposition(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  const text = addTextModule(target, profile, { window: { ...frame, width: frame.width / 2 } });
  edit('resizeCell', cell, 'e', -20000, 0);
  assert.equal(compositionModuleWindow(scope.getComposition(), cell).width, 80);
  assert.equal(compositionModuleWindow(scope.getComposition(), text).width, 40);
  assert.ok(validCompositionEditorDocument(scope.getComposition()));
  edit('cellSize', cell, { width: frame.width });
  assert.equal(compositionModuleWindow(scope.getComposition(), text).width, frame.width / 2);
  scope.release();
});

test('cell height changes crop stationary text through preview, save, Undo and reload', () => {
  const { scope, edit, storage, first } = fourCells();
  const frame = compositionModuleWindow(scope.getComposition(), first);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(first, candidate, options) };
  const text = addTextModule(target, profile, { window: { ...frame, top: frame.top + 30, width: frame.width - 60, height: 180 } });
  const before = structuredClone(scope.getComposition());
  for (const height of [240, 100, 500]) {
    edit('cellSize', first, { height });
    const saved = scope.getComposition(), cell = compositionModuleWindow(saved, first), child = compositionModuleWindow(saved, text);
    const original = compositionModuleWindow(before, text);
    assert.deepEqual(child, original, 'cell height edits never move or resize the authored text');
    const gap = cell.top + cell.height - child.top - child.height;
    assert.deepEqual(saved.texts, before.texts, 'resizing does not rewrite the article');
    for (const width of [1440, 1100, 900]) {
      const layout = compositionResponsiveLayout(saved, width), r = layout.windows[first], t = layout.windows[text];
      assert.ok(Math.abs((r.top + r.height - t.top - t.height) / r.height - gap / cell.height) < .001,
        'the public projection preserves the overflow instead of pulling text back inside');
    }
    const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
    assert.deepEqual(reopened.getComposition(), saved); reopened.release();
    assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
    assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), saved);
    assert.ok(scope.undo());
  }
  scope.release();
});

test('minimum Image content rejects proportional shrink with a useful error and no history or data loss', () => {
  const { scope, edit } = fixture(1), cell = scope.getCells()[0].id;
  const frame = compositionModuleWindow(scope.getComposition(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  addImageModule(target, profile, { artwork: createCompositionExample().imageModules[0].artwork, position: { left: frame.left, top: frame.top }, size: { width: 32, height: 32 } });
  const before = structuredClone(scope.getComposition()), history = structuredClone(scope.getHistory());
  assert.throws(() => edit('cellSize', cell, { width: frame.width / 2 }), /between|Image needs a frame/);
  assert.deepEqual(scope.getComposition(), before); assert.deepEqual(scope.getHistory(), history);
  scope.release();
});


test('numeric shrinking leaves adjacent geometry and canvas bounds unchanged', () => {
  const { scope, edit, first } = fourCells(), before = scope.getComposition();
  edit('cellSize', first, { width: 400, height: 250 });
  const after = scope.getComposition(); bounded(after);
  assert.deepEqual(after.workbench.area, before.workbench.area);
  for (const cell of before.cells.filter(c => c.id !== first)) assert.deepEqual(compositionModuleWindow(after, cell.id), compositionModuleWindow(before, cell.id));
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before); scope.release();
});

test('left insertion and an upper row preserve a closed grid, authored content and Undo', () => {
  const { scope, root, edit } = fixture(2);
  const first = scope.getCells()[0].id;
  const before = scope.getComposition();
  drawOuterCell(scope, 'left', 'shape:left-added');
  let next = scope.getComposition(); closed(next);
  assert.equal(compositionModuleWindow(next, 'shape:left-added').left, compositionModuleWindow(before, first).left - 344);
  assert.deepEqual(compositionModuleWindow(next,first),compositionModuleWindow(before,first));
  assert.deepEqual(next.texts, before.texts); assert.deepEqual(next.imageModules, before.imageModules);
  root.undo(); assert.deepEqual(scope.getComposition(), before);
  drawOuterCell(scope, 'top', 'shape:upper'); next = scope.getComposition(); closed(next);
  const upper = compositionModuleWindow(next, 'shape:upper'), gap = next.bento.gap;
  for (const cell of before.cells) assert.deepEqual(compositionModuleWindow(next, cell.id), compositionModuleWindow(before,cell.id));
  assert.deepEqual(next.workbench.area, { ...before.workbench.area, top: before.workbench.area.top - upper.height - gap, height: before.workbench.area.height + upper.height + gap });
  root.undo(); assert.deepEqual(scope.getComposition(), before);
  scope.release();
});

// A spanning cell beside two stacked cells exercises independent placement.
function threeCells() {
  const state = fixture(1), left = state.scope.getCells()[0].id;
  seedCellFrames(state, [[left, { left: 24, top: 24, width: 684, height: 852 }],
    ['shape:right', { left: 732, top: 24, width: 684, height: 414 }],
    ['shape:bottom-right', { left: 732, top: 462, width: 684, height: 414 }]]);
  return { ...state, left, top: 'shape:right', bottom: 'shape:bottom-right' };
}
test('moving below the right column leaves a gap without touching the left cell', () => {
  const { scope, edit, left, top, bottom } = threeCells(), before = scope.getComposition();
  edit('moveCell', top, { left: 732, top: 900 });
  const after = scope.getComposition(); bounded(after);
  assert.deepEqual(compositionModuleWindow(after, left), compositionModuleWindow(before, left));
  assert.equal(compositionModuleWindow(after, top).left, compositionModuleWindow(before, top).left);
  assert.ok(compositionModuleWindow(after, top).top > compositionModuleWindow(after, bottom).top);
  assert.ok(after.workbench.area.height > before.workbench.area.height);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before); scope.release();
});
test('moving past the right edge keeps both text slots stacked in place, with reload and Undo', () => {
  const { scope, edit, storage, root, left, top, bottom } = threeCells();
  const before = scope.getComposition(), other = structuredClone(root.getDraft().workbenches);
  const cellStore = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(top, candidate, options) };
  const text = addTextModule(cellStore, profile, { cellId: top, window: compositionModuleWindow(before, top) });
  const origin = scope.getComposition();
  edit('moveCell', left, { left: 1440, top: 24 });
  const after = scope.getComposition(); bounded(after);
  const a = compositionModuleWindow(after, left), b = compositionModuleWindow(after, top), c = compositionModuleWindow(after, bottom);
  assert.equal(a.height, compositionModuleWindow(origin, left).height); assert.equal(b.left, c.left);
  assert.ok(b.left < a.left); assert.ok(b.top < c.top);
  assert.deepEqual(after.texts, origin.texts); assert.equal(after.cells.find(c => c.id === top).members.includes(text), true);
  assert.ok(after.workbench.area.width > origin.workbench.area.width);
  assert.deepEqual(b, compositionModuleWindow(origin, top)); assert.deepEqual(c, compositionModuleWindow(origin, bottom)); assert.deepEqual(root.getDraft().workbenches, other);
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), origin); assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), after); scope.release();
});
test('moving above and below the canvas preserves sizes, contents and authored responsive order', () => {
  for (const y of [-500, 1000]) {
    const { scope, edit, top } = threeCells(), before = scope.getComposition();
    edit('moveCell', top, { left: 732, top: y });
    const after = scope.getComposition(); bounded(after);
    for (const cell of before.cells) {
      assert.equal(compositionModuleWindow(after, cell.id).width, compositionModuleWindow(before, cell.id).width);
      assert.equal(compositionModuleWindow(after, cell.id).height, compositionModuleWindow(before, cell.id).height);
    }
    assert.deepEqual(after.cells, before.cells); assert.deepEqual(after.shapes, before.shapes);
    assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before); scope.release();
  }
});
test('free destinations preserve generated cell dimensions and source documents with bounded nonoverlap', () => {
  let applied = 0;
  for (const count of [2, 4, 6, 10]) for (const seed of [1, 42]) {
    const { scope } = fixture(count, seed), before = scope.getComposition(), copy = structuredClone(before);
    for (const cell of before.cells) for (const destination of [{left:-300,top:24},{left:1600,top:24},{left:24,top:-400},{left:24,top:1000}, ...before.cells.map(c=>compositionModuleWindow(before,c.id))]) {
      const next = moveCompositionBentoCell(before, cell.id, destination); bounded(next);
      for (const other of before.cells) {
        assert.equal(compositionModuleWindow(next,other.id).width, compositionModuleWindow(before,other.id).width);
        assert.equal(compositionModuleWindow(next,other.id).height, compositionModuleWindow(before,other.id).height);
      }
      applied++;
    }
    assert.deepEqual(before, copy); scope.release();
  }
  assert.ok(applied > 100);
});
test('keyboard cell movement uses fixed world distances in every direction', () => {
  const { scope, left } = threeCells(), value = scope.getComposition(), r = compositionModuleWindow(value,left);
  for (const [side,axis,sign] of [['left','left',-1],['right','left',1],['top','top',-1],['bottom','top',1]]) for (const large of [false,true])
    assert.deepEqual(compositionBentoKeyboardTarget(value,left,side,large), {left:r.left,top:r.top,[axis]:r[axis]+sign*(large?50:10)});
  scope.release();
});
test('failed, stale and released moves leave the accepted composition and history unchanged', () => {
  const { scope, edit, fail, left } = threeCells(), before = scope.getComposition(), generation = scope.getGeneration();
  fail(true); assert.throws(() => edit('moveCell', left, { left: 1440, top: 24 }), /could not be saved/);
  assert.deepEqual(scope.getComposition(), before); fail(false);
  edit('moveCell', left, { left: 1440, top: 24 });
  assert.throws(() => scope.editBento('moveCell', [left, { left: -720, top: 24 }], generation), /changed/);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before); scope.release();
  assert.throws(() => edit('moveCell', left, { left: 1440, top: 24 }), /no longer active/);
});

test('readable desktop reflow adds rows before the phone breakpoint without changing authored geometry', () => {
  const { scope } = fixture(16), before = scope.getComposition(), copy = structuredClone(before);
  const full = compositionResponsiveLayout(before, 1440), narrow = compositionResponsiveLayout(before, 700), phone = compositionResponsiveLayout(before, 390);
  assert.equal(full.stacked, false); assert.equal(narrow.stacked, true);
  assert.ok(narrow.height > 900 * 700 / 1440);
  assert.equal(narrow.cells.length, 16); assert.equal(phone.cells.length, 16);
  for (const cell of narrow.cells) { assert.ok(cell.window.width >= 220 - .01); assert.ok(cell.window.height >= 80 - 1e-8); }
  assert.deepEqual(before, copy); scope.release();
});
test('long native text retains a bounded responsive preview and its complete saved article', () => {
  const { scope, top } = threeCells(), frame = compositionModuleWindow(scope.getComposition(), top);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(top, candidate, options) };
  const text = addTextModule(target, profile, { cellId: top, window: frame });
  const value = scope.getComposition(), saved = structuredClone(value);
  const layout = compositionResponsiveLayout(value, 390), long = structuredClone(value);
  long.texts.find(item => item.id === text).article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A complete long article. '.repeat(200) }] }] };
  const longer = compositionResponsiveLayout(long, 390);
  assert.deepEqual(longer.windows, layout.windows, 'adding text does not stretch the preview or move neighbouring cells');
  assert.ok(layout.windows[text].height <= layout.windows[top].height);
  assert.deepEqual(value, saved); scope.release();
});


test('Composition frame colors save atomically with undo, publication, recovery and canvas isolation', () => {
  const { root, scope, storage, edit, fail } = fixture();
  const before = structuredClone(scope.getComposition()), canvases = structuredClone(root.getDraft().workbenches);
  const colors = { frameColor: '#ff5500', surface: '#112233', backgroundColor: '#345678' };
  edit('settings', colors);
  const saved = structuredClone(scope.getComposition());
  assert.deepEqual(saved, { ...before, showFrame: true, ...colors });
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), saved);
  const published = projectCompositionEditorDocument(saved);
  assert.ok(validCompositionEditorDocument(published, true));
  const restored = restoreCompositionEditorDocument(published);
  for (const key of Object.keys(colors)) assert.equal(restored[key], colors[key]);
  fail(true); assert.throws(() => edit('settings', { surface: '#abcdef' })); fail(false);
  assert.deepEqual(scope.getComposition(), saved);
  for (const key of Object.keys(colors)) for (const invalid of ['red', '#abc', '#12345678', 123, ['#abcdef']]) {
    assert.throws(() => edit('settings', { [key]: invalid }));
    assert.equal(validCompositionEditorDocument({ ...saved, [key]: invalid }), false);
  }
  scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), saved);
  reopened.generateCellLayout(COMPOSITION_LAYOUT_DEFAULTS, 15, reopened.getGeneration());
  for (const key of Object.keys(colors)) assert.equal(reopened.getComposition()[key], colors[key]);
  reopened.editBento('settings', [{ surface: null, frameColor: null, backgroundColor: null }], reopened.getGeneration());
  assert.equal(reopened.getComposition().surface, null);
  assert.ok(reopened.undo()); assert.equal(reopened.getComposition().surface, colors.surface);
  reopened.release();
});


test('outer frame radius is independent of cell radii and survives history, storage and publication', () => {
  const { root, scope, storage, edit, fail } = fixture();
  const before = structuredClone(scope.getComposition()), canvases = structuredClone(root.getDraft().workbenches);
  edit('settings', { frameRadius: 32 });
  const saved = structuredClone(scope.getComposition());
  assert.deepEqual(saved, { ...before, showFrame: true, frameRadius: 32 });
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), saved);
  const published = projectCompositionEditorDocument(saved);
  assert.ok(validCompositionEditorDocument(published, true));
  assert.equal(restoreCompositionEditorDocument(published).frameRadius, 32);
  fail(true); assert.throws(() => edit('settings', { frameRadius: 64 })); fail(false);
  assert.deepEqual(scope.getComposition(), saved);
  for (const frameRadius of [-1, 161, null, '32', Infinity, NaN]) {
    assert.throws(() => edit('settings', { frameRadius }));
    assert.equal(validCompositionEditorDocument({ ...saved, frameRadius }), false);
  }
  edit('settings', { showFrame: false }); assert.equal(scope.getComposition().frameRadius, 32);
  edit('settings', { radius: 12 }); assert.equal(scope.getComposition().frameRadius, 32);
  edit('settings', { frameRadius: 0 }); assert.ok(scope.getComposition().cells.every(cell => cell.radius === 12));
  assert.ok(scope.undo());
  const last = structuredClone(scope.getComposition()); scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), last);
  reopened.generateCellLayout(COMPOSITION_LAYOUT_DEFAULTS, 15, reopened.getGeneration());
  assert.equal(reopened.getComposition().frameRadius, 32); reopened.release();
});


for (const opacityKey of ['surfaceOpacity', 'frameOpacity']) test(`${opacityKey} preserves geometry and saves transparent and partial appearance`, () => {
  const { root, scope, storage, edit, fail } = fixture();
  edit('settings', { surface: '#ffffff', frameColor: '#ff5500', backgroundColor: '#001120', frameRadius: 32 });
  const before = structuredClone(scope.getComposition()), canvases = structuredClone(root.getDraft().workbenches);
  for (const surfaceOpacity of [0, .35, 1]) {
    edit('settings', { [opacityKey]: surfaceOpacity });
    const saved = structuredClone(scope.getComposition());
    assert.deepEqual(saved, { ...before, [opacityKey]: surfaceOpacity });
    assert.deepEqual(root.getDraft().workbenches, canvases);
    assert.ok(scope.undo()); assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), saved);
    const published = projectCompositionEditorDocument(saved);
    assert.ok(validCompositionEditorDocument(published, true));
    assert.equal(restoreCompositionEditorDocument(published)[opacityKey], surfaceOpacity);
  }
  edit('settings', { [opacityKey]: 0 });
  const transparent = structuredClone(scope.getComposition());
  fail(true); assert.throws(() => edit('settings', { [opacityKey]: .5 })); fail(false);
  assert.deepEqual(scope.getComposition(), transparent);
  for (const surfaceOpacity of [-1, 1.01, null, '0', Infinity, NaN]) {
    assert.throws(() => edit('settings', { [opacityKey]: surfaceOpacity }));
    assert.equal(validCompositionEditorDocument({ ...transparent, [opacityKey]: surfaceOpacity }), false);
  }
  scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), transparent); reopened.release();
});


test('cell grain coverage is independent of fill opacity and survives history, publication and reload', () => {
  const { root, scope, storage, edit, fail } = fixture(2), id = scope.getCells()[0].id;
  editShape(scope, profile, scope.getSnapshot().shapes.find(item => item.id === id), { grain: .8, opacity: 0 });
  const before = structuredClone(scope.getComposition()), canvases = structuredClone(root.getDraft().workbenches);
  assert.equal(before.cells.find(cell => cell.id === id).grainOverContent, undefined);
  edit('cellGrain', id, false);
  const saved = structuredClone(scope.getComposition());
  assert.equal(saved.cells.find(cell => cell.id === id).grainOverContent, false);
  assert.deepEqual(saved.shapes, before.shapes);
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), saved);
  for (const grainOverContent of [null, 'false', 0]) {
    assert.throws(() => edit('cellGrain', id, grainOverContent));
    assert.equal(validCompositionEditorDocument({ ...saved, cells: saved.cells.map(cell => cell.id === id ? { ...cell, grainOverContent } : cell) }), false);
  }
  fail(true); assert.throws(() => edit('cellGrain', id, true)); fail(false);
  assert.deepEqual(scope.getComposition(), saved);
  const published = projectCompositionEditorDocument(saved);
  assert.ok(validCompositionEditorDocument(published, true));
  assert.equal(restoreCompositionEditorDocument(published).cells.find(cell => cell.id === id).grainOverContent, false);
  scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), saved); reopened.release();
});

test('removed cell partition command rejects without changing content, generation or history', () => {
  const { scope, edit } = fixture(2), before = structuredClone(scope.getComposition()), generation = scope.getGeneration();
  assert.throws(() => edit('split', before.cells[0].id, 'vertical'), /available bento action/u);
  assert.deepEqual(scope.getComposition(), before); assert.equal(scope.getGeneration(), generation);
  assert.ok(scope.undo()); assert.equal(scope.getCells().length, 0, 'rejection adds no history entry');
  scope.release();
});

for (const side of ['top', 'bottom']) test('Drawing ' + side + ' accepts odd-height rows, saves and survives Undo and reload', () => {
  const { scope, root, edit, storage } = fixture(1);
  edit('settings', { height: 901 });
  const before = structuredClone(scope.getComposition());
  drawOuterCell(scope, side, 'shape:odd-row');
  const after = structuredClone(scope.getComposition()); bounded(after);
  for (const cell of before.cells) {
    assert.equal(compositionModuleWindow(after,cell.id).width,compositionModuleWindow(before,cell.id).width);
    assert.equal(compositionModuleWindow(after,cell.id).height,compositionModuleWindow(before,cell.id).height);
  }
  const added = after.cells.find(cell => cell.id === 'shape:odd-row');
  assert.equal(after.cells.length, 2);
  assert.ok(Number.isInteger(added.mobile.height) && added.mobile.height >= 80 && added.mobile.height <= 1200);
  assert.deepEqual(after.workbench.area, { ...before.workbench.area, top: before.workbench.area.top - (side === 'top' ? compositionModuleWindow(after,added.id).height + before.bento.gap : 0), height: before.workbench.area.height + compositionModuleWindow(after, added.id).height + before.bento.gap });
  root.undo(); assert.deepEqual(scope.getComposition(), before);
  root.redo(); assert.deepEqual(scope.getComposition(), after);
  scope.release();
  const reopened = createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage });
  assert.deepEqual(reopened.getDraft().composition, after);
});

for (const side of ['left', 'right', 'top', 'bottom']) test('Drawing ' + side + ' preserves locked artwork without scaling, with history and reload', () => {
  const { scope, root, edit, storage, first } = fourCells();
  const frame = compositionModuleWindow(scope.getComposition(), first);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(first, candidate, options) };
  const image = addImageModule(target, profile, { artwork: createCompositionExample().imageModules[0].artwork,
    position: { left: frame.left + 10, top: frame.top + 10 }, size: { width: 200, height: 160 } });
  const text = addTextModule(target, profile, { window: { left: frame.left + 20, top: frame.top + 20, width: 240, height: 120 } });
  const draft = root.getDraft(); draft.composition.cells.find(cell => cell.id === first).lockedMembers = [image, text];
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  const before = structuredClone(scope.getComposition()), canvases = root.getDraft().workbenches;
  drawOuterCell(scope, side);
  const after = structuredClone(scope.getComposition()); closed(after);
  const horizontal = ['left','right'].includes(side);
  const added = after.cells.find(cell => !before.cells.some(old => old.id === cell.id)), addedFrame = compositionModuleWindow(after, added.id);
  assert.equal(addedFrame.width, horizontal ? 320 : before.workbench.area.width - before.bento.padding * 2);
  assert.equal(addedFrame.height, horizontal ? before.workbench.area.height - before.bento.padding * 2 : 240);
  for (const id of [...before.cells.map(cell => cell.id), image, text]) {
    const old = compositionModuleWindow(before, id);
    assert.deepEqual(compositionModuleWindow(after, id), old);
  }
  assert.deepEqual(after.imageModules, before.imageModules); assert.deepEqual(after.texts, before.texts);
  assert.deepEqual(after.cells.find(cell => cell.id === first), before.cells.find(cell => cell.id === first));
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), after); scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
});

for (const edge of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) test('outer frame ' + edge + ' resize anchors opposite edges and saves one reversible operation', () => {
  const { scope, edit, fail, storage } = fixture(6);
  const dx = edge.includes('w') ? -40 : 40, dy = edge.includes('n') ? -30 : 30;
  const before = structuredClone(scope.getComposition()), history = scope.getHistory();
  fail(true); assert.throws(() => edit('resizeFrame', edge, dx, dy), /could not be saved/); fail(false);
  assert.deepEqual(scope.getComposition(), before); assert.deepEqual(scope.getHistory(), history);
  edit('resizeFrame', edge, dx, dy);
  const after = structuredClone(scope.getComposition()), old = before.workbench.area, next = after.workbench.area;
  bounded(after);
  assert.deepEqual(after.workbench.shapes, before.workbench.shapes);
  assert.equal(next.left, old.left + (edge.includes('w') ? -40 : 0));
  assert.equal(next.top, old.top + (edge.includes('n') ? -30 : 0));
  assert.equal(next.width, old.width + (/[we]/.test(edge) ? 40 : 0));
  assert.equal(next.height, old.height + (/[ns]/.test(edge) ? 30 : 0));
  assert.ok(scope.undo()); assert.deepEqual(scope.getComposition(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getComposition(), after); scope.release();
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
});

test('fractional shared edges retain their resize handles and preserve adjoining cells', () => {
  const { scope } = fixture(3), value = structuredClone(scope.getComposition());
  const [a, b, c] = value.cells.map(cell => cell.id);
  const regions = [[a, { left: 24, top: 24, width: 100.3, height: 852 }], [b, { left: 148.3000000001, top: 24, width: 600, height: 852 }], [c, { left: 772.3, top: 24, width: 643.7, height: 852 }]];
  for (const [id, frame] of regions) Object.assign(value.workbench.shapes.find(item => item.id === id).window, frame);
  assert.ok(compositionBentoDividers(value).some(d => d.before.includes(a) && d.after.includes(b)));
  scope.release();
});
