import test from 'node:test';
import assert from 'node:assert/strict';
import { keeperReaction, keeperReactionContext } from './keeperReactions.js';
import { beginKeeperReaction, createKeeperMotion, releaseKeeper, returnKeeper, stepKeeper, stopKeeperReaction, steerKeeper } from './keeperMotion.js';
import { captureKeeperScene } from './keeperScene.js';

const bounds = { left: 100, right: 900, top: 100, bottom: 600 }, home = { x: 500, y: 350 };
function run(state, seconds, dt = 1 / 60, paused = true) {
  for (let t = 0; t < seconds - dt / 2; t += dt) stepKeeper(state, { dt, paused, bounds, home, movement: 'swim' });
}
const released = () => { const state = createKeeperMotion(home); releaseKeeper(state); return state; };

test('manual steering during chat overrides a gesture, reaches its destination and then holds still', () => {
  const state = released();
  beginKeeperReaction(state, 'retreat', { x: 800, y: 350 }, bounds, 320);
  run(state, .4);
  steerKeeper(state, { x: 800, y: 500 });
  assert.equal(state.reaction, null);
  assert.equal(beginKeeperReaction(state, 'curious', null, bounds), false, 'a reply cannot interrupt manual steering');
  run(state, 5);
  assert.equal(state.steering, false); assert.equal(state.x, 800); assert.equal(state.y, 500);
  run(state, 2); assert.equal(state.x, 800); assert.equal(state.vx, 0);
  steerKeeper(state, { x: -5000, y: 9000 }); run(state, 5);
  assert.equal(state.x, bounds.left); assert.equal(state.y, bounds.bottom);
  returnKeeper(state); assert.equal(state.steering, false);
});

test('gestures are allowlisted and scene context excludes arbitrary metadata and instructions', () => {
  const scene = keeperReactionContext({ gestures: true, pointer: true, secret: 'private', artworks: [
    { id: 'art-1', title: 'A'.repeat(200), direction: 'left', distance: 'near', url: 'private' },
    { id: 'art-1', title: 'duplicate' }, { id: 'anything', title: 'unknown' }, null,
  ] });
  assert.equal(scene.artworks.length, 1); assert.equal(scene.artworks[0].title.length, 120);
  assert.ok(!JSON.stringify(scene).includes('private'));
  assert.deepEqual(keeperReaction({ gesture: 'retreat', target: 'art-1' }, scene), { gesture: 'retreat', target: 'art-1' });
  for (const action of [{ gesture: 'delete', target: 'art-1' }, { gesture: 'approach', target: 'art-8' }, { gesture: 'curious', target: 'pointer' }])
    assert.equal(keeperReaction(action, scene), null);
  assert.equal(keeperReaction({ gesture: 'startled', target: 'none' }, { ...scene, reducedMotion: true }), null);
  assert.equal(keeperReaction({ gesture: 'approach', target: 'pointer' }, { ...scene, gestures: false }), null);
});

test('approach and retreat animate while talking, keep user destinations and stay bounded', () => {
  for (const gesture of ['approach', 'retreat']) {
    const state = released(); state.destination = { x: 750, y: 450 };
    assert.equal(beginKeeperReaction(state, gesture, { x: 800, y: 350 }, bounds, 320), true);
    run(state, 1.5);
    assert.ok(gesture === 'approach' ? state.x > 530 : state.x < 470);
    assert.equal(state.heading, 0, 'retreat still faces the subject');
    assert.deepEqual(state.destination, { x: 750, y: 450 });
    run(state, 2); assert.equal(state.reaction, null); assert.equal(state.expression, null);
    assert.ok(state.x >= bounds.left && state.x <= bounds.right);
    assert.ok(Math.abs(state.x - home.x) <= 160.1);
  }
});

test('gestures settle consistently across refresh rates and cancel on recall or resumed travel', () => {
  const slow = released(), fast = released();
  for (const state of [slow, fast]) beginKeeperReaction(state, 'retreat', { x: 800, y: 350 }, bounds, 320);
  run(slow, 1, 1 / 30); run(fast, 1, 1 / 120); assert.ok(Math.abs(slow.x - fast.x) < .5);
  returnKeeper(slow); assert.equal(slow.reaction, null);
  run(fast, 1 / 60, 1 / 60, false); assert.equal(fast.reaction, null);
  const docked = createKeeperMotion(home); assert.equal(beginKeeperReaction(docked, 'curious', null, bounds), false);
  const state = released(); beginKeeperReaction(state, 'startled', null, bounds); run(state, .5);
  assert.ok(state.expression.amount > 0); stopKeeperReaction(state); run(state, .2); assert.equal(state.x, home.x);
});

test('scene reads only published DOM cues in this host and invalidates removed or replaced artwork', () => {
  const rect = { left: 100, right: 300, top: 100, bottom: 300 };
  const win = { innerWidth: 1000, innerHeight: 700, getComputedStyle: () => ({ overflowX: 'visible', overflowY: 'visible' }) };
  const nodes = [];
  const host = { isConnected: true, ownerDocument: { defaultView: win }, contains: node => nodes.includes(node), querySelectorAll: () => nodes };
  const node = { parentElement: host, dataset: { artworkContextId: 'image:one', artworkContextTitle: 'Night visitor' },
    checkVisibility: () => true, getBoundingClientRect: () => rect };
  nodes.push(node, { ...node, checkVisibility: () => false });
  const snapshot = captureKeeperScene(host, home, null, { gestures: true, shareArtwork: true, layered: true });
  assert.deepEqual(snapshot.scene.artworks, [{ id: 'art-1', title: 'Night visitor', direction: 'left, above', distance: 'near' }]);
  const action = { gesture: 'approach', target: 'art-1' };
  assert.deepEqual(snapshot.resolve(action).point, { x: 200, y: 200 });
  node.dataset.artworkContextId = 'replacement'; assert.equal(snapshot.resolve(action), null);
  assert.deepEqual(captureKeeperScene(host, home, null, { shareArtwork: false }).scene.artworks, []);
  nodes.length = 0; assert.equal(snapshot.resolve(action), null);
});
