import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeeperSnakeRig } from './keeperRig.js';
import { createKeeperSnakePose, stepKeeperSnakePose } from './keeperSnakeMotion.js';
import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

const parts = [
  { id: 'body', x: 900, y: 100, width: 200, height: 120 },
  { id: 'eye', x: 970, y: 145, width: 60, height: 60 },
  ...Array.from({ length: 38 }, (_, i) => ({ id: `segment-${i+1}`, x: 930 + Math.sin(i / 5) * 45,
    y: 230 + i * 40, width: 140, height: 60 })),
];
const rig = createKeeperSnakeRig(parts);
const segment = (pose, n) => pose.parts[rig.parts.findIndex(part => part.id === `segment-${n}`)];
function run(pose, seconds, path, fps = 60, options = {}) {
  for (let i = 1; i <= seconds * fps; i++) stepKeeperSnakePose(pose, rig, path(i / fps), 1 / fps, options);
  return pose;
}
const still = () => ({ x: 600, y: 400, vx: 0, vy: 0 });

test('Source order, curved chain tangents and the eye pivot survive raster normalization', () => {
  const shuffled = createKeeperSnakeRig([...parts].reverse());
  assert.deepEqual(shuffled, rig);
  assert.equal(rig.parts.at(-1).id, 'eye');
  assert.equal(rig.parts.at(-1).x, 0); assert.equal(rig.parts.at(-1).y, 0);
  assert.ok(rig.parts.slice(0, 38).every((part, i, all) => i === 0 || part.distance > all[i-1].distance));
  assert.ok(rig.parts.slice(0, 38).every(part => Number.isFinite(part.sourceHeading)));
});

test('Speed opens the chain, braking compacts it, head turns while eye remains upright', () => {
  const pose = createKeeperSnakePose(rig);
  run(pose, 2, t => ({ x: 600 + t * 420, y: 400, vx: 420, vy: 0, heading: 0 }));
  const expanded = Math.hypot(segment(pose, 15).x, segment(pose, 15).y);
  assert.ok(pose.stretch > .99);
  assert.equal(pose.parts.at(-1).angle, 0);
  assert.ok(Math.abs(pose.parts.at(-2).angle - Math.PI / 2) < .001);
  run(pose, 2, () => ({ x: 1440, y: 400, vx: 0, vy: 0, heading: 0 }));
  assert.ok(pose.stretch < .001);
  assert.ok(Math.hypot(segment(pose, 15).x, segment(pose, 15).y) < expanded * .8);
  const moving = pose.parts.map(part => ({ ...part }));
  run(pose, .4, () => ({ x: 1440, y: 400, vx: 0, vy: 0, heading: Math.PI }));
  assert.ok(Math.abs(pose.parts.at(-2).angle - moving.at(-2).angle) > 1);
  assert.equal(pose.parts.at(-1).angle, 0);
});

test('A corner propagates down the chain instead of rotating every segment as a group', () => {
  const pose = createKeeperSnakePose(rig);
  run(pose, 2, t => ({ x: 600 + t * 200, y: 400, vx: 200, vy: 0, heading: 0 }));
  run(pose, .3, t => ({ x: 1000, y: 400 - t * 200, vx: 0, vy: -200, heading: -Math.PI / 2 }));
  assert.ok(Math.abs(segment(pose, 1).x) < .03, 'neck follows the new vertical track');
  assert.ok(segment(pose, 38).x < -.25, 'tail is still on the previous horizontal track');
  assert.ok(Math.abs(segment(pose, 1).angle - segment(pose, 38).angle) > .4);
});

test('30/60/120 Hz travel agrees and path history stays bounded during turns and idle', () => {
  const path = t => ({ x: 600 + 120 * Math.cos(t), y: 400 + 120 * Math.sin(t),
    vx: -120 * Math.sin(t), vy: 120 * Math.cos(t), heading: t + Math.PI / 2 });
  const poses = [30, 60, 120].map(fps => run(createKeeperSnakePose(rig), 8, path, fps));
  for (const pose of poses) {
    assert.ok(pose.trail.length < 600);
    pose.parts.forEach((part, i) => assert.ok(Math.hypot(part.x - poses[1].parts[i].x, part.y - poses[1].parts[i].y) < .025));
  }
  const pose = poses[1];
  run(pose, 60, () => path(8));
  assert.ok(pose.trail.length < 600);
});

test('Live resize, viewport edges and reduced motion preserve a finite contained pose', () => {
  const pose = run(createKeeperSnakePose(rig), 2, still);
  const frozen = structuredClone(pose);
  run(pose, 2, still, 60, { reducedMotion: true });
  assert.deepEqual(pose, frozen);
  const bounds = { left: 8, top: 24, right: 382, bottom: 652 };
  run(pose, 3, t => ({ x: 190, y: 340 + Math.sin(t) * 80, vx: 0, vy: 200, heading: Math.PI / 2 }), 60,
    { size: 200, bounds, swim: { ...KEEPER_SWIM_DEFAULTS, speed: 900 } });
  pose.parts.forEach((part, i) => {
    assert.ok([part.x, part.y, part.angle].every(Number.isFinite));
    const radius = Math.hypot(rig.parts[i].width, rig.parts[i].height) * 100;
    const x = pose.origin.x + part.x * 200, y = pose.origin.y + part.y * 200;
    assert.ok(x - radius >= bounds.left - .01 && x + radius <= bounds.right + .01);
    assert.ok(y - radius >= bounds.top - .01 && y + radius <= bounds.bottom + .01);
  });
});
