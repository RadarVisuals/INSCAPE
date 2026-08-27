import { SYSTEM_WORKFLOW_GEOMETRY } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { projectSystemWorkflowViewport } from '../../systemWorkflow/systemWorkflowViewportProjection.js';
import { projectLatticePixelRectangle } from '../../lattice/rendering/latticePixelGeometry.js';

export const OWNER_SYSTEM_WORKFLOW_COLUMNS = SYSTEM_WORKFLOW_GEOMETRY.columns;
export const OWNER_SYSTEM_WORKFLOW_ROWS = SYSTEM_WORKFLOW_GEOMETRY.rows;
export const OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES = Object.freeze({ GRID: 'grid', HERO: 'hero' });
export const OWNER_SYSTEM_WORKFLOW_HERO_MAXIMUM = Object.freeze({ width: 768, height: 432 });

export function measureOwnerSystemWorkflowArtboard(availableWidth, availableHeight, scale = 1) {
  const width = Number(availableWidth);
  const height = Number(availableHeight);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) return null;
  const projection = projectSystemWorkflowViewport(SYSTEM_WORKFLOW_GEOMETRY, { width: width * scale, height: height * scale });
  return Object.freeze({
    ...projection,
    left: projection.left + width * (1 - scale) / 2,
    top: projection.top + height * (1 - scale) / 2,
  });
}

export function measureOwnerSystemWorkflowHeroArtboard(availableWidth, availableHeight) {
  const width = Number(availableWidth);
  const height = Number(availableHeight);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
  const widthLimit = width * 0.84;
  const heightLimit = Math.max(1, height - 96) * (SYSTEM_WORKFLOW_GEOMETRY.columns / SYSTEM_WORKFLOW_GEOMETRY.rows);
  const referenceWidth = Math.min(OWNER_SYSTEM_WORKFLOW_HERO_MAXIMUM.width, widthLimit, heightLimit);
  const referenceHeight = referenceWidth * (SYSTEM_WORKFLOW_GEOMETRY.rows / SYSTEM_WORKFLOW_GEOMETRY.columns);
  const projection = projectSystemWorkflowViewport(SYSTEM_WORKFLOW_GEOMETRY, {
    width: referenceWidth,
    height: referenceHeight,
  });
  return Object.freeze({
    ...projection,
    left: (width - referenceWidth) / 2,
    top: (height - referenceHeight) / 2,
  });
}

export function createOwnerSystemWorkflowProjectedField(node, snapStep = 1, scale = 1, mode = OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES.GRID) {
  const rectangle = node?.getBoundingClientRect?.();
  const projection = rectangle && (mode === OWNER_SYSTEM_WORKFLOW_ARTBOARD_MODES.HERO
    ? measureOwnerSystemWorkflowHeroArtboard(rectangle.width, rectangle.height)
    : measureOwnerSystemWorkflowArtboard(rectangle.width, rectangle.height, scale));
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

export function ownerSystemWorkflowProjectedFieldContainsPoint(field, point) {
  if (!field || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const width = OWNER_SYSTEM_WORKFLOW_COLUMNS * field.cellSize;
  const height = OWNER_SYSTEM_WORKFLOW_ROWS * field.cellSize;
  return point.x >= field.left && point.x <= field.left + width
    && point.y >= field.top && point.y <= field.top + height;
}

export function ownerSystemWorkflowArtboardContainsPoint(artboard, point) {
  if (!artboard || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  return point.x >= 0 && point.x <= artboard.width && point.y >= 0 && point.y <= artboard.height;
}

export function projectOwnerSystemWorkflowPlacement(placement, artboard) {
  if (!artboard || !placement) return null;
  return projectLatticePixelRectangle(placement, artboard);
}
