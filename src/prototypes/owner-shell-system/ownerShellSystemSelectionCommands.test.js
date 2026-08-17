import assert from 'node:assert/strict';
import test from 'node:test';
import {
  duplicateSelectedPlacements,
  projectSelectionLayers,
  reorderSelectedPlacements,
  selectionAfterPlacementRemoval,
  togglePlacementLock,
} from './ownerShellSystemSelectionCommands.js';

const placements = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, assetId: id, tableId: 'home', left: index * 40, top: 0 }));
const ids = (items) => items.map(({ id }) => id);

test('layer ordering preserves selected-group order at every command distance', () => {
  assert.deepEqual(ids(reorderSelectedPlacements(placements, ['b', 'd'], -placements.length)), ['b', 'd', 'a', 'c']);
  assert.deepEqual(ids(reorderSelectedPlacements(placements, ['b', 'd'], placements.length)), ['a', 'c', 'b', 'd']);
  assert.deepEqual(ids(reorderSelectedPlacements(placements, ['b', 'd'], -1)), ['b', 'a', 'd', 'c']);
  assert.deepEqual(ids(reorderSelectedPlacements(placements, ['b', 'd'], 1)), ['a', 'c', 'b', 'd']);
  assert.deepEqual(ids(reorderSelectedPlacements(placements, ['b'], 0)), ['a', 'b', 'c', 'd']);
});

test('duplication copies complete placement data with deterministic offset and fresh identities', () => {
  assert.deepEqual(duplicateSelectedPlacements(placements.slice(0, 2), 123), [
    { ...placements[0], id: 'placement-123-0', locked: false, left: 40, top: 40 },
    { ...placements[1], id: 'placement-123-1', locked: false, left: 80, top: 40 },
  ]);
});

test('placement locks toggle only the requested placement and preserve geometry', () => {
  const locked = togglePlacementLock(placements, 'b');
  assert.deepEqual(locked, [placements[0], { ...placements[1], locked: true }, placements[2], placements[3]]);
  assert.deepEqual(togglePlacementLock(locked, 'b'), placements.map((placement, index) => index === 1 ? { ...placement, locked: false } : placement));
});

test('removal retains surviving selection or chooses the nearest layer fallback', () => {
  assert.deepEqual(selectionAfterPlacementRemoval({
    activePlacements: placements,
    placementId: 'b',
    selectedPlacementId: 'a',
    selectedPlacementIds: ['a', 'b'],
  }), { ids: ['a'], primaryId: 'a' });
  assert.deepEqual(selectionAfterPlacementRemoval({
    activePlacements: placements,
    placementId: 'b',
    selectedPlacementId: 'b',
    selectedPlacementIds: ['b'],
  }), { ids: ['c'], primaryId: 'c' });
  assert.deepEqual(selectionAfterPlacementRemoval({
    activePlacements: placements,
    placementId: 'd',
    selectedPlacementId: 'd',
    selectedPlacementIds: ['d'],
  }), { ids: ['c'], primaryId: 'c' });
});

test('inspector layer projection reverses visual stack and keeps selection and confirmation explicit', () => {
  const assets = placements.map(({ assetId }) => ({ stableAssetId: assetId, previewSrc: `/${assetId}.webp`, title: assetId.toUpperCase() }));
  assert.deepEqual(projectSelectionLayers({ activePlacements: placements.slice(0, 2), assets, removeCandidateId: 'a', selectedPlacementIds: ['b'] }), [
    { confirming: false, id: 'b', locked: false, previewSrc: '/b.webp', selected: true, title: 'B' },
    { confirming: true, id: 'a', locked: false, previewSrc: '/a.webp', selected: false, title: 'A' },
  ]);
});
