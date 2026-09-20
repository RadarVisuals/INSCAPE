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
  const aspectRatio = options.aspectRatio || PRESENTATION_STAGE.aspectRatio;
  const stageWidth = Math.min(space.width, space.stageHeight * aspectRatio);
  const stageHeight = stageWidth / aspectRatio;
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
  const fit = fitPresentationBoard(viewport, { ...options, aspectRatio: documentGeometry?.columns / documentGeometry?.rows || options.aspectRatio });
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
  const fit = fitPresentationBoard(viewport, { ...options, aspectRatio: view.documentGeometry?.columns / view.documentGeometry?.rows || options.aspectRatio });
  if (!fit) return null;
  const maximumPercentage = maximumPresentationBoardPercentage(fit, viewport, options);
  // Available desktop space is not a request to resize the user's window.
  // Retain its pixel width, constrained only by the new available bounds.
  const safeScale = Math.min(view.frame.stage.width / fit.stage.width, percentageScale(maximumPercentage));
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

export function setContinuousPresentationBoardScale(view, scale) {
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

// Interpolate the centre with the same progress as the size. Both endpoint
// rectangles fit the Workbench, so intermediate rectangles need no edge shove.
export function presentationBoardWheelZoomPosition(view, origin, viewport, sidecarWidth = 0) {
  const range = view.maximumPercentage / 100 - origin.originView.scale;
  const progress = range > 0 ? Math.max(0, Math.min(1, (view.scale - origin.originView.scale) / range)) : 0;
  const centerX = origin.centerX + ((viewport.width - sidecarWidth) / 2 - origin.centerX) * progress;
  const centerY = origin.centerY + (viewport.height / 2 - origin.centerY) * progress;
  return { left: centerX - view.frame.board.width / 2, top: centerY - view.frame.board.height / 2 };
}

export function resizePresentationBoardFromCorner(view, frame, corner, movement, gridStep = 0, snapEdge = null, bounds = null) {
  if (!view || !frame || !['ne', 'nw', 'se', 'sw'].includes(corner)) return null;
  const deltaX = Number(movement?.x) || 0;
  const deltaY = Number(movement?.y) || 0;
  const horizontalDirection = corner.endsWith('e') ? 1 : -1;
  const verticalDirection = corner.startsWith('s') ? 1 : -1;
  const signedWidthMovement = deltaX * horizontalDirection;
  const signedHeightMovement = deltaY * verticalDirection;
  const inverseAspect = view.fit.stage.height / view.fit.stage.width;
  // Project the pointer delta onto the Stage's fixed-ratio diagonal. This keeps
  // both axes responsive without switching abruptly between X- and Y-derived sizes.
  const projectedWidthMovement = (signedWidthMovement + signedHeightMovement * inverseAspect)
    / (1 + inverseAspect ** 2);
  let requestedWidth = frame.width + projectedWidthMovement;
  const anchorX = horizontalDirection === 1 ? frame.left : frame.left + frame.width;
  const anchorY = verticalDirection === 1 ? frame.top : frame.top + frame.height;
  const chromeHeight = frame.height - frame.width * inverseAspect;
  if (gridStep > 0) {
    // Snap the projected moving edge, without changing the resize axis halfway
    // through a diagonal gesture.
    const edge = anchorX + horizontalDirection * requestedWidth;
    requestedWidth = (Math.round(edge / gridStep) * gridStep - anchorX) * horizontalDirection;
  }
  if (snapEdge) {
    const x = snapEdge('x', horizontalDirection === 1 ? 'right' : 'left', anchorX + horizontalDirection * requestedWidth);
    const y = snapEdge('y', verticalDirection === 1 ? 'bottom' : 'top',
      anchorY + verticalDirection * (requestedWidth * inverseAspect + chromeHeight));
    // A module edge wins over a grid candidate on either axis. Keep legacy
    // numeric callbacks readable while the shared snapper supplies its kind.
    const useY = y !== null && (x === null || x.kind === 'grid' && y.kind !== 'grid');
    if (useY) requestedWidth = (((y.value ?? y) - anchorY) * verticalDirection - chromeHeight) / inverseAspect;
    else if (x !== null) requestedWidth = ((x.value ?? x) - anchorX) * horizontalDirection;
  }
  let boundedWidth = Infinity;
  if (bounds) {
    const availableWidth = horizontalDirection === 1 ? bounds.right - anchorX : anchorX - bounds.left;
    const availableHeight = verticalDirection === 1 ? bounds.bottom - anchorY : anchorY - bounds.top;
    boundedWidth = Math.max(1, Math.min(availableWidth, (availableHeight - chromeHeight) / inverseAspect));
    requestedWidth = Math.min(requestedWidth, boundedWidth);
  }
  let nextView = setContinuousPresentationBoardScale(view, requestedWidth / view.fit.stage.width);
  // Screen limits win over the preferred minimum size near an anchored edge.
  if (nextView.frame.board.width > boundedWidth) {
    const scale = boundedWidth / view.fit.stage.width;
    const viewport = { width: view.frame.board.left * 2 + view.frame.board.width,
      height: view.frame.board.top * 2 + view.frame.board.height };
    nextView = Object.freeze({ ...view, scale, frame: projectScaledPresentationBoard(view.fit, viewport, scale) });
  }
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
