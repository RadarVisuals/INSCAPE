import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterfaceThemeStore, INTERFACE_THEME_KEY } from './interfaceTheme.js';
import { createEmptySystemWorkflowDraft, assertValidSystemWorkflowDraft } from './systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, assertValidWorkbenchCollection } from './systemWorkflow/domain/workbenchCollection.js';
import { createReception } from './profileDocument/domain/receptionPresentation.js';

test('one device appearance persists independently of profile and artwork records', () => {
  const records = new Map([['composition', 'authored content']]);
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const target = { dataset: {} }, store = createInterfaceThemeStore({ storage, target });
  let notifications = 0; const unsubscribe = store.subscribe(() => notifications++);
  assert.equal(target.dataset.interfaceTheme, 'dark');
  store.setMode('light');
  assert.equal(target.dataset.interfaceTheme, 'light');
  assert.equal(records.get(INTERFACE_THEME_KEY), 'light');
  assert.equal(records.get('composition'), 'authored content');
  assert.equal(createInterfaceThemeStore({ storage }).getSnapshot().mode, 'light');
  assert.throws(() => store.setMode('carbon'), /Dark or Light/);
  assert.equal(notifications, 1); unsubscribe(); store.dispose();
});

test('failed persistence stays explicit, retries, and storage events synchronize other windows', () => {
  let broken = true, saved = null;
  const storage = { getItem: () => saved, setItem: (_key, value) => { if (broken) throw Error('Full'); saved = value; } };
  const events = new EventTarget(), target = { dataset: {} }, store = createInterfaceThemeStore({ storage, target, events });
  store.setMode('light'); assert.match(store.getSnapshot().error, /could not be saved/);
  assert.equal(saved, null); assert.equal(target.dataset.interfaceTheme, 'light');
  broken = false; store.setMode('light'); assert.equal(store.getSnapshot().error, null); assert.equal(saved, 'light');
  const event = new Event('storage'); Object.assign(event, { key: INTERFACE_THEME_KEY, newValue: 'dark' }); events.dispatchEvent(event);
  assert.equal(target.dataset.interfaceTheme, 'dark'); store.dispose();
  Object.assign(event, { newValue: 'light' }); events.dispatchEvent(event); assert.equal(target.dataset.interfaceTheme, 'dark');
});

test('existing drafts discard retired interface choices without rewriting artwork or their input', () => {
  const draft = createEmptySystemWorkflowDraft(`0x${'1'.repeat(40)}`);
  draft.appearance.menuSurfaceId = 'paper'; draft.appearance.dossierSurfaceId = 'slate';
  draft.identityPresentation.dossierSurface = 'mist'; draft.reception = createReception(); draft.reception.branding.theme = 'carbon';
  const before = structuredClone(draft), clean = assertValidSystemWorkflowDraft(draft);
  assert.deepEqual(draft, before);
  assert.deepEqual(clean.grids, draft.grids); assert.equal(clean.appearance.surfaceId, draft.appearance.surfaceId);
  assert.equal(Object.hasOwn(clean.appearance, 'menuSurfaceId'), false);
  assert.equal(Object.hasOwn(clean.identityPresentation, 'dossierSurface'), false);
  assert.equal(Object.hasOwn(clean.reception.branding, 'theme'), false);
  const collection = createWorkbenchCollection(clean); collection.shared.menuSurfaceId = 'graphite';
  collection.shared.reception.branding.theme = 'mist';
  const result = assertValidWorkbenchCollection(collection);
  assert.equal(Object.hasOwn(result.shared, 'menuSurfaceId'), false);
  assert.equal(Object.hasOwn(result.shared.reception.branding, 'theme'), false);
  assert.deepEqual(result.workbenches, collection.workbenches);
});
