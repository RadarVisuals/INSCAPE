import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlacementFromAssetDrop,
  cropForPlacementFrame,
  getPlacementBounds,
  getPlacementsInsideMarquee,
  movePlacementGroup,
  placementRectangleFromPointer,
  resizePlacementGroup,
} from './ownerShellSystemPlacementGeometry.js';

const assets = [
  { stableAssetId: 'square', width: 1000, height: 1000 },
  { stableAssetId: 'wide', width: 1600, height: 900 },
];

test('placement bounds and marquee selection operate on the visible placement rectangles', () => {
  const placements = [
    { id: 'a', left: 40, top: 80, width: 120, height: 80 },
    { id: 'b', left: 240, top: 160, width: 80, height: 120 },
  ];
  assert.deepEqual(getPlacementBounds(placements), {
    bottom: 280, height: 200, left: 40, right: 320, top: 80, width: 280,
  });
  assert.deepEqual(getPlacementsInsideMarquee(placements, { left: 120, right: 260, top: 100, bottom: 220 }), ['a', 'b']);
  assert.deepEqual(getPlacementsInsideMarquee(placements, { left: 160, right: 240, top: 0, bottom: 400 }), []);
});

test('movement snaps the group once and clamps its shared bounds to the canvas', () => {
  const placements = [
    { id: 'a', left: 40, top: 40, width: 80, height: 80 },
    { id: 'b', left: 160, top: 80, width: 80, height: 80 },
  ];
  const bounds = getPlacementBounds(placements);
  assert.deepEqual(movePlacementGroup({ bounds, canvas: { width: 320, height: 240 }, cell: 40, dx: 57, dy: 73, placements }), [
    { id: 'a', left: 80, top: 120, width: 80, height: 80 },
    { id: 'b', left: 200, top: 160, width: 80, height: 80 },
  ]);
  assert.deepEqual(movePlacementGroup({ bounds, canvas: { width: 320, height: 240 }, cell: 40, dx: -500, dy: -500, placements }).map(({ left, top }) => ({ left, top })), [
    { left: 0, top: 0 },
    { left: 120, top: 40 },
  ]);
});

test('all resize corners retain the opposite anchor and snap placement geometry', () => {
  const placement = { id: 'a', assetId: 'square', crop: null, left: 120, top: 120, width: 120, height: 120 };
  const bounds = getPlacementBounds([placement]);
  const cases = [
    ['se', 80, 80, { left: 120, top: 120 }],
    ['sw', -80, 80, { left: 40, top: 120 }],
    ['ne', 80, -80, { left: 120, top: 40 }],
    ['nw', -80, -80, { left: 40, top: 40 }],
  ];
  for (const [corner, dx, dy, anchor] of cases) {
    const [resized] = resizePlacementGroup({ assets, bounds, canvas: { width: 480, height: 480 }, cell: 40, corner, dx, dy, placements: [placement], preserveRatio: false });
    assert.equal(resized.width, 200, corner);
    assert.equal(resized.height, 200, corner);
    assert.equal(resized.left, anchor.left, corner);
    assert.equal(resized.top, anchor.top, corner);
  }
});

test('ratio-preserving resize and crop initialization preserve the existing prototype contract', () => {
  const placement = { id: 'wide-placement', assetId: 'wide', crop: null, left: 40, top: 40, width: 160, height: 80 };
  const [resized] = resizePlacementGroup({
    assets,
    bounds: getPlacementBounds([placement]),
    canvas: { width: 640, height: 480 },
    cell: 40,
    corner: 'se',
    dx: 80,
    dy: 5,
    placements: [placement],
    preserveRatio: true,
  });
  assert.deepEqual({ width: resized.width, height: resized.height }, { width: 240, height: 120 });
  assert.deepEqual(resized.crop, { x: 0.5, y: 0.5, zoom: 1 });
  assert.equal(cropForPlacementFrame(null, assets[0], 200, 200), null);
  assert.deepEqual(cropForPlacementFrame(null, assets[0], 200, 160), { x: 0.5, y: 0.5, zoom: 1 });
});

test('Library pointer drops produce snapped, contained placement rectangles', () => {
  const bounds = { left: 100, top: 50, width: 800, height: 600, right: 900, bottom: 650 };
  assert.deepEqual(placementRectangleFromPointer({
    asset: assets[1], bounds, cell: 40, clientX: 500, clientY: 350,
  }), { height: 135, left: 280, top: 240, width: 240 });
  assert.deepEqual(placementRectangleFromPointer({
    asset: assets[0], bounds, cell: 40, clientX: 110, clientY: 60,
  }), { height: 180, left: 0, top: 0, width: 180 });
  assert.equal(placementRectangleFromPointer({
    asset: assets[0], bounds, cell: 40, clientX: 99, clientY: 350,
  }), null);
});

test('asset drops create one stable placement for the active grid', () => {
  assert.deepEqual(createPlacementFromAssetDrop({
    asset: assets[1],
    rectangle: { height: 135, left: 280, top: 240, width: 240 },
    stamp: 77,
    tableId: 'grid-2',
  }), {
    id: 'placement-77',
    assetId: 'wide',
    crop: null,
    tableId: 'grid-2',
    height: 135,
    left: 280,
    top: 240,
    width: 240,
  });
});
