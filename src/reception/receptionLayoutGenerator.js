import { MAX_SHAPES, validShapeOutline } from '../shapes/shapes.js';
import { validWorkbenchArea, workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { RECEPTION_CELL_LIMIT, MIN_RECEPTION_CELL_SIZE, withReceptionModuleWindow, receptionCellResizeReason } from './receptionEditorDocument.js';

export const RECEPTION_LAYOUT_DEFAULTS = Object.freeze({ width: 1440, height: 900, count: 6, gap: 24, padding: 24, radius: 0 });
const MIN_CELL_SIZE = MIN_RECEPTION_CELL_SIZE;
const occupied = cell => cell.members.length > 0 || Boolean(cell.content);
export const receptionLayoutCountRange = value => ({
  min: Math.max(1, value.cells.filter(occupied).length),
  max: Math.min(RECEPTION_CELL_LIMIT, MAX_SHAPES - value.shapes.length + value.cells.length),
});

// A seed keeps the proposal stable while settings change. Only applying its
// rectangles creates authored state. Spacing persists for subsequent bento edits;
// the seed and temporary proposals never enter the document.
export function generateReceptionLayout(settings, seed = 1) {
  const { width, height, count, gap, padding, radius } = settings;
  if (![width, height].every(value => Number.isInteger(value) && value >= 320 && value <= 16384))
    throw new Error('Choose a width and height between 320 and 16384 pixels.');
  if (!Number.isInteger(count) || count < 1 || count > RECEPTION_CELL_LIMIT)
    throw new Error(`Choose between 1 and ${RECEPTION_CELL_LIMIT} cells.`);
  if (![gap, padding].every(value => Number.isInteger(value) && value >= 0 && value <= 256))
    throw new Error('Choose spacing and outer margin between 0 and 256 pixels.');
  if (!Number.isFinite(radius) || radius < 0 || radius > 160) throw new Error('Choose a corner radius between 0 and 160 pixels.');
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const innerWidth = width - 2 * padding, innerHeight = height - 2 * padding;
  const maxColumns = Math.floor((innerWidth + gap) / (MIN_CELL_SIZE + gap));
  const maxRows = Math.floor((innerHeight + gap) / (MIN_CELL_SIZE + gap));
  if (maxColumns < 1 || maxRows < 1 || maxColumns * maxRows < count)
    throw new Error('Use a larger canvas, fewer cells or less spacing. Each cell needs at least 80 × 80 pixels.');
  const minRows = Math.ceil(count / maxColumns);
  const idealRows = Math.ceil(Math.sqrt(count * innerHeight / innerWidth));
  const preferredRows = Math.min(maxRows, Math.ceil(count / 4));
  const rows = Math.max(minRows, preferredRows, Math.min(count, maxRows, idealRows + Math.floor(random() * 3) - 1));
  const columns = Array(rows).fill(1);
  for (let remaining = count - rows; remaining > 0; remaining--) {
    const available = columns.map((size, index) => ({ size, index })).filter(row => row.size < maxColumns);
    const smallest = Math.min(...available.map(row => row.size));
    const candidates = available.filter(row => row.size <= smallest + 1);
    columns[candidates[Math.floor(random() * candidates.length)].index]++;
  }
  const distribute = (total, amount, emphasis) => {
    const free = total - amount * MIN_CELL_SIZE;
    const weights = Array.from({ length: amount }, (_, index) => (0.5 + random()) * (index === emphasis ? 2.4 : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    let used = 0;
    return weights.map((weight, index) => {
      const size = index === amount - 1 ? total - used : MIN_CELL_SIZE + Math.floor(free * weight / sum);
      used += size; return size;
    });
  };
  const dominantRow = Math.floor(random() * rows);
  const heights = distribute(innerHeight - gap * (rows - 1), rows, dominantRow);
  const rectangles = [];
  let top = padding;
  columns.forEach((amount, row) => {
    const widths = distribute(innerWidth - gap * (amount - 1), amount, Math.floor(random() * amount));
    let left = padding;
    widths.forEach(cellWidth => { rectangles.push({ left, top, width: cellWidth, height: heights[row] }); left += cellWidth + gap; });
    top += heights[row] + gap;
  });
  return { width, height, radius, rectangles };
}

// Reuse occupied cells first, then empty cells in their existing reading order.
// Artwork records stay intact; the normal cell reconciler carries their geometry.
export function applyReceptionLayout(value, settings, seed) {
  const layout = generateReceptionLayout(settings, seed), range = receptionLayoutCountRange(value);
  if (Object.hasOwn(settings, 'showFrame') && typeof settings.showFrame !== 'boolean') throw new Error('Choose whether to show the outer frame.');
  if (Object.hasOwn(settings, 'innerLines') && settings.innerLines !== null && !validShapeOutline(settings.innerLines)) throw new Error('Choose valid Outline settings for the inner lines.');
  if (settings.count < range.min) throw new Error(`Keep at least ${range.min} cells to retain their content.`);
  if (settings.count > range.max) throw new Error(`There is room for ${range.max} cells alongside your other shapes.`);
  let emptySlots = settings.count - value.cells.filter(occupied).length;
  const cells = value.cells.filter(cell => occupied(cell) || emptySlots-- > 0);
  const removed = new Set(value.cells.filter(cell => !cells.includes(cell)).map(cell => cell.id));
  const area = { ...workbenchArea(value.workbench), width: layout.width, height: layout.height };
  if (!validWorkbenchArea(area)) throw new Error('This size extends beyond the canvas editing limits.');
  let next = { ...value, ...(Object.hasOwn(settings, 'showFrame') ? { showFrame: settings.showFrame } : {}),
    ...(Object.hasOwn(settings, 'innerLines') ? { innerLines: settings.innerLines } : {}),
    bento: { gap: settings.gap, padding: settings.padding }, cells: [...cells], shapes: value.shapes.filter(shape => !removed.has(shape.id)),
    workbench: { ...value.workbench, area, shapes: value.workbench.shapes.filter(shape => !removed.has(shape.id)) },
    ...(value.arrangement ? { arrangement: { groups: [] } } : {}) };
  while (next.cells.length < settings.count) {
    const id = `shape:${crypto.randomUUID()}`;
    next.shapes.push({ id, name: `Cell ${next.cells.length + 1}`, color: '#808080', opacity: 0.25, visibility: 'PUBLIC' });
    next.cells.push({ id, members: [], mobile: { columns: 2, height: 240 } });
  }
  const placedCells = next.cells.map((cell, index) => {
    const frame = layout.rectangles[index];
    const reason = value.cells.some(old => old.id === cell.id) && receptionCellResizeReason(value, cell.id, frame);
    if (reason) throw new Error(reason);
    next = withReceptionModuleWindow(next, cell.id, { ...frame, left: area.left + frame.left, top: area.top + frame.top });
    return { ...cell, radius: value.cells.some(old => old.id === cell.id) ? cell.radius || 0 : layout.radius };
  });
  return { ...next, cells: placedCells };
}
