import assert from 'node:assert/strict';
import test from 'node:test';
import { transformArtwork } from './systemWorkflowTransform.js';

const point = (transform, x, y) => {
  for (let turn = 0; turn < transform.quarterTurns; turn++) [x, y] = [-y, x];
  return [transform.mirrorX ? -x : x, transform.mirrorY ? -y : y];
};

test('rotating Image content moves source points clockwise through each mirror', () => {
  for (const mirrorX of [false, true]) for (const mirrorY of [false, true]) for (const quarterTurns of [0, 1, 2, 3]) {
    const transform = { quarterTurns, mirrorX, mirrorY };
    const [x, y] = point(transform, .2, -.7);
    assert.deepEqual(point(transformArtwork(transform, 'ROTATE'), .2, -.7), [-y, x]);
    let rotated = transform;
    for (let turn = 0; turn < 4; turn++) rotated = transformArtwork(rotated, 'ROTATE');
    assert.deepEqual(rotated, transform);
  }
});
