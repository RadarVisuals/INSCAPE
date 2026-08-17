import { normalizeProfileAddress } from '../../library/config.js';
import {
  LATTICE_PRODUCTION_GRID_STATE_ACTIVE,
  LATTICE_PRODUCTION_VISIBILITY,
  assertValidLatticeProductionDraft,
} from './latticeProductionDraft.js';
import { assertValidLatticeProductionPublication } from './latticeProductionPublication.js';

const MAX_PLACEMENT_ID_LENGTH = 200;
const VALID_PLACEMENT_ID = /^[A-Za-z0-9:_-]+$/u;

function nextAvailableInteger(used, requested) {
  if (Number.isSafeInteger(requested) && requested >= 0 && !used.has(requested)) return requested;
  let candidate = 0;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

export function remapPrivatePlacementId(originalId, tableId, usedIds, maximumAttempts = usedIds.size + 1) {
  for (let counter = 1; counter <= maximumAttempts; counter += 1) {
    const suffix = `:private-${tableId}-${counter}`;
    const baseLength = MAX_PLACEMENT_ID_LENGTH - suffix.length;
    if (baseLength < 1) break;
    const candidate = `${originalId.slice(0, baseLength)}${suffix}`;
    if (VALID_PLACEMENT_ID.test(candidate) && !usedIds.has(candidate)) return candidate;
  }
  throw new TypeError(`Could not deterministically remap private placement ID: ${originalId}`);
}

function restoredIdentity(publicIdentity, currentIdentity) {
  return {
    alias: publicIdentity.alias,
    avatar: {
      mode: publicIdentity.avatar.mode,
      stableAssetId: publicIdentity.avatar.mode === 'inscape'
        ? publicIdentity.avatar.asset?.stableAssetId || null
        : currentIdentity.avatar.stableAssetId,
      shape: publicIdentity.avatar.shape,
    },
    bio: {
      mode: publicIdentity.bio.mode,
      customText: publicIdentity.bio.mode === 'inscape'
        ? publicIdentity.bio.customText
        : currentIdentity.bio.customText,
    },
    tags: structuredClone(publicIdentity.tags),
    dossierSurface: publicIdentity.dossierSurface,
    visibility: { ...publicIdentity.visibility },
  };
}

function publicPlacementToDraft(placement, currentPlacement) {
  const { asset, ...presentation } = structuredClone(placement);
  return {
    ...presentation,
    stableAssetId: asset.stableAssetId,
    locked: currentPlacement?.visibility === LATTICE_PRODUCTION_VISIBILITY.PUBLIC
      && currentPlacement.stableAssetId === asset.stableAssetId
      ? currentPlacement.locked
      : false,
  };
}

/**
 * Reconciles one accepted public lattice into the profile-scoped canonical owner draft.
 * Compatibility fields never enter this adapter.
 */
export function reconcileLatticeProductionDraft(publicationInput, currentDraftInput, { profileAddress } = {}) {
  const publication = assertValidLatticeProductionPublication(publicationInput);
  const current = assertValidLatticeProductionDraft(currentDraftInput);
  const profile = normalizeProfileAddress(profileAddress);
  if (!profile || current.profileAddress !== profile) {
    throw new TypeError('The reconciliation profile must match the canonical lattice draft');
  }

  const usedIds = new Set();
  for (const table of publication.tables) {
    for (const placement of table.placements || []) {
      if (usedIds.has(placement.id)) throw new TypeError(`Duplicate published placement ID: ${placement.id}`);
      usedIds.add(placement.id);
    }
  }

  const preserved = [];
  const tables = publication.tables.map((publishedTable, tableIndex) => {
    const currentTable = current.tables[tableIndex];
    if (publishedTable.visibility === LATTICE_PRODUCTION_VISIBILITY.PRIVATE) {
      currentTable.placements.forEach((placement) => preserved.push({ tableIndex, tableId: currentTable.id, placement }));
      return { ...structuredClone(currentTable), visibility: LATTICE_PRODUCTION_VISIBILITY.PRIVATE, placements: [] };
    }

    const currentById = new Map(currentTable.placements.map((placement) => [placement.id, placement]));
    currentTable.placements
      .filter((placement) => placement.visibility === LATTICE_PRODUCTION_VISIBILITY.PRIVATE)
      .forEach((placement) => preserved.push({ tableIndex, tableId: currentTable.id, placement }));
    return {
      id: publishedTable.id,
      coordinate: { ...publishedTable.coordinate },
      gridState: LATTICE_PRODUCTION_GRID_STATE_ACTIVE,
      title: publishedTable.title,
      subtitle: publishedTable.subtitle,
      labelVisible: publishedTable.labelVisible,
      labelAnchor: publishedTable.labelAnchor,
      labelOffset: { ...publishedTable.labelOffset },
      visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC,
      placements: publishedTable.placements.map((placement) => publicPlacementToDraft(
        placement,
        currentById.get(placement.id),
      )),
    };
  });

  preserved.sort((left, right) => left.tableIndex - right.tableIndex
    || left.placement.navigationOrder - right.placement.navigationOrder
    || left.placement.layer - right.placement.layer
    || left.placement.id.localeCompare(right.placement.id));

  for (const entry of preserved) {
    const table = tables[entry.tableIndex];
    const placement = structuredClone(entry.placement);
    if (usedIds.has(placement.id)) placement.id = remapPrivatePlacementId(placement.id, entry.tableId, usedIds);
    usedIds.add(placement.id);
    const layers = new Set(table.placements.map((candidate) => candidate.layer));
    const navigationOrders = new Set(table.placements.map((candidate) => candidate.navigationOrder));
    placement.layer = nextAvailableInteger(layers, placement.layer);
    placement.navigationOrder = nextAvailableInteger(navigationOrders, placement.navigationOrder);
    table.placements.push(placement);
  }

  return assertValidLatticeProductionDraft({
    ...structuredClone(current),
    artboard: { ...publication.artboard },
    geometry: { ...publication.geometry },
    appearance: { ...publication.appearance },
    identityPresentation: restoredIdentity(publication.identityPresentation, current.identityPresentation),
    tables,
  });
}
