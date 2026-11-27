import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');


const ownerMetadata = read('../../public/ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx');

test('owner metadata remains independent from artwork focus motion', () => {
  assert.match(ownerMetadata, /export function OwnerSystemWorkflowMetadataContent/);
  assert.match(ownerMetadata, /if \(!dossier\)/);
  assert.match(ownerMetadata, /dossier\.description/);
  assert.doesNotMatch(ownerMetadata, /LatticeFocusViewer|originRectangle|returnLanding|createPortal/);
});
