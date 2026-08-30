export const PRESENTATION_STAGE = Object.freeze({ width: 1600, height: 900, aspectRatio: 16 / 9 });
export const PRESENTATION_BOARD_MINIMUM_PERCENTAGE = 25;
export const PRESENTATION_BOARD_DEFAULT_PERCENTAGE = 100;
export const PRESENTATION_BOARD_METADATA_SIDECAR = Object.freeze({
  gap: 8,
  panelWidth: 278,
  trackWidth: 286,
});
const PRESENTATION_BOARD_RESPONSIVE_BLEND = Object.freeze({ start: 600, end: 760 });

const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const cleanOffset = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const percentageScale = (percentage) => percentage / 100;

export function presentationBoardResponsiveMetrics(viewportWidth) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const blend = Math.min(1, Math.max(0,
    (width - PRESENTATION_BOARD_RESPONSIVE_BLEND.start)
      / (PRESENTATION_BOARD_RESPONSIVE_BLEND.end - PRESENTATION_BOARD_RESPONSIVE_BLEND.start)));
  const narrowMetadataWidth = Math.min(180, width * 0.42);
  return Object.freeze({
    identityStripHeight: 34 + 4 * blend,
    inset: 8 + 16 * blend,
    metadataWidth: narrowMetadataWidth
      + (PRESENTATION_BOARD_METADATA_SIDECAR.trackWidth - narrowMetadataWidth) * blend,
  });
}

function availablePresentationBoardSpace(viewport, options = {}) {
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);
  if (!finitePositive(width) || !finitePositive(height)) return null;
  const inset = Math.max(0, cleanOffset(options.inset ?? 18));
  const identityStripHeight = Math.max(0, cleanOffset(options.identityStripHeight ?? 38));
  return Object.freeze({
    height: Math.max(1, height - inset * 2),
    identityStripHeight,
    stageHeight: Math.max(1, height - inset * 2 - identityStripHeight),
    width: Math.max(1, width - inset * 2),
  });
}

export function fitPresentationBoard(viewport, options = {}) {
  const space = availablePresentationBoardSpace(viewport, options);
  if (!space) return null;
  const stageWidth = Math.min(space.width, space.stageHeight * PRESENTATION_STAGE.aspectRatio);
  const stageHeight = stageWidth / PRESENTATION_STAGE.aspectRatio;
  const boardHeight = stageHeight + space.identityStripHeight;
  return Object.freeze({
    board: Object.freeze({
      left: (Number(viewport.width) - stageWidth) / 2,
      top: (Number(viewport.height) - boardHeight) / 2,
      width: stageWidth,
      height: boardHeight,
    }),
    stage: Object.freeze({ width: stageWidth, height: stageHeight }),
    identityStripHeight: space.identityStripHeight,
    fitScale: stageWidth / PRESENTATION_STAGE.width,
  });
}

export function maximumPresentationBoardPercentage(fit, viewport, options = {}) {
  const space = availablePresentationBoardSpace(viewport, options);
  if (!fit || !space || !finitePositive(fit.stage?.width) || !finitePositive(fit.stage?.height)) {
    return PRESENTATION_BOARD_DEFAULT_PERCENTAGE;
  }
  const sidecarWidth = Math.max(0, cleanOffset(options.sidecarWidth));
  const availableStageWidth = Math.max(1, space.width - sidecarWidth);
  const maximumScale = Math.min(availableStageWidth / fit.stage.width, space.stageHeight / fit.stage.height);
  const minimumMaximum = sidecarWidth > 0
    ? PRESENTATION_BOARD_MINIMUM_PERCENTAGE
    : PRESENTATION_BOARD_DEFAULT_PERCENTAGE;
  return Math.max(minimumMaximum, Math.floor((maximumScale + Number.EPSILON) * 100));
}

export function normalizePresentationBoardPercentage(value, maximumPercentage, fallback = PRESENTATION_BOARD_DEFAULT_PERCENTAGE) {
  const maximum = Number.isFinite(Number(maximumPercentage))
    ? Math.max(PRESENTATION_BOARD_MINIMUM_PERCENTAGE, Math.floor(Number(maximumPercentage)))
    : PRESENTATION_BOARD_DEFAULT_PERCENTAGE;
  const fallbackValue = Number.isFinite(Number(fallback)) ? Math.round(Number(fallback)) : PRESENTATION_BOARD_DEFAULT_PERCENTAGE;
  const requested = typeof value === 'string' && value.trim() === '' ? fallbackValue : Number(value);
  const safe = Number.isFinite(requested) ? Math.round(requested) : fallbackValue;
  return Math.min(maximum, Math.max(PRESENTATION_BOARD_MINIMUM_PERCENTAGE, safe));
}

export function clampPresentationBoardScale(scale, maximumScale = 1, fallbackScale = 1) {
  const maximumPercentage = Math.max(PRESENTATION_BOARD_MINIMUM_PERCENTAGE, Math.floor(Number(maximumScale) * 100));
  return percentageScale(normalizePresentationBoardPercentage(
    Number(scale) * 100, maximumPercentage, Number(fallbackScale) * 100,
  ));
}

function clampContinuousPresentationBoardScale(scale, maximumScale = 1, fallbackScale = 1) {
  const minimumScale = percentageScale(PRESENTATION_BOARD_MINIMUM_PERCENTAGE);
  const numericMaximum = Number(maximumScale);
  const safeMaximum = Number.isFinite(numericMaximum) ? Math.max(minimumScale, numericMaximum) : 1;
  const numericFallback = Number(fallbackScale);
  const safeFallback = Number.isFinite(numericFallback) ? numericFallback : 1;
  const requested = Number(scale);
  return Math.min(safeMaximum, Math.max(minimumScale, Number.isFinite(requested) ? requested : safeFallback));
}

function projectScaledPresentationBoard(fit, viewport, scale) {
  const stage = Object.freeze({ width: fit.stage.width * scale, height: fit.stage.height * scale });
  const board = Object.freeze({
    left: (Number(viewport.width) - stage.width) / 2,
    top: (Number(viewport.height) - stage.height - fit.identityStripHeight) / 2,
    width: stage.width,
    height: stage.height + fit.identityStripHeight,
  });
  return Object.freeze({ board, stage });
}

export function projectPresentationBoardView(documentGeometry, viewport, scale = 1, options = {}) {
  const fit = fitPresentationBoard(viewport, options);
  if (!fit) return null;
  const maximumPercentage = maximumPresentationBoardPercentage(fit, viewport, options);
  const safeScale = clampPresentationBoardScale(scale, percentageScale(maximumPercentage));
  return Object.freeze({
    documentGeometry,
    fit,
    frame: projectScaledPresentationBoard(fit, viewport, safeScale),
    maximumPercentage,
    scale: safeScale,
  });
}

export function resizePresentationBoardView(view, viewport, options = {}) {
  if (!view) return null;
  const fit = fitPresentationBoard(viewport, options);
  if (!fit) return null;
  const maximumPercentage = maximumPresentationBoardPercentage(fit, viewport, options);
  const safeScale = clampContinuousPresentationBoardScale(
    view.scale, percentageScale(maximumPercentage), view.scale,
  );
  return Object.freeze({
    documentGeometry: view.documentGeometry,
    fit,
    frame: projectScaledPresentationBoard(fit, viewport, safeScale),
    maximumPercentage,
    scale: safeScale,
  });
}

export function presentationBoardInspectionFrame(view, viewport, options = {}) {
  const space = availablePresentationBoardSpace(viewport, options);
  if (!view?.fit || !space) return null;
  const inset = Math.max(0, cleanOffset(options.inset ?? 18));
  const sidecarWidth = Math.max(0, cleanOffset(options.sidecarWidth));
  const availableStageWidth = Math.max(1, space.width - sidecarWidth);
  const scale = Math.min(
    availableStageWidth / view.fit.stage.width,
    space.stageHeight / view.fit.stage.height,
  );
  const stage = Object.freeze({
    width: view.fit.stage.width * scale,
    height: view.fit.stage.height * scale,
  });
  const groupWidth = stage.width + sidecarWidth;
  const boardHeight = stage.height + space.identityStripHeight;
  return Object.freeze({
    board: Object.freeze({
      left: inset + Math.max(0, (space.width - groupWidth) / 2),
      top: inset + Math.max(0, (space.height - boardHeight) / 2),
      width: stage.width,
      height: boardHeight,
    }),
    scale,
    sidecarWidth,
    stage,
  });
}

export function setPresentationBoardScale(view, scale) {
  if (!view) return null;
  const safeScale = clampPresentationBoardScale(scale, percentageScale(view.maximumPercentage), view.scale);
  if (safeScale === view.scale) return view;
  const viewport = {
    width: view.frame.board.left * 2 + view.frame.board.width,
    height: view.frame.board.top * 2 + view.frame.board.height,
  };
  return Object.freeze({ ...view, frame: projectScaledPresentationBoard(view.fit, viewport, safeScale), scale: safeScale });
}

function setContinuousPresentationBoardScale(view, scale) {
  const safeScale = clampContinuousPresentationBoardScale(
    scale, percentageScale(view.maximumPercentage), view.scale,
  );
  if (safeScale === view.scale) return view;
  const viewport = {
    width: view.frame.board.left * 2 + view.frame.board.width,
    height: view.frame.board.top * 2 + view.frame.board.height,
  };
  return Object.freeze({ ...view, frame: projectScaledPresentationBoard(view.fit, viewport, safeScale), scale: safeScale });
}

export function resizePresentationBoardFromCorner(view, frame, corner, movement) {
  if (!view || !frame || !['ne', 'nw', 'se', 'sw'].includes(corner)) return null;
  const deltaX = Number(movement?.x) || 0;
  const deltaY = Number(movement?.y) || 0;
  const horizontalDirection = corner.endsWith('e') ? 1 : -1;
  const verticalDirection = corner.startsWith('s') ? 1 : -1;
  const signedWidthMovement = deltaX * horizontalDirection;
  const signedHeightMovement = deltaY * verticalDirection;
  const inverseAspect = 1 / PRESENTATION_STAGE.aspectRatio;
  // Project the pointer delta onto the Stage's fixed-ratio diagonal. This keeps
  // both axes responsive without switching abruptly between X- and Y-derived sizes.
  const projectedWidthMovement = (signedWidthMovement + signedHeightMovement * inverseAspect)
    / (1 + inverseAspect ** 2);
  const requestedWidth = frame.width + projectedWidthMovement;
  const nextView = setContinuousPresentationBoardScale(view, requestedWidth / view.fit.stage.width);
  const width = nextView.frame.board.width;
  const height = nextView.frame.board.height;
  return Object.freeze({
    view: nextView,
    position: Object.freeze({
      left: corner.endsWith('w') ? frame.left + frame.width - width : frame.left,
      top: corner.startsWith('n') ? frame.top + frame.height - height : frame.top,
    }),
  });
}
