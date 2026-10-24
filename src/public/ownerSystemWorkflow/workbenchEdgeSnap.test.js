import test from 'node:test';
import assert from 'node:assert/strict';
import { gridEdgeMatch, moduleEdgeMatch, modulePositionMatch, nearestModuleEdge, snapModulePosition } from './workbenchEdgeSnap.js';
import { projectPresentationBoardView, resizePresentationBoardFromCorner } from './presentationBoardGeometry.js';
import { normalizeWorkbenchPreferences } from './workbenchPreferences.js';
const target = { left: 500, top: 100, width: 640, height: 360 };
test('visible edges join flush and align tops or bottoms without rounding to grid', () => {
  assert.deepEqual(snapModulePosition({ left: 204, top: 104, width: 300, height: 300 }, [target]), { left: 200, top: 100 });
  assert.deepEqual(snapModulePosition({ left: 1144, top: 154, width: 300, height: 300 }, [target]), { left: 1140, top: 160 });
  assert.deepEqual(snapModulePosition({ left: 185, top: 99, width: 300, height: 360 }, [target], 12), { left: 188, top: 100 });
});
test('snapping rejects distant targets and chooses the nearest eligible edge', () => {
  assert.deepEqual(snapModulePosition({ left: 200, top: 900, width: 300, height: 300 }, [target]), {});
  assert.equal(nearestModuleEdge({ left: 200, top: 100, width: 300, height: 300 }, [target, { ...target, left: 503 }], 'x', 'right', 504), 503);
  assert.equal(nearestModuleEdge(target, [target], 'x', 'right', 1170), null);
});
test('edge snapping preserves both Display ratios and the opposite resize corner', () => {
  for (const [columns, rows] of [[32, 18], [18, 32]]) {
    const view = projectPresentationBoardView({ columns, rows }, { width: 1440, height: 1000 }, .5, { identityStripHeight: 0 });
    const frame = { ...view.frame.board, left: 103, top: 79 };
    for (const corner of ['ne', 'nw', 'se', 'sw']) for (const movement of [{ x: 37, y: 4 }, { x: 4, y: 37 }]) {
      let destination;
      const r = resizePresentationBoardFromCorner(view, frame, corner, movement, 24, (axis, _side, edge) => { if (axis === 'x') destination = edge + 3; return axis === 'x' ? destination : null; });
      const b = { ...r.view.frame.board, ...r.position };
      const near = (a, expected) => assert.ok(Math.abs(a - expected) < .001, `${a} != ${expected}`);
      near(b.width / b.height, columns / rows);
      near(corner.endsWith('e') ? b.left : b.left + b.width, corner.endsWith('e') ? frame.left : frame.left + frame.width);
      near(corner.startsWith('s') ? b.top : b.top + b.height, corner.startsWith('s') ? frame.top : frame.top + frame.height);
      near(corner.endsWith('e') ? b.left + b.width : b.left, destination);
    }
  }
});

test('module snapping captures at 10 pixels and retains the same edge until beyond 18', () => {
  const rect = { left: 0, top: 120, width: 300, height: 180 };
  const first = moduleEdgeMatch(rect, [target], 'x', 'right', 490);
  assert.equal(first.value, 500);
  assert.equal(moduleEdgeMatch(rect, [target], 'x', 'right', 489.9), null);
  assert.equal(moduleEdgeMatch(rect, [target], 'x', 'right', 482, 0, first).value, 500);
  assert.equal(moduleEdgeMatch(rect, [target], 'x', 'right', 481.9, 0, first), null);
  const competitor = { id: 'other', ...target, left: 512 };
  assert.equal(moduleEdgeMatch(rect, [target, competitor], 'x', 'right', 512, 0, first).target, target);
  assert.equal(moduleEdgeMatch(rect, [competitor], 'x', 'right', 512, 0, first).target, competitor);
});

test('gap feedback describes the actual participating edges and retains identity across measurement', () => {
  const t = { id: 'target', ...target };
  const rect = { left: 103, top: 123, width: 300, height: 180 };
  const first = modulePositionMatch(rect, [t], 104);
  assert.equal(first.position.left, 96);
  assert.equal(first.matches.x.targetEdge, 500);
  assert.equal(first.matches.x.value, 396);
  assert.equal(first.matches.x.kind, 'gap');
  const held = modulePositionMatch({ ...rect, left: 113 }, [{ ...t }], 104, first.matches);
  assert.equal(held.position.left, 96);
  assert.equal(modulePositionMatch({ ...rect, left: 115 }, [{ ...t }], 104, first.matches).matches.x, undefined);
  assert.equal(modulePositionMatch(rect, [], 104, first.matches).matches.x, undefined);
});

test('grid feedback stays on the visible lattice while holding an active grid line', () => {
  const first = gridEdgeMatch('x', 'left', 100);
  assert.equal(first.value, 96);
  assert.equal(gridEdgeMatch('x', 'left', 113, 0, 24, first).value, 96);
  assert.equal(gridEdgeMatch('x', 'left', 115, 0, 24, first).value, 120);
  assert.equal(gridEdgeMatch('x', 'left', 115).value, 120);
});

test('zoomed grid movement and resizing reach every adjacent line in both directions', () => {
  for (const scale of [.1, .25, .33, .46, .5, 1, 2]) {
    const step = 24 * scale, origin = 37.125;
    for (const [axis, side] of [['x', 'left'], ['x', 'right'], ['y', 'top'], ['y', 'bottom']]) {
      for (const direction of [-1, 1]) {
        let match = gridEdgeMatch(axis, side, origin, origin, step);
        for (let cell = 1; cell <= 5; cell++) {
          const value = origin + direction * cell * step;
          match = gridEdgeMatch(axis, side, value, origin, step, match);
          assert.ok(Math.abs(match.value - value) < 1e-9, `${scale}: ${side} skipped cell ${direction * cell}`);
        }
      }
    }
  }
});

test('zoomed grid retains a little hysteresis without sticking through the next line', () => {
  for (const scale of [.1, .25, .33, .46, .5, 1]) {
    const step = 24 * scale, origin = 37.125;
    const first = gridEdgeMatch('x', 'left', origin, origin, step);
    for (const direction of [-1, 1]) {
      assert.equal(gridEdgeMatch('x', 'left', origin + direction * .6 * step, origin, step, first).value, origin);
      assert.equal(gridEdgeMatch('x', 'left', origin + direction * .8 * step, origin, step, first).value, origin + direction * step);
    }
  }
});

test('Display resize chooses a module edge over a grid match on the other axis', () => {
  const view = projectPresentationBoardView({ columns: 32, rows: 18 }, { width: 1440, height: 1000 }, .5, { identityStripHeight: 0 });
  const frame = { ...view.frame.board, left: 100, top: 80 };
  const r = resizePresentationBoardFromCorner(view, frame, 'se', { x: 20, y: 20 }, 0,
    axis => axis === 'x' ? { kind: 'grid', value: 840 } : { kind: 'edge', value: 500 });
  assert.ok(Math.abs(r.position.top + r.view.frame.board.height - 500) < .001);
  assert.equal(r.position.left, frame.left);
});
test('old preferences and malformed gaps normalize without changing grid preference', () => {
  assert.equal(normalizeWorkbenchPreferences({ shortcutSnap: false }).shortcutSnap, false);
  assert.equal(normalizeWorkbenchPreferences({ moduleGap: -1 }).moduleGap, 0);
  assert.equal(normalizeWorkbenchPreferences({ edgeSnap: false, moduleGap: 12 }).edgeSnap, false);
});
