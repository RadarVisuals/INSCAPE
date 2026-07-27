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
  dossierGap: 0,
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
      contentHeight: Math.max(size.height, finalPanelBottom + dossierGap),
    });
  }

  const panelAllowance = 2 * (dossierWidth + dossierGap);
  const availableWidth = Math.max(1, size.width - (horizontalMargin * 2) - panelAllowance);
  const availableHeight = Math.max(1, size.height - (verticalMargin * 2)) * verticalArtworkScale;
  const scale = Math.min(availableWidth / origin.width, availableHeight / origin.height);
  const artworkWidth = origin.width * scale;
  const artworkHeight = origin.height * scale;
  const groupWidth = artworkWidth + panelAllowance;
  const groupLeft = (size.width - groupWidth) / 2;
  const artworkLeft = groupLeft + dossierWidth + dossierGap;
  const artwork = rectangle(artworkLeft, (size.height - artworkHeight) / 2, artworkWidth, artworkHeight);
  const dossierHeight = Math.max(1, artworkHeight * 0.98);
  const dossierTop = (size.height - dossierHeight) / 2;

  return Object.freeze({
    mode: 'wide',
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
