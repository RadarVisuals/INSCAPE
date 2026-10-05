import test from 'node:test';
import assert from 'node:assert/strict';
import { readOctopusPath, octopusPath, mapOctopusPath } from './keeperOctopusRig.js';
import { createKeeperOctopusPose, stepKeeperOctopusPose } from './keeperOctopusMotion.js';
import { stepKeeperSvgPose } from './keeperSvgMotion.js';
import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

const shape = d => { const commands = readOctopusPath(d); return { commands, d: octopusPath(commands) }; };
const rig = {
  tentacles: [{ ...shape('M-30 0 C-30 60 -10 200 0 200 C10 200 30 60 30 0 Z'), root: { x: 0, y: 0 }, tip: { x: 0, y: 200 } }],
  eyes: [{ aperture: shape('M-20 -10 C-10 -20 10 -20 20 -10 C10 10 -10 10 -20 -10 Z'), center: { x: 0, y: -5 }, bounds: { left: -20, top: -20, right: 20, bottom: 10 } }],
};
const motion = { x: 500, y: 400, vx: 0, vy: 0, heading: 0 };
function run(pose, state, options = {}, frames = 180) {
  for (let i = 0; i < frames; i++) stepKeeperSvgPose(pose, rig, state, 1 / 60, options);
}

test('SVG float matches the four reference directions without mirroring either source facing', () => {
  for (const faces of ['left', 'right']) {
    const pose = createKeeperOctopusPose(rig);
    for (const [heading, expectedBank] of [[-Math.PI / 2, 0], [Math.PI, -35 * Math.PI / 180], [-Math.PI / 4, 0], [Math.PI * .75, -1.64]]) {
      const vx = Math.cos(heading) * 420, vy = Math.sin(heading) * 420;
      run(pose, { ...motion, heading, vx, vy }, { faces });
      assert.ok(Math.abs(Math.atan2(Math.sin(pose.headAngle - expectedBank), Math.cos(pose.headAngle - expectedBank))) < .01);
      const tip = pose.tentacles[0].tip, length = Math.hypot(tip.x, tip.y);
      assert.ok(-(tip.x * vx + tip.y * vy) / (length * 420) > .95, 'tentacles stream opposite travel');
      assert.equal(pose.scaleX, 1, 'the authored head and eye arrangement never mirror');
      const eye = pose.eyes[0], c = Math.cos(pose.headAngle), s = Math.sin(pose.headAngle);
      assert.ok((eye.x * c - eye.y * s) * vx + (eye.x * s + eye.y * c) * vy > 0, 'eyes look toward travel');
    }
    run(pose, motion, { faces });
    assert.ok(Math.abs(Math.sin(pose.headAngle)) < .001 && Math.cos(pose.headAngle) > .99, 'braking settles back to the authored pose');
  }
});

test('Trailing retains the authored tentacle fan instead of squeezing every tip into the same line', () => {
  const fanRig = { ...rig, tentacles: [-.5, 0, .5].map(angle => {
    const rotate = (x, y) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
    const commands = mapOctopusPath(rig.tentacles[0].commands, rotate), [x, y] = rotate(0, 200);
    return { ...rig.tentacles[0], commands, d: octopusPath(commands), tip: { x, y } };
  }) };
  const pose = createKeeperOctopusPose(fanRig);
  for (let i = 0; i < 180; i++) stepKeeperSvgPose(pose, fanRig, { ...motion, heading: -Math.PI / 2, vy: -420 }, 1 / 60);
  const angles = pose.tentacles.map(t => Math.atan2(t.tip.y, t.tip.x));
  assert.ok(Math.max(...angles) - Math.min(...angles) > .8);
});

test('Eyes resume pointer attention at rest and detached goo keeps screen gravity through a bank', () => {
  const pose = createKeeperOctopusPose(rig), options = { size: 384, pointer: { x: 800, y: 300 } };
  run(pose, { ...motion, heading: Math.PI }, options, 96);
  assert.equal(pose.scaleX, 1);
  assert.ok(pose.eyes[0].x > 0 && pose.eyes[0].y < 0);
  const drop = pose.drops[0]; assert.ok(drop);
  const before = { x: drop.x, y: drop.y };
  stepKeeperSvgPose(pose, rig, { ...motion, x: 650, heading: 0, vx: 420 }, .016, options);
  assert.ok(Math.abs(drop.x - before.x) < 1 && drop.y > before.y);
  assert.equal(drop.localX, (drop.x - 650) * 1000 / 384);
  run(pose, { ...motion, heading: -Math.PI / 2, vy: -420 }, options);
  assert.ok(Math.abs(pose.headAngle) < .001, 'upward travel levels the head');
  stepKeeperSvgPose(pose, rig, motion, .016, { reducedMotion: true });
  assert.equal(pose.scaleX, 1); assert.equal(pose.headAngle, 0); assert.equal(pose.drops.length, 0);
});

test('Float respects live response tuning; Layered swim still makes full head turns', () => {
  const fast = createKeeperOctopusPose(rig), slow = createKeeperOctopusPose(rig), layered = createKeeperOctopusPose(rig);
  const left = { ...motion, heading: Math.PI, vx: -420 };
  run(fast, left, { swim: { ...KEEPER_SWIM_DEFAULTS, turnSeconds: .1 } }, 15);
  run(slow, left, { swim: { ...KEEPER_SWIM_DEFAULTS, turnSeconds: 2 } }, 15);
  assert.ok(fast.angle < slow.angle);
  for (let frame = 0; frame < 240; frame++) stepKeeperOctopusPose(layered, rig, left, 1 / 60);
  assert.ok(Math.abs(layered.headAngle - Math.PI) < .001);
  assert.equal(layered.scaleX, 1);
});

test('Circling through downward travel never mirrors, snaps at the angle wrap or emits non-finite paths', () => {
  const pose = createKeeperOctopusPose(rig);
  for (let i = 0; i < 900; i++) {
    const heading = -Math.PI / 2 + i / 900 * Math.PI * 4, previous = pose.headAngle;
    stepKeeperSvgPose(pose, rig, { ...motion, heading, vx: Math.cos(heading) * 420, vy: Math.sin(heading) * 420 }, 1 / 60);
    assert.equal(pose.scaleX, 1);
    assert.ok(Math.abs(pose.headAngle - previous) < .15, 'continuous banking across straight down');
    assert.ok(!/NaN|Infinity/.test(pose.tentacles[0].d));
  }
});
