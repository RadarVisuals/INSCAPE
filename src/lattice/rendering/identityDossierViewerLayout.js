import { normalizeViewerRectangle } from './latticeFocusViewer.js';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function identityDossierViewerLayout(originRectangle, viewport) {
  const origin = normalizeViewerRectangle(originRectangle, 'identityOriginRectangle');
  const width = Math.max(1, Number(viewport?.width) || 1);
  const height = Math.max(1, Number(viewport?.height) || 1);
  const compact = width <= 700;
  if (compact) {
    const margin = 12;
    const top = 52;
    return Object.freeze({
      mode: 'compact', origin,
      rack: Object.freeze({ left: margin, top, width: width - (margin * 2), height: Math.max(280, height - top - margin) }),
    });
  }
  const margin = 32;
  const rackWidth = clamp(width * 0.34, 380, 430);
  const rackHeight = Math.min(620, height - (margin * 2));
  return Object.freeze({
    mode: 'desktop', origin,
    rack: Object.freeze({ left: (width - rackWidth) / 2, top: (height - rackHeight) / 2, width: rackWidth, height: rackHeight }),
  });
}
