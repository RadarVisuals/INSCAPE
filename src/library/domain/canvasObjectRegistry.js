export const CANVAS_OBJECT_KIND = Object.freeze({ FRAMED_ARTWORK: 'framed-artwork' });

const FRAMED_ARTWORK_PRESENTATION = Object.freeze({ fit: 'contain', frame: 'thin', mat: 'none', background: 'dark' });
const ENUMS = Object.freeze({
  fit: Object.freeze(['contain', 'cover']),
  frame: Object.freeze(['none', 'thin', 'heavy']),
  mat: Object.freeze(['none', 'light', 'dark']),
  background: Object.freeze(['dark', 'light', 'neutral'])
});

const FRAMED_ARTWORK = Object.freeze({
  kind: CANVAS_OBJECT_KIND.FRAMED_ARTWORK,
  label: 'Framed Artwork',
  iconKey: 'gallery',
  rendererKey: 'framed-artwork',
  inspectorKey: 'framed-artwork',
  allowedAssetMediaKinds: Object.freeze(['image']),
  defaultSpan: Object.freeze({ columns: 4, rows: 4 }),
  minimumSpan: Object.freeze({ columns: 2, rows: 2 }),
  maximumSpan: Object.freeze({ columns: 12, rows: 12 }),
  defaultPresentation: FRAMED_ARTWORK_PRESENTATION
});

export const CANVAS_OBJECT_REGISTRY = Object.freeze({ [CANVAS_OBJECT_KIND.FRAMED_ARTWORK]: FRAMED_ARTWORK });
export const CANVAS_OBJECT_PRESENTATION_ENUMS = ENUMS;

export function getCanvasObjectDefinition(kind) { return CANVAS_OBJECT_REGISTRY[kind] || null; }

export function normalizeCanvasObjectPresentation(kind, value) {
  const definition = getCanvasObjectDefinition(kind);
  if (!definition) return null;
  return Object.fromEntries(Object.entries(definition.defaultPresentation).map(([key, fallback]) => [
    key, ENUMS[key].includes(value?.[key]) ? value[key] : fallback
  ]));
}

export function isImageCompatibleAsset(asset) {
  return Boolean(asset && typeof asset.id === 'string' && (asset.thumbnailUrl || asset.imageUrl || asset.originalImageUrl));
}
