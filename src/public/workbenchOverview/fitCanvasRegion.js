// Fit authored bounds independently of the editor's zoom and minimum scale.
export function fitCanvasRegion(area, region, size, padding = 16) {
  const scale = Math.min(Math.max(0, size.width - padding * 2) / region.width,
    Math.max(0, size.height - padding * 2) / region.height);
  return { scale, left: (size.width - region.width * scale) / 2 + (area.left - region.left) * scale,
    top: (size.height - region.height * scale) / 2 + (area.top - region.top) * scale };
}
