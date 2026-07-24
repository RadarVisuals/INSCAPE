import assert from 'node:assert/strict';
import test from 'node:test';
import { clampMenuPosition, contextMenuCommands, presentationPatchForCommand } from './contextMenuModel.js';
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
  const gallery = contextMenuCommands({ target: { type: 'gallery-canvas', id: 'gallery-canvas' }, canvasObjects: [{ locked: false }, { locked: true }], ownerAuthoringEnabled: true });
  assert.deepEqual(gallery.map((command) => command.id), ['add-gallery-artwork', 'lock-all-artwork', 'unlock-all-artwork']);
  const object = contextMenuCommands({ target: { type: 'canvas-object', id: 'canvas:artwork:one' }, canvasObject: { visitorVisible: true }, ownerAuthoringEnabled: true });
  assert.deepEqual(object.map((command) => command.id), ['open-artwork', 'edit-artwork', 'replace-artwork', 'toggle-object-visibility', 'menu-layer', 'remove-artwork']);
  const layer = contextMenuCommands({ target: { type: 'canvas-object', id: 'canvas:artwork:one' }, menu: 'layer', ownerAuthoringEnabled: true });
  assert.deepEqual(layer.map((command) => command.id), ['menu-root', 'object-forward', 'object-backward', 'object-front', 'object-back']);
  const galleryObject = contextMenuCommands({ target: { type: 'gallery-object', id: 'canvas:artwork:one' }, canvasObject: { visitorVisible: true, locked: true }, ownerAuthoringEnabled: true });
  assert.deepEqual(galleryObject.map((command) => command.id), ['open-artwork', 'menu-appearance', 'replace-artwork', 'remove-artwork', 'menu-layer', 'toggle-object-visibility', 'toggle-artwork-lock']);
  assert.equal(galleryObject.find((command) => command.id === 'toggle-artwork-lock').label, 'Unlock');
  assert.equal(galleryObject.some((command) => command.id === 'edit-artwork'), false);
  const appearance = contextMenuCommands({ target: { type: 'gallery-object', id: 'canvas:artwork:one' }, menu: 'appearance', ownerAuthoringEnabled: true });
  assert.deepEqual(appearance.map((command) => command.id), ['menu-root', 'menu-presentation', 'menu-image-fit', 'menu-frame', 'menu-mat', 'menu-background']);
  const presentation = contextMenuCommands({ target: { type: 'gallery-object', id: 'canvas:artwork:one' }, menu: 'presentation', canvasObject: { presentation: { background: 'transparent' } }, ownerAuthoringEnabled: true });
  assert.equal(presentation.find((command) => command.id === 'presentation-transparent').label, '✓ Transparent');
  const frame = contextMenuCommands({ target: { type: 'gallery-object', id: 'canvas:artwork:one' }, menu: 'frame', canvasObject: { presentation: { frame: 'thin' } }, ownerAuthoringEnabled: true });
  assert.equal(frame.find((command) => command.id === 'frame-thin').label, '✓ Thin');
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

test('appearance commands resolve to temporary or committed presentation patches', () => {
  assert.deepEqual(presentationPatchForCommand('presentation-transparent', { background: 'light' }), { background: 'transparent' });
  assert.deepEqual(presentationPatchForCommand('presentation-framed', { background: 'transparent' }), { background: 'dark' });
  assert.deepEqual(presentationPatchForCommand('image-fit-cover'), { fit: 'cover' });
  assert.deepEqual(presentationPatchForCommand('frame-heavy'), { frame: 'heavy' });
  assert.deepEqual(presentationPatchForCommand('mat-light'), { mat: 'light' });
  assert.deepEqual(presentationPatchForCommand('background-neutral'), { background: 'neutral' });
  assert.equal(presentationPatchForCommand('replace-artwork'), null);
});
