import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestModuleEdge, snapModulePosition } from './workbenchEdgeSnap.js';
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
      const r = resizePresentationBoardFromCorner(view, frame, corner, movement, 24, (_axis, _side, edge) => { destination = edge + 3; return destination; });
      const b = { ...r.view.frame.board, ...r.position };
      const near = (a, expected) => assert.ok(Math.abs(a - expected) < .001, `${a} != ${expected}`);
      near(b.width / b.height, columns / rows);
      near(corner.endsWith('e') ? b.left : b.left + b.width, corner.endsWith('e') ? frame.left : frame.left + frame.width);
      near(corner.startsWith('s') ? b.top : b.top + b.height, corner.startsWith('s') ? frame.top : frame.top + frame.height);
      near(movement.x > movement.y ? (corner.endsWith('e') ? b.left + b.width : b.left) : (corner.startsWith('s') ? b.top + b.height : b.top), destination);
    }
  }
});
test('old preferences and malformed gaps normalize without changing grid preference', () => {
  assert.equal(normalizeWorkbenchPreferences({ shortcutSnap: false }).shortcutSnap, false);
  assert.equal(normalizeWorkbenchPreferences({ moduleGap: -1 }).moduleGap, 0);
  assert.equal(normalizeWorkbenchPreferences({ edgeSnap: false, moduleGap: 12 }).edgeSnap, false);
});
