import test from 'node:test';
import assert from 'node:assert/strict';
import { moveKeeperWithWalls } from './keeperCollision.js';
import { createKeeperMotion, releaseKeeper, steerKeeper, stepKeeper } from './keeperMotion.js';

const wall = { left: 100, right: 200, top: 100, bottom: 110 };
test('body cannot tunnel through a thin wall in either direction and slides along its face', () => {
  for (const [start, delta, expected] of [[50, 300, 90], [200, -300, 120]]) {
    const body = { x: 150, y: start, vx: 40, vy: delta };
    moveKeeperWithWalls(body, 15, delta, [wall], 10);
    assert.equal(body.y, expected); assert.equal(body.x, 165); assert.equal(body.vy, 0);
  }
  const side = { x: 50, y: 105, vx: 300, vy: 0 };
  moveKeeperWithWalls(side, 300, 0, [wall], 10);
  assert.equal(side.x, 90); assert.equal(side.vx, 0);
});
test('a body can go around the edge and recovers if a resize puts it inside a wall', () => {
  const around = { x: 230, y: 60, vx: 0, vy: 200 };
  moveKeeperWithWalls(around, 0, 200, [wall], 10);
  assert.equal(around.y, 260);
  const inside = { x: 150, y: 105, vx: 20, vy: 10 };
  moveKeeperWithWalls(inside, 0, 0, [wall], 10);
  assert.equal(inside.y, 90); assert.equal(inside.vx, 0); assert.equal(inside.vy, 0);
});
test('live swim stays below the wall at multiple frame rates; direct recall remains recoverable', () => {
  for (const hz of [30, 60, 120]) {
    const home = { x: 150, y: 240 }, body = createKeeperMotion(home);
    releaseKeeper(body); steerKeeper(body, { x: 150, y: 30 });
    for (let frame = 0; frame < hz * 4; frame++) stepKeeper(body, {
      dt: 1 / hz, home, movement: 'swim', size: 40, walls: [wall], bounds: { left: 0, top: 0, right: 500, bottom: 500 },
    });
    assert.ok(body.y >= 122); assert.ok(body.y < 123);
    body.phase = 'returning';
    for (let frame = 0; frame < hz * 5; frame++) stepKeeper(body, {
      dt: 1 / hz, home, movement: 'swim', walls: [wall], bounds: { left: 0, top: 0, right: 500, bottom: 500 },
    });
    assert.equal(body.phase, 'docked');
  }
});
