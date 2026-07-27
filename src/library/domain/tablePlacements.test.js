import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyWorkspace } from './libraryWorkspace.js';
import {
  createTablePlacement,
  normalizeTablePlacements,
  removeTablePlacement,
  reorderTablePlacement,
  updateTablePlacement
} from './tablePlacements.js';

const profileAddress = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';

test('table placements normalize bounds, crop, and layer order', () => {
  const placements = normalizeTablePlacements([
    { id: 'second', tableId: 'archive', stableAssetId: 'asset:b', rect: { x: .95, y: .95, width: .3, height: .4 }, crop: { x: 2, y: -1, zoom: 9 }, layer: 9 },
    { id: 'first', tableId: 'identity', stableAssetId: 'asset:a', rect: { x: .1, y: .2, width: .2, height: .3 }, crop: { x: .4, y: .6, zoom: 1.5 }, layer: 1 },
    { id: 'invalid', tableId: 'unknown', stableAssetId: 'asset:c' }
  ]);

  assert.deepEqual(placements.map(({ id, layer }) => [id, layer]), [['first', 0], ['second', 1]]);
  assert.deepEqual(placements[1].rect, { x: .7, y: .6, width: .3, height: .4 });
  assert.deepEqual(placements[1].crop, { x: 1, y: 0, zoom: 4 });
});

test('table placement commands preserve gallery canvas objects and isolate table membership', () => {
  const original = { ...createEmptyWorkspace(profileAddress), canvas: { launchers: [], objects: [{ id: 'gallery-object' }] } };
  const withArchive = createTablePlacement(original, {
    tableId: 'archive', stableAssetId: 'asset:a', rect: { x: .2, y: .3, width: .25, height: .35 }, crop: { x: .4, y: .6, zoom: 1.2 }
  });
  const withDrops = createTablePlacement(withArchive, { tableId: 'drops', stableAssetId: 'asset:b' });

  assert.equal(withDrops.tables.placements.length, 2);
  assert.deepEqual(withDrops.canvas, original.canvas);
  assert.equal(withDrops.tables.placements[0].tableId, 'archive');
  assert.equal(withDrops.tables.placements[1].tableId, 'drops');

  const archiveId = withDrops.tables.placements[0].id;
  const updated = updateTablePlacement(withDrops, archiveId, { rect: { x: .45 }, crop: { zoom: 2 } });
  assert.equal(updated.tables.placements[0].rect.x, .45);
  assert.equal(updated.tables.placements[0].crop.zoom, 2);

  const front = reorderTablePlacement(updated, archiveId, 'front');
  assert.equal(front.tables.placements.at(-1).id, archiveId);
  const removed = removeTablePlacement(front, archiveId);
  assert.deepEqual(removed.tables.placements.map(({ stableAssetId }) => stableAssetId), ['asset:b']);
});
