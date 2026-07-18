import { assertValidProfileDocument } from './profileDocumentValidation.js';

function folderIdFromSpace(space) {
  const prefix = 'library:folder:';
  return space.kind === 'folder' && space.launcherId.startsWith(prefix) ? space.launcherId.slice(prefix.length) : null;
}
/** Builds a detached presentation-only restore plan. No store is touched here. */
export function createProfileDocumentRestorePlan(document, currentWorkspace) {
  const value = assertValidProfileDocument(document);
  const workspace = structuredClone(currentWorkspace);
  const existing = new Map(workspace.folders.map((folder) => [folder.id, folder]));
  const currentLaunchers = workspace.canvas?.launchers || [];
  const privateLaunchers = currentLaunchers.filter((launcher) => launcher.visitorVisible !== true);
  const publicPinnedFolderIds = new Set(currentLaunchers.filter((launcher) => launcher.visitorVisible === true).map((launcher) => launcher.folderId).filter(Boolean));
  const privateFavorites = privateLaunchers.some((launcher) => launcher.viewType === 'favorites');
  const restoredFolderIds = new Set();
  const launchers = structuredClone(privateLaunchers);
  const uniqueFolderId = (requested) => {
    if (!existing.has(requested) || publicPinnedFolderIds.has(requested)) return requested;
    let suffix = 2; while (existing.has(`${requested}-${suffix}`)) suffix += 1;
    return `${requested}-${suffix}`;
  };
  const restoreAsFolder = (space, requested) => {
    const id = uniqueFolderId(requested);
    const prior = existing.get(id);
    const folder = { id, name: space.label, assetIds: space.assets.map((asset) => asset.stableAssetId),
      createdAt: prior?.createdAt || 0, updatedAt: Math.max(prior?.updatedAt || 0, Date.parse(value.exportedAt) || 0) };
    if (prior) workspace.folders = workspace.folders.map((item) => item.id === id ? folder : item); else workspace.folders.push(folder);
    existing.set(id, folder); restoredFolderIds.add(id);
    launchers.push({ id: `library:folder:${id}`, viewType: 'folder', folderId: id, visitorVisible: true,
      position: space.placement, windowPosition: space.windowPlacement });
  };
  for (const space of [...value.spaces].sort((a, b) => a.order - b.order)) {
    if (space.kind === 'favorites') {
      if (privateFavorites) restoreAsFolder(space, 'restored-favorites');
      else {
        workspace.favorites = [...new Set([...workspace.favorites, ...space.assets.map((asset) => asset.stableAssetId)])];
        launchers.push({ id: 'library:favorites', viewType: 'favorites', folderId: null, visitorVisible: true,
          position: space.placement, windowPosition: space.windowPlacement });
      }
      continue;
    }
    const requested = folderIdFromSpace(space) || `restored-${space.id}`;
    restoreAsFolder(space, requested);
  }
  workspace.canvas = { ...workspace.canvas, launchers };
  return { workspace, keeperId: value.presentation.keeperId, stageId: value.presentation.stageId,
    signalSettings: { ...value.presentation.signals }, restoredFolderIds: [...restoredFolderIds] };
}

export async function executeAtomicRestore(plan, adapters) {
  const previous = { workspace: adapters.getWorkspace(), presentation: adapters.getPresentation(), signalSettings: adapters.getSignalSettings() };
  try {
    if (await adapters.persistWorkspace(plan.workspace) === false) throw new Error('Workspace persistence failed');
    adapters.applyWorkspace(plan.workspace);
    adapters.applyPresentation({ keeperId: plan.keeperId, stageId: plan.stageId });
    adapters.applySignalSettings(plan.signalSettings);
    return true;
  } catch (error) {
    adapters.applyWorkspace(previous.workspace); adapters.applyPresentation(previous.presentation); adapters.applySignalSettings(previous.signalSettings);
    throw error;
  }
}
