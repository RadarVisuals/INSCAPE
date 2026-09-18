import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPresentationBoardView, setContinuousPresentationBoardScale, presentationBoardWheelZoomPosition } from './presentationBoardGeometry.js';

test('wheel zoom travels from any corner to centre without crossing bounds and reverses identically', () => {
  for (const viewport of [{ width: 1440, height: 950 }, { width: 390, height: 790 }]) {
    for (const geometry of [{ columns: 32, rows: 18 }, { columns: 18, rows: 32 }]) {
      for (const sidecarWidth of viewport.width > 600 ? [0, 300] : [0]) {
        const base = projectPresentationBoardView(geometry, viewport, .3, { inset: 24, identityStripHeight: 0, sidecarWidth });
        for (const left of [8, viewport.width - sidecarWidth - base.frame.board.width - 8]) {
          for (const top of [8, viewport.height - base.frame.board.height - 8]) {
            const origin = { originView: base, centerX: left + base.frame.board.width / 2, centerY: top + base.frame.board.height / 2 };
            const frames = [];
            for (let i = 0; i <= 20; i++) {
              const view = setContinuousPresentationBoardScale(base, base.scale + (base.maximumPercentage / 100 - base.scale) * i / 20);
              const position = presentationBoardWheelZoomPosition(view, origin, viewport, sidecarWidth);
              assert.ok(position.left >= 8 - 1e-6 && position.top >= 8 - 1e-6);
              assert.ok(position.left + view.frame.board.width + sidecarWidth <= viewport.width - 8 + 1e-6);
              assert.ok(position.top + view.frame.board.height <= viewport.height - 8 + 1e-6);
              frames.push({ view, position });
            }
            assert.ok(Math.abs(frames[0].position.left - left) < 1e-6 && Math.abs(frames[0].position.top - top) < 1e-6);
            const last = frames.at(-1);
            assert.ok(Math.abs(last.position.left + last.view.frame.board.width / 2 - (viewport.width - sidecarWidth) / 2) < 1e-6);
            assert.ok(Math.abs(last.position.top + last.view.frame.board.height / 2 - viewport.height / 2) < 1e-6);
            for (const { view, position } of frames.reverse()) assert.deepEqual(presentationBoardWheelZoomPosition(view, origin, viewport, sidecarWidth), position);
          }
        }
      }
    }
  }
});
