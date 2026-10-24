import { assertValidSystemWorkflowDraft, quantizeSystemWorkflowGridCoordinate as quantize } from './domain/systemWorkflowDraft.js';
import { createSystemWorkflowMovementCandidate } from './systemWorkflowMovement.js';

const EPSILON = 1e-7;
const overlaps = (a, b, axis, span) => Math.min(a[axis] + a[span], b[axis] + b[span])
  - Math.max(a[axis], b[axis]) > EPSILON;

function spacedCoordinates(items, axis, span, crossAxis, crossSpan, gap) {
  const coordinates = new Map();
  const ordered = [...items].sort((a, b) => a[axis] - b[axis] || a.id.localeCompare(b.id));
  for (const item of ordered) {
    // Use the original composition to identify neighbours. A tall image may
    // neighbour several shorter images without belonging to a shared row.
    const predecessors = ordered.filter(other => other.id !== item.id
      && other[axis] + other[span] <= item[axis] + EPSILON
      && overlaps(item, other, crossAxis, crossSpan));
    const coordinate = predecessors.length
      ? Math.max(...predecessors.map(other => coordinates.get(other.id) + other[span] + gap))
      : item[axis];
    coordinates.set(item.id, quantize(coordinate));
  }
  return coordinates;
}

// Gutters are an explicit arrangement operation, not a persistent layout constraint.
export function createSystemWorkflowGutterCandidate(draftInput, { gridId, gutter, expectedPlacements }) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const grid = draft.grids.find(item => item.id === gridId);
  if (!grid || JSON.stringify(grid.placements) !== JSON.stringify(expectedPlacements)) throw new Error('The scene changed. Apply the gutter again.');
  if (!Number.isFinite(gutter) || gutter < 0 || gutter > 32) throw new Error('Enter a gutter between 0 and 32 canvas units.');
  if (grid.placements.length < 2) throw new Error('Add at least two images first.');
  if (grid.placements.some(item => item.locked || item.visibility !== 'PUBLIC')) throw new Error('Unlock all images and make them public before applying gutters.');
  const gap = quantize(gutter);
  const items = grid.placements;
  for (let index = 0; index < items.length; index += 1) {
    for (const other of items.slice(index + 1)) {
      if (overlaps(items[index], other, 'column', 'columnSpan') && overlaps(items[index], other, 'row', 'rowSpan')) {
        throw new Error('Some image bounds overlap. Separate those images before applying gutters.');
      }
    }
  }
  const columns = spacedCoordinates(items, 'column', 'columnSpan', 'row', 'rowSpan', gap);
  const rows = spacedCoordinates(items, 'row', 'rowSpan', 'column', 'columnSpan', gap);
  const destinations = items.map(item => ({ ...item, column: columns.get(item.id), row: rows.get(item.id) }));
  // Independent axis changes can introduce new neighbours in complex layouts.
  // Reject the entire operation if the resulting arrangement cannot keep the gap.
  for (let index = 0; index < destinations.length; index += 1) {
    const item = destinations[index];
    for (const other of destinations.slice(index + 1)) {
      const horizontalGap = Math.max(other.column - item.column - item.columnSpan, item.column - other.column - other.columnSpan);
      const verticalGap = Math.max(other.row - item.row - item.rowSpan, item.row - other.row - other.rowSpan);
      if (overlaps(item, other, 'row', 'rowSpan') && horizontalGap < gap - EPSILON
        || overlaps(item, other, 'column', 'columnSpan') && verticalGap < gap - EPSILON) {
        throw new Error('This gutter would crowd another image. Try a smaller value or move that image first.');
      }
    }
  }
  let candidate = draft;
  for (const item of items) {
    const destination = { column: columns.get(item.id), row: rows.get(item.id), columnSpan: item.columnSpan, rowSpan: item.rowSpan };
    // Validate all moves before the session commits the single completed operation.
    candidate = createSystemWorkflowMovementCandidate(candidate, {
      gridId, placementId: item.id, expectedStartGeometry: item, destination,
    }) || candidate;
  }
  return candidate === draft ? null : candidate;
}
