import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LATTICE_GEOMETRY_PRESETS,
  PROTOTYPE_START_GEOMETRY,
  LATTICE_SURFACES,
  assertRenderGeometry,
  normalizeLatticeSurface,
  projectAuthoredLatticeField,
  projectTableLabelPosition,
  semanticGridVariables,
} from './latticeGeometry.js';

test('candidate geometry remains explicit while rendering accepts any valid contract geometry', () => {
  assert.deepEqual(LATTICE_GEOMETRY_PRESETS.map(({ geometry }) => geometry), [
    { columns: 20, rows: 20 },
    { columns: 24, rows: 18 },
    { columns: 24, rows: 16 },
  ]);
  assert.deepEqual(PROTOTYPE_START_GEOMETRY, { columns: 24, rows: 16 });
  assert.deepEqual(assertRenderGeometry({ columns: 12, rows: 9 }), { columns: 12, rows: 9 });
  assert.throws(() => assertRenderGeometry({ columns: 0, rows: 9 }), /positive integer/);
  assert.throws(() => assertRenderGeometry({ columns: 12.5, rows: 9 }), /positive integer/);
  assert.deepEqual(semanticGridVariables({ columns: 12, rows: 9 }, { width: 1200, height: 900 }), {
    '--lattice-grid-columns': 12,
    '--lattice-grid-rows': 9,
    '--lattice-grid-cell-size': '100px',
    '--lattice-grid-origin-x': '0px',
    '--lattice-grid-origin-y': '0px',
  });
});

test('authored field preserves square cells inside landscape and portrait containers', () => {
  assert.deepEqual(projectAuthoredLatticeField(
    { columns: 24, rows: 16 },
    { width: 1280, height: 720 },
  ), { cellSize: 45, width: 1080, height: 720, left: 100, top: 0 });
  assert.deepEqual(projectAuthoredLatticeField(
    { columns: 24, rows: 16 },
    { width: 390, height: 844 },
  ), { cellSize: 16.25, width: 390, height: 260, left: 0, top: 292 });
  assert.throws(() => projectAuthoredLatticeField(
    { columns: 24, rows: 16 },
    { width: 0, height: 844 },
  ), /positive viewport/);
});

test('neighboring authored fields snap to one shared stage-grid phase', () => {
  const geometry = { columns: 24, rows: 16 };
  const viewport = { width: 1024, height: 868 };
  const center = projectAuthoredLatticeField(geometry, viewport, { x: 0, y: 0 });
  const below = projectAuthoredLatticeField(geometry, viewport, { x: 0, y: 1 });
  const cellsBetweenOrigins = (viewport.height + below.top - center.top) / center.cellSize;
  assert.equal(Number.isInteger(cellsBetweenOrigins), true);
  assert.equal(below.left, center.left);
});

test('label anchors project onto semantic cells with global bounded offsets', () => {
  const geometry = { columns: 24, rows: 16 };
  const viewport = { width: 1280, height: 720 };
  assert.deepEqual(projectTableLabelPosition({
    labelAnchor: 'top-left', labelOffset: { column: 0, row: 0 },
  }, geometry, viewport), {
    left: '45px', top: '45px', transform: 'translate(0%, 0%)',
  });
  assert.deepEqual(projectTableLabelPosition({
    labelAnchor: 'bottom-right', labelOffset: { column: -2, row: -2 },
  }, geometry, viewport), {
    left: '1145px', top: '585px', transform: 'translate(-100%, -100%)',
  });
  assert.deepEqual(projectTableLabelPosition({
    labelAnchor: 'top-center', labelOffset: { column: 2, row: 1 },
  }, geometry, viewport), {
    left: '730px', top: '90px', transform: 'translate(-50%, 0%)',
  });
});

test('invalid rendering inputs fail closed to safe label and surface values', () => {
  assert.equal(normalizeLatticeSurface('mist'), 'mist');
  assert.equal(normalizeLatticeSurface('invented'), LATTICE_SURFACES[0].id);
  assert.deepEqual(projectTableLabelPosition({
    labelAnchor: 'invented', labelOffset: { column: 500, row: -500 },
  }, { columns: 3, rows: 3 }, { width: 300, height: 300 }), {
    left: '300px', top: '0px', transform: 'translate(0%, 0%)',
  });
});
