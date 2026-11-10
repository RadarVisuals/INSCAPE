import { MAX_SHAPES } from '../shapes/shapes.js';
import { validWorkbenchArea, workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { RECEPTION_CELL_LIMIT, MIN_RECEPTION_CELL_SIZE, withReceptionModuleWindow, receptionCellResizeReason } from './receptionEditorDocument.js';

export const RECEPTION_LAYOUT_DEFAULTS = Object.freeze({ width: 1440, height: 900, columns: 3, rows: 2, gap: 24, padding: 24, radius: 0 });
const occupied = cell => cell.members.length > 0 || Boolean(cell.content);
export const receptionLayoutCountRange = value => ({
  min: Math.max(1, value.cells.filter(occupied).length),
  max: Math.min(RECEPTION_CELL_LIMIT, MAX_SHAPES - value.shapes.length + value.cells.length),
});

export function validateReceptionBentoGeometry(settings) {
  for (const [key, label, min, max] of [['width', 'Width', 320, 16384], ['height', 'Height', 320, 16384],
    ['gap', 'Gap', 0, 256], ['padding', 'Outer margin', 0, 256]]) {
    if (!Number.isInteger(settings[key]) || settings[key] < min || settings[key] > max)
      throw new Error(`${label} must be a whole number between ${min} and ${max} px.`);
  }
}
// A seed keeps proportions stable while settings change. Rows and columns are
// explicit; only applying the proposal creates authored rectangles.
export function generateReceptionLayout(settings, seed = 1) {
  const { width, height, columns, rows, gap, padding, radius } = settings, count = columns * rows;
  validateReceptionBentoGeometry(settings);
  for (const [label, value] of [['Columns', columns], ['Rows', rows]]) {
    if (!Number.isInteger(value) || value < 1 || value > RECEPTION_CELL_LIMIT)
      throw new Error(`${label} must be a whole number between 1 and ${RECEPTION_CELL_LIMIT}.`);
  }
  if (count > RECEPTION_CELL_LIMIT) throw new Error(`Use at most ${RECEPTION_CELL_LIMIT} cells in total (columns × rows).`);
  if (!Number.isFinite(radius) || radius < 0 || radius > 160) throw new Error('Choose a corner radius between 0 and 160 pixels.');
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const innerWidth = width - 2 * padding, innerHeight = height - 2 * padding;
  const maxColumns = Math.floor((innerWidth + gap) / (MIN_RECEPTION_CELL_SIZE.width + gap));
  const maxRows = Math.floor((innerHeight + gap) / (MIN_RECEPTION_CELL_SIZE.height + gap));
  if (columns > maxColumns || rows > maxRows)
    throw new Error(`Use a larger canvas, fewer cells or less spacing. Each cell needs at least ${MIN_RECEPTION_CELL_SIZE.width} × ${MIN_RECEPTION_CELL_SIZE.height} pixels.`);
  const distribute = (total, amount, emphasis, minimum) => {
    const free = total - amount * minimum;
    const weights = Array.from({ length: amount }, (_, index) => (0.5 + random()) * (index === emphasis ? 2.4 : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    let used = 0;
    return weights.map((weight, index) => {
      const size = index === amount - 1 ? total - used : minimum + Math.floor(free * weight / sum);
      used += size; return size;
    });
  };
  const dominantRow = Math.floor(random() * rows);
  const heights = distribute(innerHeight - gap * (rows - 1), rows, dominantRow, MIN_RECEPTION_CELL_SIZE.height);
  const rectangles = [];
  let top = padding;
  heights.forEach(height => {
    const widths = distribute(innerWidth - gap * (columns - 1), columns, Math.floor(random() * columns), MIN_RECEPTION_CELL_SIZE.width);
    let left = padding;
    widths.forEach(cellWidth => { rectangles.push({ left, top, width: cellWidth, height }); left += cellWidth + gap; });
    top += height + gap;
  });
  return { width, height, radius, rectangles };
}

// Reuse occupied cells first, then empty cells in their existing reading order.
// Artwork records stay intact; the normal cell reconciler carries their geometry.
export function applyReceptionLayout(value, settings, seed) {
  const layout = generateReceptionLayout(settings, seed), range = receptionLayoutCountRange(value), count = layout.rectangles.length;
  if (count < range.min) throw new Error(`Keep at least ${range.min} cells to retain their content.`);
  if (count > range.max) throw new Error(`There is room for ${range.max} cells alongside your other shapes.`);
  let emptySlots = count - value.cells.filter(occupied).length;
  const cells = value.cells.filter(cell => occupied(cell) || emptySlots-- > 0);
  const removed = new Set(value.cells.filter(cell => !cells.includes(cell)).map(cell => cell.id));
  const area = { ...workbenchArea(value.workbench), width: layout.width, height: layout.height };
  if (!validWorkbenchArea(area)) throw new Error('This size extends beyond the canvas editing limits.');
  let next = { ...value,
    bento: { gap: settings.gap, padding: settings.padding }, cells: [...cells], shapes: value.shapes.filter(shape => !removed.has(shape.id)),
    workbench: { ...value.workbench, area, shapes: value.workbench.shapes.filter(shape => !removed.has(shape.id)) },
    ...(value.arrangement ? { arrangement: { groups: [] } } : {}) };
  while (next.cells.length < count) {
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
