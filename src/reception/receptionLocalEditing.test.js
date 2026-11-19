import { drawnCellArgs, drawOuterCell, drawBesideCell } from './fixtures/cellDrawing.js';
import { drawReceptionBentoCell } from './receptionCellDrawing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from './receptionEditorScope.js';
import { RECEPTION_LAYOUT_DEFAULTS } from './receptionLayoutGenerator.js';
import { receptionModuleWindow, validReceptionEditorDocument, projectReceptionEditorDocument, restoreReceptionEditorDocument } from './receptionEditorDocument.js';
import { editorCellPreviewTransforms } from './editorCellGeometry.js';
import { moveReceptionBentoCell } from './receptionBentoInsertion.js';
import { receptionCellSizeControl } from './receptionCellSizing.js';
import { receptionBentoSettings } from './receptionBento.js';
import { addTextModule } from '../text/textSession.js';

const profile = '0x' + '8'.repeat(40);
function fixture() {
  const data = new Map(); let failing = false;
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => { if (failing) throw Error('Storage full'); data.set(k, v); }, removeItem: k => data.delete(k) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage }), scope = createReceptionEditorScope(root);
  scope.generateCellLayout({ ...RECEPTION_LAYOUT_DEFAULTS, width: 1793, height: 1164, gap: 16, padding: 16, columns: 1, rows: 1 }, 1, scope.getGeneration());
  const entries = [
    ['shape:header', { left: 16, top: 16, width: 1761, height: 134 }],
    ['shape:intro', { left: 16, top: 166, width: 479, height: 282 }],
    ['shape:portrait', { left: 16, top: 464, width: 479, height: 477 }],
    ['shape:bio', { left: 16, top: 957, width: 479, height: 191 }],
    ['shape:right', { left: 511, top: 166, width: 1266, height: 982 }],
  ];
  const draft = root.getDraft(), value = draft.reception, shape = value.shapes[0], cell = value.cells[0], placement = value.workbench.shapes[0];
  value.shapes = entries.map(([id]) => ({ ...shape, id, name: id.slice(6) }));
  value.cells = entries.map(([id]) => ({ ...structuredClone(cell), id, members: [] }));
  value.workbench.shapes = entries.map(([id, window]) => ({ ...placement, id, window }));
  value.artworkLayers = entries.map(([id]) => id);
  assert.ok(root.commitCompletedOperation(draft, { expectedGeneration: root.getGeneration() }));
  const edit = (action, ...args) => scope.editBento(action, args, scope.getGeneration()), text = {};
  for (const name of ['intro', 'bio']) {
    const id = 'shape:' + name, r = receptionModuleWindow(scope.getReception(), id);
    const target = { ...scope, commitCompletedOperation: (candidate, options) => scope.commitInCell(id, candidate, options) };
    text[name] = addTextModule(target, profile, { window: { left: r.left + 24, top: r.top + 32, width: r.width - 48, height: 160 } }, { visibility: 'PUBLIC' });
  }
  return { root, scope, storage, edit, text, fail: value => { failing = value; } };
}
const frame = receptionModuleWindow;
function bounded(value) {
  assert.ok(validReceptionEditorDocument(value));
  const { width, height, gap, padding } = receptionBentoSettings(value), area = value.workbench.area;
  const frames = value.cells.map(cell => frame(value, cell.id));
  for (const [i, a] of frames.entries()) {
    assert.ok(a.left >= area.left + padding && a.top >= area.top + padding);
    assert.ok(a.left + a.width <= area.left + width - padding + .001 && a.top + a.height <= area.top + height - padding + .001);
    for (const b of frames.slice(i + 1)) assert.ok(a.left + a.width + gap <= b.left + .001 || b.left + b.width + gap <= a.left + .001
      || a.top + a.height + gap <= b.top + .001 || b.top + b.height + gap <= a.top + .001);
  }

}
function retainedText(before, after, text) {
  for (const [name, id] of Object.entries(text)) {
    const a = frame(before, id), b = frame(after, id);
    assert.equal(b.top - frame(after, 'shape:' + name).top, a.top - frame(before, 'shape:' + name).top, name + ' retains local text inset');
    assert.equal(b.height, a.height, name + ' retains text box height');
  }
}
function historyAndReload(f, before, after) {
  assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getReception(), before);
  assert.ok(f.scope.redo()); assert.deepEqual(f.scope.getReception(), after);
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }));
  assert.deepEqual(reopened.getReception(), after); reopened.release();
  assert.deepEqual(restoreReceptionEditorDocument(projectReceptionEditorDocument(after)).workbench.texts, after.workbench.texts);
}

test('moving the bottom strip into the right column retains text in preview, commit, Undo and reload', () => {
  const f = fixture(); drawOuterCell(f.scope, 'bottom', 'shape:new');
  const before = f.scope.getReception(), destination = { left: 511, top: 166 };
  const next = moveReceptionBentoCell(before, 'shape:new', destination);
  const transforms = Object.fromEntries(before.cells.map(cell => [cell.id, { frame: frame(next, cell.id), cellMoveContents: true }]));
  const preview = editorCellPreviewTransforms(before.cells, transforms, before.workbench, before);
  f.edit('moveCell', 'shape:new', destination);
  const after = f.scope.getReception(); bounded(after); retainedText(before, after, f.text);
  for (const id of Object.values(f.text)) assert.deepEqual(preview[id].frame, frame(after, id));
  historyAndReload(f, before, after); f.scope.release();
});

for (const side of ['top', 'bottom', 'left', 'right']) test(`adding ${side} of a cell preserves the selected size, text, identity and all other cell sizes`, () => {
  const f = fixture(), before = f.scope.getReception(), canvas = structuredClone(f.root.getDraft().workbenches);
  drawBesideCell(f.scope, 'shape:intro', side, 'shape:new');
  const after = f.scope.getReception(), source = frame(before, 'shape:intro'), target = frame(after, 'shape:intro'), added = frame(after, 'shape:new');
  assert.equal(target.width, source.width); assert.equal(target.height, source.height);
  const horizontal = side === 'left' || side === 'right', size = horizontal ? 'width' : 'height', pos = horizontal ? 'left' : 'top';
  const earlier = side === 'left' || side === 'top' ? added : target, later = earlier === added ? target : added;
  assert.equal(earlier[pos] + earlier[size] + 16, later[pos]);
  assert.equal(added[size], horizontal ? 320 : 240);
  assert.deepEqual(after.cells.find(c => c.id === 'shape:intro'), before.cells.find(c => c.id === 'shape:intro'));
  assert.deepEqual(after.shapes.find(s => s.id === 'shape:intro'), before.shapes.find(s => s.id === 'shape:intro'));
  assert.deepEqual(f.root.getDraft().workbenches, canvas);
  retainedText(before, after, f.text); bounded(after); historyAndReload(f, before, after); f.scope.release();
});

test('adding below the right region leaves header, left rows, and all existing text positions intact', () => {
  const f = fixture(), before = f.scope.getReception();
  drawBesideCell(f.scope, 'shape:right', 'bottom', 'shape:new');
  const after = f.scope.getReception();
  for (const id of ['shape:header', 'shape:intro', 'shape:portrait', 'shape:right', ...Object.values(f.text)]) assert.deepEqual(frame(after, id), frame(before, id));
  assert.deepEqual(frame(after, 'shape:bio'), frame(before, 'shape:bio'));
  assert.deepEqual(frame(after, 'shape:new'), { left: 511, top: 1164, width: 1266, height: 240 });
  assert.equal(after.workbench.area.height, 1420); bounded(after); f.scope.release();
});

test('numeric height keeps the top edge fixed, translates later rows and is exactly reversible', () => {
  const f = fixture(), before = f.scope.getReception();
  f.edit('cellSize', 'shape:intro', { height: 362 });
  const after = f.scope.getReception();
  assert.deepEqual(frame(after, 'shape:intro'), { ...frame(before, 'shape:intro'), height: 362 });
  for (const id of ['shape:portrait', 'shape:bio']) assert.deepEqual(frame(after, id), { ...frame(before, id), top: frame(before, id).top + 80 });
  assert.deepEqual(frame(after, 'shape:right'), frame(before, 'shape:right'));
  assert.deepEqual(frame(after, 'shape:header'), frame(before, 'shape:header'));
  retainedText(before, after, f.text); bounded(after); historyAndReload(f, before, after);
  f.edit('cellSize', 'shape:intro', { height: 282 });
  for (const id of ['shape:portrait', 'shape:bio', 'shape:right']) assert.deepEqual(frame(f.scope.getReception(), id), frame(after, id), 'shrinking leaves space');
  f.scope.release();
});

test('adding a bottom strip cannot reverse the Height field direction', () => {
  for (const strip of [false, true]) {
    const f = fixture(); if (strip) drawOuterCell(f.scope, 'bottom', 'shape:strip');
    const before = f.scope.getReception(); f.edit('cellSize', 'shape:bio', { height: 251 });
    const after = f.scope.getReception();
    assert.deepEqual(frame(after, 'shape:bio'), { ...frame(before, 'shape:bio'), height: 251 });
    for (const id of ['shape:header', 'shape:intro', 'shape:portrait']) assert.deepEqual(frame(after, id), frame(before, id));
    retainedText(before, after, f.text); bounded(after); f.scope.release();
  }
});

test('local edits are atomic across failed saves, stale generations and exhausted geometry', () => {
  const f = fixture(), before = f.scope.getReception(), generation = f.scope.getGeneration();
  f.fail(true); assert.throws(() => drawBesideCell(f.scope, 'shape:right', 'bottom')); f.fail(false);
  assert.deepEqual(f.scope.getReception(), before);
  for (const args of [['shape:missing', 'bottom'], ['shape:right', 'diagonal'], ['shape:right', 'bottom', 'shape:bio']]) {
    assert.throws(() => drawBesideCell(f.scope, ...args)); assert.deepEqual(f.scope.getReception(), before);
  }
  const control = receptionCellSizeControl(before, 'shape:intro', 'y');
  for (const height of [NaN, Infinity, control.min - 1, control.max + 1]) {
    assert.throws(() => f.edit('cellSize', 'shape:intro', { height })); assert.deepEqual(f.scope.getReception(), before);
  }
  drawBesideCell(f.scope, 'shape:right', 'bottom'); const after = f.scope.getReception();
  assert.throws(() => f.scope.editBento('drawCell', drawnCellArgs(before, 'bottom', undefined, 'shape:right'), generation)); assert.deepEqual(f.scope.getReception(), after);
  f.scope.release(); assert.throws(() => drawBesideCell(f.scope, 'shape:right', 'bottom'));
});

test('repeated local additions preserve all existing sizes in increasingly complex layouts without mutating preview input', () => {
  const f = fixture(); let value = f.scope.getReception();
  for (let i = 0; i < 11; i++) {
    const original = structuredClone(value), id = value.cells[(i * 3) % value.cells.length].id;
    const side = ['bottom', 'right', 'top', 'left'][i % 4], addedId = 'shape:added-' + i;
    const next = drawReceptionBentoCell(value, ...drawnCellArgs(value, side, addedId, id));
    assert.deepEqual(value, original); drawBesideCell(f.scope, id, side, addedId); value = f.scope.getReception();
    for (const cell of value.cells) assert.deepEqual(frame(value, cell.id), frame(next, cell.id));
    for (const cell of original.cells) {
      assert.equal(frame(value, cell.id).width, frame(original, cell.id).width);
      assert.equal(frame(value, cell.id).height, frame(original, cell.id).height);
    }
    bounded(value);
  }
  assert.equal(value.cells.length, 16);
  assert.throws(() => drawBesideCell(f.scope, value.cells[0].id, 'bottom'), /room/);
  assert.deepEqual(f.scope.getReception(), value);
  f.scope.release();
});

test('interlocking cells support independent growth without flattening authored geometry', () => {
  const f = fixture(), draft = f.root.getDraft(), value = draft.reception;
  // Five-cell pinwheel: a valid dense partition without a complete slicing cut.
  const unitX = 1777 / 3, unitY = 1148 / 3;
  const regions = [[0, 0, 2, 1], [2, 0, 1, 2], [1, 2, 2, 1], [0, 1, 1, 2], [1, 1, 1, 1]];
  value.cells = value.cells.map(cell => ({ ...cell, members: [] }));
  value.texts = []; value.workbench.texts = []; value.artworkLayers = value.cells.map(cell => cell.id);
  value.workbench.shapes = value.workbench.shapes.map((item, i) => {
    const [x, y, w, h] = regions[i];
    return { ...item, window: { left: 16 + x * unitX, top: 16 + y * unitY, width: w * unitX - 16, height: h * unitY - 16 } };
  });
  assert.ok(f.root.commitCompletedOperation(draft, { expectedGeneration: f.root.getGeneration() }));
  const before = f.scope.getReception(); bounded(before);
  assert.ok(receptionCellSizeControl(before, before.cells[0].id, 'y'));
  drawBesideCell(f.scope, before.cells[0].id, 'bottom'); bounded(f.scope.getReception());
  for (const cell of before.cells) {
    assert.equal(frame(f.scope.getReception(), cell.id).width, frame(before, cell.id).width);
    assert.equal(frame(f.scope.getReception(), cell.id).height, frame(before, cell.id).height);
  }
  assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getReception(), before);
  f.edit('cellSize', before.cells[0].id, { height: 500 }); bounded(f.scope.getReception());
  historyAndReload(f, before, f.scope.getReception()); f.scope.release();
});
