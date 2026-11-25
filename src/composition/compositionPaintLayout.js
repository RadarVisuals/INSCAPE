import { cssPaintRectangle, workbenchPaintGeometry } from '../public/ownerSystemWorkflow/workbenchPaintGeometry.js';

// Zero-gap cells and their contents share one set of physical paint edges.
// Include the canvas origin: a vertically centred canvas can start on half a pixel.
// Positive authored gaps retain their fractional coverage. Saved geometry is untouched.
export function compositionPaintLayout(layout, density = 1, origin = { left: 0, top: 0 }) {
  if (!layout || layout.gap > 0) return layout;
  const snap = rect => {
    const screen = cssPaintRectangle(workbenchPaintGeometry({ ...rect,
      left: rect.left + origin.left, top: rect.top + origin.top }, density), density);
    return { ...screen, left: screen.left - origin.left, top: screen.top - origin.top };
  };
  const windows = Object.fromEntries(Object.entries(layout.windows).map(([id, rect]) => [id, snap(rect)]));
  return { ...layout, windows, cells: layout.cells.map(cell => ({ ...cell, window: windows[cell.id] })) };
}
