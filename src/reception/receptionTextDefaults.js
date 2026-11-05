import { relativeLuminance, contrast } from '../ui/colorContrast.js';

// Creation defaults only: authored ink is never recomputed when the theme changes.
export function receptionTextDefaults(reception, cellId, mode) {
  const cell = reception?.shapes.find(item => item.id === cellId);
  const rgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const environment = rgb(mode === 'light' ? '#DEDBD3' : '#171717');
  const fill = cell ? rgb(cell.color) : environment, alpha = cell?.opacity ?? 0;
  const luminance = relativeLuminance(fill.map((channel, index) => channel * alpha + environment[index] * (1 - alpha)));
  return { visibility: 'PUBLIC', alignment: 'center', appearance: { background: null, compact: true, verticalAlign: 'center',
    color: contrast(luminance, 0) > contrast(luminance, 1) ? '#000000' : '#ffffff' } };
}
