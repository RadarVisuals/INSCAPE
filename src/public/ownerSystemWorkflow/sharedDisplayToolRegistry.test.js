import test from 'node:test';
import assert from 'node:assert/strict';
import { getRegisteredDisplayTool, registerDisplayTool, unregisterDisplayTool } from './sharedDisplayToolRegistry.js';

test('availability follows explicit module targets without depending on open windows', () => {
  const first = Symbol(), second = Symbol();
  let registry = registerDisplayTool(new Map(), { id: 'layers', targetId: 'display:first', label: 'First / Home', available: true }, first);
  registry = registerDisplayTool(registry, { id: 'layers', targetId: 'display:second', label: 'Second / Home', available: true }, second);
  registry = registerDisplayTool(registry, { id: 'metadata', targetId: 'display:first', label: 'First / Home', available: false }, Symbol());

  assert.equal(getRegisteredDisplayTool(registry, 'layers', 'display:first').label, 'First / Home');
  assert.equal(getRegisteredDisplayTool(registry, 'layers', 'display:second').label, 'Second / Home');
  assert.equal(getRegisteredDisplayTool(registry, 'metadata', 'display:first').available, false);
  assert.equal(getRegisteredDisplayTool(registry, 'layers', null), null);
  assert.equal(getRegisteredDisplayTool(registry, 'layers', 'missing'), null);
  assert.equal(getRegisteredDisplayTool(registry, 'metadata', 'display:second'), null, 'never falls back to another Display');
});

test('selection, locking and target closure can replace availability without changing other tools', () => {
  const layers = { id: 'layers', targetId: 'display:first', label: 'First / Home', available: true };
  const metadata = { id: 'metadata', targetId: 'display:first', label: 'First / Home / Artwork', available: true };
  let registry = registerDisplayTool(new Map(), layers, Symbol());
  registry = registerDisplayTool(registry, metadata, Symbol());
  const selected = registry;
  registry = registerDisplayTool(registry, { ...metadata, available: false }, Symbol());
  assert.equal(getRegisteredDisplayTool(registry, 'metadata', layers.targetId).available, false, 'deselecting can hide info');
  assert.equal(getRegisteredDisplayTool(registry, 'layers', layers.targetId).available, true, 'valid empty Grid still has Layers');
  assert.equal(getRegisteredDisplayTool(selected, 'metadata', layers.targetId).available, true, 'updates do not mutate a prior snapshot');
  registry = registerDisplayTool(registry, { id: 'appearance', targetId: layers.targetId, label: 'First', available: false }, Symbol());
  assert.equal(getRegisteredDisplayTool(registry, 'appearance', layers.targetId).available, false, 'locked target can withhold appearance');
  registry = registerDisplayTool(registry, { ...layers, available: false }, Symbol());
  assert.equal(getRegisteredDisplayTool(registry, 'layers', layers.targetId).available, false, 'minimized target can withhold Layers');
});

test('stale effect cleanup cannot remove a replacement registration or another target', () => {
  const old = Symbol(), current = Symbol(), other = Symbol();
  const tool = { id: 'metadata', targetId: 'display:first', label: 'First artwork', available: true };
  let registry = registerDisplayTool(new Map(), tool, old);
  registry = registerDisplayTool(registry, { ...tool, label: 'Second artwork' }, current);
  registry = registerDisplayTool(registry, { ...tool, targetId: 'display:second' }, other);
  assert.equal(unregisterDisplayTool(registry, tool.id, tool.targetId, old), registry);
  assert.equal(getRegisteredDisplayTool(registry, tool.id, tool.targetId).label, 'Second artwork');
  registry = unregisterDisplayTool(registry, tool.id, tool.targetId, current);
  assert.equal(getRegisteredDisplayTool(registry, tool.id, tool.targetId), null);
  assert.equal(getRegisteredDisplayTool(registry, tool.id, 'display:second').available, true);
  registry = unregisterDisplayTool(registry, tool.id, 'display:second', other);
  assert.equal(registry.size, 0, 'unmounted modules leave no registrations');
});
