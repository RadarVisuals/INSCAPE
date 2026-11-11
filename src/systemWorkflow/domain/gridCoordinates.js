// Shared authored scene precision. This small geometry boundary has no draft,
// profile or persistence dependency, so Reception and Display use the same grid.
export const SYSTEM_WORKFLOW_GRID_PRECISION = 9;
const GRID_EPSILON = 1e-7;
export const isSystemWorkflowGridCoordinate = value => Number.isFinite(value)
  && Math.abs(value * SYSTEM_WORKFLOW_GRID_PRECISION - Math.round(value * SYSTEM_WORKFLOW_GRID_PRECISION)) < GRID_EPSILON;
export const quantizeSystemWorkflowGridCoordinate = value =>
  Math.round(value * SYSTEM_WORKFLOW_GRID_PRECISION) / SYSTEM_WORKFLOW_GRID_PRECISION;
