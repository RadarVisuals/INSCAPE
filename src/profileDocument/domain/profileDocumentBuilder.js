import { normalizeProfileAddress } from '../../library/config.js';
import { buildAssetReference } from './assetReference.js';
import { PROFILE_DOCUMENT_NETWORK, PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION } from './constants.js';

const cleanPosition = (value) => value && Number.isInteger(value.column) && Number.isInteger(value.row) ? { column: value.column, row: value.row } : null;
const cleanWindowGeometry = (value) => value
  && Number.isInteger(value.column) && value.column >= 0 && value.column <= 63
  && Number.isInteger(value.row) && value.row >= 0 && value.row <= 127
  && Number.isInteger(value.columnSpan) && value.columnSpan >= 1 && value.columnSpan <= 64
  && Number.isInteger(value.rowSpan) && value.rowSpan >= 1 && value.rowSpan <= 128
  ? { column: value.column, row: value.row, columnSpan: value.columnSpan, rowSpan: value.rowSpan }
  : null;
function cleanIdentity(identity, address) {
  const name = typeof identity?.name === 'string' ? identity.name.trim().slice(0, 80) : '';
  const avatarCandidate = typeof identity?.avatarUrl === 'string' ? identity.avatarUrl.trim() : '';
  const avatarUrl = /^(https?:\/\/|ipfs:\/\/)/i.test(avatarCandidate) ? avatarCandidate.slice(0, 2048) : '';
  return { address, ...(name ? { name } : {}), ...(avatarUrl ? { avatarUrl } : {}) };
}
/** Pure allowlisted projection from subsystem-owned state into the current public document. */
export function buildProfileDocumentV3({ profileAddress, workspace, assets = [], publicPresentation, signalSettings, profileIdentity,
  modulePositions = {}, systemPresentation = {}, documentId, revision = 1, createdAt, exportedAt }) {
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
      label: launcher.viewType === 'favorites' ? String(launcher.label || 'Favorites').trim().slice(0, 80) : String(folder?.name || 'Unavailable space').trim().slice(0, 80), order,
      placement: cleanPosition(launcher.position), windowPlacement: cleanPosition(launcher.windowPosition),
      startOpen: launcher.startOpen === true, windowGeometry: cleanWindowGeometry(launcher.windowGeometry),
      appearance: { mode: ['label','icon','icon_label'].includes(launcher.appearanceMode) ? launcher.appearanceMode : 'label', iconKey: typeof launcher.iconKey === 'string' ? launcher.iconKey : launcher.viewType === 'favorites' ? 'favorites' : 'folder', showLabel: launcher.appearanceMode !== 'icon', columnSpan: Math.max(1, Math.min(12, launcher.span?.columns || 3)), rowSpan: Math.max(1, Math.min(8, launcher.span?.rows || 1)) },
      assets: [...new Set(assetIds)].map((id) => buildAssetReference(assetById.get(id), id)).filter(Boolean) }];
  });
  return {
    documentType: PROFILE_DOCUMENT_TYPE, version: PROFILE_DOCUMENT_VERSION,
    documentId: documentId || `profile:${address}`, revision: Math.max(1, Math.trunc(Number(revision) || 1)),
    createdAt: new Date(createdAt ?? 0).toISOString(), exportedAt: new Date(exportedAt ?? createdAt ?? 0).toISOString(),
    network: { ...PROFILE_DOCUMENT_NETWORK }, profile: { address, cachedIdentity: cleanIdentity(profileIdentity, address) },
    presentation: { keeperId: publicPresentation?.keeperId || 'abyssal_eye', stageId: publicPresentation?.stageId || 'moonpurple',
      environment: {
        type: publicPresentation?.environment?.type === 'shader' ? 'shader' : 'illustrated',
        shaderId: 'neural-field'
      },
      systemModules: [{ id: 'identity', visible: true, placement: cleanPosition(modulePositions.identity), startOpen: systemPresentation.identity?.startOpen === true, windowGeometry: cleanWindowGeometry(systemPresentation.identity?.windowGeometry) }, { id: 'signals', visible: true, placement: cleanPosition(modulePositions.signals), startOpen: systemPresentation.signals?.startOpen === true, windowGeometry: cleanWindowGeometry(systemPresentation.signals?.windowGeometry) }],
      signals: { notifications: signalSettings?.notifications !== false, speech: signalSettings?.speech !== false,
        visualEffects: signalSettings?.visualEffects !== false, audio: signalSettings?.audio === true } },
    spaces, metadata: {}
  };
}
// Compatibility export for Phase 4 callers; it now builds the current migrated schema.
export const buildProfileDocumentV2 = buildProfileDocumentV3;
export const buildProfileDocumentV1 = buildProfileDocumentV3;
export const countProfileDocumentAssets = (document) => document?.spaces?.reduce((sum, space) => sum + space.assets.length, 0) || 0;
