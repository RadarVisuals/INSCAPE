import { FRAME_IDS, TRANSPARENCY_MODES } from '../domain/latticeProfile.js';
import { createUnresolvedPublicProfilePresentation } from '../domain/latticePublicProfilePresentation.js';
import { LATTICE_SURFACES, PROTOTYPE_START_GEOMETRY } from '../rendering/latticeGeometry.js';
import {
  ARTWORK_MAT_PRESET_IDS,
  DEFAULT_ARTWORK_BACKING,
  normalizeArtworkBacking,
  resolveArtworkMatPreset,
} from '../rendering/latticeMat.js';

export const PROFILE_DOSSIER_PRESENTATION = Object.freeze(createUnresolvedPublicProfilePresentation());
export const CUSTOM_MAT_PRESET_ID = 'CUSTOM';

export const FIXTURE_ASSET_IDS = Object.freeze({
  landscape: '42:0x1111111111111111111111111111111111111111:0x01',
  portrait: '42:0x2222222222222222222222222222222222222222:0x02',
  transparent: '42:0x3333333333333333333333333333333333333333:0x03',
});

export const FIXTURE_MEDIA = Object.freeze({
  [FIXTURE_ASSET_IDS.landscape]: Object.freeze({
    src: '/assets/stage/backdrops/backdrop_moonpurple.webp',
    width: 4636,
    height: 2000,
    accessibleLabel: 'Landscape rendering fixture',
  }),
  [FIXTURE_ASSET_IDS.portrait]: Object.freeze({
    src: '/assets/ratio/3.webp',
    width: 2000,
    height: 2829,
    accessibleLabel: 'Portrait rendering fixture',
  }),
  [FIXTURE_ASSET_IDS.transparent]: Object.freeze({
    src: '/assets/actors/abyssal_eye/full.webp',
    width: 2000,
    height: 2000,
    accessibleLabel: 'Transparent rendering fixture',
  }),
});

export const FIXTURE_ASSET_SOURCE = Object.freeze({
  listAssets: () => Object.entries(FIXTURE_MEDIA).map(([stableAssetId, media]) => ({ stableAssetId, ...media })),
  resolveAsset: (stableAssetId) => FIXTURE_MEDIA[stableAssetId] || null,
});

export const fixtureFocusDossier = (entry) => Object.freeze({
  title: entry.media.accessibleLabel,
  description: null,
  traits: Object.freeze([]),
  technical: Object.freeze([
    Object.freeze({ label: 'STABLE ASSET ID', value: entry.placement.stableAssetId }),
    Object.freeze({ label: 'SOURCE DIMENSIONS', value: `${entry.media.width} × ${entry.media.height}` }),
    Object.freeze({ label: 'TRANSPARENCY', value: entry.transparencyMode }),
    Object.freeze({ label: 'TOKEN STANDARD', value: null }),
    Object.freeze({ label: 'CONTRACT', value: null }),
    Object.freeze({ label: 'NETWORK', value: null }),
  ]),
});

export function createFixturePlacements(transparencyMode) {
  const common = {
    crop: null,
    frameId: FRAME_IDS.NONE,
    visitorVisible: true,
  };
  return [
    {
      ...common,
      id: 'phase-2-landscape',
      stableAssetId: FIXTURE_ASSET_IDS.landscape,
      x: 0.46, y: 0.13, width: 0.4, height: 0.4 * (16 / 9) * (2000 / 4636),
      layer: 0,
      navigationOrder: 2,
      transparencyMode: TRANSPARENCY_MODES.AUTO,
    },
    {
      ...common,
      id: 'phase-2-portrait',
      stableAssetId: FIXTURE_ASSET_IDS.portrait,
      x: 0.14, y: 0.16, width: 0.22, height: 0.22 * (16 / 9) * (2829 / 2000),
      layer: 1,
      navigationOrder: 0,
      transparencyMode: TRANSPARENCY_MODES.PRESERVE_ALPHA,
    },
    {
      ...common,
      id: 'phase-2-transparent',
      stableAssetId: FIXTURE_ASSET_IDS.transparent,
      x: 0.35, y: 0.42, width: 0.27, height: 0.27 * (16 / 9),
      layer: 2,
      navigationOrder: 1,
      transparencyMode,
    },
  ];
}

export const boundsFromPlacement = ({ x, y, width, height }) => ({ x, y, width, height });

export const createDefaultPlacementBounds = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, boundsFromPlacement(placement)]),
);

export const createDefaultPlacementCrops = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, placement.crop]),
);

export const createDefaultArtworkMats = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, resolveArtworkMatPreset(ARTWORK_MAT_PRESET_IDS.NONE)]),
);

export const createDefaultArtworkBackings = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, normalizeArtworkBacking(DEFAULT_ARTWORK_BACKING)]),
);

export const createDefaultMatPresetIds = () => Object.fromEntries(
  createFixturePlacements(TRANSPARENCY_MODES.AUTO)
    .map((placement) => [placement.id, ARTWORK_MAT_PRESET_IDS.NONE]),
);

export const createDefaultPlacementDefinitions = () => createFixturePlacements(TRANSPARENCY_MODES.AUTO);

export function applyPlacementAuthoring(placements, placementBounds, placementCrops, preview, cropPreview) {
  return placements.map((placement) => ({
    ...placement,
    ...(placementBounds[placement.id] || {}),
    ...(preview?.placementId === placement.id ? preview.bounds : {}),
    crop: cropPreview?.placementId === placement.id
      ? cropPreview.crop
      : placementCrops[placement.id] ?? null,
  }));
}

export const createDefaultRenderPreview = () => ({
  geometry: { ...PROTOTYPE_START_GEOMETRY },
  surfaceId: LATTICE_SURFACES[0].id,
  title: '',
  transparencyMode: TRANSPARENCY_MODES.AUTO,
});
