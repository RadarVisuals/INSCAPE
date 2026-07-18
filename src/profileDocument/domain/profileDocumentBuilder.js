import { normalizeProfileAddress } from '../../library/config.js';
import { buildAssetReference } from './assetReference.js';
import { PROFILE_DOCUMENT_NETWORK, PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION } from './constants.js';

const cleanPosition = (value) => value && Number.isInteger(value.column) && Number.isInteger(value.row) ? { column: value.column, row: value.row } : null;
function cleanIdentity(identity, address) {
  const name = typeof identity?.name === 'string' ? identity.name.trim().slice(0, 80) : '';
  const avatarCandidate = typeof identity?.avatarUrl === 'string' ? identity.avatarUrl.trim() : '';
  const avatarUrl = /^(https?:\/\/|ipfs:\/\/)/i.test(avatarCandidate) ? avatarCandidate.slice(0, 2048) : '';
  return { address, ...(name ? { name } : {}), ...(avatarUrl ? { avatarUrl } : {}) };
}
/** Pure allowlisted projection from subsystem-owned state into public document v1. */
export function buildProfileDocumentV1({ profileAddress, workspace, assets = [], publicPresentation, signalSettings, profileIdentity,
  modulePositions = {}, documentId, revision = 1, createdAt, exportedAt }) {
  const address = normalizeProfileAddress(profileAddress);
  if (!address) throw new TypeError('A valid Universal Profile address is required');
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const folders = new Map((workspace?.folders || []).map((folder) => [folder.id, folder]));
  const launchers = Array.isArray(workspace?.canvas?.launchers) ? workspace.canvas.launchers : [];
  const spaces = launchers.filter((launcher) => launcher.visitorVisible === true).flatMap((launcher, order) => {
    const folder = launcher.viewType === 'folder' ? folders.get(launcher.folderId) : null;
    const assetIds = launcher.viewType === 'favorites' ? workspace?.favorites || [] : folder?.assetIds || [];
    if (!['folder', 'favorites'].includes(launcher.viewType)) return [];
    return [{ id: launcher.id, launcherId: launcher.id, kind: launcher.viewType,
      label: launcher.viewType === 'favorites' ? 'Favorites' : String(folder?.name || 'Unavailable space').trim().slice(0, 80), order,
      placement: cleanPosition(launcher.position), windowPlacement: cleanPosition(launcher.windowPosition),
      appearance: { mode: ['label','icon','icon_label'].includes(launcher.appearanceMode) ? launcher.appearanceMode : 'label', iconKey: typeof launcher.iconKey === 'string' ? launcher.iconKey : launcher.viewType === 'favorites' ? 'favorites' : 'folder', showLabel: launcher.appearanceMode !== 'icon', columnSpan: Math.max(1, Math.min(12, launcher.span?.columns || 3)), rowSpan: Math.max(1, Math.min(8, launcher.span?.rows || 1)) },
      assets: [...new Set(assetIds)].map((id) => buildAssetReference(assetById.get(id), id)).filter(Boolean) }];
  });
  return {
    documentType: PROFILE_DOCUMENT_TYPE, version: PROFILE_DOCUMENT_VERSION,
    documentId: documentId || `profile:${address}`, revision: Math.max(1, Math.trunc(Number(revision) || 1)),
    createdAt: new Date(createdAt ?? 0).toISOString(), exportedAt: new Date(exportedAt ?? createdAt ?? 0).toISOString(),
    network: { ...PROFILE_DOCUMENT_NETWORK }, profile: { address, cachedIdentity: cleanIdentity(profileIdentity, address) },
    presentation: { keeperId: publicPresentation?.keeperId || 'abyssal_eye', stageId: publicPresentation?.stageId || 'moonpurple',
      systemModules: [{ id: 'identity', visible: true, placement: cleanPosition(modulePositions.identity) }, { id: 'signals', visible: true, placement: cleanPosition(modulePositions.signals) }],
      signals: { notifications: signalSettings?.notifications !== false, speech: signalSettings?.speech !== false,
        visualEffects: signalSettings?.visualEffects !== false, audio: signalSettings?.audio === true } },
    spaces, metadata: {}
  };
}
export const countProfileDocumentAssets = (document) => document?.spaces?.reduce((sum, space) => sum + space.assets.length, 0) || 0;
