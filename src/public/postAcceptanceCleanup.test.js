import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('production exposes exactly one lazy System Workflow owner runtime', () => {
  const selected = source('./ownerRuntimeSelected.js');
  const loader = source('./ownerRuntimeLoader.js');
  const build = source('../../scripts/productionBuild.js');
  const isolation = source('../../scripts/ownerRuntimeIsolation.js');
  assert.match(selected, /OWNER_RUNTIME_SELECTION = 'SYSTEM_WORKFLOW'/u);
  assert.match(selected, /import\('\.\/OwnerSystemWorkflowShell\.jsx'\)/u);
  for (const legacy of ['OwnerModul8rShell', 'OwnerLatticeShell', 'ModuleGridShell']) {
    assert.equal(existsSync(new URL(`./${legacy}.jsx`, import.meta.url)), false, `${legacy} still exists`);
    assert.doesNotMatch(`${selected}\n${loader}\n${build}\n${isolation}`, new RegExp(legacy, 'u'));
  }
  assert.doesNotMatch(`${selected}\n${loader}\n${build}\n${isolation}`, /MODUL8R|\bLATTICE\b|\bLEGACY\b/u);
});

test('production entry and active Visitor contain no legacy runtime selection', () => {
  const entry = source('../main.jsx');
  const visitor = source('../profileDocument/components/PublishedProfileDocumentPreview.jsx');
  assert.doesNotMatch(entry, /Modul8rDevelopmentEntrance|development\/owner\/modul-8r/u);
  assert.match(visitor, /ProfileDocumentV9Preview/u);
  assert.doesNotMatch(visitor, /VisitorLatticeWorld|PublishedHomeWorld|PublishedLegacyStyles|selectPublishedProfileRuntime/u);
});

test('Profile Document public authority is v9-only and legacy readers are absent', () => {
  const index = source('../profileDocument/index.js');
  const constants = source('../profileDocument/domain/constants.js');
  for (const current of [
    'inscapeProfileDocumentKey',
    'profileDocumentV9Builder',
    'profileDocumentV9Reconciliation',
    'profileDocumentV9Serialization',
    'profileDocumentV9Validation',
  ]) assert.match(index, new RegExp(current, 'u'));
  for (const legacy of [
    'profileDocumentBuilder',
    'profileDocumentMigration',
    'profileDocumentRestore',
    'profileDocumentSerialization',
    'profileDocumentValidation',
    'profileDocumentStorage',
  ]) {
    assert.doesNotMatch(index, new RegExp(legacy, 'u'));
  }
  assert.doesNotMatch(constants,
    /^export const PROFILE_DOCUMENT_(?:TYPE|VERSION|VERSION_8|PUBLICATION_VERSION)\b|OS_UNDERNEATH_PROFILE/mu);
  for (const relative of [
    '../profileDocument/domain/profileDocumentBuilder.js',
    '../profileDocument/domain/profileDocumentMigration.js',
    '../profileDocument/domain/profileDocumentRestore.js',
    '../profileDocument/domain/profileDocumentSerialization.js',
    '../profileDocument/domain/profileDocumentValidation.js',
    '../profileDocument/storage/profileDocumentStorage.js',
    '../profileDocument/components/PublishedHomeWorld.jsx',
    '../profileDocument/components/VisitorLatticeWorld.jsx',
  ]) assert.equal(existsSync(new URL(relative, import.meta.url)), false, `${relative} still exists`);
});

test('active public and owner boundaries remain separated after legacy shell removal', () => {
  const app = source('../App.jsx');
  const boundary = source('./OwnerRuntimeBoundary.jsx');
  assert.match(app, /localOwnerRoute \? !ownerSourceReady \?[\s\S]*<OwnerRuntimeBoundary/u);
  assert.match(app, /: <PublishedProfileBoundary/u);
  assert.match(boundary, /workspace && workspace === viewed/u);
  assert.doesNotMatch(boundary, /PublishedProfileBoundary|localStorage|useLibraryStore|useSignalStore/u);
});
