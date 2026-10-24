import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorPreferencesStore, editorPreferencesKey } from './editorPreferencesStore.js';
import { validToolDockLayout, createToolDockLayout } from './workbenchToolDockState.js';
const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
const make = (disk, profile = 'alice', more = {}) => createEditorPreferencesStore({ storage: disk, profile, delay: 100000, ...more });

test('editor preferences round-trip all dock panes, hidden tabs and profile-level Library/window settings', () => {
  const disk = storage(), store = make(disk);
  assert.equal(disk.getItem(editorPreferencesKey('alice')), null, 'reading defaults never writes');
  store.tools.change({ type: 'place', tabs: ['Color'], target: 'tools', side: 'below' });
  store.tools.change({ type: 'place', tabs: ['Info'], frame: { left: 25, top: 140, width: 400, height: 450 } });
  store.tools.change({ type: 'close', tab: 'FX' });
  store.section('library').update(current => ({ ...current, sort: 'title-desc', query: 'moon', assetSize: 240, hideLabels: true, libraryWidth: 520, relationshipView: 'created', collapsedSections: ['section:one'], view: { kind: 'category', id: 'category:one' }, collection: 'Studies', sidebarWidth: 220 }));
  store.ref('navigator').current = { left: 300, top: 500 };
  store.ref('keeper').current = { 'keeper:one': { left: 510, top: 500 } };
  store.section('textFrame').update({ left: 80, top: 70, width: 420, height: 610 });
  store.section('textOpen').update(true); store.section('textSection').update('article');
  const expected = store.getSnapshot(); store.dispose();
  const restored = make(disk);
  assert.deepEqual(restored.getSnapshot(), { ...expected, docks: { ...expected.docks, activeGroup: null } });
  assert.deepEqual(restored.getSnapshot().docks.hidden, ['FX']);
  assert.equal(restored.tools.infoVisible(), true);
  assert.equal(make(disk, 'bob').getSnapshot().library.query, '', 'profiles cannot share preferences');
  restored.dispose();
});
test('invalid saved docks are retained and cannot overwrite until explicit retry', () => {
  const disk = storage(); disk.setItem(editorPreferencesKey('alice'), '{broken');
  const store = make(disk); store.update('sidebar', true);
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
  const store = make(disk); store.update('sidebar', true);
  assert.equal(store.flush(), false); assert.match(store.getError(), /could not be saved/);
  assert.equal(store.getSnapshot().sidebar, true);
  disk.setItem = set; assert.equal(store.retry(), true);
  assert.equal(disk.getItem('composition'), 'unchanged'); store.dispose();
});
test('revoked authority and external changes cannot be silently overwritten', () => {
  const disk = storage(); let writable = false;
  const store = make(disk, 'alice', { canSave: () => writable }); store.update('sidebar', true);
  assert.equal(store.flush(), false); assert.equal(disk.getItem(editorPreferencesKey('alice')), null);
  writable = true; assert.equal(store.retry(), true);
  disk.setItem(editorPreferencesKey('alice'), 'external'); store.update('sidebar', false);
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
