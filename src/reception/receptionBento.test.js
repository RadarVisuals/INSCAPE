import { insertReceptionBentoCell, receptionBentoInsertionTargets, receptionBentoInsertionDistance } from './receptionBentoInsertion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from './receptionEditorScope.js';
import { RECEPTION_LAYOUT_DEFAULTS } from './receptionLayoutGenerator.js';
import { receptionBentoSettings, receptionBentoDividers, receptionBentoEqualPosition, resizeReceptionBento, setReceptionBentoSettings } from './receptionBento.js';
import { receptionModuleWindow, withReceptionModuleWindow, validReceptionEditorDocument, projectReceptionEditorDocument } from './receptionEditorDocument.js';
import { addImageModule, saveImageModule } from '../imageModule/imageModuleSession.js';
import { createReceptionExample } from '../../design-system/lab/receptionExample.js';
import { addShape, editShape } from '../shapes/shapeSession.js';
import { restoreReceptionEditorDocument } from './receptionEditorDocument.js';
import { receptionCellMerge, receptionCellSplit, mergeReceptionCells } from './receptionCellStructure.js';
import { projectReceptionMember } from './editorCellGeometry.js';
import { addTextModule } from '../text/textSession.js';
import { editArtworkLayers } from '../systemWorkflow/artworkLayerSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';

const profile = '0x' + '7'.repeat(40);
function fixture(count = 6, seed = 42) {
  const data = new Map(); let failure = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failure) throw Error('Full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage }), scope = createReceptionEditorScope(root);
  let columns = Math.min(4, Math.ceil(Math.sqrt(count)));
  while (count % columns) columns--;
  scope.generateCellLayout({ ...RECEPTION_LAYOUT_DEFAULTS, columns, rows: count / columns }, seed, scope.getGeneration());
  return { root, scope, storage, fail: value => { failure = value; }, edit: (action, ...args) => scope.editBento(action, args, scope.getGeneration()) };
}
function closed(value) {
  assert.ok(validReceptionEditorDocument(value));
  const { width, height, gap, padding } = receptionBentoSettings(value), area = value.workbench.area;
  const rectangles = value.cells.map(cell => receptionModuleWindow(value, cell.id));
  assert.equal(rectangles.reduce((sum, r) => sum + (r.width + gap) * (r.height + gap), 0), (width - padding * 2 + gap) * (height - padding * 2 + gap));
  for (const [i, a] of rectangles.entries()) {
    assert.ok(a.width >= 80 && a.height >= 24);
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

test('one Bento cell retains overlapping independent Images when one artwork is replaced, including Undo and reload', () => {
  const { scope, storage } = fixture(1), cell = scope.getCells()[0].id;
  const frame = receptionModuleWindow(scope.getReception(), cell);
  const artwork = createReceptionExample().imageModules[0].artwork;
  const placement = { cellId: cell, artwork, position: { left: frame.left, top: frame.top }, size: { width: Math.round(frame.width), height: Math.round(frame.height) } };
  const first = addImageModule(scope, profile, placement), second = addImageModule(scope, profile, placement);
  const before = scope.getReception(), current = before.imageModules.find(image => image.id === first);
  const replacement = { ...current, artwork: { ...artwork, id: 'artwork:replacement',
    asset: { ...artwork.asset, media: { ...artwork.asset.media, url: 'https://images.example/replacement.webp' } },
    crop: { x: .3, y: .6, zoom: 2 } } };
  assert.ok(saveImageModule(scope, profile, current, replacement));
  const after = scope.getReception();
  assert.deepEqual(after.imageModules.find(image => image.id === first), replacement);
  assert.deepEqual(after.cells.find(item => item.id === cell).members, [first, second]);
  assert.deepEqual(after.imageModules.find(image => image.id === second), before.imageModules.find(image => image.id === second));
  assert.deepEqual(after.workbench, before.workbench, 'replacement preserves positions, layer order and overlapping frames');
  assert.deepEqual(receptionModuleWindow(after, first), receptionModuleWindow(after, second));
  assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getReception(), after);
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), after); reopened.release(); scope.release();
});

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
  const image = addImageModule(target, profile, { artwork: createReceptionExample().imageModules[0].artwork,
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
  assert.ok(Math.abs(artwork.left - (filled.left + 10 * filled.width / frame.width)) < 1e-9, 'live content transforms with the expanded cell');
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
  assert.match(receptionCellMerge(scope.getReception(), 'shape:right', 'left').reason, /outer boundary/u);
  edit('merge', first, 'right'); closed(scope.getReception());
  assert.equal(scope.getCells().length, 1, 'a tall cell can absorb both stacked neighbours');
  scope.release();
});

function staggeredCells(gap = 24, transpose = false) {
  const state = fixture(6), draft = state.root.getDraft(), value = draft.reception;
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
  closed(state.scope.getReception());
  return { ...state, ids: value.cells.map(cell => cell.id) };
}

test('directional merge aligns staggered neighbouring cells and leaves other rows exact', () => {
  for (const gap of [0, 24]) for (const direction of ['above', 'below', 'left', 'right']) {
    const transpose = ['left', 'right'].includes(direction), reverse = ['above', 'left'].includes(direction);
    const { scope, edit, ids } = staggeredCells(gap, transpose), before = structuredClone(scope.getReception());
    const selected = ids[reverse ? 2 : 0], removed = ids[reverse ? 0 : 2], cross = transpose ? 'top' : 'left', size = transpose ? 'height' : 'width';
    assert.equal(receptionCellMerge(before, selected, direction).reason, undefined);
    edit('merge', selected, direction);
    const after = structuredClone(scope.getReception()); closed(after);
    assert.equal(after.cells.length, 5); assert.equal(after.cells.some(cell => cell.id === removed), false);
    assert.equal(receptionModuleWindow(after, selected)[cross], receptionModuleWindow(before, selected)[cross]);
    assert.equal(receptionModuleWindow(after, selected)[size], receptionModuleWindow(before, selected)[size]);
    for (const id of [ids[reverse ? 3 : 1], ...ids.slice(4)])
      assert.deepEqual(receptionModuleWindow(after, id), receptionModuleWindow(before, id));
    assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before);
    assert.ok(scope.redo()); assert.deepEqual(scope.getReception(), after); scope.release();
  }
});

test('unequal-width merge fits native contents, preserves privacy and saves alignment with the merge atomically', () => {
  const { root, scope, edit, fail, storage, ids } = staggeredCells(), [first, , below, beside] = ids;
  for (const id of [first, below, beside]) {
    const frame = receptionModuleWindow(scope.getReception(), id);
    const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(id, candidate, opts) };
    addImageModule(target, profile, { artwork: createReceptionExample().imageModules[0].artwork,
      position: { left: frame.left + 10, top: frame.top + 10 }, size: { width: 200, height: 160 } });
    addTextModule(target, profile, { window: { left: frame.left + 20, top: frame.top + 20, width: 240, height: 120 } }, { visibility: 'PUBLIC' });
    addShape(target, profile, { position: { left: frame.left + 30, top: frame.top + 30 }, size: { width: 100, height: 100 } });
  }
  const draft = root.getDraft();
  draft.reception.shapes.find(item => item.id === beside).visibility = 'PRIVATE';
  draft.reception.cells.find(cell => cell.id === below).lockedMembers = [...draft.reception.cells.find(cell => cell.id === below).members];
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  const before = structuredClone(scope.getReception()), canvases = structuredClone(root.getDraft().workbenches);
  fail(true); assert.throws(() => edit('merge', first, 'below'), /could not be saved/u); fail(false);
  assert.deepEqual(scope.getReception(), before, 'alignment is not saved separately when the merge cannot be saved');
  edit('merge', first, 'below');
  const after = structuredClone(scope.getReception()); closed(after);
  const merged = after.cells.find(cell => cell.id === first), lower = before.cells.find(cell => cell.id === below);
  assert.deepEqual(merged.members, [...before.cells[0].members, ...lower.members]);
  assert.deepEqual(merged.lockedMembers, lower.members);
  for (const id of [first, below, beside]) {
    const oldFrame = receptionModuleWindow(before, id);
    const alignedFrame = id === below ? { ...oldFrame, width: 1000 }
      : id === beside ? receptionModuleWindow(after, id) : oldFrame;
    for (const member of before.cells.find(cell => cell.id === id).members) {
      const expected = projectReceptionMember(oldFrame, alignedFrame, receptionModuleWindow(before, member));
      if (member.startsWith('image:')) { expected.width = Math.round(expected.width); expected.height = Math.round(expected.height); }
      assert.deepEqual(receptionModuleWindow(after, member), expected);
    }
  }
  assert.deepEqual(after.texts, before.texts);
  assert.deepEqual(after.artworkLayers, before.artworkLayers.filter(id => id !== below));
  const published = projectReceptionEditorDocument(after);
  assert.ok(validReceptionEditorDocument(published, true));
  for (const id of [beside, ...before.cells.find(cell => cell.id === beside).members])
    assert.equal([...published.shapes, ...published.imageModules, ...published.texts].some(item => item.id === id), false);
  assert.deepEqual(root.getDraft().workbenches, canvases);
  assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before);
  assert.ok(scope.redo()); assert.deepEqual(scope.getReception(), after); scope.release();
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage }));
  assert.deepEqual(reopened.getReception(), after); reopened.release();
});

test('alignment rejects content size limits and incompatible visibility before changing the layout', () => {
  const { root, scope, ids, edit } = staggeredCells(), below = ids[2];
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(below, candidate, opts) };
  const text = addTextModule(target, profile, { cellId: below, window: { ...receptionModuleWindow(scope.getReception(), below), width: 80, height: 100 } });
  // New cell Text fits its contents. This boundary case needs a manually sized
  // frame at the native minimum, whose proportional contraction is invalid.
  edit('fitText', below, text, false);
  const minimum = root.getDraft();
  minimum.reception = withReceptionModuleWindow(minimum.reception, text, { ...receptionModuleWindow(minimum.reception, text), width: 1 });
  assert.ok(root.commitCompletedOperation(minimum, { expectedGeneration: root.getGeneration() }));
  const before = structuredClone(scope.getReception());
  assert.match(receptionCellMerge(before, ids[0], 'below').reason, /size limits/u);
  assert.throws(() => edit('merge', ids[0], 'below'), /size limits/u); assert.deepEqual(scope.getReception(), before);
  const draft = root.getDraft(); draft.reception.shapes.find(item => item.id === below).visibility = 'PRIVATE';
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  assert.match(receptionCellMerge(scope.getReception(), ids[0], 'below').reason, /publication visibility/u);
  scope.release();
});

test('a staggered middle cell aligns both edges, making room before contraction', () => {
  const { root, scope, edit } = fixture(6), draft = root.getDraft(), ids = draft.reception.cells.map(cell => cell.id);
  const widths = [[400, 500, 444], [300, 500, 544]];
  for (let row = 0; row < 2; row++) {
    let left = 24;
    for (let column = 0; column < 3; column++) {
      const width = widths[row][column];
      draft.reception.workbench.shapes.find(item => item.id === ids[row * 3 + column]).window = { left, top: 24 + row * 438, width, height: 414 };
      left += width + 24;
    }
  }
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  const lower = ids[4], target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(lower, candidate, opts) };
  const text = addTextModule(target, profile, { window: { ...receptionModuleWindow(scope.getReception(), lower), width: 180, height: 100 } });
  const before = structuredClone(scope.getReception());
  edit('merge', ids[1], 'below');
  const after = scope.getReception(); closed(after);
  assert.deepEqual(receptionModuleWindow(after, ids[1]), { left: 448, top: 24, width: 500, height: 852 });
  assert.equal(receptionModuleWindow(after, text).left, receptionModuleWindow(before, text).left + 100);
  assert.equal(receptionModuleWindow(after, text).width, 180);
  assert.equal(receptionModuleWindow(after, ids[3]).width, 400);
  assert.equal(receptionModuleWindow(after, ids[5]).width, 444);
  assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before); scope.release();
});

test('available merges keep generated partitions closed without mutating the proposal input', () => {
  let alignedCount = 0;
  for (const count of [3, 6, 10, 16]) for (const seed of [1, 12, 42, 77]) {
    const { scope } = fixture(count, seed), before = structuredClone(scope.getReception());
    for (const cell of before.cells) for (const direction of ['above', 'below', 'left', 'right']) {
      const plan = receptionCellMerge(before, cell.id, direction);
      if (plan.reason) continue;
      if (plan.aligned !== before) alignedCount++;
      closed(mergeReceptionCells(before, cell.id, direction));
    }
    assert.deepEqual(scope.getReception(), before); scope.release();
  }
  assert.ok(alignedCount > 0);
});

test('merge preserves native content, locked members, ordering and publication; split carries content into the first half', () => {
  const { root, scope, edit, storage, first } = fourCells(), neighbour = 'shape:bottom-left';
  for (const id of [first, neighbour]) {
    const frame = receptionModuleWindow(scope.getReception(), id);
    const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(id, candidate, opts) };
    addImageModule(target, profile, { artwork: createReceptionExample().imageModules[0].artwork,
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
  patch(value => { value.workbench.shapes.find(item => item.id === first).window.height = 71; });
  assert.ok(receptionCellSplit(scope.getReception(), first, 'horizontal').reason.includes('24')); assert.ok(scope.undo());
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
  reopened.generateCellLayout({ ...RECEPTION_LAYOUT_DEFAULTS, ...receptionBentoSettings(value), showFrame: false }, 15, reopened.getGeneration());
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
test('insertion moves the whole cell and native image content in one undo without touching canvas', () => {
  const { root, scope, edit } = fixture(), first = scope.getCells()[0].id, second = scope.getCells()[1].id;
  const frame = receptionModuleWindow(scope.getReception(), first), canvas = structuredClone(scope.getSnapshot());
  const target = { ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) };
  const image = addImageModule(target, profile, { artwork: createReceptionExample().imageModules[0].artwork,
    position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getReception()), otherCanvas = root.getDraft().workbenches;
  edit('insert', first, { targetId: second, side: 'right' });
  assert.equal(receptionModuleWindow(scope.getReception(), first).width, frame.width);
  assert.ok(receptionModuleWindow(scope.getReception(), first).left > receptionModuleWindow(scope.getReception(), second).left);
  assert.deepEqual(receptionModuleWindow(scope.getReception(), image), receptionModuleWindow(scope.getReception(), first));
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
  const { columns, rows, ...geometry } = RECEPTION_LAYOUT_DEFAULTS;
  assert.deepEqual(receptionBentoSettings(value), { ...geometry, count: columns * rows, showFrame: true, innerLines: null });
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
    { artwork: createReceptionExample().imageModules[0].artwork, position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
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

test('a new bottom row shares the last band inside the fixed frame and preserves other rows and contents', () => {
  const { scope, edit, storage } = fixture(6);
  const first = scope.getCells()[0].id, frame = receptionModuleWindow(scope.getReception(), first);
  const image = addImageModule({ ...scope, commitCompletedOperation: (candidate, opts) => scope.commitInCell(first, candidate, opts) }, profile,
    { artwork: createReceptionExample().imageModules[0].artwork, position: { left: frame.left, top: frame.top }, size: { width: frame.width, height: frame.height } });
  const before = structuredClone(scope.getReception()); edit('appendRow');
  const after = structuredClone(scope.getReception()); closed(after);
  assert.equal(after.cells.length, before.cells.length + 1);
  const lastTop = Math.max(...before.cells.map(cell => receptionModuleWindow(before,cell.id).top));
  for (const cell of before.cells) {
    const old = receptionModuleWindow(before,cell.id), next = receptionModuleWindow(after,cell.id);
    if (old.top < lastTop) assert.deepEqual(next,old);
    else { assert.equal(next.width,old.width); assert.equal(next.top,old.top); assert.ok(next.height < old.height); }
  }
  assert.deepEqual(receptionModuleWindow(after,image),receptionModuleWindow(before,image));
  assert.deepEqual(after.cells.slice(0, -1), before.cells);
  assert.equal(after.workbench.area.width, before.workbench.area.width);
  assert.deepEqual(after.workbench.area,before.workbench.area);
  const last = receptionModuleWindow(after, after.cells.at(-1).id), { gap, padding } = receptionBentoSettings(before);
  assert.equal(last.width, before.workbench.area.width - 2 * padding);
  assert.equal(last.top + last.height, before.workbench.area.top + before.workbench.area.height - padding);
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
  edit('settings', { width: 320, height: 320 }); edit('addCell', scope.getCells()[0].id); edit('appendRow');
  const edge = receptionBentoDividers(scope.getReception()).find(d => d.axis === 'y'); edit('resize',edge.id,edge.max);
  const before = structuredClone(scope.getReception()), generation = scope.getGeneration();
  assert.throws(() => edit('addCell', before.cells[0].id), /too full/u);
  assert.throws(() => edit('appendRow'), /not enough room/u); assert.deepEqual(scope.getReception(), before);
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
  scope.generateCellLayout({ ...RECEPTION_LAYOUT_DEFAULTS, columns: 2, rows: 1 }, 8, scope.getGeneration());
  assert.deepEqual(scope.getCells().map(cell => cell.radius), [12, 64]);
  edit('settings', { radius: 28 });
  assert.deepEqual(scope.getCells().map(cell => cell.radius), [28, 28]);
  scope.undo(); assert.deepEqual(scope.getCells().map(cell => cell.radius), [12, 64]);
  scope.release();
});

test('Text in a split cell keeps its transparent article and can use a narrow native frame', () => {
  const { scope, edit } = fixture(1);
  edit('settings', { width: 320, height: 320 });
  const cell = scope.getCells()[0].id, frame = receptionModuleWindow(scope.getReception(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  const text = addTextModule(target, profile, { window: frame }, { visibility: 'PUBLIC', appearance: { background: null } });
  assert.deepEqual(receptionModuleWindow(scope.getReception(), text), frame);
  assert.equal(scope.getReception().texts[0].article.appearance.background, null);
  const before = structuredClone(scope.getReception());
  edit('split', cell, 'vertical');
  const small = receptionModuleWindow(scope.getReception(), cell);
  assert.ok(small.width >= 80 && small.width < 180);
  assert.deepEqual(receptionModuleWindow(scope.getReception(), text), small);
  assert.deepEqual(scope.getReception().texts, before.texts);
  assert.throws(() => addTextModule(target, profile, { cellId: cell, window: { ...small, width: 79 } }), /Enlarge the cell/);
  assert.equal(scope.getReception().texts.length, 1);
  scope.release();
});

test('a manually sized text box stays proportional when its cell reaches the minimum width', () => {
  const { scope, edit } = fixture(1);
  const cell = scope.getCells()[0].id;
  edit('split', cell, 'vertical', 'shape:other');
  const frame = receptionModuleWindow(scope.getReception(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  const text = addTextModule(target, profile, { window: { ...frame, width: frame.width / 2 } });
  const edge = receptionBentoDividers(scope.getReception()).find(edge => edge.axis === 'x');
  edit('resize', edge.id, -1000);
  assert.equal(receptionModuleWindow(scope.getReception(), cell).width, 80);
  assert.equal(receptionModuleWindow(scope.getReception(), text).width, 40);
  assert.ok(validReceptionEditorDocument(scope.getReception()));
  edit('resize', edge.id, edge.position);
  assert.equal(receptionModuleWindow(scope.getReception(), text).width, frame.width / 2);
  scope.release();
});

test('minimum Image content rejects proportional shrink with a useful error and no history or data loss', () => {
  const { scope, edit } = fixture(1), cell = scope.getCells()[0].id;
  const frame = receptionModuleWindow(scope.getReception(), cell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(cell, candidate, options) };
  addImageModule(target, profile, { artwork: createReceptionExample().imageModules[0].artwork, position: { left: frame.left, top: frame.top }, size: { width: 32, height: 32 } });
  const before = structuredClone(scope.getReception()), history = structuredClone(scope.getHistory());
  assert.throws(() => edit('settings', { width: 720, height: 450 }), /Image needs a frame/);
  assert.deepEqual(scope.getReception(), before); assert.deepEqual(scope.getHistory(), history);
  scope.release();
});


test('equal divider targets balance adjacent cells on both axes and respect geometry limits', () => {
  const { scope, edit } = fourCells();
  for (const d of receptionBentoDividers(scope.getReception())) {
    const source = scope.getReception(), target = receptionBentoEqualPosition(source, d);
    assert.notEqual(target, null);
    const resized = resizeReceptionBento(source, d.id, target), key = d.axis === 'x' ? 'width' : 'height';
    assert.ok(Math.abs(receptionModuleWindow(resized, d.before[0])[key] - receptionModuleWindow(resized, d.after[0])[key]) <= 1);
    assert.equal(receptionBentoEqualPosition(source, { ...d, min: target + 1 }), null);
    closed(resized);
  }
  scope.release();
});

test('left insertion and an upper row preserve a closed grid, authored content and Undo', () => {
  const { scope, root, edit } = fixture(2);
  const first = scope.getCells()[0].id;
  const before = scope.getReception();
  edit('prependCell', first, 'shape:left-added');
  let next = scope.getReception(); closed(next);
  assert.equal(receptionModuleWindow(next, 'shape:left-added').left, receptionModuleWindow(before, first).left);
  assert.ok(next.cells.indexOf(next.cells.find(c => c.id === 'shape:left-added')) < next.cells.indexOf(next.cells.find(c => c.id === first)));
  assert.deepEqual(next.texts, before.texts); assert.deepEqual(next.imageModules, before.imageModules);
  root.undo(); assert.deepEqual(scope.getReception(), before);
  edit('prependRow', 'shape:upper'); next = scope.getReception(); closed(next);
  const upper = receptionModuleWindow(next, 'shape:upper'), gap = next.bento.gap;
  for (const cell of before.cells) assert.deepEqual(receptionModuleWindow(next, cell.id), {
    ...receptionModuleWindow(before, cell.id), top: receptionModuleWindow(before, cell.id).top + upper.height + gap,
    height: receptionModuleWindow(before,cell.id).height - upper.height - gap });
  assert.deepEqual(next.workbench.area,before.workbench.area);
  root.undo(); assert.deepEqual(scope.getReception(), before);
  scope.release();
});

test('a thin full-width strip moves to the top and bottom with its text, one Undo and atomic failed saves', () => {
  const { scope, root, edit, fail } = fixture(2);
  edit('appendRow', 'shape:strip');
  let source = scope.getReception();
  const edge = receptionBentoDividers(source).find(d => d.axis === 'y');
  edit('resize', edge.id, edge.max - 16);
  source = scope.getReception();
  const strip = receptionModuleWindow(source, 'shape:strip');
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell('shape:strip', candidate, options) };
  const text = addTextModule(target, profile, { cellId: 'shape:strip', window: { ...strip, width: 180, height: 24 } });
  const before = scope.getReception(), textBefore = receptionModuleWindow(before, text);
  edit('insert', 'shape:strip', { targetId: before.cells[0].id, side: 'above' });
  const moved = scope.getReception(), frame = receptionModuleWindow(moved, 'shape:strip'); closed(moved);
  assert.equal(frame.height, strip.height); assert.equal(frame.width, strip.width);
  assert.equal(frame.top, before.bento.padding);
  assert.equal(receptionModuleWindow(moved, text).top - frame.top, textBefore.top - strip.top);
  assert.deepEqual(moved.texts, before.texts); assert.deepEqual(moved.workbench.area, before.workbench.area);
  root.undo(); assert.deepEqual(scope.getReception(), before);
  fail(true); assert.throws(() => edit('insert', 'shape:strip', { targetId: before.cells[0].id, side: 'above' }), /could not be saved/u);
  assert.deepEqual(scope.getReception(), before); fail(false);
  edit('insert', 'shape:strip', { targetId: before.cells[0].id, side: 'above' }); edit('insert', 'shape:strip', { targetId: before.cells[0].id, side: 'below' });
  assert.deepEqual(scope.getReception(), before);
  assert.deepEqual(scope.getReception().cells.find(cell => cell.id === 'shape:strip').members, [text]);
  scope.release();
});


test('a full-width strip inserts between rows, preserving its size and every other cell size', () => {
  const { scope, edit } = fixture(4);
  edit('appendRow', 'shape:strip');
  let before = scope.getReception();
  const edge = receptionBentoDividers(before).find(d => d.after.includes('shape:strip'));
  edit('resize', edge.id, edge.max - 16); before = scope.getReception();
  const rows = [...new Set(before.cells.filter(c => c.id !== 'shape:strip').map(c => receptionModuleWindow(before, c.id).top))].sort((a,b) => a-b);
  const target = before.cells.find(c => receptionModuleWindow(before, c.id).top === rows[1]);
  edit('insert', 'shape:strip', { targetId: target.id, side: 'above' });
  const after = scope.getReception(), strip = receptionModuleWindow(after, 'shape:strip'); closed(after);
  assert.equal(strip.width, receptionModuleWindow(before, 'shape:strip').width);
  assert.equal(strip.height, 40);
  assert.ok(strip.top > rows[0] && strip.top < receptionModuleWindow(after, target.id).top);
  for (const cell of before.cells) {
    assert.equal(receptionModuleWindow(after, cell.id).width, receptionModuleWindow(before, cell.id).width);
    assert.equal(receptionModuleWindow(after, cell.id).height, receptionModuleWindow(before, cell.id).height);
  }
  assert.deepEqual(after.workbench.area, before.workbench.area);
  scope.release();
});

test('insertion targets keep generated partitions closed across rows and spanning cells', () => {
  let applied = 0;
  for (const count of [2, 4, 6, 10]) for (const seed of [1, 42]) {
    const { scope } = fixture(count, seed), source = scope.getReception();
    for (const cell of source.cells) for (const target of receptionBentoInsertionTargets(source, cell.id)) {
      try { const next = insertReceptionBentoCell(source, cell.id, target); closed(next); assert.deepEqual(next.workbench.area, source.workbench.area); applied++; }
      catch (error) { assert.match(error.message, /not enough room|spanning cell|needs|limits|at least|too small|enlarge/i); }
    }
    scope.release();
  }
  assert.ok(applied > 100);
  const { scope, edit, first } = fourCells();
  edit('merge', first, 'below');
  const source = scope.getReception();
  for (const target of receptionBentoInsertionTargets(source, first)) {
    try { const next = insertReceptionBentoCell(source, first, target); closed(next); assert.deepEqual(next.workbench.area, source.workbench.area); }
    catch (error) { assert.match(error.message, /not enough room/); }
  }
  scope.release();
});


test('reordering unequal neighbours repeatedly preserves every cell and the image inside the shifted cell', () => {
  const { scope, root, edit } = fixture(4);
  scope.generateCellLayout({ ...RECEPTION_LAYOUT_DEFAULTS, columns: 4, rows: 1 }, 42, scope.getGeneration());
  const draft = root.getDraft(), widths = [180, 620, 160, 360]; let left = 24;
  draft.reception.cells.forEach((cell, i) => {
    draft.reception.workbench.shapes.find(item => item.id === cell.id).window = { left, top: 24, width: widths[i], height: 852 };
    left += widths[i] + 24;
  });
  assert.equal(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }), true);
  const imageCell = scope.getCells()[0].id, frame = receptionModuleWindow(scope.getReception(), imageCell);
  const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(imageCell, candidate, options) };
  const image = addImageModule(target, profile, { artwork: createReceptionExample().imageModules[0].artwork,
    position: { left: frame.left + 10, top: frame.top + 12 }, size: { width: 80, height: 100 } });
  const original = scope.getReception(), imageFrame = receptionModuleWindow(original, image);
  for (let i = 0; i < 12; i++) {
    const before = scope.getReception(), order = before.cells.slice().sort((a,b) => receptionModuleWindow(before,a.id).left - receptionModuleWindow(before,b.id).left);
    const index = order.findIndex(cell => cell.id === imageCell), neighbour = order[index + 1] || order[index - 1];
    edit('insert', neighbour.id, { targetId: imageCell, side: index + 1 < order.length ? 'left' : 'right' });
    const after = scope.getReception(); closed(after);
    for (const cell of after.cells) {
      assert.equal(receptionModuleWindow(after, cell.id).width, receptionModuleWindow(original, cell.id).width, 'reordering must not resize a neighbour');
      assert.equal(receptionModuleWindow(after, cell.id).height, receptionModuleWindow(original, cell.id).height);
    }
    const current = receptionModuleWindow(after, image), owner = receptionModuleWindow(after, imageCell);
    assert.equal(current.width, imageFrame.width); assert.equal(current.height, imageFrame.height);
    assert.equal(current.left - owner.left, imageFrame.left - frame.left);
    assert.equal(current.top - owner.top, imageFrame.top - frame.top);
  }
  const changed = scope.getReception(); scope.undo(); scope.redo(); assert.deepEqual(scope.getReception(), changed);
  scope.release();
});


test('moving a cell below its row carves a strip from the target band without growing the Bento', () => {
  assert.equal(RECEPTION_LAYOUT_DEFAULTS.width, 1440); assert.equal(RECEPTION_LAYOUT_DEFAULTS.height, 900);
  const { scope, root, edit, fail } = fixture(5), draft = root.getDraft();
  const rectangles = [[24,24,1392,40], [24,88,300,160], [348,88,500,160], [872,88,544,160], [24,272,1392,604]];
  draft.reception.cells.forEach((cell,i) => {
    const [left,top,width,height] = rectangles[i];
    draft.reception.workbench.shapes.find(item => item.id === cell.id).window = {left,top,width,height};
  });
  assert.equal(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }), true);
  const before = scope.getReception(), source = before.cells[1].id, body = before.cells[4].id;
  for (const side of ['above','below']) {
    edit('insert', source, { targetId: body, side });
    const after = scope.getReception(); closed(after);
    assert.deepEqual(after.workbench.area, before.workbench.area, 'repositioning must not resize the work surface');
    assert.equal(receptionModuleWindow(after,source).height, 160);
    assert.equal(receptionModuleWindow(after,body).height, 420);
    assert.deepEqual(receptionModuleWindow(after,before.cells[0].id), receptionModuleWindow(before,before.cells[0].id));
    assert.equal(scope.undo(),true); assert.deepEqual(scope.getReception(),before);
  }
  fail(true); assert.throws(() => edit('insert', source, {targetId:body,side:'above'}), /could not be saved/);
  assert.deepEqual(scope.getReception(),before); fail(false);
  const tight = withReceptionModuleWindow(before,body,{...receptionModuleWindow(before,body),height:100});
  assert.throws(() => insertReceptionBentoCell(tight,source,{targetId:body,side:'above'}), /not enough room/);
  scope.release();
});


test('a thin neighbouring row cannot steal a drop on the intended row boundary', () => {
  const upper={axis:'x',position:24,from:24,to:64}, intended={axis:'x',position:24,from:88,to:128};
  const point={x:24,y:108}, targets=[upper,intended];
  assert.equal(receptionBentoInsertionDistance(intended,point,.5),0);
  assert.equal(receptionBentoInsertionDistance(upper,point,.5),22);
  assert.equal(targets.sort((a,b)=>receptionBentoInsertionDistance(a,point,.5)-receptionBentoInsertionDistance(b,point,.5))[0],intended);
});
