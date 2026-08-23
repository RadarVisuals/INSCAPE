import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { createSystemWorkflowAppearanceCandidate } from './systemWorkflowAppearance.js';
import { createSystemWorkflowLockCandidate } from './systemWorkflowLock.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const placement = { id: 'p', stableAssetId: '42:0x2222222222222222222222222222222222222222:0x01', column: 0, row: 0, columnSpan: 2, rowSpan: 2, layer: 0, navigationOrder: 0, crop: null, frameId: 'NONE', mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } }, backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } };

test('shell appearance and lock candidates are exact, stale-safe canonical mutations', () => {
  const draft = createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' }); draft.grids[0].placements = [placement];
  const themed = createSystemWorkflowAppearanceCandidate(draft, { expectedAppearance: draft.appearance, appearance: { surfaceId: 'carbon', guideMode: 'DOTS', guideColor: '#ffffff', guideSize: 2 } });
  assert.equal(themed.appearance.surfaceId, 'carbon'); assert.equal(themed.appearance.guideMode, 'DOTS'); assert.equal(draft.appearance.surfaceId, 'mist');
  assert.throws(() => createSystemWorkflowAppearanceCandidate(themed, { expectedAppearance: draft.appearance, appearance: { surfaceId: 'paper' } }), { code: 'SYSTEM_WORKFLOW_APPEARANCE_STALE' });
  const locked = createSystemWorkflowLockCandidate(draft, { gridId: draft.grids[0].id, placementId: 'p', expectedPlacement: placement, locked: true });
  assert.equal(locked.grids[0].placements[0].locked, true); assert.equal(draft.grids[0].placements[0].locked, false);
  assert.throws(() => createSystemWorkflowLockCandidate(locked, { gridId: locked.grids[0].id, placementId: 'p', expectedPlacement: placement, locked: false }), { code: 'SYSTEM_WORKFLOW_LOCK_STALE' });
});
