import test from 'node:test';
import assert from 'node:assert/strict';
import { measureImageJoins } from './imageSeamGeometry.js';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
const image = (id, canvas, media) => ({ moduleId: id, canvas: { rect: canvas }, svgImage: media ? { rect: media } : null });

test('captured Image frames meet exactly while their native-fit media leave a visible join', () => {
  // Rounded DOM measurements supplied on 2026-09-27, 18:01:41 UTC.
  const images = [
    image('top', rect(471, -113, 1782, 627), rect(471, -111.74320983886719, 1782, 625.7432403564453)),
    image('left', rect(471, 627, 1790, 1367), rect(472.7872619628906, 627, 1788.2126770019531, 1367)),
    image('right', rect(1790, 627, 3109, 1367), rect(1791.7872314453125, 627, 3107.212646484375, 1367)),
  ];
  const joins = measureImageJoins(images);
  assert.equal(joins.length, 2, 'diagonal neighbours do not form a shared edge');
  assert.ok(joins.every(join => join.canvasGapPhysicalPx === 0));
  assert.equal(joins.find(join => join.axis === 'horizontal').mediaRectangleGapPhysicalPx, 3.574554443359375);
  assert.equal(joins.find(join => join.axis === 'vertical').mediaRectangleGapPhysicalPx, 1.2567596435546875);
});

test('cover clips excess media at the shared canvas boundary; fractional density does not invent an overlap', () => {
  const joins = measureImageJoins([
    image('right', rect(100, 0, 200, 60), rect(90, -10, 210, 70)),
    image('left', rect(0, 0, 100, 60), rect(-10, -10, 110, 70)),
  ], 1.25);
  assert.deepEqual(joins, [{ firstId: 'left', secondId: 'right', axis: 'horizontal', canvasGapPhysicalPx: 0, mediaRectangleGapPhysicalPx: 0 }]);
});

test('missing media and perpendicular non-overlap stay unknown; window gaps remain independent', () => {
  const left = image('left', rect(0, 0, 100, 60), rect(0, 0, 100, 20));
  const right = image('right', rect(101, 0, 201, 60), null);
  assert.equal(measureImageJoins([left, right], 2)[0].canvasGapPhysicalPx, 2);
  assert.equal(measureImageJoins([left, right], 2)[0].mediaRectangleGapPhysicalPx, null);
  right.svgImage = { rect: rect(101, 40, 201, 60) };
  assert.equal(measureImageJoins([left, right])[0].mediaRectangleGapPhysicalPx, null);
  assert.deepEqual(measureImageJoins([left, right], 5), [], 'only nearby edges are reported');
});
