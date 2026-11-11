import { receptionBentoSettings } from './receptionBento.js';
import { receptionModuleWindow, withReceptionModuleWindow, MIN_RECEPTION_CELL_SIZE } from './receptionEditorDocument.js';

const near = (a, b) => Math.abs(a - b) < 0.001;
const overlaps = (a, b) => a.left < b.left + b.width - 0.001 && b.left < a.left + a.width - 0.001
  && a.top < b.top + b.height - 0.001 && b.top < a.top + a.height - 0.001;
const bounds = tiles => ({ left: Math.min(...tiles.map(r => r.left)), top: Math.min(...tiles.map(r => r.top)),
  width: Math.max(...tiles.map(r => r.left + r.width)) - Math.min(...tiles.map(r => r.left)),
  height: Math.max(...tiles.map(r => r.top + r.height)) - Math.min(...tiles.map(r => r.top)) });
const closed = tiles => {
  const frame = bounds(tiles);
  return near(tiles.reduce((sum, r) => sum + r.width * r.height, 0), frame.width * frame.height)
    && tiles.every((a, i) => tiles.slice(i + 1).every(b => !overlaps(a, b)));
};

// Prefer a local expansion across a complete side of the hole. Deleted tiles
// remain temporary holes so a multi-selection or an entire row can collapse too.
function absorb(tiles, hole) {
  for (const [axis, size, cross, crossSize, sign] of [
    ['left', 'width', 'top', 'height', -1], ['left', 'width', 'top', 'height', 1],
    ['top', 'height', 'left', 'width', -1], ['top', 'height', 'left', 'width', 1],
  ]) {
    const neighbours = tiles.filter(r => r !== hole
      && near(sign < 0 ? r[axis] + r[size] : hole[axis] + hole[size], sign < 0 ? hole[axis] : r[axis])
      && Math.max(r[cross], hole[cross]) < Math.min(r[cross] + r[crossSize], hole[cross] + hole[crossSize]) - 0.001)
      .sort((a, b) => a[cross] - b[cross]);
    let end = hole[cross];
    if (!neighbours.length || !neighbours.every(r => {
      const aligned = near(r[cross], end); end = r[cross] + r[crossSize]; return aligned;
    }) || !near(end, hole[cross] + hole[crossSize])) continue;
    for (const r of neighbours) {
      r[size] += hole[size];
      if (sign > 0) r[axis] = hole[axis];
    }
    tiles.splice(tiles.indexOf(hole), 1);
    return true;
  }
  return false;
}

// Interlocking spans can have no complete adjacent side. Repack only the
// intersecting row band, in reading order; rows outside that band stay exact.
function repackBand(tiles, hole, minimum) {
  let frame = { ...hole }, band, previous;
  do {
    previous = `${frame.top}:${frame.height}`;
    band = tiles.filter(r => r.top < frame.top + frame.height - 0.001 && r.top + r.height > frame.top + 0.001);
    frame = bounds(band);
  } while (previous !== `${frame.top}:${frame.height}`);
  if (!closed(band)) return false; // Freely drawn, separate cells keep their authored empty space.
  const kept = band.filter(r => !r.removed).sort((a, b) => a.top - b.top || a.left - b.left);
  const maxColumns = Math.floor((frame.width + 0.001) / minimum.width), maxRows = Math.floor((frame.height + 0.001) / minimum.height);
  if (!kept.length || !maxColumns || !maxRows || maxColumns * maxRows < kept.length) return false;
  const rows = Math.max(Math.ceil(kept.length / maxColumns),
    Math.min(kept.length, maxRows, Math.round(Math.sqrt(kept.length * frame.height / frame.width))));
  const edge = (extent, index, count) => index === count ? extent : Math.round(extent * index / count);
  let index = 0;
  for (let row = 0; row < rows; row++) {
    const count = Math.ceil((kept.length - index) / (rows - row));
    const top = frame.top + edge(frame.height, row, rows), bottom = frame.top + edge(frame.height, row + 1, rows);
    for (let column = 0; column < count; column++) {
      const left = frame.left + edge(frame.width, column, count), right = frame.left + edge(frame.width, column + 1, count);
      Object.assign(kept[index++], { left, top, width: right - left, height: bottom - top });
    }
  }
  for (const r of band.filter(r => r.removed)) tiles.splice(tiles.indexOf(r), 1);
  return true;
}

export function fillDeletedReceptionCells(previous, candidate) {
  const survivors = new Set(candidate.cells.map(cell => cell.id));
  if (!survivors.size || previous.cells.every(cell => survivors.has(cell.id))) return candidate;
  const { gap } = receptionBentoSettings(previous);
  const tiles = previous.cells.map(cell => {
    const frame = receptionModuleWindow(survivors.has(cell.id) ? candidate : previous, cell.id);
    return { ...frame, id: cell.id, removed: !survivors.has(cell.id), width: frame.width + gap, height: frame.height + gap };
  });
  let progress;
  do {
    progress = false;
    for (const hole of tiles.filter(r => r.removed)) if (tiles.includes(hole) && absorb(tiles, hole)) progress = true;
  } while (progress && tiles.some(r => r.removed));
  for (const hole of tiles.filter(r => r.removed)) if (tiles.includes(hole)) repackBand(tiles, hole,
    { width: MIN_RECEPTION_CELL_SIZE.width + gap, height: MIN_RECEPTION_CELL_SIZE.height + gap });
  return tiles.filter(r => !r.removed).reduce((next, r) => withReceptionModuleWindow(next, r.id,
    { left: r.left, top: r.top, width: r.width - gap, height: r.height - gap }), candidate);
}
