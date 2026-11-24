import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runtimeSource = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
const reconciliationSource = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../../public/ownerSystemWorkflow/useWorkbenchController.js', import.meta.url), 'utf8');
const publicationSource = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');

test('Studio opens the selected composition in its read-only viewer', () => {
  assert.match(runtimeSource, /<CompositionPreview\b/u);
  assert.doesNotMatch(runtimeSource, /<ProfileDocumentV9Preview\b|<ReceptionEditorPreview\b/u);
});

test('System Workflow persistence uses the profile-isolated draft v4 store', () => {
  assert.match(controllerSource, /createSystemWorkflowDraftStore/u);
  assert.match(controllerSource, /createWorkbenchSession/u);
  assert.doesNotMatch(controllerSource, /lattice-production-draft|profileDocumentStorage|useProfileDocumentStore/u);
});

test('owner entry reconciles its origin-scoped draft before mounting the Keeper-free runtime', () => {
  assert.match(reconciliationSource, /reconcileOwnerDraftWithPublishedProfile/u);
  assert.match(reconciliationSource, /ProfileEditingBoundary/u);
  assert.match(reconciliationSource, /getRecordState/u);
  assert.match(reconciliationSource, /<OwnerSystemWorkflowRuntime/u);
  assert.match(appSource, /Resolving owner workspace/u);
  assert.doesNotMatch(appSource, /GridWalkerCanvas|KeeperDock|residentHandoff|keeperReactions|selectResidentActorVisible/u);
});

test('publication preparation remains explicit and CID verification is snapshot-bound', () => {
  assert.match(publicationSource, /Prepare publication/u);
  assert.match(publicationSource, /cidRef\.current = uploaded\.cid;[\s\S]*publication\.verifyCid\(snapshot, cidRef\.current/u);
  assert.match(publicationSource, /publication\.publish\(\)/u);
  assert.match(publicationSource, /Your public images, text and shapes, composition layout, Keeper content and custom identity card/u);
  assert.doesNotMatch(publicationSource, /CID \/ MANUAL FALLBACK|PUBLISH VERSION 9/u);
  assert.doesNotMatch(publicationSource, /OwnerRackBoard|profileRackPresentation|buildProfileDocumentV8/u);
});
