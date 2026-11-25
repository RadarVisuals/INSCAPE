// Responsive viewing only: authored desktop frames and image crops stay intact.
import { projectSystemWorkflowTransform } from '../systemWorkflow/systemWorkflowTransform.js';
import { projectCroppedMediaRectangle } from '../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle, alignContainedMediaRectangle } from '../lattice/rendering/latticeGeometry.js';
import { compositionMemberAnchor, editorCellWindow } from './editorCellGeometry.js';
import { inferCompositionTiling, tilingBounds } from './compositionTiling.js';
const frame = (value, id) => editorCellWindow(value.workbench, id, value);

export const COMPOSITION_READING_WIDTH = 220;

// Infer only presentation topology. Horizontal runs wrap locally; a vertical
// pair remains one item in that run. No saved rows, spans or breakpoints.
export function progressiveCompositionFrames(value, cells, scale, gap, heightFor) {
  const sourceGap = value.bento?.gap ?? 0;
  const sources = cells.map(cell => ({ id: cell.id, ...frame(value, cell.id) }));
  const wrapping = sources.some(r => r.width * scale < COMPOSITION_READING_WIDTH);
  if (!sources.length || !wrapping && !cells.some(cell => cell.singleLine)) return null;
  const tiles = sources.map(r => ({ ...r, width: r.width + sourceGap, height: r.height + sourceGap }));
  const tree = (!wrapping || value.stackOrder !== 'manual') && inferCompositionTiling(tiles);
  // Free/non-slicing layouts and explicit reading order still wrap in order.
  const root = tree || { axis: 'x', children: compositionReadingOrder(value, cells).map(cell => ({ id: cell.id })) };
  const byId = new Map(tiles.map(r => [r.id, r]));
  const children = (node, axis) => node.axis === axis
    ? node.children || [...children(node.first, axis), ...children(node.second, axis)] : [node];
  const bounds = node => node.id ? byId.get(node.id) : tilingBounds(
    (node.children || [node.first, node.second]).map(bounds));
  const ids = node => node.id ? [node.id] : (node.children || [node.first, node.second]).flatMap(ids);
  const result = {};
  const visit = (node, left, top, width) => {
    if (node.id) {
      const cell = cells.find(cell => cell.id === node.id);
      const height = cell.singleLine ? frame(value, cell.id).height
        : wrapping ? heightFor(cell, Math.max(1, width - gap)) : frame(value, cell.id).height * scale;
      result[node.id] = { left, top, width: Math.max(1, width - gap), height };
      return height + gap;
    }
    const items = children(node, node.axis);
    if (node.axis === 'y') {
      let height = 0;
      for (const child of items) height += visit(child, left, top + height, width);
      return height;
    }
    const weights = items.map(child => bounds(child).width);
    const unit = Math.min(...weights);
    const rows = []; let row = [], needed = 0;
    for (let i = 0; i < items.length; i++) {
      const minimum = Math.min(width, (COMPOSITION_READING_WIDTH + gap) * weights[i] / unit);
      if (row.length && needed + minimum > width + .001) { rows.push(row); row = []; needed = 0; }
      row.push({ child: items[i], weight: weights[i] }); needed += minimum;
    }
    if (row.length) rows.push(row);
    let height = 0;
    for (const row of rows) {
      const total = row.reduce((sum, item) => sum + item.weight, 0);
      let offset = 0, rowHeight = 0; const placed = [];
      for (const { child, weight } of row) {
        const share = width * weight / total;
        const occupied = visit(child, left + offset, top + height, share);
        rowHeight = Math.max(rowHeight, occupied); offset += share; placed.push({ child, occupied });
      }
      // Share the trailing boundary, including for vertical subgroups. Keep
      // the authored gutter rather than leaving holes under shorter items.
      for (const { child, occupied } of placed) {
        const factor = rowHeight / occupied;
        for (const id of ids(child)) {
          const r = result[id];
          r.top = top + height + (r.top - top - height) * factor;
          if (!cells.find(cell => cell.id === id).singleLine) r.height = Math.max(1, (r.height + gap) * factor - gap);
        }
      }
      height += rowHeight;
    }
    return height;
  };
  const extent = tilingBounds(tiles), area = value.workbench.area;
  const left = (extent.left - (area?.left ?? 0)) * scale, top = (extent.top - (area?.top ?? 0)) * scale;
  visit(root, left, top, (extent.width - sourceGap) * scale + gap);
  return result;
}

// Transparent layers form one visual group. Empty canvas to their right is
// not part of the artwork's intrinsic size when a row becomes a phone card.
export function responsiveCellArtwork(value, cell) {
  if (cell.content || cell.mobile.placements?.length) return null;
  if (!cell.members.some(id => value.imageModules.some(item => item.id === id))) return null;
  const ids = cell.members.filter(id => !id.startsWith('text:')
    && [...value.workbench.imageModules, ...value.workbench.shapes].some(item => item.id === id && item.open));
  if (!ids.length || cell.members.length === 1) return null;
  const frames = ids.map(id => frame(value, id));
  const left = Math.min(...frames.map(r => r.left)), top = Math.min(...frames.map(r => r.top));
  const width = Math.max(...frames.map(r => r.left + r.width)) - left;
  const height = Math.max(...frames.map(r => r.top + r.height)) - top;
  return { ids, left, top, width, height };
}

export function responsiveArtworkHeight(group, width) {
  return Math.max(80, Math.min(1200, group.height + 32, (Math.max(1, width - 32)) * group.height / group.width + 32));
}

export function responsiveArtworkFrames(group, frames, before, after) {
  // Retain the visual/text division in mixed cells; fit a visual-only group
  // to the full card. Preserve relative positions, proportions and layering.
  const text = Object.entries(frames).filter(([id]) => id.startsWith('text:')).map(([, r]) => r);
  const right = text.length ? Math.min(...text.map(r => r.left)) : before.left + before.width;
  const fraction = text.length ? Math.max(.25, Math.min(1, (right - before.left) / before.width)) : 1;
  const padding = Math.min(16, after.width / 8);
  const room = Math.max(1, after.width * fraction - padding * 2);
  const scale = Math.min(1, room / group.width, Math.max(1, after.height - 2 * padding) / group.height);
  const left = after.left + padding, top = after.top + (after.height - group.height * scale) / 2;
  return Object.fromEntries(group.ids.map(id => [id, { left: left + (frames[id].left - group.left) * scale,
    top: top + (frames[id].top - group.top) * scale, width: frames[id].width * scale, height: frames[id].height * scale }]));
}

export function compositionReadingOrder(value, cells) {
  return value.stackOrder === 'manual' ? cells : [...cells].sort((a, b) => {
    const first = frame(value, a.id), second = frame(value, b.id);
    return first.top - second.top || first.left - second.left;
  });
}

export function responsiveCellImage(value, cell) {
  if (cell.content || cell.members.length !== 1 || cell.mobile.placements?.length) return null;
  const image = value.imageModules.find(item => item.id === cell.members[0]);
  if (!image) return null;
  const source = frame(value, image.id), { asset: { media }, transform, crop } = image.artwork;
  const cellFrame = frame(value, cell.id);
  const projection = projectSystemWorkflowTransform(transform, media, crop);
  const anchor = compositionMemberAnchor(cell, [image.id]);
  const alignment = anchor?.members.length === 1 ? anchor : undefined;
  const painted = crop ? alignContainedMediaRectangle(source,
    projectCroppedMediaRectangle(source, projection.dimensions, projection.crop), alignment)
    : fitNativeMediaRectangle(source, projection.dimensions, alignment);
  const covers = r => r.left <= cellFrame.left + 1 && r.top <= cellFrame.top + 1
    && r.left + r.width >= cellFrame.left + cellFrame.width - 1
    && r.top + r.height >= cellFrame.top + cellFrame.height - 1;
  // A cell can crop an oversized, freely placed Image even when its own mode
  // is Fit. Test the painted media as well as its frame, so intentional margins
  // (including zoom below Fill) are not mistaken for an edge-to-edge crop.
  const fillsCell = cell.clipContent !== false && covers(source) && covers(painted);
  const ratio = fillsCell ? cellFrame.width / cellFrame.height : crop ? source.width / source.height
    : projection.dimensions.width / projection.dimensions.height;
  return { id: image.id, source, ratio, fillsCell };

}

export function responsiveImageHeight(image, width) {
  if (image.fillsCell) return Math.max(80, Math.min(1200, width / image.ratio));
  return Math.max(80, Math.min(1200, image.source.height + 32, (Math.max(1, width - 32)) / image.ratio + 32));
}

export function responsiveImageFrame(image, before, after) {
  if (image.fillsCell) {
    const source = image.source;
    const oversized = source.width > before.width + 1 || source.height > before.height + 1;
    if (!oversized) return { ...after };
    // Preserve the desktop crop made by the cell over a larger image frame.
    // Cover the new cell uniformly rather than revealing the complete source.
    const scale = Math.max(after.width / before.width, after.height / before.height);
    return { left: after.left + after.width / 2 + (source.left - before.left - before.width / 2) * scale,
      top: after.top + after.height / 2 + (source.top - before.top - before.height / 2) * scale,
      width: source.width * scale, height: source.height * scale };
  }
  // Stacked cells are at least 80 px tall; only tiny widths constrain padding.
  const padding = Math.min(16, after.width / 4);
  const height = Math.min(after.height - padding * 2, (after.width - padding * 2) / image.ratio);
  const width = height * image.ratio;
  const room = before.width - image.source.width;
  const alignment = image.ratio < 1 || room < 1 ? .5
    : Math.max(0, Math.min(1, (image.source.left - before.left) / room));
  return { left: after.left + padding + (after.width - padding * 2 - width) * alignment,
    top: after.top + (after.height - height) / 2, width, height };
}
