import { SYSTEM_WORKFLOW_GEOMETRY } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { projectSystemWorkflowViewport } from '../../systemWorkflow/systemWorkflowViewportProjection.js';
import { projectLatticePixelRectangle } from '../../lattice/rendering/latticePixelGeometry.js';

export const OWNER_SYSTEM_WORKFLOW_COLUMNS = SYSTEM_WORKFLOW_GEOMETRY.columns;
export const OWNER_SYSTEM_WORKFLOW_ROWS = SYSTEM_WORKFLOW_GEOMETRY.rows;

export function measureOwnerSystemWorkflowArtboard(availableWidth, availableHeight) {
  const width = Number(availableWidth);
  const height = Number(availableHeight);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  return projectSystemWorkflowViewport(SYSTEM_WORKFLOW_GEOMETRY, { width, height });
}

export function createOwnerSystemWorkflowProjectedField(node, snapStep = 1) {
  const rectangle = node?.getBoundingClientRect?.();
  const projection = rectangle && measureOwnerSystemWorkflowArtboard(rectangle.width, rectangle.height);
  if (!rectangle || !projection || !Number.isFinite(snapStep) || snapStep <= 0) return null;
  return Object.freeze({
    cellSize: projection.cellSize,
    left: rectangle.left + projection.left,
    top: rectangle.top + projection.top,
    snapStep,
    width: rectangle.width,
    height: rectangle.height,
    viewportLeft: rectangle.left,
    viewportTop: rectangle.top,
    viewportWidth: rectangle.width,
    viewportHeight: rectangle.height,
  });
}

export function ownerSystemWorkflowArtboardContainsPoint(artboard, point) {
  if (!artboard || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  return point.x >= 0 && point.x <= artboard.width && point.y >= 0 && point.y <= artboard.height;
}

export function projectOwnerSystemWorkflowPlacement(placement, artboard) {
  if (!artboard || !placement) return null;
  return projectLatticePixelRectangle(placement, artboard);
}
