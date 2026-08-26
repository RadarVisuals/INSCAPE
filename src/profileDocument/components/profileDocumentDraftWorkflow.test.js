import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runtimeSource = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx', import.meta.url), 'utf8');
const reconciliationSource = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowReconciliationBoundary.jsx', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('../../public/ownerSystemWorkflow/useOwnerSystemWorkflowController.js', import.meta.url), 'utf8');
const publicationSource = readFileSync(new URL('../../public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');

test('Preview builds directly from the current isolated System Workflow draft', () => {
  assert.match(runtimeSource, /buildOwnerSystemWorkflowPreviewDocument\(\{[\s\S]*systemWorkflowDraft: controller\.draft/u);
  assert.match(runtimeSource, /<ProfileDocumentV9Preview document=\{preview\}/u);
  assert.doesNotMatch(runtimeSource, /ProfileDocumentPanel|enterPreview\(|ProfileDocumentPreview/u);
});

test('System Workflow persistence uses the profile-isolated draft v4 store', () => {
  assert.match(controllerSource, /createSystemWorkflowDraftStore/u);
  assert.match(controllerSource, /createSystemWorkflowAuthoringSession/u);
  assert.doesNotMatch(controllerSource, /lattice-production-draft|profileDocumentStorage|useProfileDocumentStore/u);
});

test('owner entry reconciles its origin-scoped draft before mounting the Keeper-free runtime', () => {
  assert.match(reconciliationSource, /reconcileStoredOwnerDraftWithPublishedProfile/u);
  assert.match(reconciliationSource, /publishedDocument \? 'LOADING' : 'READY'/u);
  assert.match(reconciliationSource, /<OwnerSystemWorkflowRuntime/u);
  assert.match(runtimeSource, /recordOwnerPublicationBaseline/u);
  assert.match(appSource, /Resolving owner workspace/u);
  assert.doesNotMatch(appSource, /GridWalkerCanvas|KeeperDock|residentHandoff|keeperReactions|selectResidentActorVisible/u);
});

test('publication preparation remains explicit and CID verification is snapshot-bound', () => {
  assert.match(publicationSource, /PREPARE PUBLICATION/u);
  assert.match(publicationSource, /publication\.verifyCid\(snapshot, uploaded\.cid/u);
  assert.match(publicationSource, /publication\.publish\(\)/u);
  assert.match(publicationSource, /Only your <strong>Public Grids<\/strong>/u);
  assert.doesNotMatch(publicationSource, /CID \/ MANUAL FALLBACK|PUBLISH VERSION 9/u);
  assert.doesNotMatch(publicationSource, /OwnerRackBoard|profileRackPresentation|buildProfileDocumentV8/u);
});
