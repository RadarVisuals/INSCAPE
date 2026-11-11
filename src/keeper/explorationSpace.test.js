import test from 'node:test';
import assert from 'node:assert/strict';
import { createExplorationSpace, EXPLORATION_WALLS, EXPLORATION_ROOM } from './explorationSpace.js';
import { createKeeperMotion, releaseKeeper, steerKeeper, stepKeeper } from './keeperMotion.js';

test('camera projects and unprojects input without altering world motion; resize preserves world coordinates', () => {
  let box = { left: 80, top: 160, width: 1100, height: 600 }, camera;
  const space = createExplorationSpace({ getRectangle: () => box, paintScene: value => camera = value });
  space.reset();
  const point = { x: 1234, y: 876 };
  assert.deepEqual(space.unproject(space.project(point)), point);
  const body = createKeeperMotion(space.home()); releaseKeeper(body); steerKeeper(body, { x: 1500, y: 1200 });
  for (let i = 0; i < 120; i++) {
    stepKeeper(body, { dt: 1 / 60, home: space.home(), movement: 'swim', ...space.viewport(192), walls: space.walls });
    const before = { ...body }; space.update(body, 1 / 60); assert.deepEqual(body, before);
  }
  assert.ok(camera.x > 600);
  box = { left: 16, top: 196, width: 358, height: 540 };
  space.update(body, 1 / 60);
  assert.deepEqual(space.unproject(space.project(point)), point);
  assert.ok(space.viewport(192).bounds.right > box.width, 'motion bounds belong to the world');
  space.update({ x: 100, y: 100 }, .05);
  assert.deepEqual(space.project({ x: 100, y: 100 }), { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  assert.ok(camera.x < 0, 'lens can see outside the physical room to keep the actor anchored');
});
test('only horizontal and vertical metal beams collide; organic interior remains open', () => {
  assert.equal(EXPLORATION_WALLS.length, 4);
  assert.ok(!EXPLORATION_WALLS.some(wall => 500 > wall.left && 500 < wall.right && 1000 > wall.top && 1000 < wall.bottom));
  for (const hz of [30, 60, 120]) {
    const space = createExplorationSpace({ getRectangle: () => ({ left: 0, top: 0, width: 1000, height: 600 }) });
    const body = createKeeperMotion({ x: 900, y: 1000 }); releaseKeeper(body); steerKeeper(body, { x: 600, y: 1000 });
    for (let i = 0; i < hz * 4; i++) stepKeeper(body, { dt: 1 / hz, home: space.home(), movement: 'swim', ...space.viewport(192), walls: space.walls, collisionRadius: space.collisionRadius(192) });
    assert.ok(Math.abs(body.x - (750 + 192 * .08)) < .01);
  }
});

test('100/50 toggle scales the scene and input together while keeping physical size, bounds and walls unchanged', () => {
  const space = createExplorationSpace({ getRectangle: () => ({ left: 80, top: 100, width: 1000, height: 600 }) });
  space.reset();
  const physics = space.viewport(192), point = { x: 1100, y: 1000 };
  const original = space.project(point), walls = structuredClone(space.walls);
  let changed = 0;
  const unsubscribe = space.subscribe(() => changed++);
  space.setZoom(.5);
  assert.equal(space.getZoom(), .5);
  assert.deepEqual(space.unproject(space.project(point)), point);
  assert.deepEqual(space.viewport(192), physics);
  assert.deepEqual(space.walls, walls);
  const a = space.project(point), b = space.project({ x: point.x + 200, y: point.y });
  assert.equal(b.x - a.x, 100);
  space.setZoom(1);
  assert.deepEqual(space.project(point), original);
  space.setZoom(2); assert.equal(space.getZoom(), 1);
  assert.equal(changed, 2); unsubscribe();
  space.setZoom(.5); assert.equal(changed, 2);
});

test('zoom and moving follow share the motion clock and reverse without a camera snap', () => {
  const space = createExplorationSpace({ getRectangle: () => ({ left: 0, top: 0, width: 1000, height: 600 }), animateZoom: true });
  space.reset(); space.setActive(true);
  const point = { x: 1400, y: 1100 };
  space.update(point, 1 / 60);
  const before = space.project(point);
  space.setZoom(.5);
  assert.deepEqual(space.project(point), before, 'starting zoom does not snap the lagging camera');
  for (let i = 0; i < 12; i++) { point.x += 3; space.update(point, 1 / 60); }
  const anchored = space.project(point);
  assert.ok(Math.hypot(anchored.x - 500, anchored.y - 300) < 1e-8, 'focus stays at the same screen point while moving and zooming');
  assert.ok(space.getZoom() > .5 && space.getZoom() < 1);
  const reversing = space.project(point);
  space.setZoom(1);
  assert.deepEqual(space.project(point), reversing);
  for (let i = 0; i < 30; i++) { point.x += 3; space.update(point, 1 / 60); }
  assert.equal(space.getZoom(), 1);
  space.dispose();
});

test('wall contact stays centred throughout zoom even when half the visible room extends beyond the physical boundary', () => {
  const space = createExplorationSpace({ getRectangle: () => ({ left: 160, top: 193, width: 1120, height: 600 }), animateZoom: true });
  const body = createKeeperMotion({ x: 900, y: 1100 });
  releaseKeeper(body); steerKeeper(body, { x: 650, y: 1100 });
  space.reset(); space.setActive(true);
  for (let frame = 0; frame < 240; frame++) {
    if (frame === 60) space.setZoom(.5);
    if (frame === 180) space.setZoom(1);
    stepKeeper(body, { dt: 1 / 60, home: space.home(), movement: 'swim', ...space.viewport(192), walls: space.walls, collisionRadius: space.collisionRadius(192) });
    space.update(body, 1 / 60);
    const screen = space.project(body);
    assert.ok(Math.hypot(screen.x - 720, screen.y - 493) < 1e-8);
    assert.ok(body.x >= 750 + 192 * .08 - 1e-8);
  }
});
