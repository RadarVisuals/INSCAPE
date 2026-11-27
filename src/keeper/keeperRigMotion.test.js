import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeeperRig } from './keeperRig.js';
import { createKeeperRigPose, stepKeeperRigPose } from './keeperRigMotion.js';
import { KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

const rig = createKeeperRig([
  { id: 'tentacle-1', x: 1027, y: 20, width: 436, height: 472 },
  { id: 'tentacle-2', x: 529, y: 279, width: 547, height: 329 },
  { id: 'tentacle-3', x: 143, y: 591, width: 662, height: 299 },
  { id: 'tentacle-4', x: 175, y: 930, width: 684, height: 300 },
  { id: 'tentacle-5', x: 129, y: 1267, width: 778, height: 431 },
  { id: 'tentacle-6', x: 525, y: 1508, width: 549, height: 400 },
  { id: 'tentacle-7', x: 1117, y: 1558, width: 372, height: 474 },
  { id: 'body', x: 896, y: 526, width: 881, height: 967 },
]);
const run = (pose, seconds, motion, hz = 60, options, artwork = rig) => {
  for (let i = 0; i < seconds * hz; i++) stepKeeperRigPose(pose, artwork, motion, 1 / hz, options);
};
test('Gather and spread controls respond promptly, remain smooth and follow actual speed', () => {
  const pose = createKeeperRigPose(rig);
  run(pose, .1, { vx: 420, vy: 0 }); assert.ok(pose.compression > .3 && pose.compression < .6);
  run(pose, .5, { vx: 420, vy: 0 }); assert.ok(pose.compression > .95);
  const tight = pose.compression; run(pose, .1, { vx: 0, vy: 0 });
  assert.ok(pose.compression > tight * .5 && pose.compression < tight * .8);
  run(pose, .6, { vx: 0, vy: 0 }); assert.ok(pose.compression < .06);
  const slow = createKeeperRigPose(rig); run(slow, 4, { vx: 105, vy: 0 });
  assert.ok(Math.abs(slow.compression - .25) < .001);
  const quick = createKeeperRigPose(rig), gentle = createKeeperRigPose(rig);
  const quickOptions = { swim: { ...KEEPER_SWIM_DEFAULTS, gatherSeconds: .1, spreadSeconds: .1 } };
  const gentleOptions = { swim: { ...KEEPER_SWIM_DEFAULTS, gatherSeconds: 2, spreadSeconds: 2 } };
  run(quick, .3, { vx: 420, vy: 0 }, 60, quickOptions); run(gentle, .3, { vx: 420, vy: 0 }, 60, gentleOptions);
  assert.ok(quick.compression > .99 && gentle.compression < .3);
  quick.compression = gentle.compression = 1;
  run(quick, .3, { vx: 0, vy: 0 }, 60, quickOptions); run(gentle, .3, { vx: 0, vy: 0 }, 60, gentleOptions);
  assert.ok(quick.compression < .01 && gentle.compression > .7);
});

test('Head turns first; tentacles orbit one by one, settle in the new direction and can remove the stagger', () => {
  const pose = createKeeperRigPose(rig), options = { swim: { ...KEEPER_SWIM_DEFAULTS, staggerSeconds: .1 } };
  const turning = { vx: 0, vy: 0, heading: Math.PI };
  run(pose, .05, turning, 60, options);
  assert.ok(pose.angle > .7, 'head starts even when travel has not started');
  assert.ok(pose.parts.slice(0, -1).every(p => p.heading === 0), 'tentacles wait behind the head');
  run(pose, .3, turning, 60, options);
  assert.ok(pose.parts[0].heading > pose.parts[1].heading && pose.parts[1].heading > pose.parts[2].heading);
  assert.equal(pose.parts[3].heading, 0, 'later tentacles have not begun turning');
  const body = pose.parts.at(-1), artBody = rig.parts.at(-1);
  pose.parts.slice(0, -1).forEach((part, i) => {
    const originalReach = Math.hypot(rig.parts[i].x - artBody.x, rig.parts[i].y - artBody.y);
    assert.ok(Math.hypot(part.x - body.x, part.y - body.y) > originalReach * .6, 'orbit does not take a straight shortcut across the head');
  });
  run(pose, 3, turning, 60, options);
  assert.ok(pose.parts.slice(0, -1).every(p => Math.abs(p.heading - Math.PI) < .001));
  assert.equal(pose.compression, 0, 'idle spread returns in the new direction');
  const together = createKeeperRigPose(rig);
  run(together, .3, turning, 60, { swim: { ...KEEPER_SWIM_DEFAULTS, staggerSeconds: 0 } });
  assert.ok(together.parts[0].heading > 1);
  assert.ok(together.parts.slice(0, -1).every(p => p.heading === together.parts[0].heading));
  const slowHead = createKeeperRigPose(rig), fastHead = createKeeperRigPose(rig);
  run(slowHead, .2, turning, 60, { swim: { ...KEEPER_SWIM_DEFAULTS, turnSeconds: 2 } });
  run(fastHead, .2, turning, 60, { swim: { ...KEEPER_SWIM_DEFAULTS, turnSeconds: .1 } });
  assert.ok(slowHead.angle < 1 && fastHead.angle > 3);
});
test('Idle parts move independently and reduced motion holds the complete pose still', () => {
  const pose = createKeeperRigPose(rig), before = structuredClone(pose);
  run(pose, 2, { vx: 0, vy: 0 });
  assert.equal(pose.compression, 0);
  const offsets = pose.parts.slice(0, -1).map((p, i) => `${(p.x - before.parts[i].x).toFixed(5)},${(p.y - before.parts[i].y).toFixed(5)}`);
  assert.equal(new Set(offsets).size, 7);
  const idle = structuredClone(pose); run(pose, 5, { vx: -240, vy: 0 }, 60, { reducedMotion: true });
  assert.deepEqual(pose, idle);
});

test('Clockwise follows top to bottom; counterclockwise follows bottom to top, regardless of SVG group order', () => {
  const shuffled = { parts: [7, 3, 6, 1, 5, 0, 4, 2].map(index => rig.parts[index]) };
  for (const artwork of [rig, shuffled]) for (const direction of [1, -1]) {
    const pose = createKeeperRigPose(artwork), options = { swim: { ...KEEPER_SWIM_DEFAULTS, staggerSeconds: .08 } };
    run(pose, .25, { vx: 0, vy: 0, heading: direction * Math.PI / 2 }, 60, options, artwork);
    const headings = Array.from({ length: 7 }, (_, index) => pose.parts[artwork.parts.findIndex(p => p.id === `tentacle-${index + 1}`)].heading);
    const leadingFirst = direction > 0 ? headings : headings.toReversed().map(angle => -angle);
    assert.ok(leadingFirst[0] > leadingFirst[1] && leadingFirst[1] > leadingFirst[2] && leadingFirst[2] > 0);
    assert.deepEqual(leadingFirst.slice(3).map(Math.abs), [0, 0, 0, 0], 'later tentacles wait their turn');
    assert.ok(Math.abs(pose.angle) > Math.abs(leadingFirst[0]), 'head leads the first tentacle');
  }
});

test('Mirrored left-facing artwork mirrors the first tentacle in each turn direction', () => {
  const mirrored = { parts: rig.parts.map(part => ({ ...part, x: -part.x })) };
  for (const direction of [1, -1]) {
    const pose = createKeeperRigPose(mirrored), options = { faces: 'left', swim: { ...KEEPER_SWIM_DEFAULTS, staggerSeconds: .08 } };
    run(pose, .2, { vx: 0, vy: 0, heading: Math.PI + direction * Math.PI / 2 }, 60, options, mirrored);
    const first = direction > 0 ? 6 : 0, last = direction > 0 ? 0 : 6;
    assert.ok(pose.parts[first].heading * direction > .1);
    assert.equal(pose.parts[last].heading, 0);
  }
});

test('Reversing mid-turn delays the new motion in reverse order without replaying old headings', () => {
  const reversed = createKeeperRigPose(rig), options = { swim: { ...KEEPER_SWIM_DEFAULTS, staggerSeconds: .08 } };
  run(reversed, .25, { vx: 0, vy: 0, heading: Math.PI / 2 }, 60, options);
  const coast = structuredClone(reversed), heldHeading = coast.angle, firstResponse = Array(7).fill(null);
  for (let frame = 1; frame <= 120; frame++) {
    run(reversed, 1 / 60, { vx: 0, vy: 0, heading: -Math.PI / 2 }, 60, options);
    run(coast, 1 / 60, { vx: 0, vy: 0, heading: heldHeading }, 60, options);
    for (let i = 0; i < 7; i++) {
      const difference = reversed.parts[i].heading - coast.parts[i].heading;
      assert.ok(difference <= 1e-10, 'the new turn only contributes counterclockwise motion');
      if (difference < -1e-6 && firstResponse[i] === null) firstResponse[i] = frame / 60;
    }
  }
  assert.ok(firstResponse[6] >= .08, 'first tentacle waits the authored delay');
  for (let i = 0; i < 6; i++) assert.ok(firstResponse[i] - firstResponse[i + 1] > .05, 'each subsequent tentacle follows separately');
  run(reversed, 3, { vx: 0, vy: 0, heading: -Math.PI / 2 }, 60, options);
  assert.ok(reversed.parts.slice(0, -1).every(part => Math.abs(part.heading + Math.PI / 2) < .001));
});

test('Crossing the angle wrap keeps the clockwise order, while zero stagger removes direction-dependent delay', () => {
  const pose = createKeeperRigPose(rig), options = { swim: { ...KEEPER_SWIM_DEFAULTS, staggerSeconds: .08 } };
  run(pose, 6, { vx: 0, vy: 0, heading: Math.PI - .04 }, 60, options);
  const before = pose.parts.map(part => part.heading);
  run(pose, .2, { vx: 0, vy: 0, heading: -Math.PI + .04 }, 60, options);
  assert.ok(pose.angle > Math.PI, 'wrap continues the short clockwise turn');
  assert.ok(pose.parts[0].heading - before[0] > .01);
  assert.ok(Math.abs(pose.parts[6].heading - before[6]) < .00001);
  const together = createKeeperRigPose(rig);
  run(together, .3, { vx: 0, vy: 0, heading: -Math.PI / 2 }, 60, { swim: { ...KEEPER_SWIM_DEFAULTS, staggerSeconds: 0 } });
  assert.ok(together.parts.slice(0, -1).every(part => part.heading === together.parts[0].heading));
});
test('Circle steering stays continuous, keeps floating parts inside the envelope and lets the head lead', () => {
  const pose = createKeeperRigPose(rig);
  let headLead = false;
  for (let i = 0; i < 1200; i++) {
    const heading = i / 1200 * Math.PI * 4, before = pose.parts.map(p => p.angle);
    stepKeeperRigPose(pose, rig, { vx: Math.cos(heading) * 200, vy: Math.sin(heading) * 200 }, 1 / 60);
    pose.parts.forEach((part, index) => {
      assert.ok(Math.abs(part.angle - before[index]) < .15, 'no turn-boundary snap');
      assert.ok(Math.hypot(part.x, part.y) + Math.hypot(rig.parts[index].width, rig.parts[index].height) / 2 <= .490001);
    });
    if (i > 300 && Math.abs(pose.parts.at(-1).angle - pose.angle) < Math.abs(pose.parts[0].angle - pose.angle)) headLead = true;
  }
  assert.ok(pose.angle > Math.PI * 3.5, 'multiple revolutions do not collapse into a flip');
  assert.ok(headLead);
  assert.ok(pose.turns.at(-1).time - pose.turns[0].time < 1.5, 'heading history is bounded during long animation');
});
test('Speed easing is stable across display refresh rates and caps a suspended frame', () => {
  const a = createKeeperRigPose(rig), b = createKeeperRigPose(rig);
  run(a, 3, { vx: 200, vy: 80 }, 30); run(b, 3, { vx: 200, vy: 80 }, 120);
  assert.ok(Math.abs(a.compression - b.compression) < .00001);
  assert.ok(Math.abs(a.angle - b.angle) < .00001);
  a.parts.forEach((p, i) => assert.ok(Math.hypot(p.x - b.parts[i].x, p.y - b.parts[i].y) < .01));
  const fresh = createKeeperRigPose(rig);
  stepKeeperRigPose(fresh, rig, { vx: -240, vy: 0 }, 100);
  assert.ok(fresh.compression < .15);
});

test('curiosity tilts the head and surprise spreads tentacles inside their envelope', () => {
  const idle = createKeeperRigPose(rig), curious = createKeeperRigPose(rig), startled = createKeeperRigPose(rig);
  const still = { vx: 0, vy: 0, heading: 0 };
  stepKeeperRigPose(idle, rig, still, .04);
  stepKeeperRigPose(curious, rig, { ...still, expression: { gesture: 'curious', amount: 1 } }, .04);
  stepKeeperRigPose(startled, rig, { ...still, expression: { gesture: 'startled', amount: 1 } }, .04);
  const head = rig.parts.findIndex(part => part.id === 'body');
  assert.ok(Math.abs(curious.parts[head].angle - idle.parts[head].angle) > .2);
  assert.ok(startled.parts.some((part, i) => i !== head && Math.hypot(part.x - idle.parts[i].x, part.y - idle.parts[i].y) > .015));
  startled.parts.forEach((part, i) => assert.ok(Math.hypot(part.x, part.y) + Math.hypot(rig.parts[i].width, rig.parts[i].height) / 2 <= .490001));
  const reduced = createKeeperRigPose(rig), before = structuredClone(reduced);
  stepKeeperRigPose(reduced, rig, { ...still, expression: { gesture: 'startled', amount: 1 } }, .04, { reducedMotion: true });
  assert.deepEqual(reduced, before);
});
