import { quantizeSystemWorkflowGridCoordinate } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { ownerSystemWorkflowProjectedFieldContainsPoint } from './systemWorkflowArtboardProjection.js';

// Display owns both the clipped hit area and conversion to its authored units.
// A new article starts at the click, bounded so its initial box remains visible.
export function displayTextDestinationAt(point, field) {
  if (!ownerSystemWorkflowProjectedFieldContainsPoint(field, point)
    || point.x < field.viewportLeft || point.y < field.viewportTop
    || point.x > field.viewportLeft + field.viewportWidth || point.y > field.viewportTop + field.viewportHeight) return null;
  const columnSpan = Math.min(16, field.columns), rowSpan = Math.min(6, field.rows);
  const snap = value => quantizeSystemWorkflowGridCoordinate(Math.round(value / field.snapStep) * field.snapStep);
  return {
    column: Math.max(0, Math.min(field.columns - columnSpan, snap((point.x - field.left) / field.cellSize))),
    row: Math.max(0, Math.min(field.rows - rowSpan, snap((point.y - field.top) / field.rowSize))),
    columnSpan, rowSpan,
  };
}
