import { assertValidLatticeProductionPublication } from '../domain/latticeProductionPublication.js';
import { projectCroppedMediaRectangle } from './latticeCrop.js';
import { projectArtworkMat } from './latticeMat.js';

const positiveViewport = (viewport) => Boolean(viewport
  && Number.isFinite(viewport.width) && viewport.width > 0
  && Number.isFinite(viewport.height) && viewport.height > 0);

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function fitNativeMediaRectangle(rectangle, media) {
  if (!media || !Number.isFinite(media.width) || media.width <= 0
    || !Number.isFinite(media.height) || media.height <= 0) {
    throw new TypeError('Production media fitting requires positive native dimensions');
  }
  const scale = Math.min(rectangle.width / media.width, rectangle.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  return {
    left: rectangle.left + ((rectangle.width - width) / 2),
    top: rectangle.top + ((rectangle.height - height) / 2),
    width,
    height,
  };
}

export function createLatticeProductionTableRenderModel(publicationInput, tableId) {
  const publication = assertValidLatticeProductionPublication(publicationInput);
  const table = publication.tables.find((candidate) => candidate.id === tableId);
  if (!table) throw new TypeError(`Unknown production lattice table: ${String(tableId)}`);
  const model = {
    artboard: { ...publication.artboard },
    geometry: { ...publication.geometry },
    surfaceId: publication.appearance.surfaceId,
    table: structuredClone(table),
  };
  if (Array.isArray(model.table.placements)) {
    model.table.placements.sort((left, right) => left.navigationOrder - right.navigationOrder
      || left.id.localeCompare(right.id));
  }
  return deepFreeze(model);
}

export function projectLatticeProductionViewport(model, viewport) {
  if (!positiveViewport(viewport)) throw new TypeError('Production lattice projection requires a positive viewport');
  const columns = model?.geometry?.columns;
  const rows = model?.geometry?.rows;
  if (!Number.isSafeInteger(columns) || columns < 1 || !Number.isSafeInteger(rows) || rows < 1) {
    throw new TypeError('Production lattice projection requires positive integer geometry');
  }
  const cellSize = Math.min(viewport.width / columns, viewport.height / rows);
  const width = columns * cellSize;
  const height = rows * cellSize;
  return Object.freeze({
    cellSize,
    width,
    height,
    left: (viewport.width - width) / 2,
    top: (viewport.height - height) / 2,
  });
}

export function projectLatticeProductionPlacement(placement, field) {
  return Object.freeze({
    left: field.left + (placement.column * field.cellSize),
    top: field.top + (placement.row * field.cellSize),
    width: placement.columnSpan * field.cellSize,
    height: placement.rowSpan * field.cellSize,
  });
}

export function projectLatticeProductionLabel(table, field) {
  const [vertical, horizontal] = table.labelAnchor.split('-');
  const baseX = horizontal === 'left'
    ? field.left + field.cellSize
    : horizontal === 'right' ? field.left + field.width - field.cellSize : field.left + (field.width / 2);
  const baseY = vertical === 'top'
    ? field.top + field.cellSize
    : field.top + field.height - field.cellSize;
  return Object.freeze({
    left: baseX + (table.labelOffset.column * field.cellSize),
    top: baseY + (table.labelOffset.row * field.cellSize),
    transform: `translate(${horizontal === 'left' ? '0%' : horizontal === 'right' ? '-100%' : '-50%'}, ${vertical === 'top' ? '0%' : '-100%'})`,
  });
}

export function projectLatticeProductionArtwork(placement, field, mediaDimensions) {
  const footprint = projectLatticeProductionPlacement(placement, field);
  const mat = projectArtworkMat(footprint, placement.mat);
  if (!mediaDimensions) return Object.freeze({
    footprint,
    mat: mat.mat,
    backplateRectangle: mat.backplateRectangle,
    mediaOpeningRectangle: mat.mediaOpeningRectangle,
    imageRectangle: null,
  });
  const imageRectangle = placement.crop
    ? projectCroppedMediaRectangle(mat.mediaOpeningRectangle, mediaDimensions, placement.crop)
    : fitNativeMediaRectangle(mat.mediaOpeningRectangle, mediaDimensions);
  return Object.freeze({
    footprint,
    mat: mat.mat,
    backplateRectangle: mat.backplateRectangle,
    mediaOpeningRectangle: mat.mediaOpeningRectangle,
    imageRectangle: Object.freeze(imageRectangle),
  });
}
