// One spacing for the visible Workbench guides and its placement interactions.
export const WORKBENCH_GRID_STEP = 24;
export const marqueeContains = (area, item) => item.left >= area.left && item.top >= area.top
  && item.left + item.width <= area.left + area.width && item.top + item.height <= area.top + area.height;
export const snapWorkbenchCoordinate = (value, enabled) => enabled
  ? Math.round(value / WORKBENCH_GRID_STEP) * WORKBENCH_GRID_STEP : value;

export function snapWorkbenchPosition(position, enabled) {
  return { left: snapWorkbenchCoordinate(position.left, enabled), top: snapWorkbenchCoordinate(position.top, enabled) };
}
