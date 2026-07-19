import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_WORLD_CAMERA_LIMIT,
  getWindowRevealCamera,
  getZoomedHomeWorldCamera,
  homeWorldCameraKey,
  loadHomeWorldCamera,
  normalizeHomeWorldCamera,
  saveHomeWorldCamera
} from './homeWorldCamera.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('home camera persistence is profile scoped and round-trips two axes', () => {
  const storage = memoryStorage();
  assert.equal(saveHomeWorldCamera(storage, '0xABCD', { x: -420, y: 815 }), true);
  assert.deepEqual(loadHomeWorldCamera(storage, '0xabcd'), { x: -420, y: 815, zoom: 1 });
  assert.deepEqual(loadHomeWorldCamera(storage, '0xother'), { x: 0, y: 0, zoom: 1 });
  assert.match(homeWorldCameraKey('0xABCD'), /0xabcd$/);
});

test('window reveal leaves sufficiently visible geometry alone and minimally pans to offscreen geometry', () => {
  const geometry = { cellWidth: 40, cellHeight: 40 };
  const world = { width: 3000, height: 1800, viewportWidth: 1000, viewportHeight: 600 };
  assert.equal(getWindowRevealCamera({ x: 1000, y: 600, zoom: 1 }, { column: 26, row: 16, columnSpan: 10, rowSpan: 8 }, geometry, world), null);
  assert.deepEqual(getWindowRevealCamera({ x: 0, y: 0, zoom: 1 }, { column: 50, row: 20, columnSpan: 10, rowSpan: 8 }, geometry, world), { x: 1456, y: 576, zoom: 1 });
});

test('anchored zoom keeps the world point under the pointer stable', () => {
  const world = { width: 3000, height: 1800, viewportWidth: 1000, viewportHeight: 600 };
  assert.deepEqual(getZoomedHomeWorldCamera({ x: 1000, y: 600, zoom: 1 }, 1.25, { x: 200, y: 100 }, world), { x: 1040, y: 620, zoom: 1.25 });
});

test('home camera state rejects corrupt records and bounds extreme coordinates', () => {
  const storage = { getItem: () => '{broken' };
  assert.deepEqual(loadHomeWorldCamera(storage, 'profile'), { x: 0, y: 0, zoom: 1 });
  assert.deepEqual(normalizeHomeWorldCamera({ x: Infinity, y: HOME_WORLD_CAMERA_LIMIT * 2 }), { x: 0, y: HOME_WORLD_CAMERA_LIMIT, zoom: 1 });
});
