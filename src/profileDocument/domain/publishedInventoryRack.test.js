import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { projectPublishedInventoryRack, reconcilePublishedInventoryOrder } from './publishedInventoryRack.js';

const spaces = Object.freeze([
  Object.freeze({ id: 'space:b', order: 1, label: 'B', startOpen: false, assets: [] }),
  Object.freeze({ id: 'space:a', order: 0, label: 'A', startOpen: true, assets: [Object.freeze({ stableAssetId: 'asset:a' })] })
]);

test('published Inventory Rack projects only validated document spaces in authored order', () => {
  const source = { spaces: structuredClone(spaces) };
  const projection = projectPublishedInventoryRack(source);
  assert.equal(projection.id, 'inventory');
  assert.equal(projection.label, 'INVENTORY');
  assert.deepEqual(projection.modules.map(({ id, label, startOpen }) => ({ id, label, startOpen })), [
    { id: 'space:a', label: 'A', startOpen: true },
    { id: 'space:b', label: 'B', startOpen: false }
  ]);
  assert.deepEqual(source.spaces, spaces, 'visitor projection cannot mutate the verified document');
});

test('an empty or missing public space collection produces no Inventory Rack', () => {
  assert.equal(projectPublishedInventoryRack({ spaces: [] }), null);
  assert.equal(projectPublishedInventoryRack({}), null);
});

test('live Inventory order keeps existing arrangement while adding and removing public spaces', () => {
  const current = ['space:b', 'space:a'];
  const withNewSpace = reconcilePublishedInventoryOrder(current, [
    { id: 'space:a' }, { id: 'space:b' }, { id: 'space:c' }, { id: 'space:d' }
  ]);
  assert.deepEqual(withNewSpace, ['space:b', 'space:a', 'space:c', 'space:d']);
  assert.deepEqual(reconcilePublishedInventoryOrder(withNewSpace, [
    { id: 'space:a' }, { id: 'space:c' }, { id: 'space:d' }
  ]), ['space:a', 'space:c', 'space:d']);
  assert.equal(reconcilePublishedInventoryOrder(withNewSpace, [
    { id: 'space:b' }, { id: 'space:a' }, { id: 'space:c' }, { id: 'space:d' }
  ]), withNewSpace, 'unchanged order preserves the current state reference');
});

test('production rack board stays detached and renders no fixture-only Grid rack', () => {
  const component = readFileSync(new URL('../components/PublishedInventoryRack.jsx', import.meta.url), 'utf8');
  const board = readFileSync(new URL('../components/PublishedRackBoard.jsx', import.meta.url), 'utf8');
  const world = readFileSync(new URL('../components/PublishedHomeWorld.jsx', import.meta.url), 'utf8');
  assert.match(component, /projectDocumentSpace\(module\.space\)/);
  assert.match(component, /reconcilePublishedInventoryOrder\(current, rack\.modules\)/);
  assert.match(component, /aria-label="Public inventory rack"/);
  assert.match(component, /aria-live="polite"/);
  assert.match(board, /PublishedIdentityRack/);
  assert.match(board, /PublishedInventoryRack/);
  assert.doesNotMatch(board + world, /GRID|RADAR|SIGNAL MAP|VISUALIZER/);
  assert.doesNotMatch(component + board, /useLibraryStore|useWalletStore|localStorage|sessionStorage|indexedDB|writeContract|fetch\(/);
  assert.doesNotMatch(world, /data-launcher-id|PublishedProfileDocumentSpaceWindow|published-home-world__window/);
});
