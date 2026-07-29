import { normalizeProfileAddress } from '../../library/config.js';
import { buildAssetReference } from './assetReference.js';
import { PROFILE_DOCUMENT_LIMITS, PROFILE_DOCUMENT_NETWORK, PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION } from './constants.js';
import { getCanvasObjectDefinition, normalizeCanvasObjectPresentation } from '../../library/domain/canvasObjectRegistry.js';
import { parsePublishedAssetUrl } from './publishedAssetUrl.js';
import { projectLatticeProductionPublication } from '../../lattice/domain/latticeProductionAdapter.js';
import { assertValidLatticeProductionDraft } from '../../lattice/domain/latticeProductionDraft.js';
import { PROFILE_DOCUMENT_VERSION_8 } from './constants.js';

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
  const spaces = (workspace?.folders || [])
    .filter((folder) => folder.public === true)
    .slice(0, PROFILE_DOCUMENT_LIMITS.maxSpaces)
    .map((folder, order) => {
      const id = `library:folder:${folder.id}`;
      return { id, launcherId: id, kind: 'folder',
        label: folder.name, order,
        placement: null, windowPlacement: null,
        startOpen: false, windowGeometry: null, homeShortcut: false,
        appearance: { mode: 'label', iconKey: 'folder', showLabel: true, columnSpan: 3, rowSpan: 1 },
        assets: [...new Set(folder.assetIds)].map((assetId) => buildAssetReference(assetById.get(assetId), assetId)).filter(Boolean) };
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
      avatarShape: publicPresentation?.avatarShape === 'round' ? 'round' : 'square',
      visitorNavigation: {
        showCategories: publicPresentation?.visitorNavigation?.showCategories !== false,
        showCreations: publicPresentation?.visitorNavigation?.showCreations === true
      },
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

/** Builds the readable v8 envelope without changing the v7 publication default. */
export function buildProfileDocumentV8({ latticeDraft, ...input }) {
  const compatibility = buildProfileDocumentV3(input);
  const draft = assertValidLatticeProductionDraft(latticeDraft);
  if (draft.profileAddress !== compatibility.profile.address) {
    throw new TypeError('The lattice draft profile must match the profile document authority');
  }
  return {
    ...compatibility,
    version: PROFILE_DOCUMENT_VERSION_8,
    lattice: projectLatticeProductionPublication(draft, input.assets || [], {
      lastPublished: compatibility.exportedAt,
    }),
  };
}
// Compatibility export for Phase 4 callers; it now builds the current migrated schema.
export const buildProfileDocumentV2 = buildProfileDocumentV3;
export const buildProfileDocumentV1 = buildProfileDocumentV3;
export const countProfileDocumentAssets = (document) => (document?.spaces?.reduce((sum, space) => sum + space.assets.length, 0) || 0)
  + (document?.canvasObjects?.length || 0);
