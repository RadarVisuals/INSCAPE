import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./useOwnerLatticeBrowser.js', import.meta.url), 'utf8');
const presenterSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowLibraryPresenter.jsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx', import.meta.url), 'utf8');

test('owner Browser hook exposes adapted data and a narrow guarded category boundary', () => {
  assert.match(source, /useLibraryStore/);
  assert.match(source, /createCreationsStore\(\{ retainOnRetry: true \}\)/);
  assert.match(source, /createCollectionTokensStore\(\)/);
  assert.match(source, /projectLibraryAssetUnion/);
  assert.match(source, /setProfileAddress\(profile\)/);
  assert.match(source, /profileReady && status === 'idle'/);
  assert.doesNotMatch(source, /open && profileReady/);
  assert.match(source, /adaptLatticeProductionBrowserData/);
  assert.match(source, /commitCategoryForProfile/);
  assert.doesNotMatch(source, /toggleFavorite|createFolder\(|renameFolder\(|deleteFolder\(|replaceWorkspace/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|latticeProductionDraftStore|commitCompletedOperation/);
  assert.doesNotMatch(source, /loadLibraryWorkspace|saveLibraryWorkspace|normalizeWorkspace|libraryWorkspaceKey/);
});

test('creator collections open their bounded token view and can return to Created', () => {
  assert.match(workspaceSource, /asset\.isCollection && asset\.collectionRole !== 'cover'/);
  assert.match(workspaceSource, /data\.onOpenCollection\?\.\(asset\.assetRecord\)/);
  assert.match(presenterSource, /label="Back to Created"/);
  assert.match(presenterSource, /data\.onCloseCollection\?\.\(\)/);
  assert.match(presenterSource, /Loading collection tokens/);
});

test('Library keeps creator records visible when their preview media is unavailable', () => {
  const workspace = readFileSync(new URL('../lattice/browser/useBrowserWorkspace.js', import.meta.url), 'utf8');
  assert.match(workspace, /sourceAssets\.map\(\(asset\) =>/);
  assert.match(workspace, /previewSrc: null/);
  assert.match(presenterSource, /Media unavailable/);
  assert.match(presenterSource, /workspace\.isAssetRenderable\(id\)/);
  assert.match(workspaceSource, /!workspaceState\?\.isAssetRenderable\(id\)/);
  assert.match(workspaceSource, /cleanup\(\);\s*if \(!moved\) return/);
  assert.match(workspaceSource, /ownerLibraryPreviewRecords/);
  assert.match(workspaceSource, /useBrowserWorkspace\(data, ownerLibraryPreviewRecords/);
});

test('owner Browser restores the creator-attributed union without confusing creation and holding', () => {
  assert.match(source, /createdAssets: createdProfileReady \? createdAssets : \[\]/);
  assert.match(source, /ownedAssets: profileReady \? assets : \[\]/);
  assert.match(source, /createdProfileAddress === profile/);
  assert.match(source, /\.\.\.union\.records, \.\.\.referencedUnion\.records, \.\.\.collectionUnion\.records/);
  assert.match(source, /createdRetained: Boolean\(createdProfileReady && createdError && createdAssets\.length\)/);
  assert.match(source, /acceptedAssetIds = union\.assets\.map/);
  assert.match(source, /createdAssets: \[activeCollection, \.\.\.collectionTokens\]/);
  assert.match(source, /data: collectionData \|\| unionData/);
  assert.match(source, /resolveReferencedAssets\(profile, referencedAssetKey\.split\(','\)\)/);
});

test('full owner inventory loading is explicit and can remain dormant for the curated lattice', () => {
  const loadEffect = source.slice(source.indexOf('useEffect(() => {', source.indexOf('setProfileAddress(profile)')),
    source.indexOf('const adaptedData = useMemo'));
  assert.match(loadEffect, /load\(\)/);
  assert.match(loadEffect, /inventoryEnabled && profileReady && status === 'idle'/);
  assert.match(source, /inventoryEnabled = true, referencedAssetIds = \[\]/);
});

test('owner Browser data is gated by both active store and workspace profile', () => {
  assert.match(source, /storeProfileAddress === profile/);
  assert.match(source, /normalizeProfileAddress\(workspace\?\.profileAddress\) === profile/);
  assert.match(source, /assets: profileReady \? assets : \[\]/);
  assert.match(source, /workspace: profileReady \? workspace : null/);
  assert.match(source, /commands: profileReady && !activeCollection \? commands : null/);
});
