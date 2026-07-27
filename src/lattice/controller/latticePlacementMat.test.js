import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARTWORK_MAT_PRESET_IDS,
  DEFAULT_ARTWORK_MAT,
  projectArtworkMat,
  resolveArtworkMatPreset,
} from '../rendering/latticeMat.js';
import { reframePlacementForMat } from './latticePlacementMat.js';

const artboard = { left: 0, top: 0, width: 1600, height: 900 };
const rectangle = { left: 400, top: 225, width: 400, height: 225 };
const project = (bounds) => ({
  left: bounds.x * artboard.width,
  top: bounds.y * artboard.height,
  width: bounds.width * artboard.width,
  height: bounds.height * artboard.height,
});

test('applying and removing a mat preserves the visible artwork rectangle', () => {
  const mat = resolveArtworkMatPreset(ARTWORK_MAT_PRESET_IDS.CAPTION);
  const framedBounds = reframePlacementForMat(rectangle, artboard, DEFAULT_ARTWORK_MAT, mat);
  const framedRectangle = project(framedBounds);
  assert.deepEqual(projectArtworkMat(framedRectangle, mat).mediaOpeningRectangle, rectangle);
  const noneBounds = reframePlacementForMat(framedRectangle, artboard, mat, DEFAULT_ARTWORK_MAT);
  assert.deepEqual(project(noneBounds), rectangle);
});

test('changing independent mat insets preserves artwork wherever the artboard permits', () => {
  const before = resolveArtworkMatPreset(ARTWORK_MAT_PRESET_IDS.DOSSIER);
  const beforeBounds = reframePlacementForMat(rectangle, artboard, DEFAULT_ARTWORK_MAT, before);
  const beforeRectangle = project(beforeBounds);
  const artwork = projectArtworkMat(beforeRectangle, before).mediaOpeningRectangle;
  const after = { ...before, inset: { top: 0.1, right: 0.05, bottom: 0.2, left: 0.15 } };
  const afterBounds = reframePlacementForMat(beforeRectangle, artboard, before, after);
  const restored = projectArtworkMat(project(afterBounds), after).mediaOpeningRectangle;
  for (const key of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(restored[key] - artwork[key]) < 1e-9);
});

test('oversized mats scale and clamp as complete backplates inside the artboard', () => {
  const large = { enabled: true, color: '#112233', inset: { top: 0.45, right: 0.45, bottom: 0.45, left: 0.45 } };
  const bounds = reframePlacementForMat(rectangle, artboard, DEFAULT_ARTWORK_MAT, large);
  assert.ok(bounds.x >= 0 && bounds.y >= 0);
  assert.ok(bounds.x + bounds.width <= 1);
  assert.ok(bounds.y + bounds.height <= 1);
});
