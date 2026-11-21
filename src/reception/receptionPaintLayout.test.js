import test from 'node:test';
import assert from 'node:assert/strict';
import { receptionPaintLayout } from './receptionPaintLayout.js';

test('cell, layer and adjoining paint edges agree at fractional canvas origins and densities', () => {
  const a = { left: 0, top: 0, width: 301.27, height: 168.37 };
  const b = { left: 301.27, top: 0, width: 221.55, height: 168.37 };
  const layout = { gap: 0, windows: { cellA: a, imageA: { ...a }, cellB: b, imageB: { ...b } },
    cells: [{ id: 'cellA', window: a }, { id: 'cellB', window: b }] };
  const saved = structuredClone(layout);
  for (const density of [1, 1.25, 1.5, 2]) for (const origin of [{ left: 0, top: .5 }, { left: 13.32, top: 22.47 }]) {
    const result = receptionPaintLayout(layout, density, origin), { cellA, imageA, cellB, imageB } = result.windows;
    assert.deepEqual(imageA, cellA); assert.deepEqual(imageB, cellB);
    assert.ok(Math.abs(cellA.left + cellA.width - cellB.left) < 1e-9);
    for (const rect of [cellA, cellB]) for (const value of [(rect.left + origin.left) * density,
      (rect.top + origin.top) * density, (rect.left + rect.width + origin.left) * density])
      assert.ok(Math.abs(value - Math.round(value)) < 1e-9);
    assert.deepEqual(result.cells.map(cell => cell.window), [cellA, cellB]);
  }
  assert.deepEqual(layout, saved);
  const gapped = { ...layout, gap: .2 };
  assert.equal(receptionPaintLayout(gapped), gapped);
});
