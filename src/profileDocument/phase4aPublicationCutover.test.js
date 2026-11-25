import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { INSCAPE_PROFILE_DOCUMENT_KEY } from './domain/inscapeProfileDocumentKey.js';
import { PROFILE_DOCUMENT_PUBLICATION_VERSIONS } from './domain/constants.js';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const publisher = source('./storage/profileDocumentPublisher.js');
const resolver = source('./storage/luksoPublishedProfileRepository.js');
const uploadClient = source('./storage/profileDocumentUploadClient.js');
const uploadFunction = source('../../netlify/functions/pin-profile-document.mjs');
const activeVisitor = source('./components/PublishedProfileDocumentPreview.jsx');
const systemPublicationUi = source('../public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx');
const runtimeSelector = source('../public/ownerRuntimeSelected.js');

test('publisher and resolver import one central exact singleton-key authority', () => {
  assert.equal(INSCAPE_PROFILE_DOCUMENT_KEY, '0x804dd24d51189d1d9e972f155541cead2653af105983d5acac1ec2b3478d9362');
  assert.match(publisher, /import \{ INSCAPE_PROFILE_DOCUMENT_KEY \} from '\.\.\/domain\/inscapeProfileDocumentKey\.js'/);
  assert.match(resolver, /import \{ INSCAPE_PROFILE_DOCUMENT_KEY \} from '\.\.\/domain\/inscapeProfileDocumentKey\.js'/);
  assert.match(publisher, /args: \[INSCAPE_PROFILE_DOCUMENT_KEY, verified\.value\]/);
  assert.match(resolver, /args: \[INSCAPE_PROFILE_DOCUMENT_KEY\]/);
});

test('active upload, CID, resolver, and Visitor boundaries are v9-only with no parser injection or compatibility branch', () => {
  assert.deepEqual(PROFILE_DOCUMENT_PUBLICATION_VERSIONS, [9]);
  assert.match(uploadClient, /assertValidProfileDocumentV9\(snapshot\)/);
  assert.match(uploadFunction, /parseProfileDocumentV9Json\(raw\)/);
  assert.match(uploadFunction, /isCanonicalProfileDocumentV9Bytes\(document, requestBytes\)/);
  assert.match(resolver, /import\('\.\.\/domain\/profileDocumentV9Validation\.js'\)/);
  assert.match(resolver, /isCanonicalProfileDocumentV9Bytes\(document, bytes\)/);
  assert.match(resolver, /NON_CANONICAL_DOCUMENT/);
  assert.doesNotMatch(resolver, /documentParser/);
  assert.match(activeVisitor, /ProfileDocumentV9Preview/);
  assert.doesNotMatch(activeVisitor, /VisitorLatticeWorld|PublishedHomeWorld|PublishedLegacyStyles|selectPublishedProfileRuntime/);
  for (const text of [publisher, resolver, uploadClient, uploadFunction, activeVisitor]) {
    assert.doesNotMatch(text, /OSUnderneathProfileDocument|4a5b4ddee4f353a47d88a0ad908a9ff0bee45f7d31158b2d79ddafd15817cb4e/);
  }
});

test('prepared publication UI reuses canonical v9 upload, CID, wallet, and read-back authorities', () => {
  assert.match(systemPublicationUi, /buildOwnerSystemWorkflowPublicationDocument/);
  assert.match(systemPublicationUi, /assertValidProfileDocumentV9/);
  assert.match(systemPublicationUi, /profileDocumentV9ContentFingerprint/);
  assert.match(systemPublicationUi, /uploadProfileDocument\(snapshot,\s*\{/);
  assert.match(systemPublicationUi, /cidRef\.current = uploaded\.cid;[\s\S]*publication\.verifyCid\(snapshot, cidRef\.current/);
  assert.match(systemPublicationUi, /publication\.publish\(\)/);
  assert.match(systemPublicationUi, /confirmed\?\.result\?\.document/);
  assert.doesNotMatch(systemPublicationUi, /buildProfileDocumentV8|canonicalSerializeProfileDocument\(|version 8/i);
  assert.match(runtimeSelector, /OWNER_RUNTIME_SELECTION = 'SYSTEM_WORKFLOW'/);
  assert.match(runtimeSelector, /import\('\.\/OwnerSystemWorkflowShell\.jsx'\)/);
});
