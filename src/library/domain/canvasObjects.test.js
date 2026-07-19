import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from './libraryWorkspace.js';
import { CANVAS_OBJECT_KIND, getCanvasObjectDefinition, normalizeCanvasObjectPresentation } from './canvasObjectRegistry.js';
import { CANVAS_OBJECT_ORDER_COMMAND, createCanvasObject, isValidCanvasObjectId, MAX_CANVAS_OBJECT_ID_LENGTH, normalizeCanvasObject, removeCanvasObject, reorderCanvasObject, replaceCanvasObjectAsset, setCanvasObjectGeometry, setCanvasObjectPresentation } from './canvasObjects.js';

const ASSET_A = '42:0x1111111111111111111111111111111111111111:0x01';
const ASSET_B = '42:0x2222222222222222222222222222222222222222:contract';
const input = (id, asset = ASSET_A) => ({ id, kind: CANVAS_OBJECT_KIND.FRAMED_ARTWORK, stableAssetId: asset, placement: { column: 2, row: 3 } });

test('controlled registry normalizes only framed-artwork presentation values', () => {
  assert.equal(getCanvasObjectDefinition('remote-component'), null);
  assert.deepEqual(normalizeCanvasObjectPresentation('framed-artwork', { fit: 'cover', frame: 'javascript', mat: 'light', background: 'neutral' }), { fit: 'cover', frame: 'thin', mat: 'light', background: 'neutral' });
  assert.equal(normalizeCanvasObjectPresentation('remote-component', {}), null);
});

test('canvas object IDs share one bounded local and portable-document contract', () => {
  assert.equal(isValidCanvasObjectId('canvas:artwork:one'), true);
  assert.equal(isValidCanvasObjectId('canvas:artwork:remote/path'), false);
  assert.equal(isValidCanvasObjectId(`canvas:artwork:${'a'.repeat(MAX_CANVAS_OBJECT_ID_LENGTH)}`), false);
  assert.equal(isValidCanvasObjectId(`canvas:artwork:${'a'.repeat(MAX_CANVAS_OBJECT_ID_LENGTH - 'canvas:artwork:'.length)}`), true);
});

test('creation creates exactly one stable reference while invalid kinds and asset IDs fail closed', () => {
  const empty = createEmptyWorkspace('0xprofile'); const created = createCanvasObject(empty, input('canvas:artwork:one'));
  assert.equal(created.canvas.objects.length, 1); assert.equal(created.canvas.objects[0].stableAssetId, ASSET_A);
  assert.equal(createCanvasObject(created, input('canvas:artwork:one')), created);
  assert.equal(createCanvasObject(empty, { ...input('canvas:artwork:bad'), kind: 'remote-component' }), empty);
  assert.equal(createCanvasObject(empty, { ...input('canvas:artwork:bad'), stableAssetId: 'javascript:bad' }), empty);
  assert.deepEqual(empty.canvas.objects, [], 'cancel takes no creation action');
});

test('normalization clamps spans and placement and strips uncontrolled fields', () => {
  const object = normalizeCanvasObject({ ...input('canvas:artwork:bounded'), visitorVisible: true, placement: { column: 999, row: -4 }, span: { columns: 999, rows: 0 }, presentationOrder: 999,
    presentation: { fit: 'bad', frame: 'heavy', mat: 'bad', background: 'light' }, renderer: '/remote.jsx', shaderSource: 'void main(){}' });
  assert.deepEqual(object.span, { columns: 12, rows: 2 }); assert.deepEqual(object.placement, { column: 52, row: 0 });
  assert.deepEqual(object.presentation, { fit: 'contain', frame: 'heavy', mat: 'none', background: 'light' }); assert.equal('renderer' in object, false);
});

test('geometry, replacement, presentation, removal, and bounded stacking never mutate library ownership', () => {
  let workspace = { ...createEmptyWorkspace('0xprofile'), favorites: [ASSET_A], folders: [{ id: 'one', name: 'One', assetIds: [ASSET_A], createdAt: 0, updatedAt: 0 }] };
  workspace = createCanvasObject(workspace, input('canvas:artwork:a')); workspace = createCanvasObject(workspace, input('canvas:artwork:b', ASSET_B)); workspace = createCanvasObject(workspace, input('canvas:artwork:c'));
  workspace = setCanvasObjectGeometry(workspace, 'canvas:artwork:a', { column: 7, row: 8, columnSpan: 5, rowSpan: 6 }); workspace = setCanvasObjectPresentation(workspace, 'canvas:artwork:a', { fit: 'cover' }); workspace = replaceCanvasObjectAsset(workspace, 'canvas:artwork:a', ASSET_B);
  workspace = reorderCanvasObject(workspace, 'canvas:artwork:a', CANVAS_OBJECT_ORDER_COMMAND.FRONT);
  assert.deepEqual(workspace.canvas.objects.map((object) => object.presentationOrder), [0, 1, 2]); assert.equal(workspace.canvas.objects.at(-1).id, 'canvas:artwork:a');
  workspace = reorderCanvasObject(workspace, 'canvas:artwork:a', CANVAS_OBJECT_ORDER_COMMAND.FORWARD); assert.deepEqual(workspace.canvas.objects.map((object) => object.presentationOrder), [0, 1, 2], 'front order cannot grow');
  const ownership = structuredClone({ favorites: workspace.favorites, folders: workspace.folders }); workspace = removeCanvasObject(workspace, 'canvas:artwork:a');
  assert.deepEqual({ favorites: workspace.favorites, folders: workspace.folders }, ownership); assert.equal(workspace.canvas.objects.length, 2);
});
