import test from 'node:test';
import assert from 'node:assert/strict';
import { projectLayerStudy } from './layers.js';

test('Fit and Cover preserve source aspect ratios through wide and narrow cell projections', () => {
  for (const [width, height] of [[600, 600], [280, 480], [900, 220]]) {
    for (const mode of ['relative', 'anchored']) for (const fit of ['contain', 'cover']) {
      for (const { id, box, image } of projectLayerStudy(width, height, mode, 'bottom', fit)) {
        assert.ok(Object.values(box).every(Number.isFinite));
        assert.ok(Math.abs(image.width / image.height - (id === 'nomad' ? 1868 / 1999 : 1)) < 1e-9);
        if (fit === 'contain') {
          assert.ok(image.width <= box.width + 1e-8); assert.ok(image.height <= box.height + 1e-8);
        } else {
          assert.ok(image.width >= box.width - 1e-8); assert.ok(image.height >= box.height - 1e-8);
        }
      }
    }
  }
});
test('native anchors shrink proportionally, retain edge padding and never enlarge authored layers', () => {
  for (const [width, height] of [[280, 480], [900, 220], [1200, 1200]]) {
    const anchored = projectLayerStudy(width, height, 'anchored', 'bottom')[0].box;
    const scale = Math.min(1, width / 600, height / 600, (width - 32) / 410, (height - 32) / 520);
    assert.ok(Math.abs(anchored.width - 410 * scale) < 1e-8);
    assert.ok(Math.abs(anchored.height - 520 * scale) < 1e-8);
    assert.ok(Math.abs(anchored.top + anchored.height - (height - 16)) < 1e-8);
    assert.equal(anchored.left, 16);
    assert.equal(projectLayerStudy(width, height, 'anchored', 'top')[0].box.top, 16);
    assert.ok(anchored.left + anchored.width <= width - 16 + 1e-8);
    assert.ok(anchored.top >= 16 - 1e-8);
  }
  assert.equal(projectLayerStudy(280, 480, 'relative')[0].box.width, 410 * 280 / 600);
});
