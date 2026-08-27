export const SYSTEM_WORKFLOW_DEFAULT_VIEW = Object.freeze({
  horizontalAnchor: 0.5,
  verticalAnchor: 0.5,
  zoomMode: 'CONTAIN_REFERENCE',
});

const positive = (value) => Number.isFinite(value) && value > 0;

export function projectSystemWorkflowViewport(geometry, viewport, view = SYSTEM_WORKFLOW_DEFAULT_VIEW) {
  if (!Number.isSafeInteger(geometry?.columns) || geometry.columns < 1
    || !Number.isSafeInteger(geometry?.rows) || geometry.rows < 1) {
    throw new TypeError('System Workflow projection requires positive integer geometry');
  }
  if (!positive(viewport?.width) || !positive(viewport?.height)) {
    throw new TypeError('System Workflow projection requires a positive viewport');
  }
  if (view?.zoomMode !== 'CONTAIN_REFERENCE'
    || !Number.isFinite(view.horizontalAnchor) || view.horizontalAnchor < 0 || view.horizontalAnchor > 1
    || !Number.isFinite(view.verticalAnchor) || view.verticalAnchor < 0 || view.verticalAnchor > 1) {
    throw new TypeError('System Workflow projection requires a canonical view');
  }
  const cellSize = Math.min(viewport.width / geometry.columns, viewport.height / geometry.rows);
  const referenceWidth = geometry.columns * cellSize;
  const referenceHeight = geometry.rows * cellSize;
  return Object.freeze({
    cellSize,
    left: (viewport.width - referenceWidth) * view.horizontalAnchor,
    top: (viewport.height - referenceHeight) * view.verticalAnchor,
    width: viewport.width,
    height: viewport.height,
    referenceWidth,
    referenceHeight,
  });
}
