import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSpatialCamera,
  getSpatialGridOffset,
  panSpatialCamera,
  screenToSpatialWorld,
  spatialWorldToScreen
} from './spatialWorldCamera.js';

test('two-dimensional camera panning follows pointer drag in world space', () => {
  assert.deepEqual(
    panSpatialCamera({ x: 400, y: -120 }, { x: 200, y: 300 }, { x: 260, y: 250 }),
    { x: 340, y: -70 }
  );
});

test('camera bounds can clamp one axis while leaving the other unbounded', () => {
  assert.deepEqual(
    clampSpatialCamera({ x: -40, y: -9000 }, { minX: 0, maxX: 800 }),
    { x: 0, y: -9000 }
  );
  assert.deepEqual(
    clampSpatialCamera({ x: 1200, y: 9000 }, { minX: 0, maxX: 800 }),
    { x: 800, y: 9000 }
  );
});

test('screen and world coordinates round-trip through the camera', () => {
  const camera = { x: 640, y: -240 };
  const screen = { x: 320, y: 450 };
  const world = screenToSpatialWorld(screen, camera);
  assert.deepEqual(world, { x: 960, y: 210 });
  assert.deepEqual(spatialWorldToScreen(world, camera), screen);
});

test('wireframe grid offset wraps cleanly in both directions', () => {
  assert.deepEqual(getSpatialGridOffset({ x: 85, y: -15 }, 80), { x: 75, y: 15 });
  assert.deepEqual(getSpatialGridOffset({ x: -160, y: 160 }, 80), { x: 0, y: 0 });
});
