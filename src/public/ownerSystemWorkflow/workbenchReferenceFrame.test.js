import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKBENCH_REFERENCE_FRAME, constrainWorkbenchFrameCamera, fitWorkbenchReferenceFrame, projectWorkbenchReferenceFrame } from './workbenchReferenceFrame.js';
import { zoomWorkbenchCamera } from './workbenchViewScale.js';

test('fit centres the same reference area at desktop, narrow and short viewport sizes', () => {
  for (const viewport of [{ width: 1920, height: 950 }, { width: 1440, height: 820 },
    { width: 390, height: 710 }, { width: 320, height: 550 }, { width: 800, height: 240 }]) {
    const camera = fitWorkbenchReferenceFrame(viewport);
    const frame = projectWorkbenchReferenceFrame(camera.scale, camera.offset, 2);
    assert.ok(frame.left >= 0 && frame.top >= 0);
    assert.ok(frame.left + frame.width <= viewport.width && frame.top + frame.height <= viewport.height);
    assert.ok(Math.abs(frame.left + frame.width / 2 - viewport.width / 2) <= .5);
    assert.ok(Math.abs(frame.top + frame.height / 2 - viewport.height / 2) <= .5);
    assert.ok(Math.abs(frame.width / camera.scale - WORKBENCH_REFERENCE_FRAME.width) <= 3);
    assert.ok(Math.abs(frame.height / camera.scale - WORKBENCH_REFERENCE_FRAME.height) <= 3);
  }
  assert.equal(fitWorkbenchReferenceFrame({ width: 0, height: 800 }), null);
});

test('custom portrait, landscape and maximum frames fit using their actual dimensions', () => {
  for (const size of [{ width: 1080, height: 1920 }, { width: 2560, height: 1440 }, { width: 7944, height: 7944 }]) {
    const frame = { ...WORKBENCH_REFERENCE_FRAME, ...size };
    for (const viewport of [{ width: 1440, height: 820 }, { width: 320, height: 550 }]) {
      const camera = fitWorkbenchReferenceFrame(viewport, frame);
      const projected = projectWorkbenchReferenceFrame(camera.scale, camera.offset, 2, frame);
      assert.ok(projected.left >= 0 && projected.top >= 0);
      assert.ok(projected.left + projected.width <= viewport.width);
      assert.ok(projected.top + projected.height <= viewport.height);
      assert.ok(Math.abs(projected.width - size.width * camera.scale) <= .5);
      assert.ok(Math.abs(projected.height - size.height * camera.scale) <= .5);
    }
  }
});

test('reference and artwork coordinates retain their relationship through camera changes', () => {
  const frame = WORKBENCH_REFERENCE_FRAME, point = { x: frame.left + 360, y: frame.top + 225 };
  for (const scale of [.25, .66, 1, 2]) {
    const offset = { x: -117, y: 209 }, bounds = projectWorkbenchReferenceFrame(scale, offset, 2);
    assert.ok(Math.abs((point.x * scale + offset.x - bounds.left) / bounds.width - .25) < .002);
    assert.ok(Math.abs((point.y * scale + offset.y - bounds.top) / bounds.height - .25) < .002);
  }
});

test('wheel zoom from a narrow fitted view never jumps to the normal 25% floor', () => {
  const fitted = fitWorkbenchReferenceFrame({ width: 320, height: 550 });
  assert.ok(fitted.scale < .25);
  const anchor = { x: 160, y: 275 };
  const zoomed = zoomWorkbenchCamera(fitted.scale, fitted.offset, fitted.scale * 1.04, anchor);
  assert.equal(zoomed.scale, fitted.scale * 1.04);
  const outward = zoomWorkbenchCamera(fitted.scale, fitted.offset, fitted.scale / 1.04, anchor);
  assert.deepEqual(outward, fitted);
});

test('fitted camera cannot wander or zoom out past the frame, including tiny and portrait frames', () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 550 }]) {
    for (const size of [{ width: 1440, height: 900 }, { width: 1080, height: 1920 }, { width: 1, height: 1 }, { width: 7944, height: 7944 }]) {
      const frame = { ...WORKBENCH_REFERENCE_FRAME, ...size };
      const fit = fitWorkbenchReferenceFrame(viewport, frame);
      for (const offset of [{ x: -100000, y: -100000 }, { x: 100000, y: 100000 }]) {
        assert.deepEqual(constrainWorkbenchFrameCamera({ scale: .00001, offset }, viewport, frame), fit);
        assert.deepEqual(constrainWorkbenchFrameCamera({ scale: fit.scale, offset }, viewport, frame), fit);
      }
      // Returning from detail zoom must recover even a fitted scale below 25%.
      const zoomed = zoomWorkbenchCamera(1, fit.offset, .00001, { x: 60, y: 80 }, fit.scale);
      assert.deepEqual(constrainWorkbenchFrameCamera(zoomed, viewport, frame), fit);
    }
  }
});

test('zoomed navigation stops at a quarter-frame margin on every edge', () => {
  const viewport = { width: 900, height: 600 };
  for (const frame of [WORKBENCH_REFERENCE_FRAME, { left: 48, top: 48, width: 800, height: 1200 }]) {
    const scale = 2;
    const low = constrainWorkbenchFrameCamera({ scale, offset: { x: -1e6, y: -1e6 } }, viewport, frame);
    const high = constrainWorkbenchFrameCamera({ scale, offset: { x: 1e6, y: 1e6 } }, viewport, frame);
    assert.equal(low.offset.x, viewport.width - (frame.left + frame.width * 1.25) * scale);
    assert.equal(low.offset.y, viewport.height - (frame.top + frame.height * 1.25) * scale);
    assert.equal(high.offset.x, -(frame.left - frame.width * .25) * scale);
    assert.equal(high.offset.y, -(frame.top - frame.height * .25) * scale);
    const centred = { scale, offset: { x: (viewport.width - frame.width * scale) / 2 - frame.left * scale,
      y: (viewport.height - frame.height * scale) / 2 - frame.top * scale } };
    assert.deepEqual(constrainWorkbenchFrameCamera(centred, viewport, frame), centred);
  }
});

test('a fitting axis remains centred while the other can pan for a tall frame', () => {
  const frame = { left: 48, top: 48, width: 200, height: 1920 }, viewport = { width: 1440, height: 900 };
  const camera = constrainWorkbenchFrameCamera({ scale: 1, offset: { x: 1e6, y: -1e6 } }, viewport, frame);
  assert.equal(camera.offset.x, (1440 - 200) / 2 - 48);
  assert.equal(camera.offset.y, 900 - (48 + 1920 * 1.25));
});
