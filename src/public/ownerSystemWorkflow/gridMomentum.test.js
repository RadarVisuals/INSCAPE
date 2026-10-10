import test from 'node:test';
import assert from 'node:assert/strict';
import { gridLanding } from './gridMomentum.js';
import { createGridCameraTransport, GRID_PLAYBACK_SLIDE_MS } from './gridCameraTransport.js';

test('held releases choose the nearest seam; a flick projects its direction and speed', () => {
  for (const sign of [-1, 1]) {
    assert.equal(gridLanding(sign * .2, 0).target, 0);
    assert.equal(gridLanding(sign * .7, 0).target, sign);
    assert.equal(gridLanding(sign * .2, sign * .002).target, sign);
    assert.equal(gridLanding(sign * .7, -sign * .002).target, 0);
    const moving = gridLanding(sign * .3, sign * .001);
    assert.ok(Math.abs(moving.sample(0).velocity - sign * .001) < 1e-12);
    assert.equal(Math.abs(gridLanding(sign * .7, 0).sample(0).velocity), 0);
  }
});
test('landing is bounded, monotonic and reaches an exact seam at zero speed in either direction', () => {
  for (const position of [-25.8, -1, -.99, -.5, -.1, 0, .1, .5, .99, 1, 25.8]) for (const velocity of [-.002, -.0001, 0, .0001, .002]) {
    const landing = gridLanding(position, velocity);
    assert.equal(Number.isInteger(landing.target), true);
    assert.ok(Math.abs(landing.distance) <= 1.22);
    let previous = 0;
    for (let time = 0; time <= landing.duration; time++) {
      const state = landing.sample(time);
      assert.ok(Math.sign(landing.distance) * (state.distance - previous) >= -1e-12);
      assert.ok(Math.abs(state.distance) <= Math.abs(landing.distance) + 1e-12);
      previous = state.distance;
    }
    const end = landing.sample(landing.duration);
    assert.equal(position + end.distance, landing.target);
    assert.equal(Math.abs(end.velocity), 0);
    assert.equal(end.done, true);
    assert.deepEqual(landing.sample(landing.duration + 100), end);
  }
});
test('the native camera clock owns elapsed motion and takeover retains its actual position', () => {
  const animations = [];
  const node = { style: {}, ownerDocument: { timeline: { currentTime: 100 } }, animate(keyframes, options) {
    const animation = { currentTime: 0, keyframes, options, cancel() { this.cancelled = true; } };
    animations.push(animation); return animation;
  } };
  const coast = createGridCameraTransport(node, -.83, 'coast', -.0005);
  coast.animation.currentTime = 80;
  const observed = coast.sample();
  assert.ok(observed.position < -.83 && observed.position > -1, 'takeover observes the in-flight landing');
  assert.equal(animations.length, 1, 'crossing does not start a new trajectory');
  assert.equal(coast.animation.startTime, 100);
  coast.cancel();
  assert.ok(coast.animation.cancelled);
  assert.ok(node.style.transform.includes(String(observed.position * 100)));
  const play = createGridCameraTransport(node, observed.position, 'play');
  play.animation.currentTime = GRID_PLAYBACK_SLIDE_MS * 2.25;
  assert.equal(play.sample().position, observed.position - 2.25);
  assert.equal(play.sample().velocity, -1 / GRID_PLAYBACK_SLIDE_MS);
  const follower = { ...node, style: {} };
  const release = play.follow(follower, position => `translateX(${position * 100}%)`);
  const followerAnimation = animations.at(-1);
  assert.equal(followerAnimation.startTime, play.animation.startTime);
  assert.equal(followerAnimation.options.duration, play.animation.options.duration);
  play.cancel();
  assert.ok(play.animation.cancelled);
  assert.ok(followerAnimation.cancelled);
  assert.equal(follower.style.transform, `translateX(${play.sample().position * 100}%)`);
  release(); // A subscriber can dispose after its camera already stopped.
  const landing = createGridCameraTransport(node, -20.83, 'coast', -.0005);
  landing.animation.currentTime = 1000;
  assert.equal(landing.sample().position, -21, 'native endpoint and observed endpoint are the same exact seam');
  assert.equal(createGridCameraTransport(node, -21, 'coast', 0), null, 'an aligned held release needs no animation');
});
