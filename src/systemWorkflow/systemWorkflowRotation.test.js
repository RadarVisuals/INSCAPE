import assert from 'node:assert/strict';
import test from 'node:test';
import { transformArtwork, transformSystemWorkflowGroupGeometries } from './systemWorkflowTransform.js';

const point = (transform, x, y) => {
  for (let turn = 0; turn < transform.quarterTurns; turn++) [x, y] = [-y, x];
  return [transform.mirrorX ? -x : x, transform.mirrorY ? -y : y];
};

test('rotating an asymmetric group moves each media point clockwise, including mirrored members', () => {
  for (const mirrorX of [false, true]) for (const mirrorY of [false, true]) for (const quarterTurns of [0, 1, 2, 3]) {
    const transform = { quarterTurns, mirrorX, mirrorY };
    const entries = [{ id: 'left', column: 5, row: 5, columnSpan: 2, rowSpan: 2, transform },
      { id: 'right', column: 9, row: 5, columnSpan: 2, rowSpan: 2, transform }];
    const destinations = transformSystemWorkflowGroupGeometries(entries, 'ROTATE');
    for (const [index, entry] of entries.entries()) {
      const offset = point(transform, .2, -.7);
      const original = [entry.column + 1 + offset[0], entry.row + 1 + offset[1]];
      const rotatedOffset = point(transformArtwork(transform, 'ROTATE'), .2, -.7);
      const destination = destinations[index].destination;
      const actual = [destination.column + 1 + rotatedOffset[0], destination.row + 1 + rotatedOffset[1]];
      const expected = [8 - (original[1] - 6), 6 + (original[0] - 8)];
      actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]) < 1e-12));
    }
    let rotated = transform;
    for (let turn = 0; turn < 4; turn++) rotated = transformArtwork(rotated, 'ROTATE');
    assert.deepEqual(rotated, transform);
  }
});
