import test from 'node:test';
import assert from 'node:assert/strict';
import { clampWorkbenchMove, identityWorkbenchTransform, scaleWorkbenchTransform, stepWorkbenchViewScale, workbenchSelectionBounds, workbenchViewStyle, zoomWorkbenchCamera } from './workbenchViewScale.js';

test('camera zoom preserves the world point beneath the cursor through reversal and limits', () => {
  const origin = { x: -1200, y: 341 }, anchor = { x: 713, y: 208 };
  for (const requested of [.01, .37, 1.4, 8]) {
    const next = zoomWorkbenchCamera(.8, origin, requested, anchor);
    for (const axis of ['x', 'y']) assert.ok(Math.abs((anchor[axis] - next.offset[axis]) / next.scale - (anchor[axis] - origin[axis]) / .8) < 1e-8);
    assert.ok(next.scale >= .25 && next.scale <= 2);
    const restored = zoomWorkbenchCamera(next.scale, next.offset, .8, anchor);
    for (const axis of ['x', 'y']) assert.ok(Math.abs(restored.offset[axis] - origin[axis]) < 1e-8);
  }
});

test('movement clamps the visible group as one rectangle above the dock', () => {
  const rect = { left: 100, top: 50, width: 400, height: 250 }, viewport = { left: 8, top: 8, right: 1432, bottom: 950 };
  assert.deepEqual(clampWorkbenchMove(rect, { x: 2000, y: 2000 }, viewport), { x: 932, y: 650 });
  assert.deepEqual(clampWorkbenchMove(rect, { x: -2000, y: -2000 }, viewport), { x: -92, y: -42 });
  assert.deepEqual(clampWorkbenchMove(rect, { x: 600, y: 200 }, viewport), { x: 600, y: 200 });
});

test('group scaling preserves relative geometry around the opposite corner and reverses', () => {
  const anchor = { x: 1120, y: 680 }, transform = scaleWorkbenchTransform(identityWorkbenchTransform, .5, anchor);
  const rectangles = [{ left: 80, top: 140, width: 240, height: 540 }, { left: 320, top: 140, width: 800, height: 540 }];
  const result = rectangles.map(r => ({ left: r.left * transform.scale + transform.x, top: r.top * transform.scale + transform.y, width: r.width * transform.scale, height: r.height * transform.scale }));
  assert.equal(result[0].left + result[0].width, result[1].left);
  assert.deepEqual(workbenchSelectionBounds(result), { left: 600, top: 410, width: 520, height: 270 });
  assert.deepEqual(scaleWorkbenchTransform(transform, 2, anchor), identityWorkbenchTransform);
});

test('native zoom shares layout pixel edges while retaining logical content width', () => {
  for (const scale of [.25, .33, .5, .67, .75, .8, .9]) {
    const bounds = (left, width) => {
      const style = workbenchViewStyle(scale, left, 41.4, width, 540.3, 3.17, 1.13);
      assert.equal(style['--workbench-content-width'], `${width}px`);
      const matrix = style.transform.slice(7, -1).split(',').map(Number);
      const x = style.left + matrix[4], y = style.top + matrix[5];
      return { left: x * style.zoom, right: (x + style.width) * style.zoom,
        top: y * style.zoom, bottom: (y + style.height) * style.zoom };
    };
    const text = bounds(7.3, 279.7), display = bounds(287, 960.3);
    assert.ok(Math.abs(text.right - display.left) < 1 / 64);
    assert.deepEqual([text.top, text.bottom], [display.top, display.bottom]);
    for (const edge of Object.values(text)) assert.ok(Math.abs(edge - Math.round(edge)) < 1 / 64);
  }
});

test('view zoom steps stop at their limits and return to 100%', () => {
  assert.equal(stepWorkbenchViewScale(.25, -1), .25);
  assert.equal(stepWorkbenchViewScale(1, 1), 1);
  assert.equal(stepWorkbenchViewScale(.67, -1), .5);
  assert.equal(stepWorkbenchViewScale(.9, 1), 1);
});
