import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultWorkbenchPresentation } from './workbenchPresentation.js';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from './profileDocumentV9Builder.js';
import {
  canonicalSerializeProfileDocumentV9,
  profileDocumentV9CanonicalHash,
  profileDocumentV9ContentFingerprint,
  profileDocumentV9HashInput,
  profileDocumentV9ReconciliationFingerprint,
} from './profileDocumentV9Serialization.js';
import {
  assertValidProfileDocumentV9,
  parseProfileDocumentV9Json,
  validateProfileDocumentV9,
} from './profileDocumentV9Validation.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from './profileDocumentV9Reconciliation.js';
import { createOwnerDraftFromPublishedProfile } from '../storage/ownerDraftReconciliation.js';
import { SYSTEM_WORKFLOW_LIMITS } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { isValidIdentityCard, resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CONTRACT = '0x2222222222222222222222222222222222222222';
const ASSET = `42:${CONTRACT}:0x01`;
const asset = () => ({
  id: ASSET, chainId: 42, contractAddress: CONTRACT, tokenId: '0x01', standard: 'LSP8',
  name: 'Canonical work', description: 'Public description', collectionName: 'Collection',
  imageUrl: 'https://assets.example/work.png', thumbnailUrl: null, originalImageUrl: null,
  imageWidth: 1600, imageHeight: 900, creators: [{ address: PROFILE, name: 'Creator' }], attributes: [],
  fieldProvenance: { creators: { source: 'LUKSO INDEXER / LSP4 CREATORS', scope: 'tokenId' } },
});
function draft() { return createEmptySystemWorkflowDraft(PROFILE); }

function document(overrides = {}) {
  return buildProfileDocumentV9({
    assetRecords: [asset()], createdAt: 1, exportedAt: 2, profileAddress: PROFILE,
    profileIdentity: { name: 'Resident Zero', avatarUrl: 'https://assets.example/avatar.png' },
    revision: 4, systemWorkflowDraft: draft(), ...overrides,
  });
}

test('Identity chosen image survives the existing public avatar envelope and draft restoration', () => {
  const input = draft();
  const selectedMedia = { url: 'https://assets.example/purple.png', width: 2000, height: 2000 };
  input.identityPresentation.avatar = { mode: 'inscape', stableAssetId: ASSET, shape: 'square', selectedMedia };
  const published = document({ systemWorkflowDraft: input });
  assert.equal(published.version, 9);
  assert.deepEqual(Object.keys(published.identityPresentation.avatar), ['mode', 'asset', 'shape']);
  assert.equal(published.identityPresentation.avatar.asset.media.url, selectedMedia.url);
  assert.equal(published.identityPresentation.avatar.asset.media.width, 2000);
  assert.deepEqual(reconcileSystemWorkflowDraftFromProfileDocumentV9(published).identityPresentation.avatar,
    input.identityPresentation.avatar);
  assert.deepEqual(createOwnerDraftFromPublishedProfile(published).identityPresentation.avatar,
    input.identityPresentation.avatar);
  assert.equal(document().identityPresentation.avatar.mode, 'official');
});

test('Identity settings round-trip, empty fields stay private, and legacy cards retain their defaults', () => {
  const input = draft();
  const legacy = document();
  assert.equal(Object.hasOwn(legacy.identityPresentation, 'card'), false);
  assert.equal(resolveIdentityCard(legacy.identityPresentation).background.type, 'plain');
  assert.equal(resolveIdentityCard({ avatar: { mode: 'inscape' } }).background.type, 'clouds');
  input.identityPresentation.card = { version: 1, background: { type: 'clouds', color: '#7020cc', speed: 0.4 }, fields: [
    { id: 'field:location', label: ' Location ', type: 'text', value: 'The Underneath\nLunar Desert' },
    { id: 'field:roles', label: 'Open to', type: 'list', value: [' Collaboration ', '', 'Commissions'] },
    { id: 'field:unfinished', label: '', type: 'text', value: 'UNPUBLISHED EMPTY FIELD' },
    { id: 'field:empty', label: 'Empty', type: 'text', value: '   ' },
  ] };
  const published = document({ systemWorkflowDraft: input });
  assert.equal(published.version, 9);
  assert.deepEqual(published.identityPresentation.card.background, input.identityPresentation.card.background);
  assert.deepEqual(published.identityPresentation.card.fields.map(field => field.id), ['field:location', 'field:roles']);
  assert.deepEqual(published.identityPresentation.card.fields[1].value, ['Collaboration', 'Commissions']);
  assert.equal(canonicalSerializeProfileDocumentV9(published).includes('UNPUBLISHED EMPTY FIELD'), false);
  assert.equal(input.identityPresentation.card.fields.length, 4, 'publication does not mutate the draft');
  const parsed = parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(published));
  assert.deepEqual(parsed.identityPresentation.card, published.identityPresentation.card);
  for (const restore of [reconcileSystemWorkflowDraftFromProfileDocumentV9, createOwnerDraftFromPublishedProfile]) {
    assert.deepEqual(restore(published).identityPresentation.card, published.identityPresentation.card);
  }
  const changed = structuredClone(published); changed.identityPresentation.card.background.speed = 0.8;
  assert.notEqual(profileDocumentV9ContentFingerprint(changed), profileDocumentV9ContentFingerprint(published));
  assert.notEqual(profileDocumentV9CanonicalHash(changed), profileDocumentV9CanonicalHash(published));
});

test('Identity card boundaries reject executable settings, invalid values and unbounded fields', () => {
  const card = resolveIdentityCard();
  const validField = { id: 'field:one', label: 'Role', type: 'text', value: 'Artist' };
  for (const invalid of [null, {}, { ...card, version: 2 }, { ...card, shader: 'code' },
    ...[1, 6, 2.5, '3', null].map(columns => ({ ...card, columns })),
    { ...card, fields: [{ ...validField, wide: 'yes' }] },
    { ...card, subtitle: 'Unsupported field' },
    { ...card, fields: [{ ...validField, category: 'x'.repeat(61) }] },
    { ...card, background: { ...card.background, type: 'custom-code' } },
    { ...card, background: { ...card.background, color: 'url(https://example.org)' } },
    { ...card, background: { ...card.background, speed: 3 } },
    { ...card, background: { ...card.background, speed: NaN } },
    { ...card, fields: [validField, validField] },
    { ...card, fields: [{ ...validField, value: '\u0000' }] },
    { ...card, fields: [{ ...validField, value: 'x'.repeat(2001) }] },
    { ...card, fields: [{ ...validField, type: 'list', value: Array(17).fill('x') }] },
    { ...card, fields: Array.from({ length: 17 }, (_, index) => ({ ...validField, id: `field:${index}` })) },
    (value) => { value.grids = []; },
    (value) => { value.displays = []; },
  ]) {
    assert.equal(isValidIdentityCard(invalid), false);
    const candidate = document(); candidate.identityPresentation.card = invalid;
    assert.equal(validateProfileDocumentV9(candidate).valid, false);
    const input = draft(); input.identityPresentation.card = invalid;
    assert.throws(() => document({ systemWorkflowDraft: input }));
  }
});

test('Identity column preferences and wide fields survive publication and restore without changing legacy cards', () => {
  const input = draft();
  const legacy = resolveIdentityCard();
  input.identityPresentation.card = legacy;
  assert.deepEqual(document({ systemWorkflowDraft: input }).identityPresentation.card, legacy);
  for (const columns of [2, 3, 4, 5]) {
    const card = { ...legacy, columns, fields: [{ id: 'field:exploring', label: 'Exploring', type: 'list', value: ['Motion through code'], wide: true }] };
    input.identityPresentation.card = card;
    const published = parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(document({ systemWorkflowDraft: input })));
    assert.deepEqual(published.identityPresentation.card, card);
    assert.deepEqual(createOwnerDraftFromPublishedProfile(published).identityPresentation.card, card);
    assert.deepEqual(input.identityPresentation.card, card);
  }
});

test('optional Identity categories round-trip while cards without categories stay unchanged', () => {
  const legacy = resolveIdentityCard();
  const input = draft(); input.identityPresentation.card = legacy;
  assert.deepEqual(document({ systemWorkflowDraft: input }).identityPresentation.card, legacy);
  const card = { ...legacy, fields: [
    { id: 'field:role', category: 'Practice', label: 'Role', type: 'text', value: 'Artist' },
  ] };
  input.identityPresentation.card = card;
  const published = document({ systemWorkflowDraft: input });
  assert.equal(validateProfileDocumentV9(published).valid, true);
  assert.deepEqual(published.identityPresentation.card, card);
});

test('builder rejects explicit invalid revisions and strips creators without canonical LSP4 provenance', () => {
  for (const revision of [0, -1, 1.5, '2', NaN]) {
    assert.throws(() => document({ revision }), { code: 'INSCAPE_PROFILE_REVISION_INVALID' });
  }
  const unproven = asset(); delete unproven.fieldProvenance;
  const input = draft();
  input.identityPresentation.avatar = { mode: 'inscape', stableAssetId: ASSET, shape: 'square' };
  const value = document({ assetRecords: [unproven], systemWorkflowDraft: input });
  assert.deepEqual(value.identityPresentation.avatar.asset.creators, []);
});

test('malformed identity presentation returns structured validation errors without throwing', () => {
  for (const identityPresentation of [null, 'identity', {}, { avatar: null }]) {
    const candidate = structuredClone(document()); candidate.identityPresentation = identityPresentation;
    let result;
    assert.doesNotThrow(() => { result = validateProfileDocumentV9(candidate); });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(({ path }) => path === 'identityPresentation'));
  }
});

test('v9 validation is exact, v9-only, quantity bounded, and rejects private or legacy leakage', () => {
  const source = document();
  for (const mutate of [
    (value) => { value.version = 8; },
    (value) => { value.documentType = 'OS_UNDERNEATH_PROFILE'; },
    (value) => { value.lattice = {}; },
    (value) => { value.miniApps = []; },
    (value) => { value.workbench = { ...createDefaultWorkbenchPresentation(), miniApps: [] }; },
  ]) {
    const candidate = structuredClone(source);
    mutate(candidate);
    assert.equal(validateProfileDocumentV9(candidate).valid, false);
  }

});

test('v9 raw byte boundary accepts 512 KiB and rejects limit plus one', () => {
  const value = document();
  assert.equal(validateProfileDocumentV9(value, { rawSize: SYSTEM_WORKFLOW_LIMITS.maxJsonBytes }).valid, true);
  assert.ok(validateProfileDocumentV9(value, { rawSize: SYSTEM_WORKFLOW_LIMITS.maxJsonBytes + 1 }).errors
    .some(({ code }) => code === 'document_too_large'));
});

test('canonical serialization and hash input are stable while content/reconciliation fingerprints omit only their authorities', () => {
  const first = document();
  const second = document({ createdAt: 10, exportedAt: 20, revision: 9 });
  const changedCache = document({ createdAt: 10, exportedAt: 20, revision: 9,
    profileIdentity: { name: 'Changed cached identity' } });
  assert.deepEqual(parseProfileDocumentV9Json(canonicalSerializeProfileDocumentV9(first)), first);
  assert.deepEqual(profileDocumentV9HashInput(first), new TextEncoder().encode(canonicalSerializeProfileDocumentV9(first)));
  assert.match(profileDocumentV9CanonicalHash(first), /^0x[0-9a-f]{64}$/u);
  assert.equal(profileDocumentV9ContentFingerprint(first), profileDocumentV9ContentFingerprint(second));
  assert.equal(profileDocumentV9ReconciliationFingerprint(first), profileDocumentV9ReconciliationFingerprint(second));
  assert.notEqual(profileDocumentV9ContentFingerprint(first), profileDocumentV9ContentFingerprint(changedCache));
  assert.equal(profileDocumentV9ReconciliationFingerprint(first), profileDocumentV9ReconciliationFingerprint(changedCache));
  assert.throws(() => parseProfileDocumentV9Json(JSON.stringify({ ...first, version: 8 })));
});

test('publications and restored drafts omit the retired Display schema', () => {
  const snapshot = document();
  for (const key of ['artboard', 'geometry', 'appearance', 'grids', 'displays']) {
    assert.equal(Object.hasOwn(snapshot, key), false);
  }
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(snapshot);
  assert.equal(Object.hasOwn(restored, 'grids'), false);
  assert.deepEqual(restored.identityPresentation.alias, snapshot.identityPresentation.alias);
});
