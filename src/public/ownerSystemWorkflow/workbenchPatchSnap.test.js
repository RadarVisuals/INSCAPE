import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkbenchGrid, workbenchGridMatch, limitWorkbenchEdge } from './workbenchPatchSnap.js';
import { marqueeContains } from './workbenchGrid.js';
import { workbenchDestinationCamera } from './workbenchNavigation.js';

test('a local origin and cell size stay exact through pan, fractional zoom and negative positions', () => {
  for (const zoom of [.25, .33, .5, 1, 1.75]) {
    const grid = { id: 'patch', left: -237.5 * zoom + 83, top: 101.25 * zoom - 62, step: 37.5 * zoom };
    for (let cell = 0; cell < 8; cell++) {
      const match = workbenchGridMatch(grid, 'x', 'left', grid.left + (cell + .2) * grid.step);
      assert.ok(Math.abs((match.value - 83) / zoom - (-237.5 + cell * 37.5)) < 1e-8);
    }
  }
});
test('frontmost patch wins overlap; small boundary hysteresis yields to another patch and the global fallback', () => {
  const back = { id: 'back', left: 10, top: 10, width: 80, height: 80, step: 20 };
  const front = { id: 'front', left: 20, top: 20, width: 40, height: 40, step: 10 };
  const global = { id: 'global', left: 0, top: 0, step: 24 };
  assert.equal(resolveWorkbenchGrid({ x: 40, y: 40 }, [back, front], global, 'back'), front);
  assert.equal(resolveWorkbenchGrid({ x: 70, y: 40 }, [back, front], global, 'front'), back);
  assert.equal(resolveWorkbenchGrid({ x: 92, y: 40 }, [back, front], global, 'back'), back);
  assert.equal(resolveWorkbenchGrid({ x: 100, y: 40 }, [back, front], global, 'back'), global);
});
test('retention cannot keep a line from a different patch, spacing or origin', () => {
  const grid = { id: 'a', left: 7, top: 0, step: 10 };
  const previous = workbenchGridMatch(grid, 'x', 'left', 17);
  assert.equal(workbenchGridMatch(grid, 'x', 'left', 23, previous).value, 17);
  assert.equal(workbenchGridMatch({ ...grid, id: 'b', left: 9 }, 'x', 'left', 23, previous).value, 19);
  assert.equal(workbenchGridMatch({ ...grid, step: 5 }, 'x', 'left', 23, previous).value, 22);
  assert.equal(workbenchGridMatch({ ...grid, left: 9 }, 'x', 'left', 23, previous).value, 19);
  assert.equal(limitWorkbenchEdge({ distance: 5 }, { step: 6 }), null);
});
test('marquee encloses small items without capturing an intersecting background of any module type', () => {
  const area = { left: 100, top: 100, width: 300, height: 200 };
  assert.equal(marqueeContains(area, { left: 120, top: 120, width: 80, height: 80 }), true);
  assert.equal(marqueeContains(area, { left: 0, top: 0, width: 1000, height: 1000 }), false);
  assert.equal(marqueeContains(area, { left: 380, top: 150, width: 50, height: 50 }), false);
  assert.equal(marqueeContains(area, area), true);
});
test('saved view framing round-trips without accumulating focus margins and adapts to another aspect ratio', () => {
  const viewport = { left: 0, top: 0, width: 1200, height: 700 };
  const bounds = { left: 520, top: 800, width: 2400, height: 1400 };
  const camera = workbenchDestinationCamera(bounds, viewport, .25, 0);
  assert.deepEqual(camera, { scale: .5, offset: { x: -260, y: -400 } });
  const narrow = workbenchDestinationCamera(bounds, { ...viewport, width: 800 }, .25, 0);
  assert.equal(narrow.scale, 1 / 3);
  assert.ok(Math.abs((400 - narrow.offset.x) / narrow.scale - 1720) < 1e-8);
});
