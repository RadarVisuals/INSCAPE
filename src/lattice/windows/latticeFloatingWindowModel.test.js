import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampLatticeFloatingWindowPosition,
  clampLatticeFloatingWindowSize,
  initialLatticeFloatingWindowPosition,
  initialLatticeFloatingWindowSize,
  moveLatticeFloatingWindow,
  positionLatticeFloatingWindowAfterCenteredResize,
  resizeLatticeFloatingWindowAroundCenter,
  resizeLatticeFloatingWindowByKey,
  resizeLatticeFloatingWindowRightEdge,
} from './latticeFloatingWindowModel.js';

test('floating-window defaults preserve the production Browser geometry', () => {
  assert.deepEqual(initialLatticeFloatingWindowSize({ width: 1440, height: 900 }), { width: 1040, height: 680 });
  assert.deepEqual(initialLatticeFloatingWindowPosition(
    { width: 1040, height: 680 },
    { width: 1440, height: 900 },
  ), { left: 200, top: 110 });
  assert.deepEqual(initialLatticeFloatingWindowSize({ width: 600, height: 500 }), { width: 580, height: 480 });
});

test('floating windows remain completely contained at desktop and narrow viewport sizes', () => {
  assert.deepEqual(clampLatticeFloatingWindowPosition(
    { left: -200, top: 2000 },
    { width: 1040, height: 680 },
    { width: 1440, height: 900 },
  ), { left: 10, top: 210 });
  assert.deepEqual(clampLatticeFloatingWindowSize(
    { width: 1040, height: 680 },
    { width: 640, height: 720 },
  ), { width: 620, height: 680 });
  assert.deepEqual(clampLatticeFloatingWindowSize(
    { width: 1040, height: 680 },
    { width: 390, height: 844 },
  ), { width: 370, height: 680 });
  assert.deepEqual(clampLatticeFloatingWindowPosition(
    { left: 50, top: 50 },
    { width: 370, height: 680 },
    { width: 390, height: 844 },
  ), { left: 10, top: 50 });
});

test('free movement applies pointer delta and clamps all viewport edges', () => {
  const viewport = { width: 1200, height: 800 };
  const size = { width: 800, height: 500 };
  assert.deepEqual(moveLatticeFloatingWindow(
    { left: 200, top: 100 }, { x: 75, y: 45 }, size, viewport,
  ), { left: 275, top: 145 });
  assert.deepEqual(moveLatticeFloatingWindow(
    { left: 200, top: 100 }, { x: -1000, y: 1000 }, size, viewport,
  ), { left: 10, top: 290 });
});

test('centered pointer and keyboard resizing preserve the window center until clamped', () => {
  const viewport = { width: 1200, height: 800 };
  const current = { width: 800, height: 500 };
  const next = resizeLatticeFloatingWindowAroundCenter(current, { x: 50, y: 25 }, viewport);
  assert.deepEqual(next, { width: 900, height: 550 });
  assert.deepEqual(positionLatticeFloatingWindowAfterCenteredResize(
    { left: 200, top: 100 }, current, next, viewport,
  ), { left: 150, top: 75 });
  assert.deepEqual(resizeLatticeFloatingWindowByKey(current, 'ArrowRight', viewport), { width: 824, height: 500 });
  assert.deepEqual(resizeLatticeFloatingWindowByKey(current, 'ArrowDown', viewport), { width: 800, height: 524 });
  assert.equal(resizeLatticeFloatingWindowByKey(current, 'Enter', viewport), null);
});

test('right-edge Rack resizing changes only width and leaves its origin independently clamped', () => {
  const viewport = { width: 1200, height: 800 };
  assert.deepEqual(resizeLatticeFloatingWindowRightEdge(
    { width: 800, height: 500 }, 75, viewport,
  ), { width: 875, height: 500 });
  assert.deepEqual(resizeLatticeFloatingWindowRightEdge(
    { width: 800, height: 500 }, 5000, viewport,
  ), { width: 1180, height: 500 });
  assert.deepEqual(clampLatticeFloatingWindowPosition(
    { left: 300, top: 100 }, { width: 875, height: 500 }, viewport,
  ), { left: 300, top: 100 });
});
