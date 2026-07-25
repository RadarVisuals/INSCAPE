import test from 'node:test';
import assert from 'node:assert/strict';
import { decideOwnerPublicationReconciliation, isWorkspacePublicProjectionEmpty, OWNER_RECONCILIATION_ACTION as ACTION } from './ownerPublicationReconciliation.js';

const input = (overrides = {}) => ({
  localRecordPresence: 'current',
  localFingerprint: 'local',
  localPublicProjectionEmpty: false,
  baseline: { publishedFingerprint: 'base', localFingerprint: 'base' },
  publishedFingerprint: 'base',
  ...overrides
});

test('an absent owner workspace hydrates from the verified publication', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ localRecordPresence: 'absent' })), ACTION.HYDRATE_PUBLICATION);
});

test('legacy empty records from premature autosave hydrate once when no baseline exists', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ baseline: null, localPublicProjectionEmpty: true })), ACTION.HYDRATE_PUBLICATION);
});

test('unchanged local state fast-forwards when the publication advances', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ localFingerprint: 'base', publishedFingerprint: 'next' })), ACTION.HYDRATE_PUBLICATION);
});

test('newer local state survives while publication remains at its baseline', () => {
  assert.equal(decideOwnerPublicationReconciliation(input()), ACTION.KEEP_LOCAL);
});

test('two divergent changes require an explicit conflict decision', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ publishedFingerprint: 'next' })), ACTION.CONFLICT);
});

test('matching local and published state adopts the current publication baseline', () => {
  assert.equal(decideOwnerPublicationReconciliation(input({ localFingerprint: 'same', publishedFingerprint: 'same' })), ACTION.ADOPT_BASELINE);
});

test('public projection emptiness ignores private folders and private artwork', () => {
  assert.equal(isWorkspacePublicProjectionEmpty({ folders: [{ public: false }], canvas: { objects: [{ visitorVisible: false }] } }), true);
  assert.equal(isWorkspacePublicProjectionEmpty({ folders: [{ public: true }], canvas: { objects: [] } }), false);
  assert.equal(isWorkspacePublicProjectionEmpty({ folders: [], canvas: { objects: [{ visitorVisible: true }] } }), false);
});
