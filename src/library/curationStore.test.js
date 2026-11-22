import { saveMissingSnapshots } from './curatedSnapshots.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { curatedImages, curatedAssetIds, changeCuratedAssets, curatedDisplayAssets } from './curationStore.js';
import { applicationRouteUrl, readApplicationRoute, resolveApplicationDestination } from '../profileDiscovery/applicationNavigation.js';

import { createEmptyWorkspace, createFolder, setFolderAssets } from './domain/libraryWorkspace.js';
import { normalizeWorkspace } from './storage/libraryWorkspaceStorage.js';

const profile = '0x' + '1'.repeat(40);
test('curation keeps one reference per asset and files without changing the source', () => {
  let workspace = createFolder(createFolder(createEmptyWorkspace(profile), 'Studio'), 'Portraits');
  const [first, second] = workspace.folders;
  workspace = setFolderAssets(workspace, first.id, ['existing'], true);
  assert.deepEqual(curatedAssetIds(workspace), ['existing']);
  workspace = changeCuratedAssets(workspace, 'add', ['existing', 'new'], second.id);
  workspace = changeCuratedAssets(workspace, 'reorder', ['new'], 'existing');
  const restored = normalizeWorkspace(workspace, profile);
  assert.deepEqual(curatedAssetIds(restored), ['new', 'existing']);
  const removed = changeCuratedAssets(restored, 'remove', ['existing']);
  assert.deepEqual(curatedAssetIds(removed), ['new']);
  assert.deepEqual(removed.folders.map(folder => folder.assetIds), [[], ['new']]);
});
test('curation URL round trips and opens the private workspace only for the owner', () => {
  const route = { kind: 'profile', address: profile, curation: true };
  const url = new URL(applicationRouteUrl(new URL('https://example.test'), route), 'https://example.test');
  assert.deepEqual(readApplicationRoute(url), route);
  const authority = { profileAddress: profile, ownershipVerified: true, status: 'complete' };
  assert.equal(resolveApplicationDestination(route, authority).kind, 'curation');
  assert.equal(resolveApplicationDestination(route, { ...authority, ownershipVerified: false }).kind, 'public');
});

test('individual token images survive reload, folder drops, duplicates and individual removal', () => {
  const workspace = createFolder(createEmptyWorkspace(profile), 'Characters');
  const folder = workspace.folders[0].id;
  const first = 'https://art.test/one.webp', second = 'https://art.test/two.webp';
  let next = changeCuratedAssets(workspace, 'add', ['token'], folder, first);
  next = changeCuratedAssets(next, 'add', ['token'], null, second);
  next = normalizeWorkspace(changeCuratedAssets(next, 'add', ['token'], null, first), profile);
  assert.deepEqual(curatedImages(next, 'token').map(entry => entry.url), [first, second]);
  assert.deepEqual(next.folders[0].imageSelections.map(entry => entry.url), [first]);
  next = changeCuratedAssets(next, 'remove', ['token'], null, first, [first, second]);
  assert.deepEqual(next.folders[0].assetIds, []);
  assert.deepEqual(curatedImages(next, 'token').map(entry => entry.url), [second]);
  next = changeCuratedAssets(next, 'add', ['token']);
  assert.deepEqual(curatedImages(next, 'token'), []);
});

test('v9 backfill is additive and survives browse-cache expiry and a missing record', () => {
  const contract = '0x' + '2'.repeat(40);
  const id = '42:' + contract + ':contract';
  const image = 'https://art.test/selected.webp';
  let workspace = createFolder(createEmptyWorkspace(profile), 'Props');
  workspace = createFolder(workspace, 'Parts', 1, workspace.folders[0].id);
  const child = workspace.folders[1].id;
  workspace = changeCuratedAssets(workspace, 'add', [id], child, image);
  workspace = changeCuratedAssets(workspace, 'add', ['bad-id'], child);
  workspace = changeCuratedAssets(workspace, 'reorder', ['bad-id'], id);
  workspace = normalizeWorkspace({ ...workspace, favorites: [id] }, profile);
  const record = { id, chainId: 42, contractAddress: contract, name: 'Prop', collectionName: 'World',
    standard: 'LSP7', imageUrl: image, thumbnailUrl: image, imageWidth: 800, imageHeight: 600,
    mediaFileType: 'image/webp', creators: [{ address: profile, name: 'Maker' }],
    fieldProvenance: { creators: { scope: 'contract', source: 'LSP4Creators[]' } },
    imageGroups: [{ index: 0, originalImageUrl: image, width: 800, height: 600, fileType: 'image/webp',
      variants: [{ url: image, width: 800, height: 600 }] }] };
  const snapshots = saveMissingSnapshots(workspace, curatedAssetIds(workspace), new Map([[id, record]]));
  const { curatedSnapshots, ...restored } = normalizeWorkspace(JSON.parse(JSON.stringify(snapshots)), profile);
  assert.deepEqual(restored, workspace);
  const [missing, display] = curatedDisplayAssets(snapshots, curatedAssetIds(snapshots));
  assert.equal(missing.title, 'bad-id');
  assert.equal(missing.folderContext, 'Parts');
  assert.equal(display.title, 'Prop');
  assert.equal(display.collection, 'World');
  assert.equal(display.width, 800);
  assert.equal(display.imageGroups[0].variants[0].url, image);
  assert.deepEqual(curatedSnapshots[id].creators, record.creators);
  assert.deepEqual(curatedSnapshots[id].fieldProvenance, record.fieldProvenance);
  assert.equal(saveMissingSnapshots(snapshots, [id], new Map()), snapshots);
  assert.deepEqual(changeCuratedAssets(snapshots, 'remove', [id]).curatedSnapshots, {});
});

test('the 1,001st curated snapshot survives a workspace round trip', () => {
  const records = new Map();
  for (let n = 1; n <= 1001; n++) {
    const contract = '0x' + n.toString(16).padStart(40, '0');
    const id = '42:' + contract + ':contract';
    records.set(id, { id, chainId: 42, contractAddress: contract, name: 'Work ' + n });
  }
  const ids = [...records.keys()];
  const workspace = changeCuratedAssets(createEmptyWorkspace(profile), 'add', ids);
  const saved = normalizeWorkspace(saveMissingSnapshots(workspace, ids, records), profile);
  assert.equal(Object.keys(saved.curatedSnapshots).length, 1001);
  assert.equal(curatedDisplayAssets(saved, [ids.at(-1)])[0].title, 'Work 1001');
});
