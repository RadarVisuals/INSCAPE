import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const ownerDisplay = read('../../public/ownerSystemWorkflow/DisplayModule.jsx');

const ownerMetadata = read('../../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx');
const visitor = read('../../profileDocument/components/PublishedDisplayModule.jsx');

// Shared Display inspection and focus restoration are exercised in
// browser-tests/display-hardening.browser.mjs.

test('owner metadata remains independent from artwork focus motion', () => {
  assert.match(ownerDisplay, /<SharedDisplayToolContent id="metadata"[\s\S]*<OwnerSystemWorkflowMetadataContent/);
  assert.match(ownerMetadata, /export function OwnerSystemWorkflowMetadataContent/);
  assert.match(ownerMetadata, /if \(!dossier\)/);
  assert.match(ownerMetadata, /dossier\.description/);
  assert.doesNotMatch(ownerMetadata, /LatticeFocusViewer|originRectangle|returnLanding|createPortal/);
});

test('Visitor limits the landing handoff to the selected Grid and retains stored layer order', () => {
  assert.match(visitor, /viewerPlacementId=\{selected \? viewer\.sourcePlacementId : null\}/);
  assert.doesNotMatch(visitor, /placement\.layer\s*=/);
});
