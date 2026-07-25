import { assertValidProfileDocument } from './profileDocumentValidation.js';
import { MAX_CANVAS_OBJECT_ID_LENGTH } from '../../library/domain/canvasObjects.js';

function folderIdFromSpace(space) {
  const prefix = 'library:folder:';
  return space.kind === 'folder' && space.launcherId.startsWith(prefix) ? space.launcherId.slice(prefix.length) : null;
}
/** Builds a detached presentation-only restore plan. No store is touched here. */
export function createProfileDocumentRestorePlan(document, currentWorkspace) {
  const value = assertValidProfileDocument(document);
  const workspace = structuredClone(currentWorkspace);
  const existing = new Map(workspace.folders.map((folder) => [folder.id, folder]));
  const publicFolderIds = new Set(workspace.folders.filter((folder) => folder.public === true).map((folder) => folder.id));
  const restoredFolderIds = new Set();
  const uniqueFolderId = (requested) => {
    if (!existing.has(requested) || publicFolderIds.has(requested)) return requested;
    let suffix = 2; while (existing.has(`${requested}-${suffix}`)) suffix += 1;
    return `${requested}-${suffix}`;
  };
  const restoreAsFolder = (space, requested) => {
    const id = uniqueFolderId(requested);
    const prior = existing.get(id);
    const folder = { id, name: space.label, assetIds: space.assets.map((asset) => asset.stableAssetId), public: true,
      createdAt: prior?.createdAt || 0, updatedAt: Math.max(prior?.updatedAt || 0, Date.parse(value.exportedAt) || 0) };
    if (prior) workspace.folders = workspace.folders.map((item) => item.id === id ? folder : item); else workspace.folders.push(folder);
    existing.set(id, folder); restoredFolderIds.add(id);
  };
  for (const space of [...value.spaces].sort((a, b) => a.order - b.order)) {
    if (space.kind === 'favorites') {
      workspace.favorites = [...new Set([...workspace.favorites, ...space.assets.map((asset) => asset.stableAssetId)])];
      continue;
    }
    const requested = folderIdFromSpace(space) || `restored-${space.id}`;
    restoreAsFolder(space, requested);
  }
  // Restore follows the existing public-presentation replacement policy: public objects are replaced,
  // unrelated private local objects survive, and imported IDs are suffixed only when they collide.
  const privateObjects = (workspace.canvas?.objects || []).filter((object) => object.visitorVisible !== true);
  const usedObjectIds = new Set(privateObjects.map((object) => object.id));
  const uniqueObjectId = (requested) => {
    if (!usedObjectIds.has(requested)) { usedObjectIds.add(requested); return requested; }
    let suffix = 2;
    let id;
    do {
      const ending = `-${suffix}`;
      id = `${requested.slice(0, MAX_CANVAS_OBJECT_ID_LENGTH - ending.length)}${ending}`;
      suffix += 1;
    } while (usedObjectIds.has(id));
    usedObjectIds.add(id); return id;
  };
  const restoredObjects = [...value.canvasObjects].sort((a, b) => a.order - b.order).map((object, index) => ({
    id: uniqueObjectId(object.id), kind: object.kind, stableAssetId: object.asset.stableAssetId, visitorVisible: true,
    placement: { ...object.placement }, span: { ...object.span }, presentationOrder: privateObjects.length + index,
    presentation: { ...object.presentation }
  }));
  workspace.canvas = { ...workspace.canvas, launchers: [], objects: [...privateObjects, ...restoredObjects] };
  return { workspace, keeperId: value.presentation.keeperId, stageId: value.presentation.stageId,
    environment: { ...value.presentation.environment },
    signalSettings: { ...value.presentation.signals }, restoredFolderIds: [...restoredFolderIds] };
}

export async function executeAtomicRestore(plan, adapters) {
  const previous = { workspace: adapters.getWorkspace(), presentation: adapters.getPresentation(), signalSettings: adapters.getSignalSettings() };
  try {
    if (await adapters.persistWorkspace(plan.workspace) === false) throw new Error('Workspace persistence failed');
    adapters.applyWorkspace(plan.workspace);
    adapters.applyPresentation({ keeperId: plan.keeperId, stageId: plan.stageId, environment: plan.environment });
    adapters.applySignalSettings(plan.signalSettings);
    return true;
  } catch (error) {
    adapters.applyWorkspace(previous.workspace); adapters.applyPresentation(previous.presentation); adapters.applySignalSettings(previous.signalSettings);
    throw error;
  }
}
