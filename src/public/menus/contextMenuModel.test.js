import assert from 'node:assert/strict';
import test from 'node:test';
import { clampMenuPosition, contextMenuCommands } from './contextMenuModel.js';
test('menu position is clamped on every viewport edge', () => {
  assert.deepEqual(clampMenuPosition({ x: 990, y: 790 }, { width: 220, height: 260 }, { width: 1000, height: 800 }), { x: 772, y: 532 });
  assert.deepEqual(clampMenuPosition({ x: -20, y: -4 }, { width: 220, height: 260 }, { width: 1000, height: 800 }), { x: 8, y: 8 });
});
test('launcher editing and visitor-start commands are directly available', () => {
  assert.deepEqual(contextMenuCommands({ target: { type: 'launcher' }, editMode: false, ownerAuthoringEnabled: true }).map((item) => item.id), ['open', 'edit-launcher']);
  assert.ok(contextMenuCommands({ target: { type: 'launcher' }, editMode: false, launcher: { visitorVisible: false }, ownerAuthoringEnabled: true }).some((item) => item.id === 'toggle-visibility'));
  assert.deepEqual(contextMenuCommands({ target: { type: 'launcher' }, editMode: false, launcher: { viewType: 'folder', visitorVisible: false }, ownerAuthoringEnabled: true }).map((item) => item.id), ['open', 'edit-launcher']);
  assert.ok(contextMenuCommands({ target: { type: 'window' }, editMode: false, ownerAuthoringEnabled: true }).some((item) => item.id === 'toggle-start-open'));
  assert.equal(contextMenuCommands({ target: { type: 'window' }, editMode: false, launcher: { id: 'library:folder:one' } }).find((item) => item.id === 'reset-window').label, 'Reset Near Folder');
  assert.equal(contextMenuCommands({ target: { type: 'window' }, editMode: false, launcher: { id: 'library:folder:one', viewType: 'folder' } }).some((item) => item.id === 'toggle-start-open'), false);
});

test('home and gallery creation commands stay room-specific and keyboard-menu compatible', () => {
  const create = contextMenuCommands({ target: { type: 'canvas', id: 'canvas' }, menu: 'create', ownerAuthoringEnabled: true });
  assert.deepEqual(create.map((command) => command.id), ['menu-root', 'create-folder']);
  const gallery = contextMenuCommands({ target: { type: 'gallery-canvas', id: 'gallery-canvas' }, ownerAuthoringEnabled: true });
  assert.deepEqual(gallery.map((command) => command.id), ['add-gallery-artwork']);
  const object = contextMenuCommands({ target: { type: 'canvas-object', id: 'canvas:artwork:one' }, canvasObject: { visitorVisible: true }, ownerAuthoringEnabled: true });
  assert.deepEqual(object.map((command) => command.id), ['open-artwork', 'edit-artwork', 'replace-artwork', 'toggle-object-visibility', 'menu-layer', 'remove-artwork']);
  const layer = contextMenuCommands({ target: { type: 'canvas-object', id: 'canvas:artwork:one' }, menu: 'layer', ownerAuthoringEnabled: true });
  assert.deepEqual(layer.map((command) => command.id), ['menu-root', 'object-forward', 'object-backward', 'object-front', 'object-back']);
  const galleryObject = contextMenuCommands({ target: { type: 'gallery-object', id: 'canvas:artwork:one' }, canvasObject: { visitorVisible: true, locked: true }, ownerAuthoringEnabled: true });
  assert.equal(galleryObject.find((command) => command.id === 'toggle-artwork-lock').label, 'Unlock Placement');
  assert.equal(galleryObject.find((command) => command.id === 'toggle-transparent-presentation').label, 'Use Transparent Presentation');
  const transparentObject = contextMenuCommands({ target: { type: 'gallery-object', id: 'canvas:artwork:one' }, canvasObject: { presentation: { background: 'transparent' } }, ownerAuthoringEnabled: true });
  assert.equal(transparentObject.find((command) => command.id === 'toggle-transparent-presentation').label, 'Use Framed Presentation');
});

test('visitor menus expose runtime viewing commands but no authoring commands', () => {
  assert.deepEqual(contextMenuCommands({ target: { type: 'launcher' } }).map((item) => item.id), ['open']);
  assert.deepEqual(contextMenuCommands({ target: { type: 'canvas-object' } }).map((item) => item.id), ['open-artwork']);
  const canvas = contextMenuCommands({ target: { type: 'canvas' } }).map((item) => item.id);
  assert.equal(canvas.some((id) => ['toggle-edit', 'menu-create', 'settings'].includes(id)), false);
});

test('stage-free spatial home omits stage controls and exposes camera reset', () => {
  const view = contextMenuCommands({ target: { type: 'canvas', id: 'canvas' }, menu: 'view', stageAvailable: false });
  assert.equal(view.some((command) => command.id === 'toggle-stage'), false);
  assert.equal(view.some((command) => command.id === 'reset-home-camera'), true);
});
