import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorPreferencesStore, editorPreferencesKey } from './editorPreferencesStore.js';
import { validToolDockLayout, createToolDockLayout } from './workbenchToolDockState.js';
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const make = (disk, profile = 'alice', more = {}) => createEditorPreferencesStore({ storage: disk, profile, delay: 100000, ...more });

test('editor preferences round-trip all dock panes, hidden tabs and profile-level Library/window settings', () => {
  const disk = storage(), store = make(disk);
  assert.equal(disk.getItem(editorPreferencesKey('alice')), null, 'reading defaults never writes');
  store.tools.change({ type: 'place', tabs: ['Inspector'], target: 'tools', side: 'below' });
  store.tools.change({ type: 'place', tabs: ['Inspector'], frame: { left: 25, top: 140, width: 400, height: 450 } });
  store.tools.change({ type: 'close', tab: 'Layers' });
  store.tools.change({ type: 'open', tab: 'Inspector', section: 'Info' });
  store.section('library').update(current => ({ ...current, sort: 'title-desc', query: 'moon', assetSize: 240, hideLabels: true, libraryWidth: 520, relationshipView: 'created', collapsedSections: ['section:one'], view: { kind: 'category', id: 'category:one' }, collection: 'Studies', sidebarWidth: 220 }));
  store.ref('navigator').current = { left: 300, top: 500 };
  store.section('creationBar').update(false);
  store.ref('keeper').current = { 'keeper:one': { left: 510, top: 500 } };
  store.section('colourPickers').update(['Text']);
  store.section('libraryWindow').update({ detached: true, frame: { left: 300, top: 120, width: 540, height: 600 } });
  store.section('textOpen').update(true);
  const expected = store.getSnapshot(); store.dispose();
  const restored = make(disk);
  assert.deepEqual(restored.getSnapshot(), { ...expected, docks: { ...expected.docks, activeGroup: null } });
  assert.deepEqual(restored.getSnapshot().docks.hidden, ['Layers']);
  assert.equal(restored.tools.infoVisible(), true);
  assert.equal(make(disk, 'bob').getSnapshot().library.query, '', 'profiles cannot share preferences');
  assert.equal(make(disk, 'bob').getSnapshot().libraryWindow, null, 'floating Library belongs to its profile');
  restored.dispose();
});

test('current seven-tab preferences consolidate while preserving other editor settings and retained side-dock hosts', () => {
  const disk = storage(), initial = make(disk), defaults = initial.getSnapshot();
  initial.dispose();
  const layerFrame = { left: 18, top: 88, width: 340, height: 500 };
  const selectionFrame = { left: 900, top: 90, width: 310, height: 650 };
  const saved = { version: 1, value: { ...defaults, creationBar: false,
    library: { ...defaults.library, query: 'moon', assetSize: 240 },
    navigator: { left: 600, top: 500 },
    sideDock: { width: 310, leftWidth: 340, items: [
      { id: 'tools:layers-host', side: 'left', height: 500 },
      { id: 'tools:selection-host', side: 'right', height: 650 },
      { id: 'Navigator', side: 'right', height: 200 },
    ] },
    docks: { nextId: 1, activeGroup: 'selection-host', hidden: ['FX'], groups: [
      { id: 'layers-host', frame: layerFrame, panes: [{ id: 'layers-pane', tabs: ['Layers'], active: 'Layers', share: 1 }] },
      { id: 'selection-host', frame: selectionFrame, panes: [{ id: 'selection-pane', tabs: ['Transform', 'Color', 'Image', 'Shape', 'FX', 'Info'], active: 'Image', share: 1 }] },
    ] },
  } };
  const serialized = JSON.stringify(saved); disk.setItem(editorPreferencesKey('alice'), serialized);
  disk.setItem('composition', 'untouched draft');
  const store = make(disk), restored = store.getSnapshot();
  assert.equal(store.getError(), null);
  assert.ok(validToolDockLayout(restored.docks));
  assert.deepEqual(restored.docks.groups.map(group => group.id), ['layers-host', 'selection-host']);
  assert.deepEqual(restored.docks.groups.map(group => group.frame), [layerFrame, selectionFrame]);
  assert.deepEqual(restored.sideDock, saved.value.sideDock);
  assert.deepEqual(restored.library, saved.value.library);
  assert.deepEqual(restored.navigator, saved.value.navigator);
  assert.equal(restored.creationBar, false);
  assert.equal(restored.docks.activeGroup, null);
  assert.equal(disk.getItem(editorPreferencesKey('alice')), serialized, 'reading does not rewrite the current saved record');
  store.tools.change({ type: 'open', tab: 'Inspector', section: 'Transform' });
  assert.equal(store.flush(), true);
  const persisted = JSON.parse(disk.getItem(editorPreferencesKey('alice'))).value;
  assert.deepEqual(persisted.library, saved.value.library);
  assert.deepEqual(persisted.sideDock, saved.value.sideDock);
  assert.equal(disk.getItem('composition'), 'untouched draft');
  store.dispose();
});
test('Library window rejects invalid frames and docking retains its last floating geometry', () => {
  const disk = storage(), store = make(disk), window = store.section('libraryWindow');
  const frame = { left: 300, top: 100, width: 500, height: 600 };
  window.update({ detached: true, frame });
  window.update({ detached: true, frame: { ...frame, width: Infinity } });
  assert.deepEqual(window.getSnapshot(), { detached: true, frame });
  window.update(current => ({ ...current, detached: false }));
  store.dispose();
  const restored = make(disk);
  assert.deepEqual(restored.section('libraryWindow').getSnapshot(), { detached: false, frame });
  restored.dispose();
});
test('invalid saved docks are retained and cannot overwrite until explicit retry', () => {
  const disk = storage(); disk.setItem(editorPreferencesKey('alice'), '{broken');
  const store = make(disk); store.update('creationBar', false);
  assert.equal(store.flush(), false); assert.equal(disk.getItem(editorPreferencesKey('alice')), '{broken');
  assert.match(store.getError(), /could not be read/);
  assert.equal(store.retry(), true); assert.equal(store.getError(), null); store.dispose();
  for (const change of [layout => { layout.groups[0].panes[0].tabs.push('Color'); },
    layout => { layout.groups[0].frame.width = Infinity; }, layout => { layout.groups[0].panes[0].active = 'missing'; },
    layout => { layout.groups[0].panes[0].share = 0; }]) {
    const layout = createToolDockLayout(); change(layout); assert.equal(validToolDockLayout(layout), false);
  }
});
test('failed writes retain current preferences and retry saves them without modifying unrelated data', () => {
  const disk = storage(), set = disk.setItem; disk.setItem('composition', 'unchanged');
  disk.setItem = () => { throw Error('Quota'); };
  const store = make(disk); store.update('creationBar', false);
  assert.equal(store.flush(), false); assert.match(store.getError(), /could not be saved/);
  assert.equal(store.getSnapshot().creationBar, false);
  disk.setItem = set; assert.equal(store.retry(), true);
  assert.equal(disk.getItem('composition'), 'unchanged'); store.dispose();
});
test('revoked authority and external changes cannot be silently overwritten', () => {
  const disk = storage(); let writable = false;
  const store = make(disk, 'alice', { canSave: () => writable }); store.update('creationBar', false);
  assert.equal(store.flush(), false); assert.equal(disk.getItem(editorPreferencesKey('alice')), null);
  writable = true; assert.equal(store.retry(), true);
  disk.setItem(editorPreferencesKey('alice'), 'external'); store.update('creationBar', true);
  assert.equal(store.flush(), false); assert.equal(disk.getItem(editorPreferencesKey('alice')), 'external');
  assert.match(store.getError(), /another window/); store.dispose();
});
test('disposing flushes pending changes and rejects stale callbacks from the departed profile', () => {
  const disk = storage(), store = make(disk), section = store.section('library');
  section.update(current => ({ ...current, query: 'last keystroke' })); store.dispose();
  const saved = disk.getItem(editorPreferencesKey('alice'));
  section.update(current => ({ ...current, query: 'late callback' }));
  assert.equal(disk.getItem(editorPreferencesKey('alice')), saved);
  assert.equal(make(disk).getSnapshot().library.query, 'last keystroke');
});
