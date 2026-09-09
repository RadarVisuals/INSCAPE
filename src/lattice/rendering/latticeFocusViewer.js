export const DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG = Object.freeze({
  horizontalMargin: 48,
  verticalMargin: 40,
  verticalArtworkScale: 0.72,
  squareArtworkScale: 0.85,
  browseDuration: 240,
  swipeThreshold: 48,
  swipeDominance: 1.25,
  wheelAccumulationThreshold: 80,
  wheelCooldown: 320,
  dossierBreakpoint: 900,
  dossierWidth: 320,
  dossierGap: 88,
  horizontalAspectRatio: 1.6,
  inspectionPadding: 36,
  horizontalArtworkMaxWidthScale: 0.72,
  lowerDossierGap: 52,
  lowerDossierHeight: 280,
  lowerPanelGap: 28,
  navigationClearance: 72,
  compactHorizontalMargin: 16,
  compactDossierHeight: 420,
});

export function shouldContainViewerScroll(scrollRegion, deltaX = 0, deltaY = 0) {
  const maximumScrollTop = Math.max(0,
    Number(scrollRegion?.scrollHeight) - Number(scrollRegion?.clientHeight));
  const scrollTop = Number(scrollRegion?.scrollTop) || 0;
  const horizontal = Number(deltaX) || 0;
  const vertical = Number(deltaY) || 0;
  const movement = Math.abs(vertical) >= Math.abs(horizontal) ? vertical : horizontal;
  return maximumScrollTop <= 0
    || (movement < 0 && scrollTop <= 0)
    || (movement > 0 && scrollTop >= maximumScrollTop - 1);
}

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

export function focusViewerEntryRectangle(originRectangle, focusDimensions) {
  const origin = normalizeViewerRectangle(originRectangle, 'originRectangle');
  return focusDimensions?.width > 0 && focusDimensions?.height > 0
    ? Object.freeze({ ...origin, width: focusDimensions.width, height: focusDimensions.height })
    : origin;
}

export function focusViewerPresentationDimensions(entry) {
  const dimensions = entry?.focusDimensions;
  if (!(dimensions?.width > 0 && dimensions?.height > 0)) return dimensions;
  const quarterTurns = entry?.placement?.transform?.quarterTurns || 0;
  return quarterTurns % 2 === 1
    ? Object.freeze({ width: dimensions.height, height: dimensions.width })
    : dimensions;
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

  const horizontal = (origin.width / origin.height) >= horizontalAspectRatio;
  const sideArtworkAllowance = size.width - (Math.max(0, Number(config?.horizontalMargin)) * 2)
    - (2 * (dossierWidth + dossierGap));
  if (size.width < breakpoint || (!horizontal && sideArtworkAllowance < 280)) {
    const horizontalMargin = Math.max(0, Number(config?.compactHorizontalMargin));
    const maximumDossierHeight = finitePositive(Number(config?.compactDossierHeight), 'compactDossierHeight');
    const dossierHeight = Math.min(maximumDossierHeight, Math.max(240, size.height * 0.46));
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
      contentHeight: Math.max(size.height, finalPanelBottom + dossierGap),
    });
  }

  if (horizontal) {
    const lowerDossierGap = finiteNonNegative(Number(config?.lowerDossierGap), 'lowerDossierGap');
    const lowerDossierHeight = finitePositive(Number(config?.lowerDossierHeight), 'lowerDossierHeight');
    const lowerPanelGap = finiteNonNegative(Number(config?.lowerPanelGap), 'lowerPanelGap');
    const navigationClearance = finiteNonNegative(Number(config?.navigationClearance), 'navigationClearance');
    const horizontalArtworkMaxWidthScale = Number(config?.horizontalArtworkMaxWidthScale);
    if (!Number.isFinite(horizontalArtworkMaxWidthScale)
      || horizontalArtworkMaxWidthScale <= 0 || horizontalArtworkMaxWidthScale > 1) {
      throw new TypeError('horizontalArtworkMaxWidthScale must be between zero and one');
    }
    const availableWidth = Math.max(1, Math.min(
      size.width - (horizontalMargin * 2) - (inspectionPadding * 2),
      size.width * horizontalArtworkMaxWidthScale,
    ));
    const availableArtworkHeight = Math.max(
      1,
      size.height - (verticalMargin * 2) - (inspectionPadding * 2)
        - lowerDossierGap - lowerDossierHeight - navigationClearance,
    );
    const scale = Math.min(availableWidth / origin.width, availableArtworkHeight / origin.height);
    const artworkWidth = origin.width * scale;
    const artworkHeight = origin.height * scale;
    const frameWidth = Math.max(1, size.width - (horizontalMargin * 2));
    const frameHeight = artworkHeight + (inspectionPadding * 2);
    const groupHeight = frameHeight + lowerDossierGap + lowerDossierHeight;
    const frameLeft = horizontalMargin;
    const centeredFrameTop = (size.height - navigationClearance - groupHeight) / 2;
    const latestFrameTop = size.height - navigationClearance - groupHeight;
    const frameTop = Math.max(verticalMargin, centeredFrameTop, Math.min(112, latestFrameTop));
    const artwork = rectangle(
      (size.width - artworkWidth) / 2,
      frameTop + inspectionPadding,
      artworkWidth,
      artworkHeight,
    );
    const inspectionFrame = rectangle(frameLeft, frameTop, frameWidth, frameHeight);
    const panelGroupWidth = Math.min(
      size.width - (horizontalMargin * 2),
      Math.max(artworkWidth, dossierWidth * 2 + lowerPanelGap),
    );
    const panelWidth = (panelGroupWidth - lowerPanelGap) / 2;
    const panelLeft = (size.width - panelGroupWidth) / 2;
    const panelTop = frameTop + frameHeight + lowerDossierGap;

    return Object.freeze({
      mode: 'lower',
      artwork,
      leftDossier: rectangle(panelLeft, panelTop, panelGroupWidth, lowerDossierHeight),
      rightDossier: rectangle(panelLeft, panelTop, panelGroupWidth, lowerDossierHeight),
      inspectionFrame,
      contentHeight: Math.max(size.height, panelTop + lowerDossierHeight + navigationClearance),
    });
  }

  const panelAllowance = 2 * (dossierWidth + dossierGap);
  const availableWidth = Math.max(1, size.width - (horizontalMargin * 2) - panelAllowance);
  const availableHeight = Math.max(1, size.height - (verticalMargin * 2)) * verticalArtworkScale;
  const squareArtworkScale = Number(config?.squareArtworkScale);
  if (!Number.isFinite(squareArtworkScale) || squareArtworkScale <= 0 || squareArtworkScale > 1) {
    throw new TypeError('squareArtworkScale must be between zero and one');
  }
  const aspectRatio = origin.width / origin.height;
  const artworkScale = aspectRatio >= 0.9 && aspectRatio <= 1.1 ? squareArtworkScale : 1;
  const scale = Math.min(availableWidth / origin.width, availableHeight / origin.height) * artworkScale;
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
    contentHeight: size.height,
  });
}

export function focusViewerRackLayout(originRectangle, viewport, rackOpen, config = DEFAULT_LATTICE_FOCUS_VIEWER_CONFIG) {
  const origin = normalizeViewerRectangle(originRectangle, 'originRectangle');
  const size = viewerViewport(viewport);
  viewerDossierState(rackOpen);
  const compact = size.width < 1000;
  const margin = compact ? 16 : Math.max(32, Number(config.horizontalMargin));
  const verticalMargin = compact ? 28 : Math.max(32, Number(config.verticalMargin));
  const gap = compact ? 64 : 56;
  const rackWidth = compact
    ? Math.max(1, size.width - (margin * 2))
    : Math.min(430, Math.max(380, size.width * 0.34));
  const navigationClearance = 84;

  if (compact) {
    const maximumArtworkWidth = Math.max(1, size.width - (margin * 2));
    const maximumArtworkHeight = Math.max(1, Math.min(size.height * 0.58, 620));
    const scale = Math.min(maximumArtworkWidth / origin.width, maximumArtworkHeight / origin.height);
    const artwork = rectangle((size.width - (origin.width * scale)) / 2, verticalMargin,
      origin.width * scale, origin.height * scale);
    const rackTop = artwork.top + artwork.height + gap;
    const rackHeight = Math.max(420, Math.min(680, size.height * 0.72));
    return Object.freeze({
      mode: 'rack-compact', artwork,
      inspectionRack: rectangle(margin, rackTop, rackWidth, rackHeight),
      inspectionFrame: rectangle(Math.max(0, artwork.left - 24), Math.max(0, artwork.top - 24),
        Math.min(size.width, artwork.width + 48), artwork.height + 48),
      contentHeight: rackTop + rackHeight + navigationClearance,
    });
  }

  const maximumHeight = Math.max(1, Math.min(
    size.height * 0.72,
    size.height - (verticalMargin * 2) - navigationClearance,
  ));
  const rackHeight = Math.max(460, Math.min(680, maximumHeight));
  const maximumArtworkWidth = Math.max(1, Math.min(
    size.width * 0.58,
    size.width - (margin * 2) - rackWidth - gap,
  ));
  const scale = Math.min(maximumArtworkWidth / origin.width, rackHeight / origin.height);
  const artworkWidth = origin.width * scale;
  const artworkHeight = origin.height * scale;
  const groupWidth = artworkWidth + gap + rackWidth;
  const groupLeft = (size.width - groupWidth) / 2;
  const rackTop = Math.max(verticalMargin, (size.height - navigationClearance - rackHeight) / 2);
  const artworkTop = rackTop + ((rackHeight - artworkHeight) / 2);
  const artwork = rectangle(groupLeft, artworkTop, artworkWidth, artworkHeight);
  return Object.freeze({
    mode: 'rack', artwork,
    inspectionRack: rectangle(groupLeft + artworkWidth + gap, rackTop, rackWidth, rackHeight),
    inspectionFrame: rectangle(Math.max(0, artwork.left - 28), Math.max(0, artwork.top - 28),
      artwork.width + 56, artwork.height + 56),
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
