import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCompositionLayout, COMPOSITION_LAYOUT_DEFAULTS as defaults } from './compositionLayoutGenerator.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createCompositionEditorScope } from './compositionEditorScope.js';
import { compositionModuleWindow, validCompositionEditorDocument, projectCompositionEditorDocument } from './compositionEditorDocument.js';
import { addShape } from '../shapes/shapeSession.js';

const profile = '0x' + '4'.repeat(40);
function fixture() {
  const data = new Map(); let failed = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (failed) throw Error('Full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage });
  addShape(root.getWorkbenchScope(), profile);
  const scope = createCompositionEditorScope(root);
  const apply = (settings = {}, seed = 42) => scope.generateCellLayout({ ...defaults, ...settings }, seed, scope.getGeneration());
  return { root, scope, apply, storage, fail: value => { failed = value; } };
}
const canvasOnly = ({ composition: _composition, ...rest }) => rest;

test('generated layouts keep the chosen rows and columns, exact margins, usable cells and non-overlapping gaps', () => {
  for (const [width, height] of [[1440, 900], [1920, 1080], [900, 1440]]) for (let columns = 1; columns <= 4; columns++) for (let rows = 1; rows <= 16 / columns; rows++) for (let seed = 0; seed < 50; seed++) {
    const settings = { ...defaults, width, height, columns, rows }, result = generateCompositionLayout(settings, seed);
    assert.equal(result.rectangles.length, columns * rows);
    const tops = new Set(result.rectangles.map(rect => rect.top));
    assert.equal(tops.size, rows);
    for (const top of tops) assert.equal(result.rectangles.filter(rect => rect.top === top).length, columns);
    for (const [index, rect] of result.rectangles.entries()) {
      assert.ok(Object.values(rect).every(Number.isInteger));
      assert.ok(rect.width >= 80 && rect.height >= 24);
      assert.ok(rect.left >= settings.padding && rect.top >= settings.padding);
      assert.ok(rect.left + rect.width <= width - settings.padding && rect.top + rect.height <= height - settings.padding);
      for (const other of result.rectangles.slice(index + 1)) assert.ok(
        rect.left + rect.width + settings.gap <= other.left || other.left + other.width + settings.gap <= rect.left
        || rect.top + rect.height + settings.gap <= other.top || other.top + other.height + settings.gap <= rect.top);
    }
    assert.equal(Math.max(...result.rectangles.map(rect => rect.left + rect.width)), width - settings.padding);
    assert.equal(Math.max(...result.rectangles.map(rect => rect.top + rect.height)), height - settings.padding);
  }
  assert.deepEqual(generateCompositionLayout(defaults, 21), generateCompositionLayout(defaults, 21));
  assert.notDeepEqual(generateCompositionLayout(defaults, 21), generateCompositionLayout(defaults, 22));
});

test('invalid and impossible settings are rejected without silently changing the chosen count', () => {
  for (const patch of [{ width: 0 }, { height: 20000 }, { columns: 0 }, { rows: 17 }, { columns: 2.5 }, { rows: NaN }, { columns: 4, rows: 5 }, { padding: NaN },
    { gap: -1 }, { padding: 1.1 }, { radius: 161 }, { width: 320, height: 320, columns: 4, rows: 4 }, { width: 320, padding: 256 }])
    assert.throws(() => generateCompositionLayout({ ...defaults, ...patch }));
});

test('apply stores the exact proposal as native cells, with one undo, redo, reload and canvas isolation', () => {
  const { root, scope, apply, storage } = fixture();
  const before = structuredClone(scope.getComposition()), canvas = canvasOnly(root.getSnapshot());
  const settings = { ...defaults, columns: 2, rows: 5, radius: 24 }, proposal = generateCompositionLayout(settings, 42);
  apply(settings);
  const saved = structuredClone(scope.getComposition());
  assert.equal(saved.cells.length, 10);
  saved.cells.forEach((cell, index) => {
    assert.equal(cell.radius, 24);
    assert.deepEqual(compositionModuleWindow(saved, cell.id), proposal.rectangles[index]);
  });
  assert.equal(validCompositionEditorDocument(saved), true);
  assert.equal(validCompositionEditorDocument(projectCompositionEditorDocument(saved), true), true);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), before);
  assert.equal(scope.redo(), true); assert.deepEqual(scope.getComposition(), saved);
  assert.deepEqual(canvasOnly(root.getSnapshot()), canvas);
  scope.release();
  assert.deepEqual(createSystemWorkflowDraftStore({ initialStudio: true, profileAddress: profile, storage }).getSnapshot().composition, saved);
});

test('reroll retains occupied cells, contents, appearance and relative geometry while removing only surplus empty cells', () => {
  const { scope, apply } = fixture(); apply();
  const cells = scope.getCells(), owner = cells[5].id;
  scope.setEditingCell(owner);
  const child = addShape(scope, profile, { position: { left: 100, top: 100 }, size: { width: 80, height: 60 } });
  scope.setEditingCell(null);
  const previous = structuredClone(scope.getComposition()), oldParent = compositionModuleWindow(previous, owner), oldChild = compositionModuleWindow(previous, child);
  apply({ columns: 1, rows: 1, width: 1920, height: 1080 }, 99);
  const saved = scope.getComposition(), parent = compositionModuleWindow(saved, owner), moved = compositionModuleWindow(saved, child);
  assert.deepEqual(saved.cells.map(cell => cell.id), [owner]);
  assert.deepEqual(saved.cells[0].members, [child]);
  assert.deepEqual(saved.shapes.find(item => item.id === child), previous.shapes.find(item => item.id === child));
  assert.deepEqual(saved.shapes.find(item => item.id === owner), previous.shapes.find(item => item.id === owner));
  assert.ok(Math.abs(moved.left - (parent.left + (oldChild.left - oldParent.left) * parent.width / oldParent.width)) < 1e-9);
  assert.ok(Math.abs(moved.width - oldChild.width * parent.width / oldParent.width) < 1e-9);
  assert.equal(scope.undo(), true); assert.deepEqual(scope.getComposition(), previous);
  scope.release();
});

test('occupied cells, failed storage, stale proposals, exhausted shape capacity and released scopes preserve saved work', () => {
  const { root, scope, apply, fail } = fixture(); apply({ columns: 2, rows: 1 });
  for (const cell of scope.getCells()) {
    scope.setEditingCell(cell.id);
    addShape(scope, profile);
    scope.setEditingCell(null);
  }
  let saved = structuredClone(root.getSnapshot());
  assert.throws(() => apply({ columns: 1, rows: 1 }), /retain their content/u);
  fail(true); assert.throws(() => apply(), /could not be saved/u); fail(false);
  assert.deepEqual(root.getSnapshot(), saved);
  const generation = scope.getGeneration(); apply({ columns: 3, rows: 1 }); saved = structuredClone(root.getSnapshot());
  assert.throws(() => scope.generateCellLayout(defaults, 42, generation), /composition changed/u);
  assert.deepEqual(root.getSnapshot(), saved);
  for (let index = scope.getComposition().shapes.length; index < 32; index++) addShape(scope, profile);
  saved = structuredClone(root.getSnapshot());
  assert.throws(() => apply({ columns: 2, rows: 2 }), /room for 3 cells/u);
  assert.deepEqual(root.getSnapshot(), saved);
  scope.release(); assert.throws(() => apply(), /no longer active/u);
  assert.deepEqual(root.getSnapshot(), saved);
});
