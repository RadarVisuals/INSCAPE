import test from 'node:test';
import assert from 'node:assert/strict';
import { validImageModules } from './imageModule.js';
import { createEmptySystemWorkflowDraft, validateSystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS as assets } from '../public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
const profileAddress = `0x${'1'.repeat(40)}`;
const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[0].id);
const record = index => ({ id: `image:audit-${index}`, name: 'Audit image', width: 4096, height: 32, visibility: 'PUBLIC',
  sides: Array.from({ length: 32 }, (_, i) => ({ id: `side:${i}`, asset: structuredClone(asset), crop: { x: .5, y: .5, zoom: 1 }, transform: { quarterTurns: i % 4, mirrorX: false, mirrorY: false } })) });
const build = draft => buildProfileDocumentV9({ profileAddress, systemWorkflowDraft: draft, assetRecords: [] });

test('audit: 16 Images with 32 sides survive publication and restoration without truncation', () => {
  const draft = { ...createEmptySystemWorkflowDraft(profileAddress), imageModules: Array.from({ length: 16 }, (_, i) => record(i)) };
  assert.equal(validateSystemWorkflowDraft(draft).valid, true);
  const doc = build(draft);
  assert.equal(countProfileDocumentV9Assets(doc), 512);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft).imageModules, draft.imageModules);
  assert.equal(validImageModules([...draft.imageModules, record(16)]), false);
  const tooManySides = record(0); tooManySides.sides.push({ ...tooManySides.sides[0], id: 'side:overflow' });
  assert.equal(validImageModules([tooManySides]), false);
});
test('audit: over-capacity restore rejects rather than removing local Images', () => {
  const draft = { ...createEmptySystemWorkflowDraft(profileAddress), imageModules: Array.from({ length: 16 }, (_, i) => ({ ...record(i), sides: [], visibility: 'PRIVATE' })) };
  const doc = build({ ...createEmptySystemWorkflowDraft(profileAddress), imageModules: [record(16)] });
  const before = structuredClone(draft);
  assert.throws(() => reconcileSystemWorkflowDraftFromProfileDocumentV9(doc, draft));
  assert.deepEqual(draft, before);
});
test('audit: Image metadata participates in the existing draft byte limit', () => {
  const draft = { ...createEmptySystemWorkflowDraft(profileAddress), imageModules: Array.from({ length: 16 }, (_, i) => record(i)) };
  for (const image of draft.imageModules) for (const side of image.sides) side.asset.attributes = Array.from({ length: 128 }, (_, i) => ({ key: `attribute-${i}`, value: 'x'.repeat(400), type: null }));
  const result = validateSystemWorkflowDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'draft_too_large'));
});
