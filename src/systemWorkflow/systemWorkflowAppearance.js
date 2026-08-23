import { SYSTEM_WORKFLOW_GRID_DENSITY, SYSTEM_WORKFLOW_GUIDE_MODES, SYSTEM_WORKFLOW_SURFACE_IDS, assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';

const surfaces = new Set(SYSTEM_WORKFLOW_SURFACE_IDS); const guides = new Set(SYSTEM_WORKFLOW_GUIDE_MODES); const color = /^#[0-9a-f]{6}$/iu;

export function createSystemWorkflowAppearanceCandidate(draftInput, { expectedAppearance, appearance } = {}) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  if (JSON.stringify(draft.appearance) !== JSON.stringify(expectedAppearance)) throw Object.assign(new TypeError('Canonical appearance changed before editing completed'), { code: 'SYSTEM_WORKFLOW_APPEARANCE_STALE' });
  const next = { ...draft.appearance, ...appearance };
  if (!surfaces.has(next.surfaceId) || !surfaces.has(next.menuSurfaceId) || !surfaces.has(next.dossierSurfaceId) || !guides.has(next.guideMode) || !Number.isSafeInteger(next.guideSize) || next.guideSize < SYSTEM_WORKFLOW_GRID_DENSITY.minimum || next.guideSize > SYSTEM_WORKFLOW_GRID_DENSITY.maximum || !color.test(next.guideColor)) throw Object.assign(new TypeError('Canonical appearance values are invalid'), { code: 'SYSTEM_WORKFLOW_APPEARANCE_INVALID' });
  if (JSON.stringify(next) === JSON.stringify(draft.appearance)) return null;
  draft.appearance = next;
  return assertValidSystemWorkflowDraft(draft);
}
