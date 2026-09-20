import test from 'node:test';
import assert from 'node:assert/strict';
import { gridRailSlot } from './gridRail.js';

test('incoming artwork keeps its physical slot across forward, backward and wrapped handoffs', () => {
  for (const count of [2, 3, 6, 24]) for (const direction of ['next', 'previous']) {
    const step = direction === 'next' ? 1 : -1;
    const id = index => String(((index % count) + count) % count);
    const scene = index => ({ sourceId: id(index), targetId: id(index + step), sourceSlot: index, direction,
      previousId: id(index - 1), nextId: id(index + 1), aheadId: id(index + 2), behindId: id(index - 2) });
    for (let index = -count * 2; index < count * 2; index++) {
      const incoming = id(index + step);
      assert.equal(gridRailSlot(incoming, scene(index)), gridRailSlot(incoming, scene(index + step)));
      if (count > 2) {
        const prepared = id(index + step * 2);
        assert.equal(gridRailSlot(prepared, scene(index)), gridRailSlot(prepared, scene(index + step)));
      }
    }
  }
});
