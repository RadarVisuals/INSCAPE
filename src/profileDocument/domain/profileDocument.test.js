import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfileDocumentV1 } from './profileDocumentBuilder.js';
import { canonicalSerializeProfileDocument, formatProfileDocumentJson, profileDocumentContentFingerprint } from './profileDocumentSerialization.js';
import { migrateProfileDocument } from './profileDocumentMigration.js';
import { parseProfileDocumentJson, ProfileDocumentValidationError, validateProfileDocument } from './profileDocumentValidation.js';
import { createProfileDocumentRestorePlan, executeAtomicRestore } from './profileDocumentRestore.js';
import { activateProfileDocumentState, createProfileDocumentState, enterDocumentPreview, exitDocumentPreview, isSnapshotStale, setImportedDocument, setSnapshot } from '../state/profileDocumentState.js';
import { loadRestoredPresentation, profilePresentationKey, saveRestoredPresentation } from '../storage/profileDocumentStorage.js';
import { projectDocumentAsset } from './documentProjection.js';
import { PROFILE_DOCUMENT_LIMITS } from './constants.js';

const PROFILE = '0xf3C189819Fd5b042f692983bFbFD57ab607ee709';
const CONTRACT_A = '0x1111111111111111111111111111111111111111';
const CONTRACT_B = '0x2222222222222222222222222222222222222222';
const PRIVATE_ASSET_ID = '42:0x4444444444444444444444444444444444444444:0x04';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
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
    ], objects: [
      { id: 'canvas:artwork:public', kind: 'framed-artwork', stableAssetId: assetA.id, visitorVisible: true, placement: { column: 8, row: 3 }, span: { columns: 4, rows: 4 }, presentationOrder: 1, presentation: { fit: 'contain', frame: 'thin', mat: 'none', background: 'dark' } },
      { id: 'canvas:artwork:private', kind: 'framed-artwork', stableAssetId: PRIVATE_ASSET_ID, visitorVisible: false, placement: { column: 1, row: 1 }, span: { columns: 3, rows: 3 }, presentationOrder: 0, presentation: { fit: 'cover', frame: 'heavy', mat: 'dark', background: 'light' } }
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

test('builder emits a valid allowlisted deterministic v5 public document', () => {
  const first = build(); const second = build();
  assert.equal(validateProfileDocument(first).valid, true);
  assert.deepEqual(first, second);
  assert.equal(canonicalSerializeProfileDocument(first), canonicalSerializeProfileDocument(second));
  assert.deepEqual(first.spaces.map((space) => space.label), ['Public A', 'Public B']);
  assert.equal(first.spaces[0].assets[0].stableAssetId, assetA.id);
  assert.equal(first.spaces[1].assets[0].stableAssetId, assetA.id, 'multi-space membership is preserved');
  assert.equal(first.version, 5); assert.equal(first.canvasObjects.length, 1); assert.equal(first.canvasObjects[0].asset.stableAssetId, assetA.id);
});

test('empty authored profiles are valid', () => {
  const document = build({ workspace: { ...workspace(), folders: [], favorites: [], canvas: { launchers: [], objects: [] } }, assets: [] });
  assert.equal(validateProfileDocument(document).valid, true); assert.deepEqual(document.spaces, []); assert.deepEqual(document.canvasObjects, []);
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

test('builder drops malformed local window geometry instead of exporting invalid presentation', () => {
  const malformed = workspace();
  malformed.canvas.launchers[0].windowGeometry = { column: 2, row: 2, columnSpan: 0, rowSpan: 8 };
  const document = build({ workspace: malformed, systemPresentation: {
    identity: { startOpen: true, windowGeometry: { column: -256, row: 2, columnSpan: 8, rowSpan: 8 } }
  } });
  assert.equal(document.spaces[0].windowGeometry, null);
  assert.equal(document.presentation.systemModules.find((module) => module.id === 'identity').windowGeometry, null);
  assert.equal(validateProfileDocument(document).valid, true);
});

test('formatted export/import round trip preserves semantic and canonical content', () => {
  const source = build(); const imported = parseProfileDocumentJson(formatProfileDocumentJson(source));
  assert.deepEqual(imported, source); assert.equal(canonicalSerializeProfileDocument(imported), canonicalSerializeProfileDocument(source));
});

test('strict validation rejects malformed JSON, wrong type, future versions, addresses, duplicates, placement, fields and URLs', () => {
  assert.throws(() => parseProfileDocumentJson('{no'), ProfileDocumentValidationError);
  const cases = [
    { documentType: 'OTHER' }, { version: 6 }, { profile: { address: 'bad', cachedIdentity: { address: 'bad' } } },
    { spaces: [build().spaces[0], build().spaces[0]] },
    { spaces: [{ ...build().spaces[0], placement: { column: -256, row: 0 } }] },
    { spaces: [{ ...build().spaces[0], privateState: true }] },
    { spaces: [{ ...build().spaces[0], assets: [{ ...build().spaces[0].assets[0], cachedPreviewUrl: 'javascript:alert(1)' }] }] }
  ];
  for (const change of cases) assert.equal(validateProfileDocument({ ...build(), ...change }).valid, false);
});

test('publication URL policy covers avatar, space assets, and canvas artwork without admitting fixture paths', () => {
  const secure = build();
  secure.profile.cachedIdentity.avatarUrl = 'https://images.example/avatar.png';
  secure.spaces[0].assets[0].cachedPreviewUrl = `ipfs://${CID}/space.png`;
  secure.canvasObjects[0].asset.cachedPreviewUrl = 'https://images.example/art.png';
  assert.equal(validateProfileDocument(secure).valid, true);
  for (const [surface, mutate] of [
    ['avatar', (document, value) => { document.profile.cachedIdentity.avatarUrl = value; }],
    ['space asset', (document, value) => { document.spaces[0].assets[0].cachedPreviewUrl = value; }],
    ['canvas artwork', (document, value) => { document.canvasObjects[0].asset.cachedPreviewUrl = value; }]
  ]) {
    for (const value of ['http://images.example/insecure.png', '//images.example/relative.png', '/assets/fixture.png', 'data:image/png;base64,AA==', 'blob:https://example.test/id', 'javascript:alert(1)', 'file:///tmp/image.png', 'https://user:pass@images.example/art.png', 'not a URL']) {
      const changed = structuredClone(secure); mutate(changed, value);
      assert.equal(validateProfileDocument(changed).valid, false, `${surface}: ${value}`);
    }
  }
});

test('owner-local HTTP assets are omitted from snapshots without changing the owner asset record', () => {
  const localAsset = { ...assetA, thumbnailUrl: 'http://owner-local.example/art.png' };
  const document = build({ assets: [localAsset, assetB], profileIdentity: { name: 'Owner', avatarUrl: 'http://owner-local.example/avatar.png' } });
  assert.equal(document.profile.cachedIdentity.avatarUrl, undefined);
  assert.equal(document.spaces[0].assets[0].cachedPreviewUrl, undefined);
  assert.equal(localAsset.thumbnailUrl, 'http://owner-local.example/art.png');
  assert.equal(validateProfileDocument(document).valid, true);
});

test('validation enforces space, asset, total-size and canonical-reference limits', () => {
  const base = build(); const space = base.spaces[0];
  assert.equal(validateProfileDocument({ ...base, spaces: Array.from({ length: 25 }, (_, index) => ({ ...space, id: `space:${index}`, launcherId: `launcher:${index}`, order: index })) }).valid, false);
  assert.equal(validateProfileDocument({ ...base, spaces: [{ ...space, assets: Array.from({ length: 201 }, (_, index) => ({ ...space.assets[0], stableAssetId: `42:${CONTRACT_A}:0x${(index + 1).toString(16)}`, tokenId: `0x${(index + 1).toString(16)}` })) }] }).valid, false);
  assert.equal(validateProfileDocument(base, { rawSize: 600 * 1024 }).valid, false);
  assert.equal(validateProfileDocument({ ...base, spaces: [{ ...space, assets: [{ ...space.assets[0], stableAssetId: `42:${CONTRACT_B}:0x01` }] }] }).valid, false);
});

test('migration defaults v1 and v2 documents to the illustrated environment', () => {
  assert.deepEqual(migrateProfileDocument(build()), build());
  const legacy = structuredClone(build()); legacy.version = 1;
  delete legacy.presentation.environment;
  legacy.presentation.systemModules = legacy.presentation.systemModules.map(({ startOpen, windowGeometry, ...module }) => module);
  legacy.spaces = legacy.spaces.map(({ startOpen, windowGeometry, ...space }) => space);
  const migrated = migrateProfileDocument(legacy);
  assert.equal(migrated.version, 5); assert.equal(migrated.spaces[0].startOpen, false); assert.equal(migrated.spaces[0].windowGeometry, null); assert.equal(migrated.spaces[0].homeShortcut, true); assert.deepEqual(migrated.canvasObjects, []);
  assert.deepEqual(migrated.presentation.environment, { type: 'illustrated', shaderId: 'neural-field' });
  const v2 = structuredClone(build()); v2.version = 2; delete v2.presentation.environment;
  assert.deepEqual(migrateProfileDocument(v2).presentation.environment, { type: 'illustrated', shaderId: 'neural-field' });
  assert.throws(() => migrateProfileDocument({ documentType: 'OTHER', version: 1 }), ProfileDocumentValidationError);
  assert.throws(() => migrateProfileDocument({ ...build(), version: 9 }), ProfileDocumentValidationError);
});

test('profile documents round-trip a controlled shader environment and reject unknown shader IDs', () => {
  const shader = build({ publicPresentation: { keeperId: 'skull_reaper', stageId: 'black', environment: { type: 'shader', shaderId: 'neural-field' } } });
  assert.deepEqual(parseProfileDocumentJson(formatProfileDocumentJson(shader)).presentation.environment, { type: 'shader', shaderId: 'neural-field' });
  const remote = structuredClone(shader); remote.presentation.environment.shaderId = '../untrusted.glsl';
  assert.equal(validateProfileDocument(remote).valid, false);
});

test('snapshot stale detection ignores revision timestamps but detects authored public changes', () => {
  const source = build(); let state = setSnapshot(createProfileDocumentState(), source, profileDocumentContentFingerprint(source));
  assert.equal(isSnapshotStale(state, { ...source, revision: 99, exportedAt: new Date(9999).toISOString() }), false);
  const changed = structuredClone(source); changed.spaces[0].label = 'Changed'; assert.equal(isSnapshotStale(state, changed), true);
});

test('runtime desktop state is excluded while authored start-open presentation stales snapshots', () => {
  const source = build();
  const runtimeOnly = workspace(); runtimeOnly.runtimeDesktop = { openIds: ['private'], rects: { private: { column: 1 } } };
  assert.equal(profileDocumentContentFingerprint(build({ workspace: runtimeOnly })), profileDocumentContentFingerprint(source));
  const authored = workspace(); authored.canvas.launchers.find((launcher) => launcher.folderId === 'public-a').startOpen = true;
  authored.canvas.launchers.find((launcher) => launcher.folderId === 'public-a').windowGeometry = { column: 2, row: 2, columnSpan: 10, rowSpan: 8 };
  assert.notEqual(profileDocumentContentFingerprint(build({ workspace: authored })), profileDocumentContentFingerprint(source));
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
  const draft = workspace(); const shaderDocument = build({ publicPresentation: { keeperId: 'skull_reaper', stageId: 'black', environment: { type: 'shader', shaderId: 'neural-field' } } });
  let state = setImportedDocument(createProfileDocumentState(), shaderDocument);
  state = enterDocumentPreview(state, 'imported'); state.preview.spaces[0].label = 'Visitor mutation';
  assert.deepEqual(state.preview.presentation.environment, { type: 'shader', shaderId: 'neural-field' });
  state = exitDocumentPreview(state); assert.deepEqual(workspace(), draft); assert.equal(state.imported.spaces[0].label, 'Public A');
});

test('public folders publish as categories without requiring a Home shortcut', () => {
  const source = workspace();
  source.folders.push({ id: 'navigation-only', name: 'Navigation only', assetIds: [assetA.id], public: true, createdAt: 7, updatedAt: 8 });
  const document = build({ workspace: source });
  const category = document.spaces.find((space) => space.id === 'library:folder:navigation-only');
  assert.equal(category.homeShortcut, false);
  assert.equal(category.label, 'Navigation only');
  assert.equal(validateProfileDocument(document).valid, true);
});

test('switching the active profile clears snapshot, import, preview, lineage, and errors', () => {
  const source = build();
  let state = createProfileDocumentState(null, PROFILE.toLowerCase());
  state = setSnapshot(state, source, profileDocumentContentFingerprint(source));
  state = setImportedDocument(state, source);
  state = enterDocumentPreview(state, 'imported');
  state = { ...state, error: 'old profile error' };
  const next = activateProfileDocumentState(state, CONTRACT_A);
  assert.equal(next.profileAddress, CONTRACT_A);
  assert.equal(next.snapshot, null);
  assert.equal(next.imported, null);
  assert.equal(next.preview, null);
  assert.equal(next.snapshotGeneration, 0);
  assert.equal(next.error, null);
  assert.equal(activateProfileDocumentState(next, CONTRACT_A), next);
});

test('draft preview clones the current public projection without replacing the publication snapshot', () => {
  const snapshot = build({ revision: 1 });
  const draft = build({ revision: 2, profileIdentity: { name: 'Current draft' } });
  let state = setSnapshot(createProfileDocumentState(), snapshot, profileDocumentContentFingerprint(snapshot));

  state = enterDocumentPreview(state, 'draft', draft);
  assert.equal(state.previewSource, 'draft');
  assert.equal(state.preview.profile.cachedIdentity.name, 'Current draft');
  assert.equal(state.snapshot.revision, 1);
  state.preview.profile.cachedIdentity.name = 'Preview mutation';
  assert.equal(draft.profile.cachedIdentity.name, 'Current draft');
});

test('restored-presentation records preserve controlled environments and migrate legacy records', () => {
  const records = new Map(); const storage = { getItem: (key) => records.get(key) ?? null };
  const key = profilePresentationKey(PROFILE);
  records.set(key, JSON.stringify({ version: 2, keeperId: 'skull_reaper', stageId: 'black', environment: { type: 'shader', shaderId: 'neural-field' } }));
  assert.equal(loadRestoredPresentation(storage, PROFILE).environment.type, 'shader');
  records.set(key, JSON.stringify({ version: 1, keeperId: 'skull_reaper', stageId: 'black' }));
  assert.equal(loadRestoredPresentation(storage, PROFILE).environment.type, 'illustrated');
  records.set(key, JSON.stringify({ version: 2, keeperId: 'skull_reaper', stageId: 'black', environment: { type: 'shader', shaderId: 'remote' } }));
  assert.equal(loadRestoredPresentation(storage, PROFILE), null);
});

test('owner Keeper and world presentation save through the existing profile-scoped record', () => {
  const records = new Map();
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const presentation = { keeperId: 'skull_reaper', stageId: 'black', environment: { type: 'shader', shaderId: 'neural-field' } };
  assert.equal(saveRestoredPresentation(storage, PROFILE, presentation), true);
  assert.deepEqual(loadRestoredPresentation(storage, PROFILE), { version: 2, ...presentation });
  assert.equal(saveRestoredPresentation(storage, PROFILE, { ...presentation, environment: { type: 'shader', shaderId: 'remote' } }), false);
  assert.equal(saveRestoredPresentation(null, PROFILE, presentation), false);
  assert.equal(saveRestoredPresentation({ setItem: () => { throw new Error('quota'); } }, PROFILE, presentation), false);
});

test('restore plan replaces only public presentation and preserves private Favorites/folders', () => {
  const current = workspace(); const plan = createProfileDocumentRestorePlan(build(), current);
  assert.deepEqual(plan.workspace.favorites, current.favorites);
  assert.deepEqual(plan.workspace.folders.find((folder) => folder.id === 'private-folder'), current.folders[2]);
  assert.equal(plan.workspace.canvas.launchers.find((launcher) => launcher.folderId === 'private-folder').visitorVisible, false);
  assert.equal(plan.workspace.canvas.launchers.filter((launcher) => launcher.visitorVisible).length, 2);
  assert.deepEqual(plan.workspace.folders.find((folder) => folder.id === 'public-a').assetIds, [assetA.id, assetB.id]);
  assert.equal(plan.keeperId, 'skull_reaper'); assert.equal(plan.stageId, 'black');
  assert.deepEqual(plan.environment, { type: 'illustrated', shaderId: 'neural-field' });
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

test('private canvas objects never enter documents or fingerprints while public changes stale snapshots', () => {
  const sourceWorkspace = workspace(); const source = build({ workspace: sourceWorkspace });
  assert.deepEqual(source.canvasObjects.map((object) => object.id), ['canvas:artwork:public']);
  assert.equal(canonicalSerializeProfileDocument(source).includes('canvas:artwork:private'), false);
  const state = setSnapshot(createProfileDocumentState(), source, profileDocumentContentFingerprint(source));
  const privateEdit = workspace(); privateEdit.canvas.objects.find((object) => !object.visitorVisible).presentation.frame = 'none';
  assert.equal(isSnapshotStale(state, build({ workspace: privateEdit })), false);
  const lockEdit = workspace(); lockEdit.canvas.objects.find((object) => object.visitorVisible).locked = true;
  assert.equal(isSnapshotStale(state, build({ workspace: lockEdit })), false, 'local Gallery locks do not alter the published document');
  const publicEdit = workspace(); publicEdit.canvas.objects.find((object) => object.visitorVisible).presentation.fit = 'cover';
  assert.equal(isSnapshotStale(state, build({ workspace: publicEdit })), true);
});

test('canvas artwork validates strict controlled fields and rejects remote renderer escape hatches', () => {
  const source = build(); const object = source.canvasObjects[0];
  assert.equal(validateProfileDocument({ ...source, canvasObjects: [{ ...object, presentation: { ...object.presentation, background: 'transparent' } }] }).valid, true);
  for (const changed of [
    { ...object, kind: 'remote-widget' }, { ...object, span: { columns: 0, rows: 4 } },
    { ...object, presentation: { ...object.presentation, fit: 'crop-script' } }, { ...object, stableAssetId: 'bad' },
    { ...object, id: 'canvas:artwork:remote/path' }, { ...object, placement: null },
    { ...object, renderer: '/remote/component.jsx' }, { ...object, shaderSource: 'void main(){}' }
  ]) assert.equal(validateProfileDocument({ ...source, canvasObjects: [changed] }).valid, false);
});

test('builder deterministically bounds the public canvas-object projection', () => {
  const crowded = workspace(); const template = crowded.canvas.objects[0];
  crowded.canvas.objects = Array.from({ length: PROFILE_DOCUMENT_LIMITS.maxCanvasObjects + 4 }, (_, index) => ({
    ...structuredClone(template), id: `canvas:artwork:bounded-${String(index).padStart(2, '0')}`, presentationOrder: index
  }));
  const document = build({ workspace: crowded });
  assert.equal(document.canvasObjects.length, PROFILE_DOCUMENT_LIMITS.maxCanvasObjects);
  assert.equal(validateProfileDocument(document).valid, true);
  assert.equal(document.canvasObjects.at(-1).id, 'canvas:artwork:bounded-47');
});

test('framed artwork round-trips through serialize, parse, projection, and restore with collision-safe IDs', () => {
  const source = build(); const parsed = parseProfileDocumentJson(formatProfileDocumentJson(source));
  assert.deepEqual(parsed.canvasObjects, source.canvasObjects);
  const current = workspace(); current.canvas.objects = [{ ...current.canvas.objects[1], id: 'canvas:artwork:public' }];
  const plan = createProfileDocumentRestorePlan(parsed, current);
  assert.equal(plan.workspace.canvas.objects.find((object) => object.visitorVisible).id, 'canvas:artwork:public-2');
  assert.equal(plan.workspace.canvas.objects.find((object) => object.visitorVisible).stableAssetId, assetA.id);
  assert.deepEqual(current.canvas.objects[0].presentation, workspace().canvas.objects[1].presentation, 'private local object remains untouched');
});

test('restore collision suffixes remain inside the portable canvas-object ID limit', () => {
  const source = build(); const maximumId = `canvas:artwork:${'a'.repeat(200 - 'canvas:artwork:'.length)}`;
  source.canvasObjects[0].id = maximumId;
  const current = workspace(); current.canvas.objects = [{ ...current.canvas.objects[1], id: maximumId }];
  const plan = createProfileDocumentRestorePlan(source, current);
  const restored = plan.workspace.canvas.objects.find((object) => object.visitorVisible);
  assert.equal(restored.id.length, 200); assert.match(restored.id, /-2$/);
});

test('missing public asset metadata projects a readable safe fallback', () => {
  const reference = build().canvasObjects[0].asset; const missing = projectDocumentAsset({ ...reference, cachedName: 'Missing portrait', cachedPreviewUrl: undefined }, []);
  assert.equal(missing.name, 'Missing portrait'); assert.equal(missing.metadataStatus, 'unavailable'); assert.equal(missing.imageUrl, null);
});
