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
  assert.deepEqual(contextMenuCommands({ target: { type: 'launcher' }, editMode: false, launcher: { viewType: 'folder', visitorVisible: false } }).map((item) => item.id), ['open', 'edit-launcher']);
  assert.ok(contextMenuCommands({ target: { type: 'window' }, editMode: false }).some((item) => item.id === 'toggle-start-open'));
  assert.equal(contextMenuCommands({ target: { type: 'window' }, editMode: false, launcher: { id: 'library:folder:one' } }).find((item) => item.id === 'reset-window').label, 'Reset Near Folder');
  assert.equal(contextMenuCommands({ target: { type: 'window' }, editMode: false, launcher: { id: 'library:folder:one', viewType: 'folder' } }).some((item) => item.id === 'toggle-start-open'), false);
});

test('canvas creation and framed-artwork commands stay controlled and keyboard-menu compatible', () => {
  const create = contextMenuCommands({ target: { type: 'canvas', id: 'canvas' }, menu: 'create' });
  assert.deepEqual(create.map((command) => command.id), ['menu-root', 'create-folder', 'create-framed-artwork']);
  const object = contextMenuCommands({ target: { type: 'canvas-object', id: 'canvas:artwork:one' }, canvasObject: { visitorVisible: true } });
  assert.deepEqual(object.map((command) => command.id), ['open-artwork', 'edit-artwork', 'replace-artwork', 'toggle-object-visibility', 'menu-layer', 'remove-artwork']);
  const layer = contextMenuCommands({ target: { type: 'canvas-object', id: 'canvas:artwork:one' }, menu: 'layer' });
  assert.deepEqual(layer.map((command) => command.id), ['menu-root', 'object-forward', 'object-backward', 'object-front', 'object-back']);
});

test('stage-free spatial home omits stage controls and exposes camera reset', () => {
  const view = contextMenuCommands({ target: { type: 'canvas', id: 'canvas' }, menu: 'view', stageAvailable: false });
  assert.equal(view.some((command) => command.id === 'toggle-stage'), false);
  assert.equal(view.some((command) => command.id === 'reset-home-camera'), true);
});
