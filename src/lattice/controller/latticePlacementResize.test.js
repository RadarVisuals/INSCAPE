import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLACEMENT_RESIZE_CORNERS,
  createPlacementResizeGesture,
  finishPlacementResizeGesture,
  updatePlacementResizeGesture,
} from './latticePlacementResize.js';

const artboard = { width: 1600, height: 900 };
const placement = { id: 'artwork', x: 0.25, y: 0.2, width: 0.2, height: 0.4 };
const handles = {
  nw: { x: 400, y: 180 }, ne: { x: 720, y: 180 },
  se: { x: 720, y: 540 }, sw: { x: 400, y: 540 },
};
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≈ ${expected}`);

const update = (corner, point, minimum = 40) => updatePlacementResizeGesture(
  createPlacementResizeGesture(placement, corner, handles[corner], artboard),
  point,
  artboard,
  10,
  minimum,
);

test('all four corners preserve the opposite normalized anchor', () => {
  const expectedAnchors = {
    nw: [0.45, 0.6], ne: [0.25, 0.6], se: [0.25, 0.2], sw: [0.45, 0.2],
  };
  for (const corner of PLACEMENT_RESIZE_CORNERS) {
    const resized = update(corner, {
      x: handles[corner].x + (corner.includes('w') ? -80 : 80),
      y: handles[corner].y + (corner.includes('n') ? -80 : 80),
    }).previewBounds;
    const anchor = [
      corner.includes('w') ? resized.x + resized.width : resized.x,
      corner.includes('n') ? resized.y + resized.height : resized.y,
    ];
    closeTo(anchor[0], expectedAnchors[corner][0]);
    closeTo(anchor[1], expectedAnchors[corner][1]);
  }
});

test('horizontal, vertical, and diagonal movement all resize smoothly while preserving screen ratio', () => {
  const horizontal = update('se', { x: 820, y: 540 }).previewBounds;
  const vertical = update('se', { x: 720, y: 640 }).previewBounds;
  const diagonal = update('se', { x: 820, y: 640 }).previewBounds;
  for (const bounds of [horizontal, vertical, diagonal]) {
    closeTo((bounds.width * artboard.width) / (bounds.height * artboard.height), 320 / 360);
    assert.ok(bounds.width > placement.width);
  }
  assert.ok(diagonal.width > horizontal.width);
  assert.ok(diagonal.width > vertical.width);
});

test('dead zone makes a handle click selection-only with no canonical mutation', () => {
  const gesture = update('se', { x: 724, y: 544 });
  assert.equal(gesture.activated, false);
  assert.deepEqual(finishPlacementResizeGesture(gesture), {
    committed: false,
    bounds: { x: 0.25, y: 0.2, width: 0.2, height: 0.4 },
  });
});

test('minimum displayed dimension and complete artboard edges clamp continuously', () => {
  const minimum = update('se', { x: -1000, y: -1000 }).previewBounds;
  assert.equal(Math.min(minimum.width * artboard.width, minimum.height * artboard.height), 40);
  const maximum = update('se', { x: 10000, y: 10000 }).previewBounds;
  assert.equal(maximum.x + maximum.width, 0.65);
  assert.equal(maximum.y + maximum.height, 1);
});

test('Escape-style cancellation restores exact starting bounds after activation', () => {
  const resized = update('nw', { x: 200, y: 20 });
  assert.deepEqual(finishPlacementResizeGesture(resized, { cancelled: true }), {
    committed: false,
    bounds: { x: 0.25, y: 0.2, width: 0.2, height: 0.4 },
  });
});

test('resize rejects invalid corners and interaction limits', () => {
  assert.throws(
    () => createPlacementResizeGesture(placement, 'middle', { x: 0, y: 0 }, artboard),
    /canonical corner/,
  );
  assert.throws(
    () => updatePlacementResizeGesture(
      createPlacementResizeGesture(placement, 'se', handles.se, artboard),
      handles.se,
      artboard,
      10,
      0,
    ),
    /interaction limits/,
  );
});
