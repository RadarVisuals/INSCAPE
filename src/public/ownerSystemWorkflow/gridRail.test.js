import test from 'node:test';
import assert from 'node:assert/strict';
import { gridRailScenes } from './gridRail.js';

test('incoming artwork keeps its physical slot across forward, backward and wrapped handoffs', () => {
  for (const count of [2, 3, 6, 24]) for (const direction of ['next', 'previous']) {
    const step = direction === 'next' ? 1 : -1;
    const id = index => String(((index % count) + count) % count);
    const grids = Array.from({ length: count }, (_, index) => ({ id: id(index) }));
    const scene = index => gridRailScenes(grids, id(index), index);
    for (let index = -count * 2; index < count * 2; index++) {
      const before = scene(index), after = scene(index + step);
      assert.equal(before.length, 5);
      assert.equal(new Set(before.map(scene => scene.slot)).size, 5);
      for (const appearance of before) {
        const retained = after.find(scene => scene.slot === appearance.slot);
        if (retained) assert.equal(retained.grid, appearance.grid);
      }
      assert.equal(before.find(scene => scene.slot === index + step).grid.id, id(index + step));
      assert.equal(before.find(scene => scene.slot === index + 2 * step).grid.id, id(index + 2 * step));
    }
  }
});

test('one Grid has one appearance and an unavailable source has none', () => {
  const grid = { id: 'only' };
  assert.deepEqual(gridRailScenes([grid], grid.id), [{ grid, slot: 0 }]);
  assert.deepEqual(gridRailScenes([grid], 'missing'), []);
  assert.deepEqual(gridRailScenes([], 'missing'), []);
});
