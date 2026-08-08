import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./useOwnerLatticeBrowser.js', import.meta.url), 'utf8');

test('owner Browser hook exposes adapted data and a narrow guarded category boundary', () => {
  assert.match(source, /useLibraryStore/);
  assert.match(source, /setProfileAddress\(profile\)/);
  assert.match(source, /profileReady && status === 'idle'/);
  assert.doesNotMatch(source, /open && profileReady/);
  assert.match(source, /adaptLatticeProductionBrowserData/);
  assert.match(source, /commitCategoryForProfile/);
  assert.doesNotMatch(source, /toggleFavorite|createFolder\(|renameFolder\(|deleteFolder\(|replaceWorkspace/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|latticeProductionDraftStore|commitCompletedOperation/);
  assert.doesNotMatch(source, /loadLibraryWorkspace|saveLibraryWorkspace|normalizeWorkspace|libraryWorkspaceKey/);
});

test('full owner inventory loading is explicit and can remain dormant for the curated lattice', () => {
  const loadEffect = source.slice(source.indexOf('useEffect(() => {', source.indexOf('setProfileAddress(profile)')),
    source.indexOf('const data = useMemo'));
  assert.match(loadEffect, /load\(\)/);
  assert.match(loadEffect, /inventoryEnabled && profileReady && status === 'idle'/);
  assert.match(source, /inventoryEnabled = true/);
});

test('owner Browser data is gated by both active store and workspace profile', () => {
  assert.match(source, /storeProfileAddress === profile/);
  assert.match(source, /normalizeProfileAddress\(workspace\?\.profileAddress\) === profile/);
  assert.match(source, /assets: profileReady \? assets : \[\]/);
  assert.match(source, /workspace: profileReady \? workspace : null/);
  assert.match(source, /commands: profileReady \? commands : null/);
});
