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
  store.section('library').update(current => ({ ...current, sort: 'title-desc', query: 'moon', navigationMode: 'icons', assetSize: 240, hideLabels: true, libraryWidth: 520, relationshipView: 'created', collapsedSections: ['section:one'], view: { kind: 'category', id: 'category:one' }, collection: 'Studies', sidebarWidth: 220 }));
  store.ref('navigator').current = { left: 300, top: 500 };
  store.section('creationBar').update(false);
  store.ref('keeper').current = { 'keeper:one': { left: 510, top: 500 } };
  store.section('colourPickers').update(['Text']);
  store.tools.change({ type: 'place', tabs: ['Library'], frame: { left: 300, top: 120, width: 540, height: 600 } });
  store.tools.change({ type: 'open', tab: 'Library' });
  store.section('textOpen').update(true);
  const expected = store.getSnapshot(); store.dispose();
  const restored = make(disk);
  assert.deepEqual(restored.getSnapshot(), { ...expected, docks: { ...expected.docks, activeGroup: null, focusRequest: undefined } });
  assert.deepEqual(restored.getSnapshot().docks.hidden, ['Layers']);
  assert.equal(restored.tools.infoVisible(), true);
  assert.equal(restored.getSnapshot().library.navigationMode, 'icons');
  assert.equal(make(disk, 'bob').getSnapshot().library.navigationMode, 'names', 'navigation style belongs to its profile');
  assert.equal(make(disk, 'bob').getSnapshot().library.query, '', 'profiles cannot share preferences');
  assert.equal(make(disk, 'bob').getSnapshot().docks.groups.length, 2, 'floating Library belongs to its profile');
  restored.dispose();
});

test('the current separate Library preference is consumed and new saves have one layout owner', () => {
  const disk = storage(), initial = make(disk), defaults = initial.getSnapshot(); initial.dispose();
  const frame = { left: 300, top: 100, width: 500, height: 600 };
  const currentDocks = { ...defaults.docks, hidden: [], groups: defaults.docks.groups.map(group => ({ ...group,
    panes: group.panes.map(pane => ({ ...pane, tabs: pane.tabs.filter(tab => tab !== 'Library') })) })) };
  const value = { ...defaults, docks: currentDocks, libraryWindow: { detached: true, frame },
    library: { ...defaults.library, query: 'moon' },
    sideDock: { ...defaults.sideDock, items: [...defaults.sideDock.items, { id: 'Library', side: 'right', height: 600 }] } };
  const serialized = JSON.stringify({ version: 1, value });
  disk.setItem(editorPreferencesKey('alice'), serialized); disk.setItem('composition', 'untouched draft');
  const store = make(disk), result = store.getSnapshot();
  assert.equal(store.getError(), null);
  assert.ok(validToolDockLayout(result.docks));
  assert.deepEqual(result.docks.groups.slice(0, 2), currentDocks.groups);
  const library = result.docks.groups[2];
  assert.deepEqual(library.frame, frame);
  assert.equal(result.sideDock.items.at(-1).id, 'tools:' + library.id);
  assert.equal(result.library.query, 'moon');
  assert.equal('libraryWindow' in result, false);
  assert.equal(disk.getItem(editorPreferencesKey('alice')), serialized, 'reading never rewrites preferences');
  store.tools.change({ type: 'open', tab: 'Library', focus: true }); assert.equal(store.flush(), true);
  const persisted = JSON.parse(disk.getItem(editorPreferencesKey('alice'))).value;
  assert.equal('libraryWindow' in persisted, false);
  assert.equal('focusRequest' in persisted.docks, false, 'focus requests are transient');
  assert.equal(disk.getItem('composition'), 'untouched draft'); store.dispose();
  const restored = make(disk);
  assert.deepEqual(restored.getSnapshot().docks.groups[2].frame, frame);
  assert.equal(restored.tools.libraryVisible(), true); restored.dispose();
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
