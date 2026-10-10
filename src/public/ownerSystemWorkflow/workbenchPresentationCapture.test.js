import assert from 'node:assert/strict';
import test from 'node:test';
import { captureWorkbenchPresentation } from './workbenchPresentationCapture.js';
import { captureDisplayPresentation, restoreDisplayPresentation } from './displayPresentation.js';
import { isValidPlacementMedia } from '../../systemWorkflow/domain/placementMedia.js';
import { createDefaultWorkbenchPresentation, createMiniAppPresentation, assertWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../../profileDocument/domain/profileDocumentV9Asset.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import { createWorkbenchSession } from '../../systemWorkflow/workbenchSession.js';

const input = overrides => ({ layout: createDefaultWorkbenchPresentation(), identityOpen: false, ...overrides });
const display = (id, name) => ({ id, ...createDefaultWorkbenchPresentation().display, name });
const contractAddress = '0x2222222222222222222222222222222222222222';
const asset = { id: `42:${contractAddress}:0x01`, chainId: 42, contractAddress, tokenId: '0x01', standard: 'LSP8',
  name: 'Shortcut artwork', imageUrl: 'https://assets.example/original.png', imageWidth: 1600, imageHeight: 900 };
const selectedMedia = { url: 'https://assets.example/selected.png', width: 800, height: 800 };
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

test('capture is read-only; only explicit saving persists the layout through the existing store', () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const store = createSystemWorkflowDraftStore({ profileAddress: '0x1111111111111111111111111111111111111111', storage });
  const before = store.getDraft();
  const source = freeze(input({ displayPresentations: { 'display:primary': { ...createDefaultWorkbenchPresentation().display, open: false } }, identityOpen: true }));
  const result = captureWorkbenchPresentation(source);
  assert.equal(result.error, null);
  assertWorkbenchPresentation(result.value);
  assert.equal(result.value.display.open, false);
  assert.equal(result.value.identity.open, true);
  assert.equal(source.layout.display.open, true);
  assert.equal(Object.hasOwn(result.value, 'displays'), false);
  assert.equal(Object.hasOwn(result.value, 'miniApps'), false);
  assert.equal(entries.size, 0);
  assert.deepEqual(store.getDraft(), before);
  assert.equal(createWorkbenchSession({ store }).saveWorkbench(result.value), true);
  assert.deepEqual(store.getDraft(), { ...before, workbench: result.value });
});

test('current modules use live presentation, then their saved layout, then existing defaults in authored order', () => {
  const layout = createDefaultWorkbenchPresentation();
  layout.displays = [display('display:saved', 'Saved'), display('display:live', 'Old')];
  layout.miniApps = [createMiniAppPresentation('miniapp:saved', 5), createMiniAppPresentation('miniapp:live', 6)];
  const liveDisplay = { ...display('display:live', 'Live'), open: false };
  const liveApp = { ...createMiniAppPresentation('miniapp:live', 7), open: false };
  const result = captureWorkbenchPresentation(freeze(input({ layout,
    displays: ['live', 'saved', 'new'].map(id => ({ id: `display:${id}` })),
    miniApps: ['live', 'saved', 'new'].map(id => ({ id: `miniapp:${id}` })),
    displayPresentations: { 'display:live': liveDisplay }, miniAppPresentations: { 'miniapp:live': liveApp },
  })));
  assert.equal(result.error, null);
  assert.deepEqual(result.value.displays, [liveDisplay, layout.displays[0], display('display:new', 'DISPLAY MODULE')]);
  assert.deepEqual(result.value.miniApps, [liveApp, layout.miniApps[0], createMiniAppPresentation('miniapp:new', 2)]);
  assertWorkbenchPresentation(result.value);
});

test('a newly dropped Image retains its saved position before its lazy renderer reports a window', () => {
  const saved = { id: 'image:dropped', open: true, position: { left: 987.25, top: 421.5 } };
  const source = input({ imageModules: [{ id: saved.id }], savedImagePresentations: [saved] });
  assert.deepEqual(captureWorkbenchPresentation(source).value.imageModules, [saved]);
  const live = { ...saved, position: { left: 123, top: 456 } };
  assert.deepEqual(captureWorkbenchPresentation({ ...source, imagePresentations: { [saved.id]: live } }).value.imageModules, [live]);
  assert.deepEqual(captureWorkbenchPresentation({ ...source, imageModules: [] }).value.imageModules, []);
});

test('removed modules contribute neither saved layouts nor cached errors, including undo to absent collections', () => {
  const layout = createDefaultWorkbenchPresentation();
  layout.displays = [display('display:removed', 'Removed')];
  layout.miniApps = [createMiniAppPresentation('miniapp:removed')];
  const source = input({ layout, displayPresentations: { 'display:removed': null },
    miniAppPresentations: { 'miniapp:removed': createMiniAppPresentation('miniapp:removed') } });
  const empty = captureWorkbenchPresentation({ ...source, displays: [], miniApps: [] });
  assert.equal(empty.error, null);
  assert.deepEqual(empty.value.displays, []);
  assert.deepEqual(empty.value.miniApps, []);
  const absent = captureWorkbenchPresentation(source);
  assert.equal(absent.error, null);
  assert.equal(Object.hasOwn(absent.value, 'displays'), false);
  assert.equal(Object.hasOwn(absent.value, 'miniApps'), false);
  const active = captureWorkbenchPresentation({ ...source, displays: [{ id: 'display:removed' }] });
  assert.equal(active.value, null);
  assert.match(active.error, /shortcut artwork.*unavailable/);
});

for (const id of ['display:primary', 'display:second']) {
  const capture = ({ layout, shortcut, assetRecords = [], ...options }) => captureWorkbenchPresentation(input({ layout,
    displays: id === 'display:primary' ? [] : [{ id }],
    displayPresentations: { [id]: captureDisplayPresentation(layout.display, shortcut, assetRecords) }, ...options }));
  const resultDisplay = result => id === 'display:primary' ? result.value.display : result.value.displays[0];
  test(id + ': saved shortcut stays usable until its selected media changes, then resolves or resets', () => {
    const layout = createDefaultWorkbenchPresentation();
    const icon = createProfileDocumentV9AssetResolver([asset], { compactContentReference: false })(asset.id, selectedMedia);
    layout.display.shortcut.icon = icon;
    const restored = restoreDisplayPresentation(layout.display);
    assert.equal(isValidPlacementMedia(restored.shortcut.iconMedia), true, 'reload restores the selected image through the editable media contract');
    assert.deepEqual(restored.shortcut.iconMedia, selectedMedia);
    assert.deepEqual(captureDisplayPresentation(layout.display, restored.shortcut, []).shortcut.icon, icon);
    const shortcut = { ...layout.display.shortcut, iconAssetId: asset.id, iconMedia: selectedMedia,
      position: { left: 220, top: 170 }, visible: false };
    const source = freeze({ layout, shortcut });
    const same = capture(source);
    assert.equal(same.error, null);
    assert.deepEqual(resultDisplay(same).shortcut.icon, icon);
    assert.deepEqual(resultDisplay(same).shortcut.position, shortcut.position);
    assert.equal(resultDisplay(same).shortcut.visible, false);
    assert.equal(capture({ ...source, shortcut: { ...shortcut, iconMedia: null } }).error, null);
    const changed = { ...source, shortcut: { ...shortcut, iconMedia: { ...selectedMedia, width: 640 } } };
    assert.equal(capture(changed).value, null);
    const recovered = capture({ ...changed, assetRecords: [asset] });
    assert.equal(recovered.error, null);
    assert.equal(resultDisplay(recovered).shortcut.icon.media.width, 640);
    assert.equal(resultDisplay(recovered).shortcut.icon.media.url, selectedMedia.url);
    assertWorkbenchPresentation(recovered.value);
    const missing = { layout: createDefaultWorkbenchPresentation(), shortcut };
    assert.match(capture(missing).error, /Open Library.*reset its icon/);
    const reset = capture({ ...missing, shortcut: { ...shortcut, iconAssetId: null } });
    assert.equal(reset.error, null);
    assert.equal(resultDisplay(reset).shortcut.icon, null);
    const removed = capture({ ...missing, hasPrimaryDisplay: false, displays: [] });
    assert.equal(removed.error, null);
    assert.equal(removed.value.display.open, false);
  });
}
