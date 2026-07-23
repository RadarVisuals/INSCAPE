import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSpatialWorldDirection,
  getSpatialWorldStackOffset,
  SPATIAL_WORLD_LEVEL
} from './spatialWorldLevels.js';

test('Home is the stable level between Upper and Gallery worlds', () => {
  assert.equal(SPATIAL_WORLD_LEVEL.UPPER, -1);
  assert.equal(SPATIAL_WORLD_LEVEL.HOME, 0);
  assert.equal(SPATIAL_WORLD_LEVEL.GALLERY, 1);
  assert.equal(getSpatialWorldDirection(SPATIAL_WORLD_LEVEL.HOME, SPATIAL_WORLD_LEVEL.UPPER), -1);
  assert.equal(getSpatialWorldDirection(SPATIAL_WORLD_LEVEL.HOME, SPATIAL_WORLD_LEVEL.GALLERY), 1);
});

test('world-stack offsets place Upper above Home and Gallery below it', () => {
  assert.equal(getSpatialWorldStackOffset(SPATIAL_WORLD_LEVEL.UPPER, SPATIAL_WORLD_LEVEL.HOME), -100);
  assert.equal(getSpatialWorldStackOffset(SPATIAL_WORLD_LEVEL.HOME, SPATIAL_WORLD_LEVEL.HOME), 0);
  assert.equal(getSpatialWorldStackOffset(SPATIAL_WORLD_LEVEL.GALLERY, SPATIAL_WORLD_LEVEL.HOME), 100);
});
