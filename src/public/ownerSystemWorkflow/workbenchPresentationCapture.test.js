import assert from 'node:assert/strict';
import test from 'node:test';
import { captureWorkbenchPresentation } from './workbenchPresentationCapture.js';
import { createDefaultWorkbenchPresentation, createTextPresentation, assertWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createWorkbenchSession } from '../../systemWorkflow/workbenchSession.js';
import { createImagePresentation } from '../../imageModule/imageModule.js';
import { createShapePresentation } from '../../shapes/shapes.js';
import { loadWorkbenchLayout, saveWorkbenchLayout } from './workbenchLayoutStorage.js';
import { workbenchLayoutKey } from '../../systemWorkflow/workbenchLayoutKey.js';
import { buildProfileDocumentV9 } from '../../profileDocument/domain/profileDocumentV9Builder.js';

const input = overrides => ({ layout: createDefaultWorkbenchPresentation(), identityOpen: false, ...overrides });
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

test('capture is read-only; only explicit saving persists the layout through the existing store', () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const store = createSystemWorkflowDraftStore({ profileAddress: '0x1111111111111111111111111111111111111111', storage });
  const before = store.getDraft();
  const source = freeze(input({ identityOpen: true }));
  const result = captureWorkbenchPresentation(source);
  assert.equal(result.error, null);
  assertWorkbenchPresentation(result.value);
  assert.equal(result.value.identity.open, true);
  assert.equal(Object.hasOwn(result.value, 'displays'), false);
  assert.equal(entries.size, 0);
  assert.deepEqual(store.getDraft(), before);
  assert.equal(createWorkbenchSession({ store }).saveWorkbench(result.value), true);
  assert.deepEqual(store.getDraft(), { ...before, workbench: result.value });
});

test('a newly dropped Image retains its saved position before its lazy renderer reports a window', () => {
  const saved = { id: 'image:dropped', open: true, position: { left: 987.25, top: 421.5 } };
  const source = input({ imageModules: [{ id: saved.id }], savedImagePresentations: [saved] });
  assert.deepEqual(captureWorkbenchPresentation(source).value.imageModules, [saved]);
  const live = { ...saved, position: { left: 123, top: 456 } };
  assert.deepEqual(captureWorkbenchPresentation({ ...source, imagePresentations: { [saved.id]: live } }).value.imageModules, [live]);
  assert.deepEqual(captureWorkbenchPresentation({ ...source, imageModules: [] }).value.imageModules, []);
});

test('Text, Image and Shape capture keeps live, cached, authored and default geometry priorities', () => {
  for (const [collection, liveField, authoredField, factory, prefix] of [
    ['texts', 'textPresentations', null, createTextPresentation, 'text'],
    ['imageModules', 'imagePresentations', 'savedImagePresentations', createImagePresentation, 'image'],
    ['shapes', 'shapePresentations', 'savedShapePresentations', createShapePresentation, 'shape'],
  ]) {
    const positioned = (suffix, left) => {
      const value = factory(`${prefix}:${suffix}`);
      if (value.window) value.window.left = left; else value.position.left = left;
      return value;
    };
    const live = positioned('live', 111), cached = positioned('cached', 222), authored = positioned('authored', 333);
    const order = ['live', 'cached', ...(authoredField ? ['authored'] : []), 'default'];
    const source = freeze(input({ layout: { ...createDefaultWorkbenchPresentation(),
      [collection]: [positioned('live', 444), cached] },
      [collection]: order.map(suffix => ({ id: `${prefix}:${suffix}` })), [liveField]: { [live.id]: live },
      ...(authoredField ? { [authoredField]: [positioned('live', 555), positioned('cached', 666), authored] } : {}),
    }));
    const result = captureWorkbenchPresentation(source);
    assert.equal(result.error, null);
    assert.deepEqual(result.value[collection], [live, cached, ...(authoredField ? [authored] : []), factory(`${prefix}:default`, order.length - 1)]);
    assertWorkbenchPresentation(result.value);
    const removed = captureWorkbenchPresentation({ ...source, [collection]: [] });
    assert.deepEqual(removed.value[collection], [], 'live reports and both saved sources cannot resurrect removed modules');
    const { [collection]: omitted, ...withoutModules } = source;
    assert.equal(Object.hasOwn(captureWorkbenchPresentation(withoutModules).value, collection), false);
  }
});

test('explicit publication capture accepts geometry only after save and invalidates the previous local cache', () => {
  const profile = '0x1111111111111111111111111111111111111111', entries = new Map();
  let blocked = false;
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => {
    if (blocked && key === systemWorkflowDraftKey(profile)) throw Error('QuotaExceededError');
    entries.set(key, value);
  } };
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  const session = createWorkbenchSession({ store: store.getWorkbenchScope() });
  assert.equal(session.saveWorkbench(createDefaultWorkbenchPresentation()), true);
  const cached = createDefaultWorkbenchPresentation(); cached.identity.window.left = 211;
  assert.equal(saveWorkbenchLayout(profile, store.getDraft(), cached, {}, storage), true);
  const captured = captureWorkbenchPresentation(input({ layout: cached, identityOpen: true })).value;
  const before = store.getSnapshot(), history = store.getHistory(), generation = store.getGeneration();
  const raw = storage.getItem(systemWorkflowDraftKey(profile)), cache = storage.getItem(workbenchLayoutKey(profile));
  assert.equal(before.workbench.identity.window.left, 28, 'preview capture alone does not accept authored geometry');
  blocked = true;
  assert.throws(() => session.saveWorkbench(captured), /could not be saved/);
  assert.equal(store.getSnapshot(), before); assert.equal(store.getGeneration(), generation);
  assert.deepEqual(store.getHistory(), history);
  assert.equal(storage.getItem(systemWorkflowDraftKey(profile)), raw);
  assert.equal(storage.getItem(workbenchLayoutKey(profile)), cache);
  assert.equal(loadWorkbenchLayout(profile, store.getDraft(), storage).layout.identity.window.left, 211);
  blocked = false;
  assert.equal(session.saveWorkbench(captured), true);
  assert.deepEqual(store.getHistory(), history, 'Prepare layout saving adds no independent Undo step');
  assert.deepEqual(loadWorkbenchLayout(profile, store.getDraft(), storage), { layout: null, views: {} });
  const reopened = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  assert.equal(reopened.getDraft().workbench.identity.window.left, 211);
  const published = buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: reopened.getDraft(), assetRecords: [] });
  assert.equal(published.workbench.identity.window.left, 211);
});
