import { createCompositionEditorScope } from '../composition/compositionEditorScope.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { createEmptySystemWorkflowDraft, validateSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { createCompositionEditorDocument, projectCompositionEditorDocument, validCompositionEditorDocument } from '../composition/compositionEditorDocument.js';
import { addShape } from '../shapes/shapeSession.js';
import { addImageModule } from '../imageModule/imageModuleSession.js';
import { addTextModule, changeTextFrames, saveTextModuleResult } from '../text/textSession.js';
import { addKeeperDock } from '../keeper/keeperSession.js';
import { openWorkbenchIndex } from './workbenchIndexSession.js';
import { editWorkbenchGroups } from './workbenchGroupSession.js';

const profile = '0x' + 'a'.repeat(40);
function fixture() {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const root = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const store = createCompositionEditorScope(root);
  assert.equal(store.getSnapshot(), root.getSnapshot());
  const save = (change, label) => {
    const draft = store.getDraft();
    change(draft);
    assert.equal(store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration(), historyLabel: label }), true,
      store.getLastCommitFailure());
  };
  const rectangle = left => addShape(store, profile, { position: { left, top: 120 }, size: { width: 320, height: 240 } });
  return { root, store, storage, save, rectangle };
}

test('ordinary module writes and cell membership share a draft, history and reload', () => {
  const { store, storage, save, rectangle } = fixture();
  const cellId = rectangle(100), artwork = rectangle(150);
  const before = store.getSnapshot();
  save(draft => { draft.cells.push({ id: cellId, members: [artwork], mobile: { columns: 2, height: 240 } }); }, 'Add first cell');
  const withCell = store.getSnapshot();
  assert.equal(Object.hasOwn(withCell, 'composition'), false);
  assert.deepEqual(withCell.shapes, before.shapes);
  assert.deepEqual(withCell.workbench, before.workbench);
  assert.ok(store.undo()); assert.deepEqual(store.getSnapshot(), before);
  assert.ok(store.redo()); assert.deepEqual(store.getSnapshot(), withCell);
  const text = addTextModule(store, profile);
  assert.ok(store.getSnapshot().texts.some(item => item.id === text));
  const image = addImageModule(store, profile);
  assert.ok(store.getSnapshot().workbench.imageModules.some(item => item.id === image));
  assert.deepEqual(store.getSnapshot().cells, withCell.cells);
  const after = store.getSnapshot();
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getSnapshot(), after);
  save(draft => { draft.cells = []; }, 'Remove cell membership');
  assert.deepEqual(store.getSnapshot().texts, after.texts);
  assert.deepEqual(store.getSnapshot().workbench, after.workbench);
  assert.ok(store.undo()); assert.deepEqual(store.getSnapshot(), after);
});

for (const cellFirst of [false, true]) test(`cells coexist with existing module capabilities, cell first: ${cellFirst}`, () => {
  const { store, storage, save, rectangle } = fixture();
  const cellId = rectangle(100), artwork = rectangle(180);
  const addCell = () => save(draft => {
    draft.cells.push({ id: cellId, members: [artwork], mobile: { columns: 2, height: 240 } });
  }, 'Add first cell');
  if (cellFirst) addCell();
  const text = addTextModule(store, profile);
  const record = store.getSnapshot().texts.find(item => item.id === text);
  const presentation = store.getSnapshot().workbench.texts.find(item => item.id === text);
  const frames = [{ id: 'text-frame:continued', window: { left: 600, top: 120, width: 400, height: 300 } }];
  changeTextFrames(store, profile, record, presentation, frames);
  const paginated = addTextModule(store, profile), pages = store.getSnapshot().texts.find(item => item.id === paginated);
  assert.equal(saveTextModuleResult(store, profile, pages, { ...pages, pagination: 'pages' }).saved, true);
  const keeper = addKeeperDock(store, profile);
  openWorkbenchIndex(store, profile);
  editWorkbenchGroups(store, profile, { type: 'create', name: 'Existing group', memberIds: [text, artwork] });
  if (!cellFirst) addCell();
  const draft = store.getSnapshot();
  assert.deepEqual(draft.workbench.texts.find(item => item.id === text).frames, frames);
  assert.equal(draft.texts.find(item => item.id === paginated).pagination, 'pages');
  assert.equal(draft.keeperDocks[0].id, keeper);
  assert.ok(draft.workbenchIndex.open);
  assert.deepEqual(draft.workbenchGroups[0].memberIds, [text, artwork]);
  assert.equal(validateSystemWorkflowDraft(draft).valid, true);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getSnapshot(), draft);
});

test('the shared model rejects invalid membership, geometry and competing artwork envelopes', () => {
  const { store, save, rectangle } = fixture();
  const cellId = rectangle(100), artwork = rectangle(180);
  save(draft => { draft.cells.push({ id: cellId, members: [artwork], mobile: { columns: 2, height: 240 } }); }, 'Add cell');
  const before = store.getSnapshot(), history = store.getHistory();
  for (const change of [
    draft => { draft.cells[0].members.push('shape:missing'); },
    draft => { draft.cells[0].members.push(artwork); },
    draft => { draft.cells[0].members.push(cellId); },
    draft => { draft.workbench.shapes[0].window.width = -1; },
    draft => { draft.workbench.shapes.pop(); },
    draft => { draft.cells = {}; },
    draft => { draft.composition = createCompositionEditorDocument(); },
    draft => { draft.unrecognizedDocumentField = true; },
  ]) {
    const candidate = structuredClone(before); change(candidate);
    assert.equal(validateSystemWorkflowDraft(candidate).valid, false);
    assert.equal(store.commitCompletedOperation(candidate, { expectedGeneration: store.getGeneration() }), false);
    assert.deepEqual(store.getSnapshot(), before);
    assert.deepEqual(store.getHistory(), history);
  }
});

test('composition projection selects artwork fields and excludes authoring/profile data', () => {
  const { store, save, rectangle } = fixture();
  const cellId = rectangle(100), artwork = rectangle(180);
  save(draft => { draft.cells.push({ id: cellId, members: [artwork], mobile: { columns: 2, height: 240 } }); }, 'Add cell');
  const keeper = addKeeperDock(store, profile);
  save(draft => {
    draft.identityPresentation.alias = 'Private editing alias';
    draft.workbench.keeperDocks = [{ id: keeper, position: { left: 20, top: 40 } }];
  }, 'Edit profile preferences');
  const projected = projectCompositionEditorDocument(store.getSnapshot());
  assert.equal(validCompositionEditorDocument(projected, true), true);
  for (const key of ['profileAddress', 'draftVersion', 'identityPresentation', 'keeperDocks', 'appearance', 'artboard', 'geometry'])
    assert.equal(Object.hasOwn(projected, key), false, key);
  assert.equal(Object.hasOwn(projected.workbench, 'keeperDocks'), false);
  assert.deepEqual(projected.cells, store.getSnapshot().cells);
  assert.deepEqual(projected.shapes.map(shape => shape.id), [cellId, artwork]);
});
