import { drawnCellArgs } from './fixtures/cellDrawing.js';
import { drawCompositionBentoCell } from './compositionCellDrawing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createCompositionEditorScope } from './compositionEditorScope.js';
import { COMPOSITION_LAYOUT_DEFAULTS } from './compositionLayoutGenerator.js';
import { compositionModuleWindow, reconcileCompositionCells, projectCompositionEditorDocument, validCompositionArtwork } from './compositionEditorDocument.js';
import { compositionCellFrames, compositionBentoSettings, setCompositionBentoSettings } from './compositionBento.js';
import { resizeCompositionCell, setCompositionCellSize } from './compositionCellSizing.js';
import { moveCompositionBentoCell } from './compositionBentoInsertion.js';
import { pushCompositionCellFrames } from './compositionCellPush.js';
import { addTextModule } from '../text/textSession.js';
import { removeWorkbenchModule } from '../systemWorkflow/removeWorkbenchModule.js';

const profile = '0x' + '7'.repeat(40);
function fixture() {
  const data = new Map(); let fail = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('Full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage }), scope = createCompositionEditorScope(root);
  scope.generateCellLayout({ ...COMPOSITION_LAYOUT_DEFAULTS, width: 1440, height: 900, columns: 3, rows: 1 }, 42, scope.getGeneration());
  const value = root.getDraft(), cells = value.cells;
  cells.forEach((cell, i) => { value.workbench.shapes.find(s => s.id === cell.id).window = { left: 24 + i * 344, top: 24, width: 320, height: 280 }; });
  assert.ok(root.commitCompletedOperation(value, { expectedGeneration: root.getGeneration() }));
  return { root, scope, storage, ids: cells.map(c => c.id), fail: value => { fail = value; }, edit: (action, ...args) => scope.editBento(action, args, scope.getGeneration()) };
}
function valid(value) {
  assert.ok(validCompositionArtwork(value));
  const { gap, padding } = compositionBentoSettings(value), area = value.workbench.area, frames = compositionCellFrames(value);
  for (const [i, a] of frames.entries()) {
    assert.ok(a.left >= area.left + padding - .001 && a.top >= area.top + padding - .001);
    assert.ok(a.left + a.width <= area.left + area.width - padding + .001 && a.top + a.height <= area.top + area.height - padding + .001);
    for (const b of frames.slice(i + 1)) assert.ok(a.left + a.width + gap <= b.left + .001 || b.left + b.width + gap <= a.left + .001
      || a.top + a.height + gap <= b.top + .001 || b.top + b.height + gap <= a.top + .001);
  }
}
function history(f, before, after) {
  assert.ok(f.scope.undo()); assert.deepEqual(f.scope.getComposition(), before);
  assert.ok(f.scope.redo()); assert.deepEqual(f.scope.getComposition(), after);
  const reopened = createCompositionEditorScope(createSystemWorkflowDraftStore({ profileAddress: profile, storage: f.storage }));
  assert.deepEqual(reopened.getComposition(), after); reopened.release();
  assert.ok(validCompositionArtwork(projectCompositionEditorDocument(after), true));
}

test('resizing pushes a chain without resizing neighbours, text or articles; preview, save and Undo agree', () => {
  const f = fixture(), [a, b, c] = f.ids, frame = compositionModuleWindow(f.scope.getComposition(), b);
  const target = { ...f.scope, commitCompletedOperation: (candidate, options) => f.scope.commitInCell(b, candidate, options) };
  const text = addTextModule(target, profile, { window: { ...frame, width: 200, height: 100 } });
  const before = structuredClone(f.scope.getComposition()), oldText = compositionModuleWindow(before, text), canvases = structuredClone(f.root.getDraft().workbenches);
  const preview = reconcileCompositionCells(before, resizeCompositionCell(before, a, 'e', 500, 0), { moveContents: true });
  f.edit('resizeCell', a, 'e', 500, 0);
  const after = f.scope.getComposition(); assert.deepEqual(after, preview); valid(after);
  for (const id of [b, c]) {
    const old = compositionModuleWindow(before, id), next = compositionModuleWindow(after, id);
    assert.deepEqual(next, { ...old, left: old.left + 500 });
  }
  assert.deepEqual(compositionModuleWindow(after, text), { ...oldText, left: oldText.left + 500 });
  assert.deepEqual(after.texts, before.texts); assert.deepEqual(f.root.getDraft().workbenches, canvases);
  history(f, before, after); f.scope.release();
});

for (const edge of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) test(`${edge} resize retains opposite edges and all other sizes, including left/top canvas growth`, () => {
  const f = fixture(), id = f.ids[1], before = f.scope.getComposition(), frame = compositionModuleWindow(before, id);
  const dx = edge.includes('w') ? -450 : 450, dy = edge.includes('n') ? -400 : 400;
  f.edit('resizeCell', id, edge, dx, dy); const after = f.scope.getComposition(), next = compositionModuleWindow(after, id);
  valid(after);
  if (edge.includes('w')) assert.equal(next.left + next.width, frame.left + frame.width); else assert.equal(next.left, frame.left);
  if (edge.includes('n')) assert.equal(next.top + next.height, frame.top + frame.height); else assert.equal(next.top, frame.top);
  for (const other of f.ids.filter(item => item !== id)) {
    const a = compositionModuleWindow(before, other), b = compositionModuleWindow(after, other);
    assert.equal(a.width, b.width); assert.equal(a.height, b.height);
  }
  history(f, before, after); f.scope.release();
});

test('shrinking, moving into an empty gap and deleting never compact neighbours', () => {
  const f = fixture(), [a, b, c] = f.ids, before = f.scope.getComposition();
  f.edit('cellSize', a, { width: 160, height: 100 });
  for (const id of [b, c]) assert.deepEqual(compositionModuleWindow(f.scope.getComposition(), id), compositionModuleWindow(before, id));
  const small = f.scope.getComposition();
  f.edit('moveCell', a, { left: 24, top: 500 });
  for (const id of [b, c]) assert.deepEqual(compositionModuleWindow(f.scope.getComposition(), id), compositionModuleWindow(before, id));
  const moved = f.scope.getComposition();
  assert.ok(removeWorkbenchModule(f.scope, profile, 'shape', moved.shapes.find(item => item.id === a)));
  for (const id of [b, c]) assert.deepEqual(compositionModuleWindow(f.scope.getComposition(), id), compositionModuleWindow(before, id));
  assert.deepEqual(f.scope.getComposition().workbench.area, moved.workbench.area);
  history(f, moved, f.scope.getComposition());
  assert.notDeepEqual(small, moved); f.scope.release();
});

for (const side of ['left', 'right', 'top', 'bottom']) test(`adding ${side} preserves every existing cell size and is one saved operation`, () => {
  const f = fixture(), before = structuredClone(f.scope.getComposition()), id = 'shape:added';
  const preview = reconcileCompositionCells(before, drawCompositionBentoCell(before, ...drawnCellArgs(before, side, id, f.ids[1])), { moveContents: true });
  f.edit('drawCell', ...drawnCellArgs(before, side, id, f.ids[1])); const after = f.scope.getComposition();
  assert.deepEqual(after, preview); valid(after);
  for (const cellId of f.ids) {
    const a = compositionModuleWindow(before, cellId), b = compositionModuleWindow(after, cellId);
    assert.equal(a.width, b.width); assert.equal(a.height, b.height);
  }
  history(f, before, after); f.scope.release();
});

test('frame resizing and spacing preserve cell dimensions and protect authored contents', () => {
  const f = fixture(), before = f.scope.getComposition();
  f.edit('resizeFrame', 'se', 400, 300);
  assert.deepEqual(compositionCellFrames(f.scope.getComposition()), compositionCellFrames(before));
  f.edit('settings', { width: 320, height: 320, gap: 64, padding: 40 });
  const after = f.scope.getComposition(); valid(after);
  for (const id of f.ids) {
    const a = compositionModuleWindow(before, id), b = compositionModuleWindow(after, id);
    assert.equal(a.width, b.width); assert.equal(a.height, b.height);
  }
  f.scope.release();
});

test('failed, stale, invalid and over-boundary pushes leave content and history unchanged', () => {
  const f = fixture(), id = f.ids[0], before = structuredClone(f.scope.getComposition()), generation = f.scope.getGeneration();
  f.fail(true); assert.throws(() => f.edit('resizeCell', id, 'e', 50, 0), /saved/); f.fail(false);
  assert.deepEqual(f.scope.getComposition(), before); assert.equal(f.scope.getGeneration(), generation);
  assert.throws(() => f.edit('moveCell', id, { left: 17000, top: 0 }), /maximum Bento/);
  assert.throws(() => f.edit('moveCell', id, { left: NaN, top: 0 }));
  assert.throws(() => f.edit('cellSize', id, { width: Infinity }));
  assert.deepEqual(f.scope.getComposition(), before);
  f.edit('resizeCell', id, 'e', 50, 0); const after = f.scope.getComposition();
  assert.throws(() => f.scope.editBento('resizeCell', [id, 's', 0, 50], generation), /changed/);
  assert.deepEqual(f.scope.getComposition(), after); history(f, before, after); f.scope.release();
});

test('uneven branches and interlocking rectangles push deterministically without needing a closed subdivision', () => {
  const frames = [{ id: 'a', left: 0, top: 0, width: 100, height: 220 },
    { id: 'b', left: 120, top: 0, width: 100, height: 100 }, { id: 'c', left: 120, top: 120, width: 180, height: 100 },
    { id: 'd', left: 320, top: 0, width: 100, height: 220 }, { id: 'free', left: 0, top: 500, width: 40, height: 40 }];
  const original = structuredClone(frames);
  const after = pushCompositionCellFrames(frames, 'a', { ...frames[0], width: 250 }, 'right', 20);
  assert.deepEqual(frames, original);
  assert.deepEqual(after.find(r => r.id === 'free'), frames[4]);
  assert.equal(after.find(r => r.id === 'd').left, 470);
  for (const r of after.slice(1)) { const old = frames.find(o => o.id === r.id); assert.equal(r.width, old.width); assert.equal(r.height, old.height); }
  assert.deepEqual(pushCompositionCellFrames(frames, 'a', { ...frames[0], width: 250 }, 'right', 20), after);
});

test('repeated native resize and drag proposals never mutate input or change other cell dimensions', () => {
  const f = fixture(); let value = f.scope.getComposition();
  for (let i = 0; i < 30; i++) {
    const snapshot = structuredClone(value), id = f.ids[i % 3], frame = compositionModuleWindow(value, id);
    const next = i % 2 ? moveCompositionBentoCell(value, id, { left: frame.left + 40, top: frame.top + 30 })
      : setCompositionCellSize(value, id, { width: frame.width + 30 });
    assert.deepEqual(value, snapshot); valid(next);
    for (const other of f.ids.filter(item => item !== id)) {
      const a = compositionModuleWindow(value, other), b = compositionModuleWindow(next, other);
      assert.equal(a.width, b.width); assert.equal(a.height, b.height);
    }
    value = next;
  }
  f.scope.release();
});

test('global spacing separates diagonal neighbours without resizing or mutating the input', () => {
  const f = fixture(), value = structuredClone(f.scope.getComposition());
  value.cells.forEach((c,i)=>{value.workbench.shapes.find(s=>s.id===c.id).window={left:24+i*344,top:24+i*304,width:320,height:280};});
  value.workbench.area.height=1000;
  const original=structuredClone(value);
  for (const gap of [0,24,40,128,256]) {
    const next=setCompositionBentoSettings(value,{gap}); valid(next);
    for(const c of value.cells) {
      assert.equal(compositionModuleWindow(next,c.id).width,320);
      assert.equal(compositionModuleWindow(next,c.id).height,280);
    }
    assert.deepEqual(value,original);
  }
  f.scope.release();
});
