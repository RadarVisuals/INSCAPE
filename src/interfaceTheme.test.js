import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterfaceThemeStore, INTERFACE_THEME_KEY, INTERFACE_PALETTE_KEY, interfacePalettes } from './interfaceTheme.js';
import { createEmptySystemWorkflowDraft, assertValidSystemWorkflowDraft } from './systemWorkflow/domain/systemWorkflowDraft.js';
import { createWorkbenchCollection, assertValidWorkbenchCollection } from './systemWorkflow/domain/workbenchCollection.js';

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
  draft.identityPresentation.dossierSurface = 'mist';
  const before = structuredClone(draft), clean = assertValidSystemWorkflowDraft(draft);
  assert.deepEqual(draft, before);
  assert.deepEqual(clean.grids, draft.grids); assert.equal(clean.appearance.surfaceId, draft.appearance.surfaceId);
  assert.equal(Object.hasOwn(clean.appearance, 'menuSurfaceId'), false);
  assert.equal(Object.hasOwn(clean.identityPresentation, 'dossierSurface'), false);
  const collection = createWorkbenchCollection(clean); collection.shared.menuSurfaceId = 'graphite';
  const result = assertValidWorkbenchCollection(collection);
  assert.equal(Object.hasOwn(result.shared, 'menuSurfaceId'), false);
  assert.deepEqual(result.workbenches, collection.workbenches);
});

test('only curated palettes persist, independently of mode, artwork and legacy editor colors', () => {
  const legacy = '{"dark":{"panel":"#ff0044"}}';
  const records = new Map([['inscape:editor-colors', legacy], ['composition', 'original']]);
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const target = { dataset: {} }, store = createInterfaceThemeStore({ storage, target });
  assert.equal(target.dataset.palette, 'charcoal');
  for (const id of Object.keys(interfacePalettes)) {
    store.setPalette(id);
    assert.equal(records.get(INTERFACE_PALETTE_KEY), id);
    store.setMode('light');
    assert.equal(target.dataset.palette, id);
    store.setMode('dark');
    assert.equal(target.dataset.palette, id);
    assert.equal(createInterfaceThemeStore({ storage }).getSnapshot().palette, id);
  }
  for (const value of ['custom', '#12ab34', '__proto__']) assert.throws(() => store.setPalette(value), /Inscape palette/);
  assert.equal(records.get('composition'), 'original');
  assert.equal(records.get('inscape:editor-colors'), legacy);
  records.set(INTERFACE_PALETTE_KEY, '#badbad');
  assert.equal(createInterfaceThemeStore({ storage }).getSnapshot().palette, 'charcoal');
  store.dispose();
});

test('palette writes are retryable and valid cross-window changes and clears update the view', () => {
  let broken = true;
  const storage = { getItem: () => null, setItem: key => { if (key === INTERFACE_PALETTE_KEY && broken) throw Error('Full'); } };
  const target = { dataset: {} }, events = new EventTarget(), store = createInterfaceThemeStore({ storage, target, events });
  store.setPalette('oxblood');
  assert.match(store.getSnapshot().error, /could not be saved/);
  store.setMode('light'); assert.match(store.getSnapshot().error, /could not be saved/);
  assert.equal(target.dataset.palette, 'oxblood');
  broken = false; store.setPalette('oxblood'); assert.equal(store.getSnapshot().error, null);
  const event = new Event('storage');
  Object.assign(event, { key: INTERFACE_PALETTE_KEY, newValue: 'storm-glass' });
  events.dispatchEvent(event); assert.equal(target.dataset.palette, 'storm-glass');
  assert.equal(target.dataset.interfaceTheme, 'light');
  Object.assign(event, { newValue: '#ab0010' }); events.dispatchEvent(event);
  assert.equal(target.dataset.palette, 'charcoal');
  Object.assign(event, { key: null, newValue: null }); events.dispatchEvent(event);
  assert.deepEqual(target.dataset, { interfaceTheme: 'dark', palette: 'charcoal' });
  store.dispose();
});
