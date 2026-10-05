import test from 'node:test';
import assert from 'node:assert/strict';
import { imageDropGeometry } from './imageDropGeometry.js';
import { imageWindowGeometry, imagePaintGeometry } from './imageWindowGeometry.js';

test('Image preview and created surface agree through camera zoom, pan and pixel density', () => {
  const host = { left: 12, top: 17, width: 1440, height: 900 }, point = { x: 600.3, y: 483.7 };
  for (const scale of [.25, .67, 1, 1.371, 2]) for (const density of [1, 1.25, 2]) {
    const offset = { x: -120.7, y: 63.3 };
    const { destination, rectangle } = imageDropGeometry({ width: 1600, height: 900 }, point, host, scale, offset, density);
    const screen = imageWindowGeometry(destination.position, destination.size, { scale, x: 0, y: 0 }, offset);
    assert.ok(Math.abs(screen.left + screen.width / 2 + host.left - point.x) < 1e-8);
    assert.ok(Math.abs(screen.top + screen.height / 2 + host.top - point.y) < 1e-8);
    const paint = imagePaintGeometry(screen, density);
    assert.deepEqual(rectangle, { left: host.left + paint.left / density, top: host.top + paint.top / density,
      width: paint.width / density, height: paint.height / density });
  }
});
test('drop sizing and placement respect narrow views and the actual Workbench boundary', () => {
  const host = { left: 0, top: 0, width: 390, height: 844 };
  const result = imageDropGeometry({ width: 2000, height: 4000 }, { x: 30, y: 30 }, host, 1, { x: 0, y: 0 });
  assert.deepEqual(result.destination, { position: { left: 8, top: 8 }, size: { width: 180, height: 360 } });
  assert.equal(imageDropGeometry({ width: 2000, height: 4000 }, { x: 5, y: 30 }, host, 1, { x: 0, y: 0 }), null);
  assert.equal(imageDropGeometry(null, { x: 30, y: 30 }, host, 1, { x: 0, y: 0 }), null);
  const edge = imageDropGeometry({ width: 1600, height: 900 }, { x: 980, y: 300 },
    { left: 0, top: 0, width: 1440, height: 900 }, .25, { x: 0, y: 0 });
  assert.equal(edge.destination.position.left + edge.destination.size.width, 3992, 'new artwork stays inside the 4000-area inset');
  assert.equal(imageDropGeometry({ width: 1600, height: 900 }, { x: 1005, y: 300 },
    { left: 0, top: 0, width: 1440, height: 900 }, .25, { x: 0, y: 0 }), null, 'drops beyond the new area are rejected');
});
