import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSystemWorkflowCropPanGesture,
  createSystemWorkflowCropSession,
  finishSystemWorkflowCropPanGesture,
  nudgeSystemWorkflowCrop,
  reframeSystemWorkflowCropForMask,
  setSystemWorkflowCropZoom,
  systemWorkflowCropMask,
  updateSystemWorkflowCropPanGesture,
} from './systemWorkflowCrop.js';
import { projectCroppedMediaRectangle } from '../lattice/rendering/latticeCrop.js';
import {
  projectSystemWorkflowImageRenderRectangle,
  projectSystemWorkflowTransform,
  renderedSystemWorkflowCssTransform,
  unprojectSystemWorkflowCrop,
} from './systemWorkflowTransform.js';
const ASSET = '42:0x2222222222222222222222222222222222222222:0x01';
const placement = (id, layer = 0, overrides = {}) => ({
  id, stableAssetId: ASSET, column: 2, row: 2, columnSpan: 4, rowSpan: 4,
  layer, navigationOrder: layer, crop: null,
  visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  ...overrides,
});

test('Image projects and reverses crop focus through artwork transforms', () => {
  assert.deepEqual(projectSystemWorkflowTransform(
    { quarterTurns: 1, mirrorX: true, mirrorY: false },
    { width: 600, height: 400 },
    { x: 0.2, y: 0.7, zoom: 1.5 },
  ), {
    crop: { x: 0.7, y: 0.2, zoom: 1.5 },
    css: 'scale(-1, 1) rotate(90deg)',
    dimensions: { width: 400, height: 600 },
    swapped: true,
  });
  assert.deepEqual(projectSystemWorkflowImageRenderRectangle(
    { left: 1, top: 2, width: 8, height: 5 },
    { swapped: true },
  ), { left: 2.5, top: 0.5, width: 5, height: 8 });
  assert.deepEqual(projectSystemWorkflowImageRenderRectangle(
    { left: 1, top: 2, width: 8, height: 5 },
    { swapped: false },
  ), { left: 1, top: 2, width: 8, height: 5 });
  assert.equal(renderedSystemWorkflowCssTransform({ css: 'scale(1, 1) rotate(0deg)' }), undefined);
  assert.equal(renderedSystemWorkflowCssTransform({ css: 'scale(-1, 1) rotate(90deg)' }), 'scale(-1, 1) rotate(90deg)');
  const remappingCases = [
    [{ quarterTurns: 0, mirrorX: false, mirrorY: false }, { x: 0.2, y: 0.7 }],
    [{ quarterTurns: 1, mirrorX: false, mirrorY: false }, { x: 1 - 0.7, y: 0.2 }],
    [{ quarterTurns: 2, mirrorX: false, mirrorY: false }, { x: 1 - 0.2, y: 1 - 0.7 }],
    [{ quarterTurns: 3, mirrorX: false, mirrorY: false }, { x: 0.7, y: 0.8 }],
    [{ quarterTurns: 0, mirrorX: true, mirrorY: false }, { x: 0.8, y: 0.7 }],
    [{ quarterTurns: 0, mirrorX: false, mirrorY: true }, { x: 0.2, y: 1 - 0.7 }],
  ];
  for (const [transform, focus] of remappingCases) {
    const projection = projectSystemWorkflowTransform(
      transform,
      { width: 600, height: 400 },
      { x: 0.2, y: 0.7, zoom: 1.5 },
    );
    assert.deepEqual({ x: projection.crop.x, y: projection.crop.y }, focus);
    const roundTrip = unprojectSystemWorkflowCrop(transform, projection.crop);
    assert.ok(Math.abs(roundTrip.x - 0.2) < 1e-12);
    assert.ok(Math.abs(roundTrip.y - 0.7) < 1e-12);
    assert.equal(roundTrip.zoom, 1.5);
  }
});

test('crop pan, dead-zone, cancellation, nudging, and zoom limits produce bounded focus', () => {
  const entry = placement('crop', 0, {
    column: 4, row: 3, columnSpan: 8, rowSpan: 8,
  });
  const portrait = { stableAssetId: ASSET, width: 900, height: 1600 };
  const session = createSystemWorkflowCropSession(
    entry,
    portrait,
    { left: 0, top: 0, width: 320, height: 320 },
  );
  const start = createSystemWorkflowCropPanGesture(session, { x: 100, y: 100 });
  const click = updateSystemWorkflowCropPanGesture(start, { x: 106, y: 107 });
  assert.equal(click.activated, false);
  const moved = updateSystemWorkflowCropPanGesture(start, { x: 100, y: 180 });
  assert.equal(moved.activated, true);
  assert.equal(moved.previewCrop.y, 0.359375);
  assert.deepEqual(finishSystemWorkflowCropPanGesture(moved), {
    changed: true, crop: moved.previewCrop,
  });
  assert.deepEqual(finishSystemWorkflowCropPanGesture(moved, { cancelled: true }), {
    changed: false, crop: start.startCrop,
  });
  const bounded = updateSystemWorkflowCropPanGesture(start, { x: -10000, y: 10000 });
  assert.ok(bounded.previewCrop.x <= 1 && bounded.previewCrop.y >= 0);

  const nudged = nudgeSystemWorkflowCrop(
    session.previewCrop, session.media, session.mask, { x: 0.01, y: -0.05 },
  );
  assert.equal(nudged.x, 0.5);
  assert.ok(nudged.y < 0.5);
  assert.equal(setSystemWorkflowCropZoom(nudged, session.media, session.mask, -1).zoom, 1);
  assert.equal(setSystemWorkflowCropZoom(nudged, session.media, session.mask, 99).zoom, 4);

  const reframed = reframeSystemWorkflowCropForMask(
    { x: 0.5, y: 0.5, zoom: 2 },
    { stableAssetId: ASSET, width: 100, height: 100 },
    { left: 0, top: 0, width: 4, height: 4 },
    { left: 0, top: 0, width: 6, height: 4 },
    { renderedScale: 0.08 },
  );
  assert.ok(Math.abs(reframed.zoom - (4 / 3)) < 1e-12);
  assert.equal(reframed.x, 0.625);
  assert.equal(reframed.y, 0.5);

  const previousRectangle = projectCroppedMediaRectangle(
    { left: 0, top: 0, width: 4, height: 4 },
    { width: 100, height: 100 },
    { x: 0.5, y: 0.5, zoom: 2 },
  );
  const liveReframe = reframeSystemWorkflowCropForMask(
    { x: 0.5, y: 0.5, zoom: 2 },
    { stableAssetId: ASSET, width: 100, height: 100 },
    { left: 0, top: 0, width: 4, height: 4 },
    { left: 0, top: 0, width: 6, height: 4 },
    { originDelta: { x: -2, y: 0 }, renderedScale: 0.08 },
  );
  const liveRectangle = projectCroppedMediaRectangle(
    { left: 0, top: 0, width: 6, height: 4 },
    { width: 100, height: 100 },
    liveReframe,
  );
  assert.deepEqual({
    left: 10 + previousRectangle.left,
    top: 3 + previousRectangle.top,
    width: previousRectangle.width,
    height: previousRectangle.height,
  }, {
    left: 8 + liveRectangle.left,
    top: 3 + liveRectangle.top,
    width: liveRectangle.width,
    height: liveRectangle.height,
  });
});
