import assert from 'node:assert/strict';
import test from 'node:test';
import { clampMenuPosition, contextMenuCommands } from './contextMenuModel.js';
test('menu position is clamped on every viewport edge', () => {
  assert.deepEqual(clampMenuPosition({ x: 990, y: 790 }, { width: 220, height: 260 }, { width: 1000, height: 800 }), { x: 772, y: 532 });
  assert.deepEqual(clampMenuPosition({ x: -20, y: -4 }, { width: 220, height: 260 }, { width: 1000, height: 800 }), { x: 8, y: 8 });
});
test('launcher editing and visitor-start commands are directly available', () => {
  assert.deepEqual(contextMenuCommands({ target: { type: 'launcher' }, editMode: false }).map((item) => item.id), ['open', 'edit-launcher']);
  assert.ok(contextMenuCommands({ target: { type: 'launcher' }, editMode: false, launcher: { visitorVisible: false } }).some((item) => item.id === 'toggle-visibility'));
  assert.ok(contextMenuCommands({ target: { type: 'window' }, editMode: false }).some((item) => item.id === 'toggle-start-open'));
});
