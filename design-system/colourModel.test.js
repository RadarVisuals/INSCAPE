import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRIANGLE,
  normaliseHex,
  hexHsv,
  hsvHex,
  hsvHsl,
  hslHsv,
  hsvPoint,
  pointHsv,
  triangleWeights,
  clampTriangle,
  ringPoint,
  pointHue,
  paintTriangle,
} from './colourModel.js';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`);

test('hue ring and triangle use the same centred geometry and white/black/hue endpoints', () => {
  const vertices = Object.values(TRIANGLE);
  near(vertices.reduce((n, p) => n + p.x, 0) / 3, 100);
  near(vertices.reduce((n, p) => n + p.y, 0) / 3, 100);
  for (const point of vertices) near(Math.hypot(point.x - 100, point.y - 100), 74);
  for (const h of [0, 60, 120, 180, 240, 300, 359]) {
    near(pointHue(ringPoint(h)), h);
    for (const [point, expected] of [
      [TRIANGLE.white, '#ffffff'],
      [TRIANGLE.black, '#000000'],
      [TRIANGLE.hue, hsvHex(h, 1, 1)],
    ]) {
      const colour = pointHsv(point, h);
      assert.equal(hsvHex(colour.h, colour.s, colour.v), expected);
    }
  }
  const middle = pointHsv({ x: 100, y: 100 }, 0);
  assert.equal(hsvHex(middle.h, middle.s, middle.v), '#aa5555');
});

test('colour codes round-trip through the triangle and achromatic colours retain the chosen hue', () => {
  for (const hex of [
    '#000000',
    '#ffffff',
    '#808080',
    '#b59b9b',
    '#243629',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#12abef',
    '#fffe01',
  ]) {
    const hsv = hexHsv(hex, 212, 0.7),
      roundtrip = pointHsv(hsvPoint(hsv), hsv.h, hsv.s);
    assert.equal(hsvHex(roundtrip.h, roundtrip.s, roundtrip.v), hex);
    const hsl = hsvHsl(hsv),
      back = hslHsv(hsv.h, hsl.s, hsl.l);
    assert.equal(hsvHex(back.h, back.s, back.v), hex);
  }
  assert.equal(hexHsv('#ffffff', 212).h, 212);
  assert.equal(hexHsv('#000000', 212, 0.7).s, 0.7);
  assert.equal(normaliseHex(' #aBc '), '#aabbcc');
  assert.equal(normaliseHex('12AbEF'), '#12abef');
  for (const invalid of ['#12', '#ff0000ff', 'banana', 'rgb(1,2,3)'])
    assert.equal(normaliseHex(invalid), null);
});

test('dragging outside the triangle projects to its nearest edge without out-of-range colours', () => {
  for (const x of [-300, 0, 75, 100, 250, 600])
    for (const y of [-300, 0, 75, 100, 250, 600]) {
      const p = clampTriangle({ x, y }),
        w = triangleWeights(p),
        hsv = pointHsv(p, 125);
      assert.ok(Object.values(w).every((n) => n >= -1e-10 && n <= 1 + 1e-10));
      assert.ok(hsv.s >= 0 && hsv.s <= 1 && hsv.v >= 0 && hsv.v <= 1);
    }
});

test('painted triangle colours agree with selection math, including neutral mixtures', () => {
  let painted;
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (image) => {
      painted = image;
    },
  };
  const canvas = { width: 200, height: 200, getContext: () => ctx };
  paintTriangle(canvas, 0);
  for (const [x, y] of [
    [100, 100],
    [80, 65],
    [70, 135],
    [150, 100],
  ]) {
    const hsv = pointHsv({ x: x + 0.5, y: y + 0.5 }, 0),
      expected = hsvHex(hsv.h, hsv.s, hsv.v)
        .slice(1)
        .match(/../g)
        .map((v) => parseInt(v, 16));
    assert.deepEqual([...painted.data.slice((y * 200 + x) * 4, (y * 200 + x) * 4 + 3)], expected);
  }
});
