import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRESENTATION_BOARD_DEFAULT_PERCENTAGE,
  PRESENTATION_BOARD_MINIMUM_PERCENTAGE,
  clampPresentationBoardScale,
  fitPresentationBoard,
  maximumPresentationBoardPercentage,
  normalizePresentationBoardPercentage,
  presentationBoardInspectionFrame,
  projectPresentationBoardView,
  resizePresentationBoardFromCorner,
  resizePresentationBoardView,
  setPresentationBoardScale,
} from './presentationBoardGeometry.js';

test('Presentation Board fits one canonical 16:9 Stage inside wide and narrow Workbenches', () => {
  const wide = fitPresentationBoard({ width: 1440, height: 806 }, { inset: 24, identityStripHeight: 38 });
  assert.deepEqual(wide, {
    board: { left: 80, top: 24, width: 1280, height: 758 },
    stage: { width: 1280, height: 720 },
    identityStripHeight: 38,
    fitScale: 0.8,
  });
  assert.equal(wide.stage.width / wide.stage.height, 16 / 9);

  const narrow = fitPresentationBoard({ width: 390, height: 616 }, { inset: 8, identityStripHeight: 34 });
  assert.deepEqual(narrow, {
    board: { left: 8, top: 185.8125, width: 374, height: 244.375 },
    stage: { width: 374, height: 210.375 },
    identityStripHeight: 34,
    fitScale: 0.23375,
  });
  assert.equal(narrow.stage.width / narrow.stage.height, 16 / 9);
});

test('Board zoom uses integer percentages, a 25% minimum, and safe invalid-input fallback', () => {
  assert.equal(PRESENTATION_BOARD_MINIMUM_PERCENTAGE, 25);
  assert.equal(PRESENTATION_BOARD_DEFAULT_PERCENTAGE, 100);
  assert.equal(normalizePresentationBoardPercentage(25, 137), 25);
  assert.equal(normalizePresentationBoardPercentage(26, 137), 26);
  assert.equal(normalizePresentationBoardPercentage(-900, 137), 25);
  assert.equal(normalizePresentationBoardPercentage(9_999_999, 137), 137);
  assert.equal(normalizePresentationBoardPercentage('', 137, 82), 82);
  assert.equal(normalizePresentationBoardPercentage('invalid', 137, 82), 82);
  assert.equal(normalizePresentationBoardPercentage(Number.NaN, 137, 82), 82);
  assert.equal(clampPresentationBoardScale(-3, 1.37), 0.25);
  assert.equal(clampPresentationBoardScale(9, 1.37), 1.37);
});

test('viewport bounds derive the maximum and scale only Stage geometry while strip height stays fixed', () => {
  const viewport = { width: 1440, height: 806 };
  const options = { inset: 24, identityStripHeight: 38 };
  const fit = fitPresentationBoard(viewport, options);
  assert.equal(maximumPresentationBoardPercentage(fit, viewport, options), 100);
  assert.equal(maximumPresentationBoardPercentage({ stage: { width: 800, height: 450 } }, viewport, options), 160);
  const view = projectPresentationBoardView(Object.freeze({ columns: 32, rows: 18 }), viewport, 1, options);
  assert.equal(view.scale, 1);
  assert.equal(view.maximumPercentage, 100);
  assert.deepEqual(view.frame, { board: fit.board, stage: fit.stage });

  const quarter = setPresentationBoardScale(view, 0.25);
  assert.equal(quarter.frame.stage.width, fit.stage.width * 0.25);
  assert.equal(quarter.frame.stage.height, fit.stage.height * 0.25);
  assert.equal(quarter.frame.board.width, quarter.frame.stage.width);
  assert.equal(quarter.frame.board.height - quarter.frame.stage.height, 38);
  assert.equal(quarter.fit.identityStripHeight, view.fit.identityStripHeight);

  const maximum = setPresentationBoardScale(view, 999);
  assert.equal(maximum.scale, 1);
  assert.ok(maximum.frame.board.left >= options.inset);
  assert.ok(maximum.frame.board.top >= options.inset);
  assert.ok(maximum.frame.board.left + maximum.frame.board.width <= viewport.width - options.inset);
  assert.ok(maximum.frame.board.top + maximum.frame.board.height <= viewport.height - options.inset);
});

test('resize recomputes the safe maximum, clamps only when needed, and never mutates document geometry', () => {
  const documentGeometry = Object.freeze({ columns: 32, rows: 18 });
  const options = { inset: 24, identityStripHeight: 38 };
  const initial = projectPresentationBoardView(documentGeometry, { width: 1440, height: 806 }, 0.75, options);
  const resized = resizePresentationBoardView(initial, { width: 420, height: 700 }, options);

  assert.equal(initial.documentGeometry, documentGeometry);
  assert.equal(resized.documentGeometry, documentGeometry);
  assert.deepEqual(documentGeometry, { columns: 32, rows: 18 });
  assert.equal(initial.scale, 0.75);
  assert.equal(resized.maximumPercentage, 100);
  assert.equal(resized.scale, 0.75);
  assert.equal(resized.fit.stage.width / resized.fit.stage.height, 16 / 9);
  assert.notDeepEqual(resized.fit, initial.fit);
  assert.equal(JSON.stringify(documentGeometry), '{"columns":32,"rows":18}');
});

test('inspect frame uses the safe fitted viewport without overwriting permanent Board zoom', () => {
  const view = projectPresentationBoardView(
    Object.freeze({ columns: 32, rows: 18 }),
    { width: 1440, height: 806 },
    0.3,
    { inset: 24, identityStripHeight: 38 },
  );
  const inspection = presentationBoardInspectionFrame(view, { width: 1440, height: 806 },
    { inset: 24, identityStripHeight: 38 });

  assert.equal(view.scale, 0.3);
  assert.equal(inspection.scale, 1);
  assert.equal(inspection.board.left, 80);
  assert.equal(inspection.board.top, 24);
  assert.equal(inspection.board.width, 1280);
  assert.equal(inspection.board.height, 758);
  assert.equal(inspection.stage.width / inspection.stage.height, 16 / 9);
  assert.equal(view.scale, 0.3);
});

test('inspect frame reserves a sidecar without distorting the canonical Stage', () => {
  const view = projectPresentationBoardView({ columns: 32, rows: 18 }, { width: 1440, height: 806 }, 0.3,
    { inset: 24, identityStripHeight: 38 });
  const inspection = presentationBoardInspectionFrame(view, { width: 1440, height: 806 },
    { inset: 24, identityStripHeight: 38, sidecarWidth: 286 });
  assert.equal(inspection.board.width / (inspection.board.height - 38), 16 / 9);
  assert.ok(inspection.board.left + inspection.board.width + 286 <= 1440 - 24);
  assert.equal(inspection.stage.width / inspection.stage.height, 16 / 9);
});

test('corner resizing preserves Stage ratio and anchors the opposite corner', () => {
  const view = projectPresentationBoardView({ columns: 32, rows: 18 }, { width: 1440, height: 806 }, 0.5,
    { inset: 24, identityStripHeight: 38 });
  const frame = { ...view.frame.board, left: 160, top: 120 };
  const southEast = resizePresentationBoardFromCorner(view, frame, 'se', { x: 160, y: 0 });
  assert.equal(southEast.view.scale, 0.63);
  assert.deepEqual(southEast.position, { left: 160, top: 120 });
  assert.equal(southEast.view.frame.stage.width / southEast.view.frame.stage.height, 16 / 9);

  const northWest = resizePresentationBoardFromCorner(view, frame, 'nw', { x: 160, y: 0 });
  assert.equal(northWest.view.scale, 0.38);
  assert.equal(northWest.position.left + northWest.view.frame.board.width, frame.left + frame.width);
  assert.equal(northWest.position.top + northWest.view.frame.board.height, frame.top + frame.height);
});
