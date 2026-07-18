import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfileDocumentV1 } from './profileDocumentBuilder.js';
import { canonicalSerializeProfileDocument, formatProfileDocumentJson, profileDocumentContentFingerprint } from './profileDocumentSerialization.js';
import { migrateProfileDocument } from './profileDocumentMigration.js';
import { parseProfileDocumentJson, ProfileDocumentValidationError, validateProfileDocument } from './profileDocumentValidation.js';
import { createProfileDocumentRestorePlan, executeAtomicRestore } from './profileDocumentRestore.js';
import { createProfileDocumentState, enterDocumentPreview, exitDocumentPreview, isSnapshotStale, setImportedDocument, setSnapshot } from '../state/profileDocumentState.js';

const PROFILE = '0xf3C189819Fd5b042f692983bFbFD57ab607ee709';
const CONTRACT_A = '0x1111111111111111111111111111111111111111';
const CONTRACT_B = '0x2222222222222222222222222222222222222222';
const PRIVATE_ASSET_ID = '42:0x4444444444444444444444444444444444444444:0x04';
const assetA = { id: `42:${CONTRACT_A}:0x01`, chainId: 42, contractAddress: CONTRACT_A, tokenId: '0x01', standard: 'LSP8', name: 'One', thumbnailUrl: 'ipfs://one' };
const assetB = { id: `42:${CONTRACT_B}:contract`, chainId: 42, contractAddress: CONTRACT_B, tokenId: null, standard: 'LSP7', name: 'Two', imageUrl: 'https://example.test/two.png' };

function workspace() {
  return { version: 3, profileAddress: PROFILE.toLowerCase(), favorites: [assetB.id, 'private-favorite'],
    folders: [
      { id: 'public-a', name: 'Public A', assetIds: [assetA.id, assetB.id], createdAt: 1, updatedAt: 2 },
      { id: 'public-b', name: 'Public B', assetIds: [assetA.id], createdAt: 3, updatedAt: 4 },
      { id: 'private-folder', name: 'Private', assetIds: [PRIVATE_ASSET_ID], createdAt: 5, updatedAt: 6 }
    ], canvas: { launchers: [
      { id: 'library:folder:public-a', viewType: 'folder', folderId: 'public-a', visitorVisible: true, position: { column: 2, row: 3 }, windowPosition: { column: 1, row: 2 } },
      { id: 'library:folder:public-b', viewType: 'folder', folderId: 'public-b', visitorVisible: true, position: null, windowPosition: null },
      { id: 'library:folder:private-folder', viewType: 'folder', folderId: 'private-folder', visitorVisible: false, position: { column: 5, row: 6 }, windowPosition: { column: 2, row: 4 } }
    ] } };
}
function build(overrides = {}) {
  return buildProfileDocumentV1({ profileAddress: PROFILE, workspace: workspace(), assets: [assetA, assetB],
    publicPresentation: { keeperId: 'skull_reaper', stageId: 'black' },
    signalSettings: { notifications: true, speech: false, visualEffects: true, audio: false },
    profileIdentity: { name: 'VXCTXR', avatarUrl: 'https://example.test/avatar.png', cache: 'private' },
    modulePositions: { identity: { column: 0, row: 1 }, signals: { column: 4, row: 3 } },
    documentId: 'profile:test', revision: 3, createdAt: 1000, exportedAt: 2000, ...overrides });
}

test('v1 builder emits a valid allowlisted deterministic public document', () => {
  const first = build(); const second = build();
  assert.equal(validateProfileDocument(first).valid, true);
  assert.deepEqual(first, second);
  assert.equal(canonicalSerializeProfileDocument(first), canonicalSerializeProfileDocument(second));
  assert.deepEqual(first.spaces.map((space) => space.label), ['Public A', 'Public B']);
  assert.equal(first.spaces[0].assets[0].stableAssetId, assetA.id);
  assert.equal(first.spaces[1].assets[0].stableAssetId, assetA.id, 'multi-space membership is preserved');
});

test('empty authored profiles are valid', () => {
  const document = build({ workspace: { ...workspace(), folders: [], favorites: [], canvas: { launchers: [] } }, assets: [] });
  assert.equal(validateProfileDocument(document).valid, true); assert.deepEqual(document.spaces, []);
});

test('private subsystem and local persistence fields cannot leak through builder allowlisting', () => {
  const privateState = workspace();
  Object.assign(privateState, { searchQuery: 'secret-search', localStorageKey: 'secret-key', identityCache: { secret: true }, signalsHistory: ['secret-signal'], fixtureMode: true });
  privateState.folders[2].privateHtml = '<script>secret-script</script>';
  const serialized = canonicalSerializeProfileDocument(build({ workspace: privateState,
    signalSettings: { notifications: true, speech: true, visualEffects: true, audio: false, history: ['secret-signal'], knownIds: ['secret-id'] } }));
  for (const secret of ['secret-search', 'secret-key', 'secret-signal', 'secret-id', 'secret-script', 'private-folder', 'private-favorite', 'identityCache', 'fixtureMode']) assert.equal(serialized.includes(secret), false, secret);
  assert.equal(serialized.includes(PRIVATE_ASSET_ID), false);
});

test('builder omits private pinned spaces and produces a valid empty projection when all are private', () => {
  const mixed = build();
  assert.deepEqual(mixed.spaces.map((space) => space.label), ['Public A', 'Public B']);
  assert.equal(formatProfileDocumentJson(mixed).includes('Private'), false);
  const privateOnlyWorkspace = workspace();
  privateOnlyWorkspace.canvas.launchers = privateOnlyWorkspace.canvas.launchers.map((launcher) => ({ ...launcher, visitorVisible: false }));
  const empty = build({ workspace: privateOnlyWorkspace });
  assert.equal(validateProfileDocument(empty).valid, true);
  assert.deepEqual(empty.spaces, []);
});

test('formatted export/import round trip preserves semantic and canonical content', () => {
  const source = build(); const imported = parseProfileDocumentJson(formatProfileDocumentJson(source));
  assert.deepEqual(imported, source); assert.equal(canonicalSerializeProfileDocument(imported), canonicalSerializeProfileDocument(source));
});

test('strict validation rejects malformed JSON, wrong type, future versions, addresses, duplicates, placement, fields and URLs', () => {
  assert.throws(() => parseProfileDocumentJson('{no'), ProfileDocumentValidationError);
  const cases = [
    { documentType: 'OTHER' }, { version: 2 }, { profile: { address: 'bad', cachedIdentity: { address: 'bad' } } },
    { spaces: [build().spaces[0], build().spaces[0]] },
    { spaces: [{ ...build().spaces[0], placement: { column: -1, row: 0 } }] },
    { spaces: [{ ...build().spaces[0], privateState: true }] },
    { spaces: [{ ...build().spaces[0], assets: [{ ...build().spaces[0].assets[0], cachedPreviewUrl: 'javascript:alert(1)' }] }] }
  ];
  for (const change of cases) assert.equal(validateProfileDocument({ ...build(), ...change }).valid, false);
});

test('validation enforces space, asset, total-size and canonical-reference limits', () => {
  const base = build(); const space = base.spaces[0];
  assert.equal(validateProfileDocument({ ...base, spaces: Array.from({ length: 25 }, (_, index) => ({ ...space, id: `space:${index}`, launcherId: `launcher:${index}`, order: index })) }).valid, false);
  assert.equal(validateProfileDocument({ ...base, spaces: [{ ...space, assets: Array.from({ length: 201 }, (_, index) => ({ ...space.assets[0], stableAssetId: `42:${CONTRACT_A}:0x${(index + 1).toString(16)}`, tokenId: `0x${(index + 1).toString(16)}` })) }] }).valid, false);
  assert.equal(validateProfileDocument(base, { rawSize: 600 * 1024 }).valid, false);
  assert.equal(validateProfileDocument({ ...base, spaces: [{ ...space, assets: [{ ...space.assets[0], stableAssetId: `42:${CONTRACT_B}:0x01` }] }] }).valid, false);
});

test('migration accepts only valid v1 documents and never guesses', () => {
  assert.deepEqual(migrateProfileDocument(build()), build());
  assert.throws(() => migrateProfileDocument({ documentType: 'OTHER', version: 1 }), ProfileDocumentValidationError);
  assert.throws(() => migrateProfileDocument({ ...build(), version: 9 }), ProfileDocumentValidationError);
});

test('snapshot stale detection ignores revision timestamps but detects authored public changes', () => {
  const source = build(); let state = setSnapshot(createProfileDocumentState(), source, profileDocumentContentFingerprint(source));
  assert.equal(isSnapshotStale(state, { ...source, revision: 99, exportedAt: new Date(9999).toISOString() }), false);
  const changed = structuredClone(source); changed.spaces[0].label = 'Changed'; assert.equal(isSnapshotStale(state, changed), true);
});

test('private content edits do not stale public content, while either visibility transition does', () => {
  const source = build();
  let state = setSnapshot(createProfileDocumentState(), source, profileDocumentContentFingerprint(source));
  const privateEdit = workspace(); privateEdit.folders.find((folder) => folder.id === 'private-folder').name = 'Private renamed'; privateEdit.folders.find((folder) => folder.id === 'private-folder').assetIds.push(assetA.id);
  assert.equal(isSnapshotStale(state, build({ workspace: privateEdit })), false);
  privateEdit.canvas.launchers.find((launcher) => launcher.folderId === 'private-folder').visitorVisible = true;
  const madePublic = build({ workspace: privateEdit });
  assert.equal(isSnapshotStale(state, madePublic), true);
  assert.equal(madePublic.spaces.some((space) => space.label === 'Private renamed' && space.assets.some((asset) => asset.stableAssetId === assetA.id)), true);
  const madePrivate = workspace(); madePrivate.canvas.launchers.find((launcher) => launcher.folderId === 'public-a').visitorVisible = false;
  assert.equal(isSnapshotStale(state, build({ workspace: madePrivate })), true);
  assert.equal(build({ workspace: madePrivate }).spaces.some((space) => space.id === 'library:folder:public-a'), false);
});

test('import preview is isolated and exit preserves draft state', () => {
  const draft = workspace(); let state = setImportedDocument(createProfileDocumentState(), build());
  state = enterDocumentPreview(state, 'imported'); state.preview.spaces[0].label = 'Visitor mutation';
  state = exitDocumentPreview(state); assert.deepEqual(workspace(), draft); assert.equal(state.imported.spaces[0].label, 'Public A');
});

test('restore plan replaces only public presentation and preserves private Favorites/folders', () => {
  const current = workspace(); const plan = createProfileDocumentRestorePlan(build(), current);
  assert.deepEqual(plan.workspace.favorites, current.favorites);
  assert.deepEqual(plan.workspace.folders.find((folder) => folder.id === 'private-folder'), current.folders[2]);
  assert.equal(plan.workspace.canvas.launchers.find((launcher) => launcher.folderId === 'private-folder').visitorVisible, false);
  assert.equal(plan.workspace.canvas.launchers.filter((launcher) => launcher.visitorVisible).length, 2);
  assert.deepEqual(plan.workspace.folders.find((folder) => folder.id === 'public-a').assetIds, [assetA.id, assetB.id]);
  assert.equal(plan.keeperId, 'skull_reaper'); assert.equal(plan.stageId, 'black');
});

test('restore collisions preserve an unpinned private folder deterministically', () => {
  const current = workspace(); current.canvas.launchers = current.canvas.launchers.filter((launcher) => launcher.folderId !== 'public-a');
  current.folders[0].assetIds = ['private-collision-membership'];
  const plan = createProfileDocumentRestorePlan(build(), current);
  assert.deepEqual(plan.workspace.folders.find((folder) => folder.id === 'public-a').assetIds, current.folders[0].assetIds);
  assert.ok(plan.workspace.folders.some((folder) => folder.id === 'public-a-2'));
});

test('restore never overwrites a colliding private pinned space', () => {
  const current = workspace();
  const importedSource = workspace();
  importedSource.canvas.launchers = [importedSource.canvas.launchers.find((launcher) => launcher.folderId === 'private-folder')];
  importedSource.canvas.launchers[0].visitorVisible = true;
  importedSource.folders.find((folder) => folder.id === 'private-folder').name = 'Imported public collision';
  const plan = createProfileDocumentRestorePlan(build({ workspace: importedSource }), current);
  assert.equal(plan.workspace.folders.find((folder) => folder.id === 'private-folder').name, 'Private');
  assert.equal(plan.workspace.canvas.launchers.find((launcher) => launcher.folderId === 'private-folder').visitorVisible, false);
  assert.equal(plan.workspace.folders.find((folder) => folder.id === 'private-folder-2').name, 'Imported public collision');
  assert.equal(plan.workspace.canvas.launchers.find((launcher) => launcher.folderId === 'private-folder-2').visitorVisible, true);
});

test('atomic restore succeeds or rolls all state back after persistence failure', async () => {
  let current = { workspace: workspace(), presentation: { keeperId: 'abyssal_eye', stageId: 'moonpurple' }, signalSettings: { notifications: true } };
  const plan = createProfileDocumentRestorePlan(build(), current.workspace);
  const adapters = { getWorkspace: () => current.workspace, getPresentation: () => current.presentation, getSignalSettings: () => current.signalSettings,
    persistWorkspace: () => true, applyWorkspace: (value) => { current.workspace = value; }, applyPresentation: (value) => { current.presentation = value; }, applySignalSettings: (value) => { current.signalSettings = value; } };
  await executeAtomicRestore(plan, adapters); assert.equal(current.presentation.keeperId, 'skull_reaper');
  const before = structuredClone(current); adapters.persistWorkspace = () => { throw new Error('quota'); };
  await assert.rejects(() => executeAtomicRestore(plan, adapters), /quota/); assert.deepEqual(current, before);
});

test('different-profile imports remain valid and can be warned without mutation', () => {
  const other = build({ profileAddress: '0x3333333333333333333333333333333333333333', documentId: 'profile:other' });
  assert.equal(validateProfileDocument(other).valid, true); assert.notEqual(other.profile.address, PROFILE.toLowerCase());
});
