import test from 'node:test';
import assert from 'node:assert/strict';
import { workbenchGroupLayout } from './workbenchGroupLayout.js';
test('temporary spreading is deterministic, bounded in work, proportion-preserving and does not rewrite module frames', () => {
  for (const width of [390, 1440]) for (const count of [0, 1, 2, 9, 128]) {
    const items = Array.from({ length: count }, (_, index) => ({ id: 'item-' + index, frame: { left: index * 600, top: index * 200, width: 80 + index * 9, height: 140 + index * 6 } }));
    const before = structuredClone(items), result = workbenchGroupLayout(items, { left: 100, top: 200 }, width);
    assert.deepEqual(result, workbenchGroupLayout(items, { left: 100, top: 200 }, width)); assert.deepEqual(items, before);
    assert.equal(Object.keys(result.rectangles).length, count);
    for (const item of items) {
      const rect = result.rectangles[item.id], transform = result.transforms[item.id];
      assert.ok(Math.abs(rect.width / rect.height - item.frame.width / item.frame.height) < 1e-9);
      assert.ok(transform.scale > 0 && transform.scale <= 1); assert.ok(rect.left >= 100 - 1e-7 && rect.top >= 200 - 1e-7);
      assert.ok(Math.abs(item.frame.left * transform.scale + transform.x - rect.left) < 1e-7);
    }
    const rectangles = Object.values(result.rectangles);
    for (let a = 0; a < rectangles.length; a++) for (let b = a + 1; b < rectangles.length; b++) {
      const x = rectangles[a], y = rectangles[b];
      assert.ok(x.left + x.width <= y.left || y.left + y.width <= x.left || x.top + x.height <= y.top || y.top + y.height <= x.top);
    }
  }
});
