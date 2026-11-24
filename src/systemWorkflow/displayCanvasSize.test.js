import assert from 'node:assert/strict';
import test from 'node:test';
import { displayFormat, displayPreset, isDisplayFormat } from './domain/displayModules.js';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { createEmptySystemWorkflowDraft, assertValidSystemWorkflowDraft, validateSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { validateProfileDocumentV9, parseProfileDocumentV9Json } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { canonicalSerializeProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Serialization.js';
import { createOwnerSystemWorkflowReviewStorage, OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE as profile, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';

function fixture() {
  const storage = createOwnerSystemWorkflowReviewStorage();
  const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage });
  return { store, storage };
}
const publish = draft => buildProfileDocumentV9({ profileAddress: profile, systemWorkflowDraft: draft, assetRecords: assets });

test('custom dimensions use existing geometry and canonical ratios; old formats retain exact bytes', () => {
  for (const size of [{ width: 24, height: 24 }, { width: 73, height: 19 }, { width: 512, height: 1 }, { width: 1, height: 512 }]) {
    const format = displayFormat(size);
    assert.ok(isDisplayFormat(format.artboard, format.geometry));
    assert.equal(displayPreset(format.geometry), 'CUSTOM');
    assertValidSystemWorkflowDraft({ ...createEmptySystemWorkflowDraft(profile), ...format });
  }
  for (const [preset, size] of [['LANDSCAPE', { width: 32, height: 18 }], ['PORTRAIT', { width: 18, height: 32 }]]) {
    assert.deepEqual(displayFormat(preset), displayFormat(size));
    const old = { ...createEmptySystemWorkflowDraft(profile), ...displayFormat(preset) };
    const bytes = JSON.stringify(old);
    assert.equal(JSON.stringify(assertValidSystemWorkflowDraft(old)), bytes);
    const publicBytes = canonicalSerializeProfileDocumentV9(publish(old));
    assert.equal(canonicalSerializeProfileDocumentV9(parseProfileDocumentV9Json(publicBytes)), publicBytes);
  }
  for (const bad of [0, -1, 1.5, 513, Infinity, NaN, '32', null]) {
    assert.throws(() => displayFormat({ width: bad, height: 18 }));
    assert.throws(() => displayFormat({ width: 32, height: bad }));
    const invalid = { ...createEmptySystemWorkflowDraft(profile), geometry: { columns: bad, rows: 18 } };
    assert.equal(validateSystemWorkflowDraft(invalid).valid, false);
  }
  assert.equal(isDisplayFormat({ aspectWidth: 16, aspectHeight: 9 }, { columns: 24, rows: 24 }), false);
  const invalidPublic = publish(createEmptySystemWorkflowDraft(profile));
  invalidPublic.geometry = { columns: 24, rows: 24 };
  assert.equal(validateProfileDocumentV9(invalidPublic).valid, false);
});
