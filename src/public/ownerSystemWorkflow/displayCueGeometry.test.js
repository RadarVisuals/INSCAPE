import test from 'node:test';
import assert from 'node:assert/strict';
import { cuePosition, cueBubbleRectangle } from './displayCueGeometry.js';
import { displayLiftRectangle } from './displayLiftGeometry.js';

test('cue offsets follow placement movement and resize without changing geometry', () => {
  const offset = { x: .8, y: .2 }, bounds = { width: 960, height: 540 };
  assert.deepEqual(cuePosition({ x: 100, y: 100, width: 200, height: 200 }, offset, bounds), { x: 260, y: 140 });
  assert.deepEqual(cuePosition({ x: 150, y: 100, width: 400, height: 400 }, offset, bounds), { x: 470, y: 180 });
});
test('foldouts remain bounded at corners of wide and narrow Displays', () => {
  for (const bounds of [{ width: 960, height: 540 }, { width: 350, height: 197 }]) {
    for (const x of [16, bounds.width / 2, bounds.width - 16]) for (const y of [42, bounds.height - 16]) {
      for (const direction of ['auto', 'left', 'right']) {
        const anchor = cuePosition({ x, y, width: 0, height: 0 }, { x: 0, y: 0 }, bounds);
        const { style: result, upward, collapseSide } = cueBubbleRectangle(anchor, bounds, direction);
        const top = upward ? bounds.height - result.bottom - result.maxHeight : result.top;
        assert.ok(result.left >= 8 && top >= 42);
        assert.ok(result.left + result.width <= bounds.width - 8);
        assert.ok(top + result.maxHeight <= bounds.height - 8);
        assert.equal(result.left + (collapseSide === 'left' ? 26 : result.width - 26), anchor.x);
        assert.equal(upward ? bounds.height - result.bottom - 24 : result.top + 24, anchor.y);
      }
    }
  }
});

test('Lift cue uses fitted artwork proportions and remains bounded after resize and rotation', () => {
  for (const viewport of [{ width: 960, height: 540 }, { width: 350, height: 197 }]) {
    for (const quarterTurns of [0, 1]) {
      const entry = { focusDimensions: { width: 600, height: 900 }, placement: { transform: { quarterTurns } } };
      const fitted = displayLiftRectangle(entry, viewport);
      assert.ok(Math.abs(fitted.width / fitted.height - (quarterTurns ? 1.5 : 2 / 3)) < .0001);
      const anchor = cuePosition({ x: fitted.left, y: fitted.top, ...fitted }, { x: .98, y: .12 }, viewport);
      assert.ok(anchor.x > viewport.width / 2 && anchor.x <= viewport.width - 16);
      assert.ok(anchor.y >= 42 && anchor.y <= viewport.height - 16);
    }
  }
});
