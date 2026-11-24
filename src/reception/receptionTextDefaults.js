import { relativeLuminance, contrast } from '../ui/colorContrast.js';

// Creation defaults only: authored ink is never recomputed when the theme changes.
export function receptionTextDefaults(reception, cellId, mode) {
  const cell = reception?.shapes.find(item => item.id === cellId);
  const rgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const theme = mode === 'light' ? '#DEDBD3' : '#171717';
  const page = rgb(reception?.backgroundColor || theme), surface = rgb(reception?.surface || theme);
  const opacity = reception?.surfaceOpacity ?? 1;
  const environment = surface.map((channel, index) => channel * opacity + page[index] * (1 - opacity));
  const fill = cell ? rgb(cell.color) : environment, alpha = cell?.opacity ?? 0;
  const luminance = relativeLuminance(fill.map((channel, index) => channel * alpha + environment[index] * (1 - alpha)));
  return { visibility: 'PUBLIC', appearance: { background: null, compact: true, fontSize: 28,
    ...(!cellId && { padding: { top: 24, right: 24, bottom: 24, left: 24 } }),
    color: contrast(luminance, 0) > contrast(luminance, 1) ? '#000000' : '#ffffff' } };
}
