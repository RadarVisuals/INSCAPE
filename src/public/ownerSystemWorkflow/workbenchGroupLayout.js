import { workbenchSelectionBounds } from './workbenchViewScale.js';

// Derived presentation only: stable order, uniform scaling, and constant gaps.
// Natural row heights keep small artworks together instead of reserving tall,
// empty cells. Module frames are immutable inputs, including on narrow screens.
export function workbenchGroupLayout(items, anchor, viewportWidth) {
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
  let top = anchor.top;
  for (const row of rows) {
    let left = anchor.left + (width - row.width) / 2;
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

export function compactWorkbenchGroupRectangles(ids, position) {
  return Object.fromEntries(ids.map((id, index) => [id, { left: position.left + 18 + Math.min(index, 3) * 3,
    top: position.top + 28 + Math.min(index, 3) * 3, width: 128, height: 96 }]));
}
