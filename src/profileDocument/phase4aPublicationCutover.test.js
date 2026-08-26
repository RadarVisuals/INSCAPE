import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { INSCAPE_PROFILE_DOCUMENT_KEY } from './domain/inscapeProfileDocumentKey.js';
import { PROFILE_DOCUMENT_PUBLICATION_VERSIONS } from './domain/constants.js';
import { PROFILE_DIRECTORY_QUERY } from '../profileDiscovery/data/luksoProfileDiscoveryRepository.js';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const publisher = source('./storage/profileDocumentPublisher.js');
const resolver = source('./storage/luksoPublishedProfileRepository.js');
const discovery = source('../profileDiscovery/data/luksoProfileDiscoveryRepository.js');
const uploadClient = source('./storage/profileDocumentUploadClient.js');
const uploadFunction = source('../../netlify/functions/pin-profile-document.mjs');
const activeVisitor = source('./components/PublishedProfileDocumentPreview.jsx');
const systemPublicationUi = source('../public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx');
const runtimeSelector = source('../public/ownerRuntimeSelected.js');

test('publisher, resolver, and Discovery import one central exact singleton-key authority', () => {
  assert.equal(INSCAPE_PROFILE_DOCUMENT_KEY, '0x804dd24d51189d1d9e972f155541cead2653af105983d5acac1ec2b3478d9362');
  assert.match(publisher, /import \{ INSCAPE_PROFILE_DOCUMENT_KEY \} from '\.\.\/domain\/inscapeProfileDocumentKey\.js'/);
  assert.match(resolver, /import \{ INSCAPE_PROFILE_DOCUMENT_KEY \} from '\.\.\/domain\/inscapeProfileDocumentKey\.js'/);
  assert.match(discovery, /import \{ INSCAPE_PROFILE_DOCUMENT_KEY \} from '\.\.\/\.\.\/profileDocument\/domain\/inscapeProfileDocumentKey\.js'/);
  assert.match(publisher, /args: \[INSCAPE_PROFILE_DOCUMENT_KEY, verified\.value\]/);
  assert.match(resolver, /args: \[INSCAPE_PROFILE_DOCUMENT_KEY\]/);
  assert.match(discovery, /key: INSCAPE_PROFILE_DOCUMENT_KEY/);
  assert.match(PROFILE_DIRECTORY_QUERY, /where: \{ key: \{ _eq: \$key \} \}/);
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
  for (const text of [publisher, resolver, discovery, uploadClient, uploadFunction, activeVisitor]) {
    assert.doesNotMatch(text, /OSUnderneathProfileDocument|4a5b4ddee4f353a47d88a0ad908a9ff0bee45f7d31158b2d79ddafd15817cb4e/);
  }
});

test('prepared publication UI reuses canonical v9 upload, CID, wallet, and read-back authorities', () => {
  assert.match(systemPublicationUi, /buildOwnerSystemWorkflowPublicationDocument/);
  assert.match(systemPublicationUi, /assertValidProfileDocumentV9/);
  assert.match(systemPublicationUi, /profileDocumentV9ContentFingerprint/);
  assert.match(systemPublicationUi, /uploadProfileDocument\(snapshot\)/);
  assert.match(systemPublicationUi, /publication\.verifyCid\(snapshot, uploaded\.cid/);
  assert.match(systemPublicationUi, /publication\.publish\(\)/);
  assert.match(systemPublicationUi, /confirmed\?\.result\?\.document/);
  assert.doesNotMatch(systemPublicationUi, /buildProfileDocumentV8|canonicalSerializeProfileDocument\(|version 8/i);
  assert.match(runtimeSelector, /OWNER_RUNTIME_SELECTION = 'SYSTEM_WORKFLOW'/);
  assert.match(runtimeSelector, /import\('\.\/OwnerSystemWorkflowShell\.jsx'\)/);
});
