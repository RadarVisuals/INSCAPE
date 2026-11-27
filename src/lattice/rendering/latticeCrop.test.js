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

test('zooming below fill centers free space and keeps the native aspect ratio', () => {
  for (const media of [{ width: 200, height: 400 }, { width: 400, height: 200 }, { width: 300, height: 300 }]) {
    const result = projectCroppedMediaRectangle(square, media, { x: 0, y: 1, zoom: .25 });
    assert.equal(result.width / result.height, media.width / media.height);
    assert.equal(result.left + result.width / 2, square.left + square.width / 2);
    assert.equal(result.top + result.height / 2, square.top + square.height / 2);
    assert.ok(result.width < square.width && result.height < square.height);
  }
  assert.deepEqual(normalizeCropForMask({ x: 0, y: 1, zoom: .75 }, square, { width: 200, height: 400 }), {
    x: .5, y: 1 - 1 / 3, zoom: .75,
  }, 'a portrait can still pan vertically while its horizontal margins stay even');
});

test('crop projection rejects speculative or invalid values', () => {
  assert.throws(() => projectCroppedMediaRectangle(square, { width: 0, height: 100 }, { x: 0.5, y: 0.5, zoom: 1 }), /native media/);
  assert.throws(() => projectCroppedMediaRectangle(square, { width: 100, height: 100 }, { x: 2, y: 0.5, zoom: 1 }), /canonical focus/);
  for (const zoom of [0, .09, 5, NaN]) {
    assert.throws(() => cropFocusBounds(square, { width: 100, height: 100 }, zoom), /0.1 through 4/);
  }
});
