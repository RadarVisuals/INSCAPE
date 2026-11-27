import { workbenchSelectionBounds } from './workbenchViewScale.js';
import { WORKBENCH_GROUP_STACK_SIZE } from '../../systemWorkflow/domain/workbenchGroups.js';

// Derived presentation only: stable order, uniform scaling, and constant gaps.
// Natural row heights keep small artworks together instead of reserving tall,
// empty cells. Module frames are immutable inputs, including on narrow screens.
export function workbenchGroupLayout(items, anchor, viewportWidth, fromStack = false) {
  const columns = viewportWidth < 600 ? 1 : Math.min(4, Math.max(1, Math.ceil(Math.sqrt(items.length * 1.4))));
  const cell = { width: viewportWidth < 600 ? 320 : 440, height: 320 }, gap = 32;
  const rows = [];
  for (let start = 0; start < items.length; start += columns) {
    const members = items.slice(start, start + columns).map(item => {
      const factor = Math.min(1, cell.width / item.frame.width, cell.height / item.frame.height);
      return { ...item, factor, width: item.frame.width * factor, height: item.frame.height * factor };
    });
    rows.push({ members, width: members.reduce((sum, item) => sum + item.width, 0) + Math.max(0, members.length - 1) * gap,
      height: Math.max(...members.map(item => item.height)) });
  }
  const width = Math.max(0, ...rows.map(row => row.width)), transforms = {}, rectangles = {};
  const height = rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * gap;
  const leftEdge = fromStack ? anchor.left + (WORKBENCH_GROUP_STACK_SIZE.width - width) / 2 : anchor.left;
  let top = fromStack ? anchor.top + (WORKBENCH_GROUP_STACK_SIZE.height - height) / 2 : anchor.top;
  for (const row of rows) {
    let left = leftEdge + (width - row.width) / 2;
    for (const item of row.members) {
      const rect = { left, top: top + (row.height - item.height) / 2, width: item.width, height: item.height };
      rectangles[item.id] = rect;
      transforms[item.id] = { scale: item.factor, x: rect.left - item.frame.left * item.factor, y: rect.top - item.frame.top * item.factor };
      left += item.width + gap;
    }
    top += row.height + gap;
  }
  return { transforms, rectangles, bounds: workbenchSelectionBounds(Object.values(rectangles)) };
}

// Slot centres in the 180 × 136 Folio. Other members unfold from between the prints.
export function compactWorkbenchGroupRectangles(ids, position, previews) {
  return Object.fromEntries(ids.map(id => {
    const index = previews.findIndex(preview => preview.id === id);
    const centerX = previews.length === 2 && index >= 0 ? (index === 0 ? 56 : 128) : 90;
    return [id, { left: position.left + centerX - 37.5, top: position.top + 40, width: 75, height: 81 }];
  }));
}
