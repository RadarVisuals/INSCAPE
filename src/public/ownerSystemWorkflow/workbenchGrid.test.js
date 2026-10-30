import assert from 'node:assert/strict';
import test from 'node:test';
import { snapWorkbenchPosition } from './workbenchGrid.js';
import { normalizeWorkbenchPreferences } from './workbenchPreferences.js';
import { projectPresentationBoardView, resizePresentationBoardFromCorner } from './presentationBoardGeometry.js';

test('Display resize snaps its projected horizontal edge while preserving ratio and opposite corner', () => {
  for (const [columns, rows] of [[32, 18], [18, 32]]) {
    const view = projectPresentationBoardView({ columns, rows }, { width: 1440, height: 1000 }, .5, { identityStripHeight: 0 });
    const frame = { ...view.frame.board, left: 103, top: 79 };
    for (const corner of ['ne', 'nw', 'se', 'sw']) for (const movement of [{ x: 67, y: 11 }, { x: 11, y: 67 }]) {
      const result = resizePresentationBoardFromCorner(view, frame, corner, movement, 24);
      const b = { ...result.view.frame.board, ...result.position };
      const near = (a, b) => assert.ok(Math.abs(a - b) < .001, `${a} != ${b}`);
      near(b.width / b.height, columns / rows);
      near(corner.endsWith('e') ? b.left : b.left + b.width, corner.endsWith('e') ? frame.left : frame.left + frame.width);
      near(corner.startsWith('s') ? b.top : b.top + b.height, corner.startsWith('s') ? frame.top : frame.top + frame.height);
      const edge = corner.endsWith('e') ? b.left + b.width : b.left;
      near(edge / 24, Math.round(edge / 24));
    }
  }
});

test('window movement shares the existing 24px grid and can bypass it without changing the source', () => {
  const position = { left: 109, top: 67 };
  assert.deepEqual(snapWorkbenchPosition(position, true), { left: 120, top: 72 });
  assert.deepEqual(snapWorkbenchPosition(position, false), position);
  assert.deepEqual(position, { left: 109, top: 67 });
});
test('existing snapping preferences remain authoritative; removed column mode falls back without resetting other settings', () => {
  const old = normalizeWorkbenchPreferences({ shortcutSnap: false, gridMode: 'DOTS', surfaceId: 'carbon' });
  assert.equal(old.shortcutSnap, false); assert.equal(old.gridMode, 'DOTS');
  const trial = normalizeWorkbenchPreferences({ shortcutSnap: true, gridMode: 'COLUMNS', surfaceId: 'carbon' });
  assert.equal(trial.gridMode, 'LINES'); assert.equal(trial.surfaceId, 'carbon');
});
