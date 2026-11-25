import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOwnerSystemWorkflowPreviewDocument } from '../ownerSystemWorkflowPreviewDocument.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';
import {
  createOwnerSystemWorkflowReviewStorage,
  OWNER_SYSTEM_WORKFLOW_REVIEW_ACTIVITY,
  OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
  OWNER_SYSTEM_WORKFLOW_REVIEW_CATEGORIES,
  OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
} from './ownerSystemWorkflowDevelopmentFixture.js';

test('development workspace opens independent Image layers from the review collection', () => {
  assert.deepEqual(OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(({ name }) => name), [
    'ABYSSAL STUDY', 'SKULL REAPER', 'MOUNTAIN SIGNAL I', 'MOUNTAIN SIGNAL II',
    'DIGITAL MEMBRANE', 'ZEBRA FIELD', 'MOON PURPLE',
  ]);
  assert.equal(OWNER_SYSTEM_WORKFLOW_REVIEW_ACTIVITY.length, 8);
  assert.deepEqual(OWNER_SYSTEM_WORKFLOW_REVIEW_CATEGORIES.map(({ id }) => id), ['portfolio', 'field-notes']);
  const store = createSystemWorkflowDraftStore({ profileAddress: OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, storage: createOwnerSystemWorkflowReviewStorage() });
  const draft = store.getDraft();
  assert.deepEqual(draft.imageModules.map(image => image.name), ['ABYSSAL STUDY', 'MOUNTAIN SIGNAL II']);
  assert.deepEqual(draft.workbench.imageModules.map(image => image.id), draft.imageModules.map(image => image.id));
  const preview = buildOwnerSystemWorkflowPreviewDocument({
    assetRecords: OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
    profile: { name: 'RADAR VISUALS', avatarUrl: null },
    profileAddress: OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
    systemWorkflowDraft: draft,
  });
  assert.equal(preview.grids, undefined);
});
