import { normalizeProfileAddress } from '../../library/config.js';
import { buildAssetReference } from './assetReference.js';
import { PROFILE_DOCUMENT_LIMITS, PROFILE_DOCUMENT_NETWORK, PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION } from './constants.js';
import { getCanvasObjectDefinition, normalizeCanvasObjectPresentation } from '../../library/domain/canvasObjectRegistry.js';
import { parsePublishedAssetUrl } from './publishedAssetUrl.js';

const cleanPosition = (value) => value && Number.isInteger(value.column) && value.column >= -255 && value.column <= 255 && Number.isInteger(value.row) && value.row >= -255 && value.row <= 255 ? { column: value.column, row: value.row } : null;
const cleanWindowGeometry = (value) => value
  && Number.isInteger(value.column) && value.column >= -255 && value.column <= 255
  && Number.isInteger(value.row) && value.row >= -255 && value.row <= 255
  && Number.isInteger(value.columnSpan) && value.columnSpan >= 1 && value.columnSpan <= 64
  && Number.isInteger(value.rowSpan) && value.rowSpan >= 1 && value.rowSpan <= 128
  ? { column: value.column, row: value.row, columnSpan: value.columnSpan, rowSpan: value.rowSpan }
  : null;
function cleanIdentity(identity, address) {
  const name = typeof identity?.name === 'string' ? identity.name.trim().slice(0, 80) : '';
  const avatarCandidate = typeof identity?.avatarUrl === 'string' ? identity.avatarUrl.trim() : '';
  const avatarUrl = parsePublishedAssetUrl(avatarCandidate.slice(0, 2048))?.value || '';
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
  const favoriteCandidates = launchers.filter((launcher) => launcher.viewType === 'favorites' && launcher.visitorVisible === true)
    .map((launcher) => ({ kind: 'favorites', launcher, folder: null, sortOrder: launcher.presentationOrder ?? 0 }));
  const folderCandidates = [...folders.values()].map((folder, index) => {
    const launcher = launchers.find((candidate) => candidate.viewType === 'folder' && candidate.folderId === folder.id) || null;
    const isPublic = folder.public === true || (folder.public === undefined && launcher?.visitorVisible === true);
    if (!isPublic) return null;
    return { kind: 'folder', launcher, folder, sortOrder: launcher?.presentationOrder ?? 1000 + index };
  }).filter(Boolean);
  const spaces = [...favoriteCandidates, ...folderCandidates]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, PROFILE_DOCUMENT_LIMITS.maxSpaces)
    .map(({ kind, launcher, folder }, order) => {
      const id = launcher?.id || `library:folder:${folder.id}`;
      const assetIds = kind === 'favorites' ? workspace?.favorites || [] : folder.assetIds;
      const appearanceMode = ['label','icon','icon_label'].includes(launcher?.appearanceMode) ? launcher.appearanceMode : 'label';
      return { id, launcherId: id, kind,
        label: kind === 'favorites' ? String(launcher?.label || 'Favorites').trim().slice(0, 80) : folder.name, order,
        placement: cleanPosition(launcher?.position), windowPlacement: cleanPosition(launcher?.windowPosition),
        startOpen: launcher?.startOpen === true, windowGeometry: cleanWindowGeometry(launcher?.windowGeometry), homeShortcut: Boolean(launcher),
        appearance: { mode: appearanceMode, iconKey: typeof launcher?.iconKey === 'string' ? launcher.iconKey : kind === 'favorites' ? 'favorites' : 'folder', showLabel: appearanceMode !== 'icon', columnSpan: Math.max(1, Math.min(12, launcher?.span?.columns || 3)), rowSpan: Math.max(1, Math.min(8, launcher?.span?.rows || 1)) },
        assets: [...new Set(assetIds)].map((assetId) => buildAssetReference(assetById.get(assetId), assetId)).filter(Boolean) };
    });
  const canvasObjects = (Array.isArray(workspace?.canvas?.objects) ? workspace.canvas.objects : [])
    .filter((object) => object.visitorVisible === true)
    .sort((a, b) => a.presentationOrder - b.presentationOrder || a.id.localeCompare(b.id))
    .slice(0, PROFILE_DOCUMENT_LIMITS.maxCanvasObjects)
    .flatMap((object, order) => {
      const definition = getCanvasObjectDefinition(object.kind);
      const asset = buildAssetReference(assetById.get(object.stableAssetId), object.stableAssetId);
      if (!definition || !asset) return [];
      const columns = Math.max(definition.minimumSpan.columns, Math.min(definition.maximumSpan.columns, Math.round(Number(object.span?.columns) || definition.defaultSpan.columns)));
      const rows = Math.max(definition.minimumSpan.rows, Math.min(definition.maximumSpan.rows, Math.round(Number(object.span?.rows) || definition.defaultSpan.rows)));
      return [{ id: object.id, kind: object.kind, asset, placement: cleanPosition(object.placement), span: { columns, rows }, order,
        presentation: normalizeCanvasObjectPresentation(object.kind, object.presentation) }];
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
    spaces, canvasObjects, metadata: {}
  };
}
// Compatibility export for Phase 4 callers; it now builds the current migrated schema.
export const buildProfileDocumentV2 = buildProfileDocumentV3;
export const buildProfileDocumentV1 = buildProfileDocumentV3;
export const countProfileDocumentAssets = (document) => (document?.spaces?.reduce((sum, space) => sum + space.assets.length, 0) || 0)
  + (document?.canvasObjects?.length || 0);
