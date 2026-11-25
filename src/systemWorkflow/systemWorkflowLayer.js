import { SYSTEM_WORKFLOW_VISIBILITY } from './domain/systemWorkflowDraft.js';
import { orderedLatticeProductionLayers as orderedSystemWorkflowLayers } from '../lattice/rendering/latticeProductionLayerOrder.js';

export function systemWorkflowLayerOperationAvailability(grid, placementId) {
  const visible = orderedSystemWorkflowLayers(
    (Array.isArray(grid?.placements) ? grid.placements : [])
      .filter((placement) => placement.visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC),
  );
  const selectedIndex = visible.findIndex((placement) => placement.id === placementId);
  const unavailable = Object.freeze({ BACK: false, BACKWARD: false, FORWARD: false, FRONT: false });
  if (selectedIndex < 0 || visible[selectedIndex].locked) return unavailable;
  const behind = visible.slice(0, selectedIndex);
  const ahead = visible.slice(selectedIndex + 1);
  return Object.freeze({
    BACK: behind.length > 0 && behind.every((placement) => !placement.locked),
    BACKWARD: Boolean(behind.at(-1) && !behind.at(-1).locked),
    FORWARD: Boolean(ahead[0] && !ahead[0].locked),
    FRONT: ahead.length > 0 && ahead.every((placement) => !placement.locked),
  });
}
