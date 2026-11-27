import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { createBlankWorkbenchDraft } from './domain/systemWorkflowDraft.js';
import { createStudioComposition, currentStudioDraft } from './domain/studioComposition.js';
import { createWorkbenchCollection, appendWorkbench, projectWorkbenchDraft } from './domain/workbenchCollection.js';
import { saveWorkbenchLayout } from '../public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import { addShape } from '../shapes/shapeSession.js';
import { addTextModule } from '../text/textSession.js';
import { createCompositionEditorScope } from '../composition/compositionEditorScope.js';

const profile = '0x' + 'c'.repeat(40);
function fixture(value) {
  const key = systemWorkflowDraftKey(profile), data = new Map(value ? [[key, JSON.stringify(value)]] : []);
  let broken = false;
  const storage = { getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { if (broken) throw Error('Full'); data.set(key, value); }, removeItem: key => data.delete(key) };
  return { key, data, storage, fail: value => { broken = value; }, open: () => createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
}
function freeDraft() {
  const state = fixture(), root = state.open();
  addShape(root, profile, { position: { left: -30, top: 80 }, size: { width: 200, height: 160 } });
  const draft = root.getDraft();
  delete draft.cells;
  return draft;
}

test('current saved nested and free artwork become one document without a write on open', () => {
  const free = freeDraft(), nested = createStudioComposition('bento');
  const input = { ...free, composition: nested }, state = fixture(input), raw = state.data.get(state.key);
  const root = state.open(), scope = createCompositionEditorScope(root), accepted = root.getSnapshot();
  assert.equal(scope.getSnapshot(), accepted);
  assert.equal(Object.hasOwn(accepted, 'composition'), false);
  assert.deepEqual(accepted.shapes, [...free.shapes, ...nested.shapes]);
  assert.deepEqual(accepted.workbench.shapes, [...free.workbench.shapes, ...nested.workbench.shapes]);
  assert.deepEqual(accepted.cells, nested.cells);
  assert.equal(state.data.get(state.key), raw);
  state.fail(true);
  assert.throws(() => addTextModule(scope, profile), /could not be saved/);
  assert.equal(state.data.get(state.key), raw);
  assert.equal(root.getSnapshot(), accepted);
  state.fail(false);
  addTextModule(scope, profile);
  assert.ok(scope.undo()); assert.deepEqual(root.getSnapshot(), accepted);
  assert.equal(Object.hasOwn(JSON.parse(state.data.get(state.key)), 'composition'), false);
  assert.deepEqual(state.open().getSnapshot(), accepted);
  scope.release();
});

test('matching cached geometry is captured for every current free document and saved on the next operation', () => {
  const first = freeDraft(), second = freeDraft();
  const collection = appendWorkbench(createWorkbenchCollection(first), 'workbench:second', 'Second', second);
  for (const item of collection.workbenches) delete item.content.cells;
  const state = fixture(collection);
  const live = structuredClone(first.workbench);
  live.shapes[0].window.left = 570;
  assert.ok(saveWorkbenchLayout(profile, first, live, {}, state.storage, 'workbench:main'));
  const raw = state.data.get(state.key), root = state.open();
  assert.deepEqual(root.readWorkbench('workbench:main').draft.workbench.shapes, live.shapes);
  assert.deepEqual(root.readWorkbench('workbench:second').draft.workbench.shapes, second.workbench.shapes);
  assert.equal(state.data.get(state.key), raw);
  assert.ok(root.renameWorkbench('Reopened'));
  const saved = JSON.parse(state.data.get(state.key));
  assert.deepEqual(projectWorkbenchDraft(saved, 'workbench:main').workbench.shapes, live.shapes);
  assert.deepEqual(state.open().getBackupSnapshot(), root.getBackupSnapshot());
});

test('conflicting current artwork IDs fail closed and retain the complete original bytes', () => {
  const free = freeDraft(), composition = createStudioComposition('canvas');
  composition.shapes = [{ ...free.shapes[0], name: 'Different artwork with the same ID' }];
  composition.workbench.shapes = free.workbench.shapes;
  composition.artworkLayers = [free.shapes[0].id];
  const state = fixture({ ...free, composition }), raw = state.data.get(state.key), root = state.open();
  assert.equal(root.getRecordState().status, 'corrupt');
  assert.throws(root.getSnapshot);
  assert.equal(root.getRecordState().issues[0].code, 'STUDIO_DOCUMENT_CONFLICT');
  assert.equal(root.commitCompletedOperation(currentStudioDraft(free), { expectedGeneration: root.getGeneration() }), false);
  assert.equal(state.data.get(state.key), raw);
});

test('adoption is idempotent and keeps current window ordering and omitted optional geometry', () => {
  const current = currentStudioDraft(createBlankWorkbenchDraft(profile));
  delete current.workbench.area;
  delete current.workbench.shapes;
  assert.deepEqual(currentStudioDraft(current), current);
});

test('cell member locks apply at the shared storage boundary as well as the editor', () => {
  const state = fixture(), root = state.open(), scope = createCompositionEditorScope(root);
  const cell = addShape(scope, profile), child = addShape(scope, profile);
  scope.turnShapeIntoCell(cell);
  const draft = scope.getDraft(); draft.cells[0].members = [child]; draft.cells[0].lockedMembers = [child];
  assert.ok(scope.commitCompletedOperation(draft, { expectedGeneration: scope.getGeneration() }));
  const before = root.getSnapshot(), candidate = root.getDraft();
  candidate.shapes.find(item => item.id === child).name = 'Forbidden edit';
  assert.equal(root.commitCompletedOperation(candidate, { expectedGeneration: root.getGeneration() }), false);
  assert.equal(root.getLastCommitFailure(), 'locked');
  assert.equal(root.getSnapshot(), before);
  scope.release();
});
