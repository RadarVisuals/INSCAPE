import test from 'node:test';
import assert from 'node:assert/strict';
import { createSideDockStore, sideDockEdge, sideDockFrames, validSideDock } from './workbenchSideDockState.js';
import { createEditorPreferencesStore } from './editorPreferencesStore.js';
test('docked windows resize together, divide height, restore cancellation and retain hidden slots', () => {
  const dock = createSideDockStore();
  dock.viewport({ width: 1440, height: 900, top: 36, left: 0 });
  const remove = dock.register('Navigator', 160); dock.register('Keeper', 160); dock.register('tools', 280);
  for (const id of ['Navigator', 'Keeper', 'tools']) dock.attach(id, { height: 200 });
  const frames = () => { const s = dock.getSnapshot(); return sideDockFrames(s.layout, s.windows, s.viewport); };
  const initial = frames();
  assert.equal(initial.tools.top + initial.tools.height, 900);
  dock.resize('Navigator', { ...initial.Navigator, width: 420, height: initial.Navigator.height + 50 });
  assert.equal(frames().Keeper.width, 420);
  assert.equal(frames().Navigator.height, initial.Navigator.height + 50);
  assert.equal(frames().tools.top, initial.tools.top);
  const saved = dock.getSnapshot().layout;
  dock.detach('Navigator'); assert.equal(frames().Navigator, undefined);
  dock.restore(saved); assert.equal(frames().Navigator.width, 420);
  remove(); assert.equal(frames().Navigator, undefined);
  dock.register('Navigator', 160); assert.equal(frames().Navigator.width, 420);
  dock.viewport({ width: 320, height: 400, top: 36, left: 0 });
  assert.equal(frames().Navigator.width, 320); assert.equal(frames().tools.top + frames().tools.height, 400);
});
test('right dock and utility dimensions persist privately and reject malformed layouts', () => {
  const data = new Map(), storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const prefs = createEditorPreferencesStore({ profile: 'alice', storage, delay: 100000 });
  const dock = createSideDockStore(prefs.section('sideDock'));
  dock.register('Navigator', 160); dock.attach('Navigator', { height: 200 });
  dock.register('Library', 300); dock.attach('Library', { height: 600 }, Infinity, 'left');
  prefs.ref('navigator').current = { left: 0, top: 20, width: 240, height: 220 };
  prefs.ref('navigator').current = { left: 0, top: 20, width: NaN, height: 220 };
  assert.equal(prefs.getSnapshot().navigator.width, 240, 'invalid utility sizes cannot replace a usable frame');
  prefs.dispose();
  const restored = createEditorPreferencesStore({ profile: 'alice', storage });
  assert.deepEqual(restored.getSnapshot().sideDock, dock.getSnapshot().layout);
  assert.equal(restored.getSnapshot().navigator.width, 240); restored.dispose();
  const other = createEditorPreferencesStore({ profile: 'bob', storage });
  assert.deepEqual(other.getSnapshot().sideDock.items, []); other.dispose();
  assert.equal(validSideDock({ width: 320, items: [{ id: 'a', height: 10 }, { id: 'a', height: 20 }] }), false);
  assert.equal(validSideDock({ width: Infinity, items: [] }), false);
  assert.equal(validSideDock({ width: 320, items: [null] }), false);
  assert.equal(validSideDock({ width: 320, leftWidth: Infinity, items: [] }), false);
  assert.equal(validSideDock({ width: 320, items: [{ id: 'a', height: 10, side: 'bottom' }] }), false);
});

test('both docks stack and resize independently, move between edges and fit a narrow viewport', () => {
  const dock = createSideDockStore();
  dock.viewport({ width: 1440, height: 900, top: 40 });
  for (const id of ['Library', 'Layers', 'Navigator', 'Keeper']) dock.register(id, 160);
  dock.attach('Library', { height: 400 }, Infinity, 'left');
  dock.attach('Layers', { height: 200 }, Infinity, 'left');
  dock.attach('Navigator', { height: 200 }); dock.attach('Keeper', { height: 200 });
  const frames = () => { const s = dock.getSnapshot(); return sideDockFrames(s.layout, s.windows, s.viewport); };
  const before = frames();
  assert.equal(before.Library.left, 0); assert.equal(before.Navigator.left + before.Navigator.width, 1440);
  dock.resize('Library', { ...before.Library, width: 410, height: before.Library.height + 50 });
  assert.deepEqual(frames().Navigator, before.Navigator); assert.deepEqual(frames().Keeper, before.Keeper);
  assert.equal(frames().Layers.width, 410); assert.ok(Math.abs(frames().Layers.top - before.Layers.top - 50) < 1e-6);
  const saved = dock.getSnapshot().layout;
  dock.attach('Library', before.Library, 40, 'right');
  assert.equal(frames().Library.top, 40); assert.equal(frames().Library.left, before.Navigator.left);
  assert.equal(dock.getSnapshot().layout.items.filter(item => item.id === 'Library').length, 1);
  dock.restore(saved); assert.equal(frames().Library.left, 0);
  for (const width of [700, 320]) {
    dock.viewport({ width, height: 400, top: 40 });
    const f = frames();
    assert.ok(f.Library.width < f.Navigator.left);
    assert.ok(Math.abs(f.Layers.top + f.Layers.height - 400) < 1e-6);
    assert.ok(Math.abs(f.Keeper.top + f.Keeper.height - 400) < 1e-6);
  }
  dock.viewport({ width: 1440, height: 900, top: 40 });
  assert.equal(frames().Library.width, 410, 'temporary viewport constraints preserve the chosen width');
});

test('edge drops share the measured workspace boundary', () => {
  const viewport = { width: 1440, height: 900, top: 40 };
  assert.equal(sideDockEdge({ clientX: 4, clientY: 40 }, viewport), 'left');
  assert.equal(sideDockEdge({ clientX: 1438, clientY: 70 }, viewport), 'right');
  for (const [clientX, clientY] of [[4, 20], [1438, 20], [500, 200], [-2, 100], [1441, 100], [4, 901]])
    assert.equal(sideDockEdge({ clientX, clientY }, viewport), null);
});
