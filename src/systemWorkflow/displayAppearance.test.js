import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { assertValidSystemWorkflowDraft, validateSystemWorkflowDraft, systemWorkflowPlacementSnapStep } from './domain/systemWorkflowDraft.js';
import { displayGuideMode } from './domain/displayAppearance.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9, parseProfileDocumentV9Json } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { canonicalSerializeProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Serialization.js';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as profile, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';

const fixture = () => {
  const storage = createOwnerSystemWorkflowReviewStorage();
  return { storage, store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
};
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: assets });

test('old draft and public appearance read without rewriting; malformed new fields are rejected', () => {
  const { store } = fixture(), draft = store.getDraft();
  const bytes = JSON.stringify(draft);
  assert.equal(JSON.stringify(assertValidSystemWorkflowDraft(draft)), bytes);
  assert.equal(systemWorkflowPlacementSnapStep(draft.appearance), 1);
  assert.equal(displayGuideMode({ ...draft.appearance, guideMode: 'NONE' }), 'NONE');
  const doc = publish(draft), publicBytes = canonicalSerializeProfileDocumentV9(doc);
  assert.equal(canonicalSerializeProfileDocumentV9(parseProfileDocumentV9Json(publicBytes)), publicBytes);
  for (const invalid of [{ backgroundColor: 'red' }, { backgroundColor: ['#123456'] }, { backgroundColor: '#123' }, { guideVisible: 1 }, { snapToGrid: null }, { unknown: true }]) {
    assert.equal(validateSystemWorkflowDraft({ ...draft, appearance: { ...draft.appearance, ...invalid } }).valid, false);
    assert.equal(validateProfileDocumentV9({ ...doc, appearance: { ...doc.appearance, ...invalid } }).valid, false);
  }
});
