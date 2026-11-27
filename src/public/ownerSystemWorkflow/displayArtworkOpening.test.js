import assert from 'node:assert/strict';
import test from 'node:test';
import { artworkSourcePoint, projectDisplayArtworkOpening } from './displayArtworkOpening.js';

test('source crops preserve world pixels through every quarter-turn, mirror and fit/cover size', () => {
  for (let turn = 0; turn < 4; turn++) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const cos = Math.round(Math.cos(turn * Math.PI / 2)), sin = Math.round(Math.sin(turn * Math.PI / 2));
    const matrix = { a: sx * cos, b: sy * sin, c: -sx * sin, d: sy * cos };
    for (const size of [45.3, 340.7, 970.1]) {
      const rect = { left: -47.1, top: 14.3, width: size, height: size * .7 };
      const width = 201.3, height = 173.7;
      const opening = projectDisplayArtworkOpening(rect, width, height, matrix);
      const viewBox = `inset(${opening.insets.map(value => `${value * 100}%`).join(' ')})`;
      for (const u of [0, .2, .5, .9, 1]) for (const v of [0, .4, 1]) {
        const source = artworkSourcePoint({ u, v }, viewBox);
        const oldX = (source.u - .5) * rect.width, oldY = (source.v - .5) * rect.height;
        const newX = (u - .5) * opening.width, newY = (v - .5) * opening.height;
        assert.ok(Math.abs(rect.left + rect.width / 2 + matrix.a * oldX + matrix.c * oldY
          - (width / 2 + matrix.a * newX + matrix.c * newY)) < 1e-9);
        assert.ok(Math.abs(rect.top + rect.height / 2 + matrix.b * oldX + matrix.d * oldY
          - (height / 2 + matrix.b * newX + matrix.d * newY)) < 1e-9);
      }
    }
  }
});

test('alpha picking understands CSS inset serialization and transparent letterboxes', () => {
  assert.deepEqual(artworkSourcePoint({ u: 0, v: 0 }, 'inset(-50% 0%)'), { u: 0, v: -.5 });
  assert.deepEqual(artworkSourcePoint({ u: .5, v: .5 }, 'inset(10%)'), { u: .5, v: .5 });
  const three = artworkSourcePoint({ u: 0, v: 1 }, 'inset(10% 20% 30%)');
  assert.equal(three.u, .2); assert.ok(Math.abs(three.v - .7) < 1e-12);
  assert.deepEqual(artworkSourcePoint({ u: .3, v: .7 }, 'none'), { u: .3, v: .7 });
});
