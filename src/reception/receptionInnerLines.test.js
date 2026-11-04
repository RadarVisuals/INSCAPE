import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionInnerLines } from './receptionPartition.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { createReceptionEditorScope } from './receptionEditorScope.js';
import { RECEPTION_LAYOUT_DEFAULTS } from './receptionLayoutGenerator.js';
import { receptionBentoSettings } from './receptionBento.js';
import { validReceptionEditorDocument, projectReceptionEditorDocument, restoreReceptionEditorDocument } from './receptionEditorDocument.js';
import { editShape } from '../shapes/shapeSession.js';

const six = gap => Array.from({ length: 6 }, (_, i) => ({ x: i % 3 * 100, y: Math.floor(i / 3) * 100, width: 100 - gap, height: 100 - gap }));
test('six adjoining cells have exactly two vertical lines and one horizontal line, with no outside edges', () => {
  assert.deepEqual(partitionInnerLines(six(0)), [
    { axis: 'x', position: 100, from: 0, to: 200 }, { axis: 'x', position: 200, from: 0, to: 200 },
    { axis: 'y', position: 100, from: 0, to: 300 },
  ]);
  assert.deepEqual(partitionInnerLines([]), []);
  assert.deepEqual(partitionInnerLines([six(0)[0]]), []);
});
test('gutter-centred lines join cleanly and stop at the outside cell edges', () => {
  assert.deepEqual(partitionInnerLines(six(10), 10), [
    { axis: 'x', position: 95, from: 0, to: 190 }, { axis: 'x', position: 195, from: 0, to: 190 },
    { axis: 'y', position: 95, from: 0, to: 290 },
  ]);
});
test('T junctions stop at the spanning cell; removing that cell removes its divider', () => {
  const cells = [{ x: 0, y: 0, width: 190, height: 190 }, { x: 200, y: 0, width: 90, height: 90 }, { x: 200, y: 100, width: 90, height: 90 }];
  assert.deepEqual(partitionInnerLines(cells, 10), [
    { axis: 'x', position: 195, from: 0, to: 190 }, { axis: 'y', position: 95, from: 195, to: 290 },
  ]);
  assert.deepEqual(partitionInnerLines(cells.slice(1), 10), [{ axis: 'y', position: 95, from: 200, to: 290 }]);
});
test('fractional viewport scaling preserves joins, while missing strips stay open', () => {
  const scale = 0.731;
  const cells = six(10).map(r => Object.fromEntries(Object.entries(r).map(([key, value]) => [key, value * scale])));
  const actual = partitionInnerLines(cells, 10 * scale), original = partitionInnerLines(six(10), 10);
  assert.equal(actual.length, original.length);
  actual.forEach((line, i) => ['position', 'from', 'to'].forEach(key => assert.ok(Math.abs(line[key] - original[i][key] * scale) < 0.001)));
  const rows = [0, 200].flatMap(y => [{ x: 0, y, width: 100, height: 100 }, { x: 100, y, width: 100, height: 100 }]);
  assert.deepEqual(partitionInnerLines(rows), [{ axis: 'x', position: 100, from: 0, to: 100 }, { axis: 'x', position: 100, from: 200, to: 300 }]);
});
test('inner line appearance persists through undo, reload, publication, restoration and layout operations without changing shape appearance', () => {
  const profileAddress = '0x' + '7'.repeat(40), data = new Map(); let fail = false;
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (fail) throw Error('Full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress, storage }), scope = createReceptionEditorScope(root);
  const edit = (action, ...args) => scope.editBento(action, args, scope.getGeneration());
  scope.generateCellLayout(RECEPTION_LAYOUT_DEFAULTS, 42, scope.getGeneration());
  editShape(scope, profileAddress, scope.getSnapshot().shapes[0], { opacity: 0, outline: { width: 4, color: '#abcdef', opacity: 1 } });
  const before = structuredClone(scope.getReception()), canvases = structuredClone(root.getDraft().workbenches);
  const innerLines = { color: '#abcdef', width: 2.5, opacity: 0.6 };
  edit('settings', { showFrame: false, innerLines });
  const saved = structuredClone(scope.getReception());
  assert.deepEqual(saved, { ...before, showFrame: false, innerLines });
  const loaded = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress, storage }));
  assert.deepEqual(loaded.getReception(), saved); loaded.release();
  assert.ok(scope.undo()); assert.deepEqual(scope.getReception(), before); assert.ok(scope.redo());
  fail = true; assert.throws(() => edit('settings', { innerLines: null })); fail = false;
  assert.deepEqual(scope.getReception(), saved);
  const published = projectReceptionEditorDocument(saved);
  assert.ok(validReceptionEditorDocument(published, true)); assert.deepEqual(published.innerLines, innerLines);
  assert.deepEqual(restoreReceptionEditorDocument(published).innerLines, innerLines);
  for (const invalid of [false, {}, { ...innerLines, width: -1 }, { ...innerLines, width: 65 }, { ...innerLines, color: 'red' }, { ...innerLines, opacity: 2 }, { ...innerLines, extra: 1 }]) {
    assert.equal(validReceptionEditorDocument({ ...saved, innerLines: invalid }), false);
    assert.throws(() => edit('settings', { innerLines: invalid }));
  }
  assert.deepEqual(scope.getReception(), saved);
  edit('appendRow'); assert.deepEqual(scope.getReception().innerLines, innerLines);
  scope.generateCellLayout(receptionBentoSettings(scope.getReception()), 57, scope.getGeneration());
  assert.deepEqual(scope.getReception().innerLines, innerLines);
  edit('settings', { innerLines: null });
  for (const shape of saved.shapes) assert.deepEqual(scope.getReception().shapes.find(item => item.id === shape.id), shape);
  assert.deepEqual(root.getDraft().workbenches, canvases);
  const final = structuredClone(scope.getReception()); scope.release();
  const reopened = createReceptionEditorScope(createSystemWorkflowDraftStore({ profileAddress, storage }));
  assert.deepEqual(reopened.getReception(), final); reopened.release();
});
