import { projectLibraryDisplayAsset } from '../lattice/browser/latticeProductionBrowserAdapter.js';
import { parseCanonicalAssetId } from '../profileDocument/domain/assetReference.js';
import { imageResourceIdentity } from './data/resolveContentUrl.js';
import { setFolderImage, setFolderAssets } from './domain/libraryWorkspace.js';

export function curatedAssetIds(workspace) {
  return [...new Set([...(workspace.curatedAssetIds || []), ...workspace.folders.flatMap(folder => folder.assetIds)])];
}

export function curatedImages(workspace, id) {
  if (workspace.curatedAssetIds?.includes(id)) return (workspace.curatedImageSelections || []).filter(entry => entry.assetId === id);
  const containing = workspace.folders.filter(folder => folder.assetIds.includes(id));
  const selections = containing.map(folder => (folder.imageSelections || []).filter(entry => entry.assetId === id));
  if (selections.some(entries => !entries.length)) return [];
  return [...new Map(selections.flat().map(entry => [imageResourceIdentity(entry.url), entry])).values()];
}

export function curatedDisplayAssets(workspace, ids) {
  return ids.map(id => {
    const record = Object.hasOwn(workspace.curatedSnapshots || {}, id) && workspace.curatedSnapshots[id];
    if (record) {
      const cover = record.imageGroups?.[0];
      const display = { ...record, originalImageUrl: record.originalImageUrl || record.imageUrl || cover?.originalImageUrl,
        imageWidth: record.imageWidth || cover?.width, imageHeight: record.imageHeight || cover?.height };
      return { ...projectLibraryDisplayAsset(display, parseCanonicalAssetId(id)), assetRecord: display };
    }
    const folders = workspace.folders.filter(folder => folder.assetIds.includes(id)).map(folder => folder.name);
    return { stableAssetId: id, title: id, missingSnapshot: true, folderContext: folders.join(', '), placeable: false };
  });
}

export function changeCuratedAssets(workspace, action, ids, target = null, imageUrl = null, urls = []) {
  const order = curatedAssetIds(workspace);
  const id = ids[0];
  const selections = order.flatMap(assetId => curatedImages(workspace, assetId));
  const otherSelections = selections.filter(entry => !ids.includes(entry.assetId));
  if (action === 'add') {
    if (target && !workspace.folders.some(folder => folder.id === target)) return workspace;
    const next = !target ? workspace : imageUrl ? setFolderImage(workspace, target, id, imageUrl, true)
      : setFolderAssets(workspace, target, ids, true);
    const images = imageUrl ? [...selections] : otherSelections;
    if (imageUrl && !images.some(entry => entry.assetId === id && imageResourceIdentity(entry.url) === imageResourceIdentity(imageUrl))) {
      // A folder can narrow its selection independently of an existing whole token at the root.
      if (!target || !order.includes(id) || selections.some(entry => entry.assetId === id)) images.push({ assetId: id, url: imageUrl });
    }
    return { ...next, curatedImageSelections: images, curatedAssetIds: [...new Set([...order, ...ids])] };
  }
  const remaining = order.filter(assetId => !ids.includes(assetId));
  if (action === 'remove') {
    let next = workspace;
    const keepOtherImages = entries => entries.filter(url => imageResourceIdentity(url) !== imageResourceIdentity(imageUrl));
    const saved = selections.filter(entry => entry.assetId === id).map(entry => entry.url);
    const keep = imageUrl ? keepOtherImages(saved.length ? saved : urls) : [];
    for (const folder of workspace.folders) {
      if (imageUrl && folder.assetIds.includes(id) && !folder.imageSelections?.some(entry => entry.assetId === id)) {
        next = setFolderAssets(next, folder.id, [id], false);
        for (const url of keepOtherImages(urls)) next = setFolderImage(next, folder.id, id, url, true);
      } else next = imageUrl ? setFolderImage(next, folder.id, id, imageUrl, false) : setFolderAssets(next, folder.id, ids, false);
    }
    if (!keep.length && next.curatedSnapshots) {
      const snapshots = { ...next.curatedSnapshots };
      for (const removed of ids) delete snapshots[removed];
      next = { ...next, curatedSnapshots: snapshots };
    }
    return { ...next, curatedImageSelections: [...otherSelections, ...keep.map(url => ({assetId: id, url}))],
      curatedAssetIds: keep.length ? order : remaining };
  }
  if (action !== 'reorder' || ids.includes(target)) return workspace;
  const moving = order.filter(id => ids.includes(id));
  const index = remaining.indexOf(target);
  remaining.splice(index < 0 ? remaining.length : index, 0, ...moving);
  return { ...workspace, curatedImageSelections: selections, curatedAssetIds: remaining };
}
