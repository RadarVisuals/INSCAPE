import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOwnerSystemWorkflowPreviewDocument } from '../ownerSystemWorkflowPreviewDocument.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import {
  createOwnerSystemWorkflowReviewStorage,
  OWNER_SYSTEM_WORKFLOW_REVIEW_ACTIVITY,
  OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
  OWNER_SYSTEM_WORKFLOW_REVIEW_CATEGORIES,
  OWNER_SYSTEM_WORKFLOW_REVIEW_DISCOVERY,
  OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
} from './ownerSystemWorkflowDevelopmentFixture.js';

test('development parity fixture matches the frozen Phase 3 study without becoming an authority', () => {
  assert.deepEqual(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(({ name }) => name), [
    'ABYSSAL STUDY', 'SKULL REAPER', 'MOUNTAIN SIGNAL I', 'MOUNTAIN SIGNAL II',
    'DIGITAL MEMBRANE', 'ZEBRA FIELD', 'MOON PURPLE',
  ]);
  assert.equal(OWNER_SYSTEM_WORKFLOW_REVIEW_ACTIVITY.length, 8);
  assert.deepEqual(OWNER_SYSTEM_WORKFLOW_REVIEW_DISCOVERY.map(({ name }) => name), ['SIGNAL ARCHIVE', 'SURFACE UNIT', 'CHROMATIC OFFICE']);
  assert.deepEqual(OWNER_SYSTEM_WORKFLOW_REVIEW_CATEGORIES.map(({ id }) => id), ['portfolio', 'field-notes']);
  const store = createSystemWorkflowDraftStore({ profileAddress: OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, storage: createOwnerSystemWorkflowReviewStorage() });
  const draft = store.getDraft();
  assert.equal(draft.grids.length, 1);
  assert.equal(draft.grids[0].title, 'HOME');
  assert.deepEqual(draft.grids[0].placements.map(({ column, row, columnSpan, rowSpan }) => ({ column, row, columnSpan, rowSpan })), [
    { column: 15, row: 4, columnSpan: 4, rowSpan: 4 },
    { column: 20, row: 9, columnSpan: 5, rowSpan: 3 },
  ]);
  assert.equal(draft.appearance.surfaceId, 'mist');
  assert.equal(draft.appearance.guideMode, 'LINES');
  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
    profile: { name: 'RADAR VISUALS', avatarUrl: null },
    profileAddress: OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
    systemWorkflowDraft: draft,
  });
  assert.equal(preview.grids[0].placements.length, 2);
  assert.ok(preview.grids[0].placements.every(({ asset }) => asset.media.url.startsWith('https://')));
});
