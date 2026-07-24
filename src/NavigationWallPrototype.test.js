import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./NavigationWallPrototype.jsx', import.meta.url), 'utf8');
const viewer = readFileSync(new URL('./NftCardViewerPrototype.jsx', import.meta.url), 'utf8');
const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');

test('navigation wall prototype is an isolated lazy route with dummy navigation only', () => {
  assert.match(entry, /\/prototype\/navigation-wall/);
  assert.match(entry, /import\.meta\.env\.DEV && prototypePath === '\/prototype\/navigation-wall'/);
  assert.match(entry, /import\.meta\.env\.DEV\s*\? React\.lazy\(\(\) => import\('\.\/NavigationWallPrototype\.jsx'\)\)/);
  for (const label of ['FAVORITES','ART','KEEPERS','MUSIC','AUDIO','VIDEO','ANIMATION']) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /useStore|useWalletStore|useLibraryStore|AssetResolver|profileDocument|residentHandoff/);
});

test('menu viewer preserves native ratios and continuously advances through media and dossier faces', () => {
  assert.match(source, /NftCardViewerPrototype/);
  for (const token of ['RATIO_ASSET_LIMIT','makeRows','naturalWidth','naturalHeight','media','story','traits','record','artifact-viewer__turntable','DRAG TO ARRANGE','VISITOR DISPLAY ORDER']) assert.match(viewer, new RegExp(token));
  assert.match(viewer, /\/assets\/ratio\/\$\{number\}\.webp/);
  assert.match(viewer, /\/assets\/ratio\/\$\{number\}-\$\{extraIndex \+ 2\}\.webp/);
  assert.match(viewer, /\(pageIndex \+ 1\) % pages\.length/);
  assert.match(viewer, /THUMBNAIL SIZE/);
  assert.match(viewer, /setThumbnailSize/);
  assert.match(viewer, /setAssetOrder/);
  assert.match(viewer, /draggable/);
  assert.match(viewer, /event\.altKey/);
  assert.match(viewer, /scanGeneration/);
  assert.match(viewer, /SCANNING RATIO ASSETS/);
  assert.match(viewer, /RATIO_SCAN_VERSION/);
  assert.match(viewer, /RATIO ASSETS NOT FOUND/);
  assert.doesNotMatch(viewer, /MOCK_ASSETS/);
});

test('prototype exposes live geometry controls, presets, modes, and collapsible states', () => {
  for (const token of ['WIDTH','SPEED','GAP','GRID','MOBILE PREVIEW','DESKTOP PREVIEW','COMPACT','BALANCED','WIDE']) assert.match(source, new RegExp(token));
  for (const removed of ['ANGLE','DEPTH','PUSH TEST','CONNECTED OVERLAY','FOLDED','DEEP']) assert.doesNotMatch(source, new RegExp(removed));
  assert.match(source, /type="range"/);
  assert.match(source, /type="number"/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-keyshortcuts="N"/);
  assert.match(source, /event\.key==='Escape'/);
  assert.doesNotMatch(source, /wall-prototype__rail/);
});

test('avatar reveals one anchored identity card that branches into profile, menu, or asset index', () => {
  assert.match(source, /wall-profile-card/);
  assert.match(source, /data-compact/);
  assert.match(source, /wall-menu-card/);
  assert.match(source, /wall-index-card/);
  assert.match(source, /identityOpen/);
  assert.match(source, /VXCTXR/);
  assert.match(source, /\/assets\/PFP\/PFP\.webp/);
  assert.match(source, /#E3C1/);
  assert.match(source, /wall-profile-card__details/);
  for (const detail of ['Turning feeling into form.','ARTIST','MUSIC','MOTION','SOCIAL','LINKED','LUKSO MAINNET']) assert.match(source, new RegExp(detail));
  for (const indexDetail of ['INDEX','ASSET DIRECTORY','SEARCH ASSET POOL','ORGANIZE','FILTER','RECENT','A–Z','FOLDER','ALL OWNED','UNFILED','COLLECTION X','RANKS 1','UNIQUES','TECHNO','HIP HOP','PHOTOGRAPHY','CREATE FOLDER','GALLERY','NFT DISPLAY']) assert.match(source, new RegExp(indexDetail));
  assert.match(source, /INDEX_ASSETS/);
  assert.match(source, /data-index-open/);
  assert.match(source, /assetType/);
  assert.match(source, /sortOrder/);
  for (const removed of ['HOST / 01','PROFILE IDENTITY','IDENTITY DOSSIER','WORLD ONLINE']) assert.doesNotMatch(source, new RegExp(removed));
});
