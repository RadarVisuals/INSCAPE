import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampLatticeOwnerCameraY,
  createWidthFitLatticeOwnerViewport,
  updateLatticeOwnerCameraY,
} from './latticeOwnerViewport.js';

test('owner viewport fits all 32 square cells to width and centers bounded vertical overflow', () => {
  assert.deepEqual(createWidthFitLatticeOwnerViewport({ width: 1600, height: 800 }), {
    cellSize: 50,
    width: 1600,
    height: 900,
    left: 0,
    top: -50,
    minimumCameraY: -50,
    maximumCameraY: 50,
  });
  assert.deepEqual(createWidthFitLatticeOwnerViewport({ width: 1000, height: 1000 }), {
    cellSize: 31.25,
    width: 1000,
    height: 562.5,
    left: 0,
    top: 218.75,
    minimumCameraY: 0,
    maximumCameraY: 0,
  });
});

test('owner camera movement is vertical, bounded, and stable when no overflow exists', () => {
  const wide = createWidthFitLatticeOwnerViewport({ width: 1600, height: 800 });
  assert.equal(updateLatticeOwnerCameraY({ originY: 400, pointerY: 430, startCameraY: 0 }, wide), 30);
  assert.equal(updateLatticeOwnerCameraY({ originY: 400, pointerY: 900, startCameraY: 0 }, wide), 50);
  assert.equal(updateLatticeOwnerCameraY({ originY: 400, pointerY: -100, startCameraY: 0 }, wide), -50);
  assert.equal(clampLatticeOwnerCameraY(25, createWidthFitLatticeOwnerViewport({ width: 1000, height: 1000 })), 0);
});
