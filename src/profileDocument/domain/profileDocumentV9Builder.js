import { normalizeProfileAddress } from '../../library/config.js';
import {
  SYSTEM_WORKFLOW_VISIBILITY,
  SYSTEM_WORKFLOW_WORLD_COVER_SIZE,
  assertValidSystemWorkflowDraft,
  isSystemWorkflowWorldCoverGrid,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import {
  INSCAPE_PROFILE_DOCUMENT_TYPE,
  INSCAPE_PROFILE_DOCUMENT_VERSION,
  PROFILE_DOCUMENT_NETWORK,
} from './constants.js';
import { parsePublishedAssetUrl } from './publishedAssetUrl.js';
import { createProfileDocumentV9AssetResolver } from './profileDocumentV9Asset.js';
import { assertValidProfileDocumentV9 } from './profileDocumentV9Validation.js';
import { projectIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import { projectDisplayDraft } from '../../systemWorkflow/domain/displayModules.js';
import { projectMobilePresentation, mobileReferenceCount } from '../../mobile/domain/mobilePresentation.js';
import { projectMiniApps } from '../../miniApps/domain/miniApps.js';
import { projectImageModules, imageReferenceCount } from '../../imageModule/imageModule.js';
import { projectShapes } from '../../shapes/shapes.js';
import { projectKeeperDocks, keeperReferenceCount } from '../../keeper/keeper.js';
import { projectTextModules } from '../../text/domain/article.js';

function timestamp(value, label) {
  const milliseconds = value instanceof Date ? value.getTime()
    : typeof value === 'number' ? value
      : Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be a valid timestamp`);
  return new Date(milliseconds).toISOString();
}

function cachedIdentity(profileIdentity, address) {
  const name = typeof profileIdentity?.name === 'string' ? profileIdentity.name.trim().slice(0, 80) : '';
  const avatarCandidate = typeof profileIdentity?.avatarUrl === 'string'
    ? profileIdentity.avatarUrl.trim().slice(0, 2048)
    : '';
  const avatarUrl = parsePublishedAssetUrl(avatarCandidate)?.value;
  return { address, ...(name ? { name } : {}), ...(avatarUrl ? { avatarUrl } : {}) };
}

function publicationError(code, message) {
  return Object.assign(new TypeError(message), { code });
}

export function projectSystemWorkflowPublicGrids(draftInput, assetRecords = []) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const resolveAsset = createProfileDocumentV9AssetResolver(assetRecords);
  const grids = draft.grids
    .filter((grid) => !isSystemWorkflowWorldCoverGrid(grid)
      && grid.visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC)
    .map((grid) => {
      // Canvas edits keep off-canvas work in the draft. Public snapshots include
      // only intersecting placements; partially visible layers retain geometry
      // and the shared renderer clips them at the authored boundary.
      const placements = grid.placements.filter(placement => placement.visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC
        && placement.column < draft.geometry.columns && placement.row < draft.geometry.rows
        && placement.column + placement.columnSpan > 0 && placement.row + placement.rowSpan > 0);
      const ids = new Set(placements.map(placement => placement.id));
      const groups = grid.groups?.map(group => ({ ...group, placementIds: group.placementIds.filter(id => ids.has(id)) }))
        .filter(group => group.placementIds.length >= 2);
      return {
      id: grid.id,
      title: grid.title,
      subtitle: grid.subtitle,
      visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
      labelVisible: grid.labelVisible,
      labelAnchor: grid.labelAnchor,
      labelOffset: { ...grid.labelOffset },
      ...(groups?.length ? { groups } : {}),
      placements: placements
        .sort((left, right) => left.navigationOrder - right.navigationOrder || left.id.localeCompare(right.id))
        .map(({ locked: _locked, stableAssetId, selectedMedia, ...placement }) => ({
          ...structuredClone(placement),
          visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
          ...(placement.kind === 'text' ? {} : { asset: resolveAsset(stableAssetId, selectedMedia) }),
        })),
      };
    });
  if (!grids.length && draft.grids.length) {
    throw publicationError('INSCAPE_PROFILE_PUBLIC_GRID_REQUIRED', 'Publication requires at least one public Grid');
  }
  return grids;
}

function projectSystemWorkflowWorldCover(draft, assetRecords) {
  const cover = draft.grids.find(isSystemWorkflowWorldCoverGrid);
  if (!cover?.placements.length) return null;
  const resolveAsset = createProfileDocumentV9AssetResolver(assetRecords);
  return {
    width: SYSTEM_WORKFLOW_WORLD_COVER_SIZE.width,
    height: SYSTEM_WORKFLOW_WORLD_COVER_SIZE.height,
    grid: {
      id: cover.id,
      title: cover.title,
      subtitle: cover.subtitle,
      visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
      labelVisible: false,
      labelAnchor: cover.labelAnchor,
      labelOffset: { ...cover.labelOffset },
      ...(cover.groups ? { groups: structuredClone(cover.groups) } : {}),
      placements: cover.placements
        .filter(({ visibility }) => visibility === SYSTEM_WORKFLOW_VISIBILITY.PUBLIC)
        .sort((left, right) => left.navigationOrder - right.navigationOrder || left.id.localeCompare(right.id))
        .map(({ locked: _locked, stableAssetId, selectedMedia, ...placement }) => ({
          ...structuredClone(placement),
          visibility: SYSTEM_WORKFLOW_VISIBILITY.PUBLIC,
          ...(placement.kind === 'text' ? {} : { asset: resolveAsset(stableAssetId, selectedMedia) }),
        })),
    },
  };
}

export function buildProfileDocumentV9({
  assetRecords = [],
  createdAt,
  documentId,
  exportedAt,
  profileAddress,
  profileIdentity,
  revision = 1,
  systemWorkflowDraft,
  workbench,
}) {
  const address = normalizeProfileAddress(profileAddress);
  if (!address) throw new TypeError('A valid Universal Profile address is required');
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw publicationError('INSCAPE_PROFILE_REVISION_INVALID', 'Profile document revision must be a positive integer');
  }
  const draft = assertValidSystemWorkflowDraft(systemWorkflowDraft);
  if (draft.profileAddress !== address) {
    throw new TypeError('The System Workflow draft must match the profile document authority');
  }
  const created = timestamp(createdAt ?? 0, 'Document creation time');
  const exported = timestamp(exportedAt ?? createdAt ?? 0, 'Document export time');
  if (Date.parse(created) > Date.parse(exported)) throw new TypeError('Document creation time cannot follow export time');
  const resolveAvatarAsset = createProfileDocumentV9AssetResolver(assetRecords, { compactContentReference: false });
  const identity = structuredClone(draft.identityPresentation);
  const avatarAsset = identity.avatar.mode === 'inscape' && identity.avatar.stableAssetId
    ? resolveAvatarAsset(identity.avatar.stableAssetId, identity.avatar.selectedMedia)
    : null;
  const worldCover = projectSystemWorkflowWorldCover(draft, assetRecords);
  const displays = draft.displays?.filter(module => module.visibility === 'PUBLIC' && module.grids.some(grid => !isSystemWorkflowWorldCoverGrid(grid) && grid.visibility === 'PUBLIC'))
    .map(module => ({ id: module.id, artboard: { ...module.artboard }, geometry: { ...module.geometry }, appearance: { ...module.appearance },
      grids: projectSystemWorkflowPublicGrids(projectDisplayDraft(draft, module.id), assetRecords) }));
  const presentation = workbench || draft.workbench;
  const miniApps = draft.miniApps ? projectMiniApps(draft.miniApps) : undefined;
  const shapes = draft.shapes ? projectShapes(draft.shapes) : undefined;
  const keeperDocks = draft.keeperDocks ? projectKeeperDocks(draft.keeperDocks) : undefined;
  const imageModules = draft.imageModules ? projectImageModules(draft.imageModules) : undefined;
  const texts = draft.texts ? projectTextModules(draft.texts, [{ id: 'display:primary', grids: draft.grids.filter(g => !isSystemWorkflowWorldCoverGrid(g)) }, ...(draft.displays || []).filter(d => d.visibility === 'PUBLIC').map(d => ({ ...d, grids: d.grids.filter(g => !isSystemWorkflowWorldCoverGrid(g)) }))]) : undefined;
  const publicWorkbench = presentation ? structuredClone(presentation) : null;
  if (publicWorkbench?.keeperDocks) publicWorkbench.keeperDocks = publicWorkbench.keeperDocks.filter(item => keeperDocks?.some(keeper => keeper.id === item.id));
  if (publicWorkbench?.shapes) publicWorkbench.shapes = publicWorkbench.shapes.filter(item => shapes?.some(shape => shape.id === item.id));
  if (publicWorkbench?.imageModules) publicWorkbench.imageModules = publicWorkbench.imageModules.filter(item => imageModules?.some(image => image.id === item.id));
  if (publicWorkbench?.miniApps) publicWorkbench.miniApps = publicWorkbench.miniApps.filter(item => miniApps?.some(app => app.id === item.id));
  if (publicWorkbench?.texts) publicWorkbench.texts = publicWorkbench.texts.filter(item => texts?.some(text => text.id === item.id));
  if (publicWorkbench?.displays) publicWorkbench.displays = publicWorkbench.displays.filter(module => displays?.some(content => content.id === module.id));
  return assertValidProfileDocumentV9({
    documentType: INSCAPE_PROFILE_DOCUMENT_TYPE,
    version: INSCAPE_PROFILE_DOCUMENT_VERSION,
    documentId: documentId || `profile:${address}`,
    revision,
    createdAt: created,
    exportedAt: exported,
    network: { ...PROFILE_DOCUMENT_NETWORK },
    profile: { address, cachedIdentity: cachedIdentity(profileIdentity, address) },
    artboard: { ...draft.artboard },
    geometry: { ...draft.geometry },
    appearance: { ...draft.appearance },
    identityPresentation: {
      ...(identity.card ? { card: projectIdentityCard(identity.card) } : {}),
      alias: identity.alias,
      avatar: { mode: identity.avatar.mode, asset: avatarAsset, shape: identity.avatar.shape },
      bio: {
        mode: identity.bio.mode,
        customText: identity.bio.mode === 'inscape' ? identity.bio.customText : '',
      },
      tags: structuredClone(identity.tags),
      dossierSurface: identity.dossierSurface,
      visibility: { ...identity.visibility },
    },
    grids: projectSystemWorkflowPublicGrids(draft, assetRecords),
    metadata: worldCover ? { worldCover } : {},
    ...(displays ? { displays } : {}),
    ...(miniApps?.length ? { miniApps } : {}),
    ...(shapes?.length ? { shapes } : {}),
    ...(keeperDocks?.length ? { keeperDocks } : {}),
    ...(imageModules?.length ? { imageModules } : {}),
    ...(texts?.length ? { texts } : {}),
    ...(draft.mobile?.visibility === 'PUBLIC' ? { mobile: projectMobilePresentation(draft.mobile, assetRecords) } : {}),
    ...(publicWorkbench ? { workbench: publicWorkbench } : {}),
  });
}

export function countProfileDocumentV9Assets(document) {
  const value = assertValidProfileDocumentV9(document);
  return value.grids.reduce((total, grid) => total + grid.placements.length, 0)
    + (value.metadata.worldCover?.grid.placements.length || 0)
    + (value.identityPresentation.avatar.asset ? 1 : 0)
    + (value.workbench?.display.shortcut.icon ? 1 : 0)
    + (value.displays || []).reduce((sum, module) => sum + module.grids.reduce((count, grid) => count + grid.placements.length, 0), 0)
    + (value.workbench?.displays || []).filter(module => module.shortcut.icon).length
    + keeperReferenceCount(value.keeperDocks) + imageReferenceCount(value.imageModules) + mobileReferenceCount(value.mobile);
}
