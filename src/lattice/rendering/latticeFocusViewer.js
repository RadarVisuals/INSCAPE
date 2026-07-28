export const DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG = Object.freeze({
  horizontalMargin: 48,
  verticalMargin: 40,
  verticalArtworkScale: 0.85,
  browseDuration: 240,
  swipeThreshold: 48,
  swipeDominance: 1.25,
  wheelAccumulationThreshold: 80,
  wheelCooldown: 320,
  dossierBreakpoint: 900,
  dossierWidth: 320,
  dossierGap: 88,
  horizontalAspectRatio: 1.6,
  inspectionPadding: 24,
  lowerDossierGap: 28,
  lowerDossierHeight: 260,
  lowerPanelGap: 28,
  navigationClearance: 72,
  compactHorizontalMargin: 16,
  compactDossierHeight: 420,
});

function finitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${label} must be a positive finite number`);
  return value;
}

function finiteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${label} must be a non-negative finite number`);
  return value;
}

export function normalizeViewerRectangle(rectangle, label = 'rectangle') {
  if (!rectangle || typeof rectangle !== 'object') throw new TypeError(`${label} is required`);
  const left = Number(rectangle.left);
  const top = Number(rectangle.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) throw new TypeError(`${label} position must be finite`);
  return Object.freeze({
    left,
    top,
    width: finitePositive(Number(rectangle.width), `${label}.width`),
    height: finitePositive(Number(rectangle.height), `${label}.height`),
  });
}

export function focusedViewerRectangle(originRectangle, viewport, config = DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG) {
  const origin = normalizeViewerRectangle(originRectangle, 'originRectangle');
  const viewportWidth = finitePositive(Number(viewport?.width), 'viewport.width');
  const viewportHeight = finitePositive(Number(viewport?.height), 'viewport.height');
  const horizontalMargin = Math.max(0, Number(config?.horizontalMargin));
  const verticalMargin = Math.max(0, Number(config?.verticalMargin));
  const verticalArtworkScale = Number(config?.verticalArtworkScale);
  if (!Number.isFinite(horizontalMargin) || !Number.isFinite(verticalMargin)) throw new TypeError('viewer margins must be finite');
  if (!Number.isFinite(verticalArtworkScale) || verticalArtworkScale <= 0 || verticalArtworkScale > 1) throw new TypeError('verticalArtworkScale must be between zero and one');

  const availableWidth = Math.max(1, viewportWidth - (horizontalMargin * 2));
  const availableHeight = Math.max(1, viewportHeight - (verticalMargin * 2)) * verticalArtworkScale;
  const scale = Math.min(availableWidth / origin.width, availableHeight / origin.height);
  const width = origin.width * scale;
  const height = origin.height * scale;

  return Object.freeze({
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2,
    width,
    height,
  });
}

function viewerViewport(viewport) {
  return {
    width: finitePositive(Number(viewport?.width), 'viewport.width'),
    height: finitePositive(Number(viewport?.height), 'viewport.height'),
  };
}

function viewerDossierState(dossiersOpen) {
  if (typeof dossiersOpen !== 'boolean') throw new TypeError('viewer dossier state must be boolean');
  return dossiersOpen;
}

const rectangle = (left, top, width, height) => Object.freeze({ left, top, width, height });

export function focusViewerLayout(originRectangle, viewport, dossiersOpen, config = DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG) {
  const origin = normalizeViewerRectangle(originRectangle, 'originRectangle');
  const size = viewerViewport(viewport);
  const open = viewerDossierState(dossiersOpen);
  const focused = focusedViewerRectangle(origin, size, config);
  const breakpoint = finitePositive(Number(config?.dossierBreakpoint), 'dossierBreakpoint');
  const dossierWidth = finitePositive(Number(config?.dossierWidth), 'dossierWidth');
  const dossierGap = finiteNonNegative(Number(config?.dossierGap), 'dossierGap');
  const horizontalAspectRatio = finitePositive(Number(config?.horizontalAspectRatio), 'horizontalAspectRatio');
  const inspectionPadding = finiteNonNegative(Number(config?.inspectionPadding), 'inspectionPadding');
  const horizontalMargin = Math.max(0, Number(config?.horizontalMargin));
  const verticalMargin = Math.max(0, Number(config?.verticalMargin));
  const verticalArtworkScale = Number(config?.verticalArtworkScale);

  if (size.width < breakpoint) {
    const horizontalMargin = Math.max(0, Number(config?.compactHorizontalMargin));
    const dossierHeight = finitePositive(Number(config?.compactDossierHeight), 'compactDossierHeight');
    if (!Number.isFinite(horizontalMargin)) throw new TypeError('compactHorizontalMargin must be finite');
    const panelWidth = Math.max(1, size.width - (horizontalMargin * 2));
    const firstPanelTop = focused.top + focused.height + dossierGap;
    const leftTop = firstPanelTop;
    const rightTop = firstPanelTop + (open ? dossierHeight + dossierGap : 0);
    const finalPanelBottom = open ? rightTop + dossierHeight : focused.top + focused.height;
    return Object.freeze({
      mode: 'compact',
      artwork: focused,
      leftDossier: rectangle(horizontalMargin, leftTop, panelWidth, dossierHeight),
      rightDossier: rectangle(horizontalMargin, rightTop, panelWidth, dossierHeight),
      inspectionFrame: rectangle(
        Math.max(0, focused.left - inspectionPadding),
        Math.max(0, focused.top - inspectionPadding),
        Math.min(size.width, focused.width + (inspectionPadding * 2)),
        focused.height + (inspectionPadding * 2),
      ),
      connectors: Object.freeze([]),
      contentHeight: Math.max(size.height, finalPanelBottom + dossierGap),
    });
  }

  if ((origin.width / origin.height) >= horizontalAspectRatio) {
    const lowerDossierGap = finiteNonNegative(Number(config?.lowerDossierGap), 'lowerDossierGap');
    const lowerDossierHeight = finitePositive(Number(config?.lowerDossierHeight), 'lowerDossierHeight');
    const lowerPanelGap = finiteNonNegative(Number(config?.lowerPanelGap), 'lowerPanelGap');
    const navigationClearance = finiteNonNegative(Number(config?.navigationClearance), 'navigationClearance');
    const availableWidth = Math.max(1, size.width - (horizontalMargin * 2) - (inspectionPadding * 2));
    const availableArtworkHeight = Math.max(
      1,
      size.height - (verticalMargin * 2) - (inspectionPadding * 2)
        - lowerDossierGap - lowerDossierHeight - navigationClearance,
    );
    const scale = Math.min(availableWidth / origin.width, availableArtworkHeight / origin.height);
    const artworkWidth = origin.width * scale;
    const artworkHeight = origin.height * scale;
    const frameWidth = artworkWidth + (inspectionPadding * 2);
    const frameHeight = artworkHeight + (inspectionPadding * 2);
    const groupHeight = frameHeight + lowerDossierGap + lowerDossierHeight;
    const frameLeft = (size.width - frameWidth) / 2;
    const frameTop = Math.max(verticalMargin, (size.height - navigationClearance - groupHeight) / 2);
    const artwork = rectangle(
      frameLeft + inspectionPadding,
      frameTop + inspectionPadding,
      artworkWidth,
      artworkHeight,
    );
    const inspectionFrame = rectangle(frameLeft, frameTop, frameWidth, frameHeight);
    const panelGroupWidth = Math.min(size.width - (horizontalMargin * 2), Math.max(frameWidth, dossierWidth * 2 + lowerPanelGap));
    const panelWidth = (panelGroupWidth - lowerPanelGap) / 2;
    const panelLeft = (size.width - panelGroupWidth) / 2;
    const panelTop = frameTop + frameHeight + lowerDossierGap;
    const branchY = frameTop + frameHeight + (lowerDossierGap / 2);
    const centerX = size.width / 2;

    return Object.freeze({
      mode: 'lower',
      artwork,
      leftDossier: rectangle(panelLeft, panelTop, panelWidth, lowerDossierHeight),
      rightDossier: rectangle(panelLeft + panelWidth + lowerPanelGap, panelTop, panelWidth, lowerDossierHeight),
      inspectionFrame,
      connectors: Object.freeze([
        Object.freeze({ left: centerX, top: frameTop + frameHeight, width: 1, height: lowerDossierGap / 2 }),
        Object.freeze({ left: panelLeft + panelWidth / 2, top: branchY, width: panelGroupWidth - panelWidth, height: 1 }),
        Object.freeze({ left: panelLeft + panelWidth / 2, top: branchY, width: 1, height: lowerDossierGap / 2 }),
        Object.freeze({ left: panelLeft + panelWidth + lowerPanelGap + panelWidth / 2, top: branchY, width: 1, height: lowerDossierGap / 2 }),
      ]),
      contentHeight: Math.max(size.height, panelTop + lowerDossierHeight + navigationClearance),
    });
  }

  const panelAllowance = 2 * (dossierWidth + dossierGap);
  const availableWidth = Math.max(1, size.width - (horizontalMargin * 2) - panelAllowance);
  const availableHeight = Math.max(1, size.height - (verticalMargin * 2)) * verticalArtworkScale;
  const scale = Math.min(availableWidth / origin.width, availableHeight / origin.height);
  const artworkWidth = Math.max(1, Math.floor(origin.width * scale));
  const artworkHeight = artworkWidth * (origin.height / origin.width);
  const groupWidth = artworkWidth + panelAllowance;
  const groupLeft = Math.round((size.width - groupWidth) / 2);
  const artworkLeft = groupLeft + dossierWidth + dossierGap;
  const artwork = rectangle(artworkLeft, (size.height - artworkHeight) / 2, artworkWidth, artworkHeight);
  const dossierHeight = Math.max(1, artworkHeight * 0.98);
  const dossierTop = (size.height - dossierHeight) / 2;
  const inspectionFrame = rectangle(
    artwork.left - inspectionPadding,
    artwork.top - inspectionPadding,
    artwork.width + (inspectionPadding * 2),
    artwork.height + (inspectionPadding * 2),
  );
  const connectorTop = size.height / 2;

  return Object.freeze({
    mode: 'side',
    artwork,
    leftDossier: rectangle(
      groupLeft,
      dossierTop,
      dossierWidth,
      dossierHeight,
    ),
    rightDossier: rectangle(
      artwork.left + artwork.width + dossierGap,
      dossierTop,
      dossierWidth,
      dossierHeight,
    ),
    inspectionFrame,
    connectors: Object.freeze([
      Object.freeze({
        left: groupLeft + dossierWidth,
        top: connectorTop,
        width: inspectionFrame.left - (groupLeft + dossierWidth),
        height: 1,
      }),
      Object.freeze({
        left: inspectionFrame.left + inspectionFrame.width,
        top: connectorTop,
        width: artwork.left + artwork.width + dossierGap - (inspectionFrame.left + inspectionFrame.width),
        height: 1,
      }),
    ]),
    contentHeight: size.height,
  });
}

export function orderedFocusViewerEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError('viewer entries must be an array');
  return [...entries].sort((left, right) => {
    const leftOrder = Number(left?.placement?.navigationOrder);
    const rightOrder = Number(right?.placement?.navigationOrder);
    if (!Number.isSafeInteger(leftOrder) || !Number.isSafeInteger(rightOrder)) {
      throw new TypeError('viewer entry navigationOrder must be a safe integer');
    }
    return leftOrder - rightOrder
      || String(left.placement.id).localeCompare(String(right.placement.id));
  });
}

export function focusViewerDestination(entries, currentPlacementId, direction) {
  const ordered = orderedFocusViewerEntries(entries);
  if (!ordered.length) return null;
  if (direction !== -1 && direction !== 1) throw new TypeError('viewer navigation direction must be -1 or 1');
  const currentIndex = ordered.findIndex(({ placement }) => placement.id === currentPlacementId);
  if (currentIndex < 0) throw new RangeError('current viewer placement is not present');
  return ordered[(currentIndex + direction + ordered.length) % ordered.length];
}
