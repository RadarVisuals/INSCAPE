import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptySystemWorkflowDraft, validateSystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { validateProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { buildProfileDocumentV9 } from './profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from './profileDocumentV9Reconciliation.js';
const profileAddress = '0x1111111111111111111111111111111111111111';

test('remaining draft content publishes and restores without Mobile', () => {
  const draft = createEmptySystemWorkflowDraft(profileAddress);
  draft.identityPresentation.alias = 'My work';
  const document = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: draft });
  assert.equal(Object.hasOwn(document, 'mobile'), false);
  assert.equal(validateProfileDocumentV9(document).valid, true);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(document);
  assert.equal(Object.hasOwn(restored, 'mobile'), false);
  assert.equal(validateSystemWorkflowDraft(restored).valid, true);
  assert.equal(restored.identityPresentation.alias, 'My work');
});

test('removed Mobile data is unsupported in drafts and publications', () => {
  const draft = createEmptySystemWorkflowDraft(profileAddress);
  const document = buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: draft });
  draft.mobile = {};
  const draftResult = validateSystemWorkflowDraft(draft);
  assert.equal(draftResult.valid, false);
  assert.ok(draftResult.errors.some(error => error.code === 'invalid_draft_structure'));
  assert.throws(() => buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: draft }), /mobile/i);
  document.mobile = {};
  const documentResult = validateProfileDocumentV9(document);
  assert.equal(documentResult.valid, false);
  assert.ok(documentResult.errors.some(error => error.code === 'unexpected_fields'));
});
