const BOUND_KEYS = Object.freeze(['left', 'top', 'right', 'bottom', 'width', 'height']);

export function measureRoundedHabitatBounds(element) {
  const rect = element.getBoundingClientRect();
  const left = rect.left + element.clientLeft;
  const top = rect.top + element.clientTop;
  const width = element.clientWidth;
  const height = element.clientHeight;

  return {
    left: Math.round(left),
    top: Math.round(top),
    right: Math.round(left + width),
    bottom: Math.round(top + height),
    width: Math.round(width),
    height: Math.round(height)
  };
}

export function habitatBoundsEqual(previous, next) {
  return Boolean(previous && next && BOUND_KEYS.every((key) => previous[key] === next[key]));
}
