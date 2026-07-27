import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARTWORK_MAT_INSET_MAX,
  ARTWORK_MAT_PRESET_IDS,
  DEFAULT_ARTWORK_BACKING,
  DEFAULT_ARTWORK_MAT,
  normalizeArtworkBacking,
  normalizeArtworkMat,
  projectArtworkMat,
  resolveArtworkMatPreset,
} from './latticeMat.js';

const rectangle = { left: 100, top: 50, width: 400, height: 200 };
const custom = {
  enabled: true,
  color: '#Aa10Ff',
  inset: { top: 0.1, right: 0.2, bottom: 0.3, left: 0.4 },
};

test('top, right, bottom and left insets project independently over one backplate', () => {
  const result = projectArtworkMat(rectangle, custom);
  assert.deepEqual(result.backplateRectangle, rectangle);
  assert.deepEqual({ ...result.mediaOpeningRectangle, height: Math.round(result.mediaOpeningRectangle.height) }, { left: 260, top: 70, width: 160, height: 120 });
  assert.equal(result.mat.color, '#aa10ff');
});

test('strict mat validation clamps finite inset values to safe normalized bounds', () => {
  assert.deepEqual(normalizeArtworkMat({
    ...custom,
    inset: { top: -1, right: 1, bottom: 0.2, left: 0.3 },
  }).inset, { top: 0, right: ARTWORK_MAT_INSET_MAX, bottom: 0.2, left: 0.3 });
  assert.throws(() => normalizeArtworkMat({ ...custom, color: 'black' }), /six-digit color/);
  assert.throws(() => normalizeArtworkMat({ ...custom, inset: { ...custom.inset, top: NaN } }), /finite/);
  assert.throws(() => normalizeArtworkMat({ ...custom, extra: true }), /requires enabled/);
});

test('disabled mat has no backplate and leaves the placement as the media opening', () => {
  const result = projectArtworkMat(rectangle, DEFAULT_ARTWORK_MAT);
  assert.equal(result.backplateRectangle, null);
  assert.deepEqual(result.mediaOpeningRectangle, rectangle);
});

test('DOSSIER and CAPTION are only presets resolving to the same generic mat shape', () => {
  const dossier = resolveArtworkMatPreset(ARTWORK_MAT_PRESET_IDS.DOSSIER);
  const caption = resolveArtworkMatPreset(ARTWORK_MAT_PRESET_IDS.CAPTION);
  for (const value of [dossier, caption]) assert.deepEqual(Object.keys(value), ['enabled', 'color', 'inset']);
  assert.equal(dossier.inset.left, 0);
  assert.equal(dossier.inset.right, 0);
  assert.ok(caption.inset.bottom > dossier.inset.bottom);
  assert.throws(() => resolveArtworkMatPreset('POLAROID'), /Unknown artwork mat preset/);
});

test('aperture backing is a separate strict color choice and never expands the mat model', () => {
  assert.deepEqual(normalizeArtworkBacking({ enabled: true, color: '#Aa10Ff' }), { enabled: true, color: '#aa10ff' });
  assert.deepEqual(DEFAULT_ARTWORK_BACKING, { enabled: false, color: '#d8d4ca' });
  assert.throws(() => normalizeArtworkBacking({ enabled: true, color: 'linen' }), /six-digit color/);
  assert.throws(() => normalizeArtworkBacking({ enabled: true, color: '#ffffff', inset: 1 }), /requires enabled/);
  assert.deepEqual(Object.keys(normalizeArtworkMat(custom)), ['enabled', 'color', 'inset']);
});
