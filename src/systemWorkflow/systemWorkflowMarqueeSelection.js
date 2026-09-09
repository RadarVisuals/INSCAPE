export const SYSTEM_WORKFLOW_MARQUEE_SELECTION_MODES = Object.freeze({
  ADD: 'add',
  REPLACE: 'replace',
  TOGGLE: 'toggle',
});

export function systemWorkflowMarqueeRectangle(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  return Object.freeze({
    left,
    top,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  });
}

export function systemWorkflowMarqueeIntersects(rectangle, placementRectangle) {
  return rectangle.left < placementRectangle.left + placementRectangle.width
    && rectangle.left + rectangle.width > placementRectangle.left
    && rectangle.top < placementRectangle.top + placementRectangle.height
    && rectangle.top + rectangle.height > placementRectangle.top;
}

export function resolveSystemWorkflowMarqueeSelection(baseIds, hitIds, mode) {
  const base = [...new Set(Array.isArray(baseIds) ? baseIds : [])];
  const hits = [...new Set(Array.isArray(hitIds) ? hitIds : [])];
  if (mode === SYSTEM_WORKFLOW_MARQUEE_SELECTION_MODES.ADD) return [...new Set([...base, ...hits])];
  if (mode === SYSTEM_WORKFLOW_MARQUEE_SELECTION_MODES.TOGGLE) {
    const result = new Set(base);
    for (const id of hits) {
      if (result.has(id)) result.delete(id);
      else result.add(id);
    }
    return [...result];
  }
  return hits;
}
