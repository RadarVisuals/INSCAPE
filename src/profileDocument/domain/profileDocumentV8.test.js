import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyLatticeProductionDraft } from '../../lattice/domain/latticeProductionDraft.js';
import { projectLatticeProductionPublication } from '../../lattice/domain/latticeProductionAdapter.js';
import { buildProfileDocumentV3, buildProfileDocumentV8 } from './profileDocumentBuilder.js';
import { canonicalSerializeProfileDocument, ownerProfileDocumentReconciliationFingerprint, profileDocumentReconciliationFingerprint } from './profileDocumentSerialization.js';
import { migrateProfileDocument } from './profileDocumentMigration.js';
import { parseProfileDocumentJson, validateProfileDocument } from './profileDocumentValidation.js';
import { createCanonicalPublication } from './profileDocumentPublication.js';
import { saveProfileSnapshot } from '../storage/profileDocumentStorage.js';

const PROFILE = '0x1111111111111111111111111111111111111111';

function input(overrides = {}) {
  return {
    profileAddress: PROFILE,
    workspace: { version: 8, profileAddress: PROFILE, favorites: [], folders: [], canvas: { launchers: [], objects: [] } },
    assets: [],
    publicPresentation: { keeperId: 'abyssal_eye', stageId: 'black' },
    signalSettings: { notifications: true, speech: true, visualEffects: true, audio: false },
    profileIdentity: { name: 'Version eight' },
    documentId: 'profile:version-eight', revision: 1, createdAt: 1, exportedAt: 2,
    ...overrides,
  };
}

test('v8 builder embeds the exact Phase 2A visitor-safe lattice projection', () => {
  const latticeDraft = createEmptyLatticeProductionDraft(PROFILE);
  latticeDraft.tables[4].title = 'Canonical center';
  const document = buildProfileDocumentV8({ ...input(), latticeDraft });
  const expected = projectLatticeProductionPublication(latticeDraft, [], { lastPublished: document.exportedAt });
  assert.equal(document.version, 8);
  assert.deepEqual(document.lattice, expected);
  assert.equal(validateProfileDocument(document).valid, true);
  assert.deepEqual(parseProfileDocumentJson(canonicalSerializeProfileDocument(document)), document);
  assert.deepEqual(migrateProfileDocument(document), document);
  assert.equal(
    ownerProfileDocumentReconciliationFingerprint(buildProfileDocumentV3(input()), latticeDraft),
    profileDocumentReconciliationFingerprint(document),
  );
});

test('v7 remains the builder default and legacy documents never acquire a lattice field', () => {
  const document = buildProfileDocumentV3(input());
  assert.equal(document.version, 7);
  assert.equal(Object.hasOwn(document, 'lattice'), false);
  for (const version of [1, 2, 3, 4, 5, 6]) {
    const legacy = structuredClone(document);
    legacy.version = version;
    if (version <= 4) delete legacy.presentation.avatarShape;
    if (version <= 5) delete legacy.presentation.visitorNavigation;
    if (version <= 2) delete legacy.presentation.environment;
    if (version === 1) {
      legacy.presentation.systemModules = legacy.presentation.systemModules.map(({ startOpen: _a, windowGeometry: _b, ...value }) => value);
      legacy.spaces = legacy.spaces.map(({ startOpen: _a, windowGeometry: _b, ...value }) => value);
    }
    const migrated = migrateProfileDocument(legacy);
    assert.equal(migrated.version, 7);
    assert.equal(Object.hasOwn(migrated, 'lattice'), false);
  }
});

test('v8 validation fails closed for corrupt lattice, mismatched timestamps, fallback mutation, and wrong draft profile', () => {
  const latticeDraft = createEmptyLatticeProductionDraft(PROFILE);
  const document = buildProfileDocumentV8({ ...input(), latticeDraft });
  const corrupt = structuredClone(document);
  corrupt.lattice.tables = [];
  assert.equal(validateProfileDocument(corrupt).valid, false);
  const timestamp = structuredClone(document);
  timestamp.lattice.lastPublished = '2026-07-29T00:00:00.000Z';
  assert.ok(validateProfileDocument(timestamp).errors.some(({ code }) => code === 'last_published_mismatch'));
  const invalidFallback = structuredClone(document);
  invalidFallback.presentation.keeperId = 'remote-keeper';
  assert.equal(validateProfileDocument(invalidFallback).valid, false);
  assert.throws(() => buildProfileDocumentV8({
    ...input(),
    latticeDraft: createEmptyLatticeProductionDraft('0x2222222222222222222222222222222222222222'),
  }), /must match/);
});

test('v8 creates canonical publication artifacts while legacy local snapshot storage remains v7-only', () => {
  const document = buildProfileDocumentV8({ ...input(), latticeDraft: createEmptyLatticeProductionDraft(PROFILE) });
  const artifact = createCanonicalPublication(document);
  assert.equal(artifact.document.version, 8);
  assert.equal(artifact.text, canonicalSerializeProfileDocument(document));
  let writes = 0;
  const storage = { setItem: () => { writes += 1; } };
  assert.equal(saveProfileSnapshot(storage, document), false);
  assert.equal(writes, 0);
  assert.throws(() => createCanonicalPublication({ ...document, version: 9 }), /not publishable/);
});
