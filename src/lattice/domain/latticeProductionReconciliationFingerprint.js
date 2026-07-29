import { LATTICE_PRODUCTION_VISIBILITY, assertValidLatticeProductionDraft } from './latticeProductionDraft.js';
import { assertValidLatticeProductionPublication } from './latticeProductionPublication.js';

const placementValue = (placement, stableAssetId) => ({
  id: placement.id, stableAssetId,
  column: placement.column, row: placement.row,
  columnSpan: placement.columnSpan, rowSpan: placement.rowSpan,
  layer: placement.layer, navigationOrder: placement.navigationOrder,
  crop: structuredClone(placement.crop), frameId: placement.frameId,
  mat: structuredClone(placement.mat), backing: structuredClone(placement.backing),
  transparencyMode: placement.transparencyMode, visibility: placement.visibility,
});

function tableValue(table, placements) {
  if (table.visibility === LATTICE_PRODUCTION_VISIBILITY.PRIVATE) {
    return { id: table.id, coordinate: { ...table.coordinate }, visibility: table.visibility };
  }
  return {
    id: table.id, coordinate: { ...table.coordinate }, title: table.title, subtitle: table.subtitle,
    labelVisible: table.labelVisible, labelAnchor: table.labelAnchor, labelOffset: { ...table.labelOffset },
    visibility: table.visibility,
    placements: placements.sort((left, right) => left.navigationOrder - right.navigationOrder || left.id.localeCompare(right.id)),
  };
}

function latticeValue(source, identityPresentation, tables) {
  return {
    artboard: { ...source.artboard }, geometry: { ...source.geometry }, appearance: { ...source.appearance },
    identityPresentation, tables,
  };
}

export function latticeProductionDraftReconciliationValue(input) {
  const draft = assertValidLatticeProductionDraft(input);
  const identity = draft.identityPresentation;
  return latticeValue(draft, {
    alias: identity.alias,
    avatar: { mode: identity.avatar.mode, stableAssetId: identity.avatar.mode === 'inscape' ? identity.avatar.stableAssetId : null, shape: identity.avatar.shape },
    bio: { mode: identity.bio.mode, customText: identity.bio.mode === 'inscape' ? identity.bio.customText : '' },
    tags: structuredClone(identity.tags), dossierSurface: identity.dossierSurface, visibility: { ...identity.visibility },
  }, draft.tables.map((table) => tableValue(table, table.placements
    .filter((placement) => placement.visibility === LATTICE_PRODUCTION_VISIBILITY.PUBLIC)
    .map((placement) => placementValue(placement, placement.stableAssetId)))));
}

export function latticeProductionPublicationReconciliationValue(input) {
  const publication = assertValidLatticeProductionPublication(input);
  const identity = publication.identityPresentation;
  return latticeValue(publication, {
    alias: identity.alias,
    avatar: { mode: identity.avatar.mode, stableAssetId: identity.avatar.mode === 'inscape' ? identity.avatar.asset?.stableAssetId || null : null, shape: identity.avatar.shape },
    bio: { ...identity.bio }, tags: structuredClone(identity.tags), dossierSurface: identity.dossierSurface,
    visibility: { ...identity.visibility },
  }, publication.tables.map((table) => tableValue(table, (table.placements || [])
    .map((placement) => placementValue(placement, placement.asset.stableAssetId)))));
}
