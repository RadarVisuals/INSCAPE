import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cropFocusBounds,
  normalizeCropForMask,
  projectCroppedMediaRectangle,
} from './latticeCrop.js';

const square = { left: 100, top: 50, width: 400, height: 400 };

test('portrait, landscape and square media cover a square mask without stretching or empty space', () => {
  assert.deepEqual(projectCroppedMediaRectangle(square, { width: 200, height: 400 }, { x: 0.5, y: 0.5, zoom: 1 }), {
    left: 100, top: -150, width: 400, height: 800,
  });
  assert.deepEqual(projectCroppedMediaRectangle(square, { width: 400, height: 200 }, { x: 0.5, y: 0.5, zoom: 1 }), {
    left: -100, top: 50, width: 800, height: 400,
  });
  assert.deepEqual(projectCroppedMediaRectangle(square, { width: 300, height: 300 }, { x: 0.5, y: 0.5, zoom: 1 }), square);
});

test('focus and zoom clamp to values that never expose empty mask area', () => {
  assert.deepEqual(cropFocusBounds(square, { width: 200, height: 400 }, 1), {
    x: { minimum: 0.5, maximum: 0.5 },
    y: { minimum: 0.25, maximum: 0.75 },
    renderedSize: { width: 400, height: 800 },
  });
  assert.deepEqual(normalizeCropForMask({ x: 0, y: 1, zoom: 1 }, square, { width: 200, height: 400 }), {
    x: 0.5, y: 0.75, zoom: 1,
  });
  assert.deepEqual(projectCroppedMediaRectangle(square, { width: 200, height: 400 }, { x: 0.5, y: 0.5, zoom: 2 }), {
    left: -100, top: -550, width: 800, height: 1600,
  });
});

test('crop projection rejects speculative or invalid values', () => {
  assert.throws(() => projectCroppedMediaRectangle(square, { width: 0, height: 100 }, { x: 0.5, y: 0.5, zoom: 1 }), /native media/);
  assert.throws(() => projectCroppedMediaRectangle(square, { width: 100, height: 100 }, { x: 2, y: 0.5, zoom: 1 }), /canonical focus/);
  assert.throws(() => cropFocusBounds(square, { width: 100, height: 100 }, 5), /one through four/);
});
