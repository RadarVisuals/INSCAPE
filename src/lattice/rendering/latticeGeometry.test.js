import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LATTICE_GEOMETRY_PRESETS,
  LATTICE_ARTBOARD_FITS,
  PROTOTYPE_START_GEOMETRY,
  LATTICE_SURFACES,
  assertRenderGeometry,
  normalizeLatticeSurface,
  fitNativeMediaRectangle,
  clampLatticeArtboardOffset,
  latticeArtboardFramingBounds,
  projectCanonicalLatticeArtboard,
  projectPlacementRectangle,
  projectTableLabelPosition,
  semanticGridVariables,
} from './latticeGeometry.js';

test('candidate geometry remains explicit while rendering accepts any valid contract geometry', () => {
  assert.deepEqual(LATTICE_GEOMETRY_PRESETS.map(({ geometry }) => geometry), [
    { columns: 32, rows: 18 },
  ]);
  assert.deepEqual(PROTOTYPE_START_GEOMETRY, { columns: 32, rows: 18 });
  assert.deepEqual(assertRenderGeometry({ columns: 12, rows: 9 }), { columns: 12, rows: 9 });
  assert.throws(() => assertRenderGeometry({ columns: 0, rows: 9 }), /positive integer/);
  assert.throws(() => assertRenderGeometry({ columns: 12.5, rows: 9 }), /positive integer/);
  assert.deepEqual(semanticGridVariables({ columns: 16, rows: 9 }, { width: 1200, height: 900 }), {
    '--lattice-grid-columns': 16,
    '--lattice-grid-rows': 9,
    '--lattice-grid-cell-size': '75px',
    '--lattice-grid-origin-x': '0px',
    '--lattice-grid-origin-y': '112.5px',
  });
});

test('canonical artboard fills 16:9 and remains centered inside mismatched containers', () => {
  assert.deepEqual(projectCanonicalLatticeArtboard(
    { aspectWidth: 16, aspectHeight: 9 },
    { width: 1280, height: 720 },
  ), { width: 1280, height: 720, left: 0, top: 0 });
  assert.deepEqual(projectCanonicalLatticeArtboard(
    { aspectWidth: 16, aspectHeight: 9 },
    { width: 390, height: 844 },
  ), { width: 390, height: 219.375, left: 0, top: 312.3125 });
  assert.throws(() => projectCanonicalLatticeArtboard(
    { aspectWidth: 16, aspectHeight: 9 },
    { width: 0, height: 844 },
  ), /positive viewport/);
});

test('cover framing fills mismatched viewports and clamps bounded presentation offsets', () => {
  const wideViewport = { width: 1280, height: 600 };
  assert.deepEqual(latticeArtboardFramingBounds(
    { aspectWidth: 16, aspectHeight: 9 },
    wideViewport,
    LATTICE_ARTBOARD_FITS.COVER,
  ), { x: 0, y: 60 });
  assert.deepEqual(projectCanonicalLatticeArtboard(
    { aspectWidth: 16, aspectHeight: 9 },
    wideViewport,
    { fit: LATTICE_ARTBOARD_FITS.COVER, offset: { x: 200, y: 40 } },
  ), { width: 1280, height: 720, left: 0, top: -20 });
  assert.deepEqual(projectCanonicalLatticeArtboard(
    { aspectWidth: 16, aspectHeight: 9 },
    { width: 400, height: 800 },
    { fit: LATTICE_ARTBOARD_FITS.COVER, offset: { x: -500, y: 100 } },
  ), { width: 1422.2222222222222, height: 800, left: -1011.1111111111111, top: 0 });
  assert.deepEqual(clampLatticeArtboardOffset({ x: 500, y: -500 }, { x: 20, y: 30 }), { x: 20, y: -30 });
});

test('placement projection uses normalized artboard bounds and native media remains contained', () => {
  const footprint = projectPlacementRectangle({
    x: 0.1, y: 0.2, width: 0.4, height: 0.4,
  }, { aspectWidth: 16, aspectHeight: 9 }, { width: 1600, height: 900 });
  assert.deepEqual(footprint, { left: 160, top: 180, width: 640, height: 360 });
  assert.deepEqual(fitNativeMediaRectangle(footprint, { width: 400, height: 200 }), {
    left: 160, top: 200, width: 640, height: 320,
  });
  assert.deepEqual(fitNativeMediaRectangle(footprint, { width: 100, height: 200 }), {
    left: 390, top: 180, width: 180, height: 360,
  });
  assert.throws(() => fitNativeMediaRectangle(footprint, { width: 0, height: 200 }), /positive placement and media/);
});

test('label anchors project onto semantic cells with global bounded offsets', () => {
  const geometry = { columns: 32, rows: 18 };
  const viewport = { width: 1280, height: 720 };
  assert.deepEqual(projectTableLabelPosition({
    labelAnchor: 'top-left', labelOffset: { column: 0, row: 0 },
  }, geometry, viewport), {
    left: '40px', top: '40px', transform: 'translate(0%, 0%)',
  });
  assert.deepEqual(projectTableLabelPosition({
    labelAnchor: 'bottom-right', labelOffset: { column: -2, row: -2 },
  }, geometry, viewport), {
    left: '1160px', top: '600px', transform: 'translate(-100%, -100%)',
  });
  assert.deepEqual(projectTableLabelPosition({
    labelAnchor: 'top-center', labelOffset: { column: 2, row: 1 },
  }, geometry, viewport), {
    left: '720px', top: '80px', transform: 'translate(-50%, 0%)',
  });
});

test('invalid rendering inputs fail closed to safe label and surface values', () => {
  assert.equal(normalizeLatticeSurface('mist'), 'mist');
  assert.equal(normalizeLatticeSurface('invented'), LATTICE_SURFACES[0].id);
  assert.deepEqual(projectTableLabelPosition({
    labelAnchor: 'invented', labelOffset: { column: 500, row: -500 },
  }, { columns: 3, rows: 3 }, { width: 300, height: 300 }), {
    left: '168.75px', top: '9.375px', transform: 'translate(0%, 0%)',
  });
});
