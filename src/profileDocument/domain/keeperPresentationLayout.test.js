import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveKeeperBubblePlacement } from './keeperPresentationLayout.js';

test('Keeper bubble prefers the right with the full authored gap', () => {
  assert.deepEqual(resolveKeeperBubblePlacement({ actorX: 200, viewportWidth: 1280 }), { side: 'right', left: 352 });
});
test('Keeper bubble flips left before it would leave the viewport', () => {
  assert.deepEqual(resolveKeeperBubblePlacement({ actorX: 1100, viewportWidth: 1280 }), { side: 'left', left: 632 });
});

test('Keeper bubble clamps inside the viewport only when neither side can preserve the gap', () => {
  assert.deepEqual(resolveKeeperBubblePlacement({ actorX: 310, viewportWidth: 457 }), { side: 'left', left: 18 });
});
