import assert from 'node:assert/strict'; import test from 'node:test';
import { canBeginReaction, completeReaction, enqueueManualReplay, enqueueReaction, getCompletionCooldown, MANUAL_REPLAY_COOLDOWN_MS, REACTION_COOLDOWN_MS } from './reactionDirector.js';

test('reaction queue suppresses duplicates and remains bounded', () => {
  let queue = []; for (let i = 0; i < 9; i += 1) queue = enqueueReaction(queue, { id: String(i), timestamp: i }, { limit: 3 });
  queue = enqueueReaction(queue, { id: '8', timestamp: 99 }, { limit: 3 });
  assert.deepEqual(queue.map((entry) => entry.id), ['8', '7', '6']);
});
test('cooldown and interruption gates delay reactions', () => {
  assert.equal(canBeginReaction({ now: 100, cooldownUntil: 101, interfaceReady: true }), false);
  assert.equal(canBeginReaction({ now: 102, cooldownUntil: 101, interfaceReady: true, actorMoving: true }), false);
  assert.equal(canBeginReaction({ now: 102, cooldownUntil: 101, interfaceReady: true }), true);
  assert.deepEqual(completeReaction(100, 20), { currentReaction: null, cooldownUntil: 120 });
});
test('queued manual replays use a short visible handoff instead of the automatic cooldown', () => {
  assert.equal(getCompletionCooldown([{ id: 'manual', manualReplay: true }]), MANUAL_REPLAY_COOLDOWN_MS);
  assert.equal(getCompletionCooldown([{ id: 'automatic' }]), REACTION_COOLDOWN_MS);
  assert.equal(getCompletionCooldown([]), REACTION_COOLDOWN_MS);
});
test('manual replays are FIFO ahead of automatic activity and cannot be queued twice', () => {
  let queue = [{ id: 'automatic', timestamp: 99 }];
  queue = enqueueManualReplay(queue, { id: 'first', timestamp: 1 });
  queue = enqueueManualReplay(queue, { id: 'second', timestamp: 2 });
  queue = enqueueManualReplay(queue, { id: 'second', timestamp: 2 });
  assert.deepEqual(queue.map((entry) => entry.id), ['first', 'second', 'automatic']);
});
