import { projectReceptionMember } from './editorCellGeometry.js';
import { validShapes, validShapeOutline, projectShapes, restoreShapes, MAX_SHAPES } from '../shapes/shapes.js';
import { validImageModules, projectImageModules, restoreImageModules, IMAGE_SIZE_LIMITS } from '../imageModule/imageModule.js';
import { validTextModules, projectTextModules, restoreTextModules } from '../text/domain/article.js';
import { createDefaultWorkbenchPresentation, isValidWorkbenchPresentation, TEXT_WINDOW_LIMITS, SHAPE_WINDOW_LIMITS } from '../profileDocument/domain/workbenchPresentation.js';
import { validReceptionLinks } from '../profileDocument/domain/receptionLinks.js';
import { artworkLayers, layerIds, validArtworkLayers, reconcileArtworkLayers } from '../systemWorkflow/domain/artworkLayers.js';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { validReceptionArrangement, pruneReceptionArrangement } from './receptionArrangement.js';
import { MIN_CROP_PROJECTION_ZOOM } from '../lattice/rendering/latticeCrop.js';

export const RECEPTION_CELL_LIMIT = 16;
export const MIN_RECEPTION_CELL_SIZE = 80;
export const receptionModuleLimits = id => id.startsWith('image:') ? IMAGE_SIZE_LIMITS
  : id.startsWith('text:') ? TEXT_WINDOW_LIMITS : SHAPE_WINDOW_LIMITS;
export function receptionModuleSizeReason(id, frame) {
  const limits = receptionModuleLimits(id);
  const name = id.startsWith('image:') ? 'Image' : id.startsWith('text:') ? 'Text' : 'Shape';
  return ['width', 'height'].some(axis => !Number.isFinite(frame[axis])
    || frame[axis] < limits[axis === 'width' ? 'minimumWidth' : 'minimumHeight']
    || frame[axis] > limits[axis === 'width' ? 'maximumWidth' : 'maximumHeight'])
    ? `${name} needs a frame between ${limits.minimumWidth} × ${limits.minimumHeight} and ${limits.maximumWidth} × ${limits.maximumHeight} px. Enlarge the cell or resize its contents first.` : null;
}

// Bound the cell by the proportional size of every native member. Empty cells
// retain their smaller minimum; native Text/Image validators remain authoritative.
export function receptionCellSizeLimits(value, id) {
  const frame = receptionModuleWindow(value, id);
  const limits = { ...SHAPE_WINDOW_LIMITS, minimumWidth: MIN_RECEPTION_CELL_SIZE, minimumHeight: MIN_RECEPTION_CELL_SIZE };
  for (const member of value.cells.find(cell => cell.id === id)?.members || []) {
    const content = receptionModuleWindow(value, member), native = receptionModuleLimits(member);
    if (!content) continue;
    for (const [axis, minimum, maximum] of [['width', 'minimumWidth', 'maximumWidth'], ['height', 'minimumHeight', 'maximumHeight']]) {
      limits[minimum] = Math.max(limits[minimum], native[minimum] * frame[axis] / content[axis]);
      limits[maximum] = Math.min(limits[maximum], native[maximum] * frame[axis] / content[axis]);
    }
  }
  return limits;
}
export function receptionCellResizeReason(value, id, nextFrame) {
  const frame = receptionModuleWindow(value, id);
  for (const member of value.cells.find(cell => cell.id === id)?.members || []) {
    const content = receptionModuleWindow(value, member);
    if (!content) continue;
    const reason = receptionModuleSizeReason(member, projectReceptionMember(frame, nextFrame, content));
    if (reason) return reason;
  }
  return receptionModuleSizeReason(id, nextFrame);
}
const keys = ['shapes', 'imageModules', 'texts'];
const builtins = new Set(['profile', 'links', 'introduction', 'details']);
const exact = (v, required, optional = []) => v && typeof v === 'object' && !Array.isArray(v)
  && required.every(key => Object.hasOwn(v, key)) && Object.keys(v).every(key => [...required, ...optional].includes(key));
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const idsOf = value => keys.flatMap(key => value[key].map(item => item.id));
const validWindow = v => exact(v, ['left', 'top', 'width', 'height']) && number(v.left, -16384, 16384)
  && number(v.top, -16384, 16384) && number(v.width, 1, 16384) && number(v.height, 1, 16384);

// Native Image dimensions belong to the image record; Text/Shape dimensions
// belong to their existing Workbench presentation. There is no second cell rect.
export function receptionModuleWindow(value, id) {
  const image = value.imageModules?.find(item => item.id === id);
  if (image) {
    const placement = value.workbench.imageModules?.find(item => item.id === id);
    return placement ? { ...placement.position, width: image.width, height: image.height } : null;
  }
  return value.workbench.shapes?.find(item => item.id === id)?.window || value.workbench.texts?.find(item => item.id === id)?.window || null;
}
export function withReceptionModuleWindow(value, id, window) {
  if (!validWindow(window)) throw new Error('Choose a valid layer position and size.');
  const reason = receptionModuleSizeReason(id, window);
  if (reason) throw new Error(reason);
  const key = keys.find(key => value[key]?.some(item => item.id === id));
  if (!key) throw new Error('This layer is no longer available.');
  const image = key === 'imageModules';
  const previous = value.workbench[key]?.find(item => item.id === id) || { id, open: true };
  const placement = image ? { ...previous, position: { left: window.left, top: window.top } } : { ...previous, window: { ...window } };
  return { ...value, ...(image ? { imageModules: value.imageModules.map(item => item.id === id
    ? { ...item, width: Math.round(window.width), height: Math.round(window.height) } : item) } : {}),
  workbench: { ...value.workbench, [key]: [...(value.workbench[key] || []).filter(item => item.id !== id), placement] } };
}
export function validReceptionEditorDocument(value, published = false) {
  if (!exact(value, ['version', 'branding', 'workbench', 'imageModules', 'texts', 'shapes', 'artworkLayers', 'cells'], ['surface', 'links', 'arrangement', 'bento', 'showFrame', 'innerLines'])
    || value.version !== 3 || !isValidWorkbenchPresentation(value.workbench)
    || !validShapes(value.shapes, published) || !validImageModules(value.imageModules, published, { minimumCropZoom: MIN_CROP_PROJECTION_ZOOM })
    || !validTextModules(value.texts, published) || value.texts.some(item => item.sceneLink || item.pagination)
    || value.workbench.texts?.some(item => Object.hasOwn(item, 'frames'))
    || !validArtworkLayers(value.artworkLayers, value, published)
    || !exact(value.branding, ['name', 'logo']) || typeof value.branding.name !== 'string' || value.branding.name.length > 64
    || /[\u0000-\u001f\u007f]/u.test(value.branding.name) || value.branding.logo !== null && !value.imageModules.some(item => item.id === value.branding.logo)
    || Object.hasOwn(value, 'surface') && value.surface !== null && !/^#[0-9a-f]{6}$/iu.test(value.surface)
    || Object.hasOwn(value, 'links') && !validReceptionLinks(value.links)
    || Object.hasOwn(value, 'showFrame') && typeof value.showFrame !== 'boolean'
    || Object.hasOwn(value, 'innerLines') && value.innerLines !== null && !validShapeOutline(value.innerLines)
    || Object.hasOwn(value, 'bento') && (!exact(value.bento, ['gap', 'padding']) || ![value.bento.gap, value.bento.padding].every(n => Number.isInteger(n) && number(n, 0, 256)))
    || !Array.isArray(value.cells) || value.cells.length > 32) return false;
  if (['miniApps', 'displays', 'keeperDocks'].some(key => value.workbench[key]?.length)) return false;
  const all = new Set(idsOf(value)), cellIds = new Set(), members = new Set();
  for (const key of keys) {
    const placed = value.workbench[key] || [];
    if (placed.length !== value[key].length || placed.some(item => !value[key].some(record => record.id === item.id))) return false;
  }
  for (const cell of value.cells) {
    if (!exact(cell, ['id', 'members', 'mobile'], ['radius', 'content', 'contentLayout', 'lockedMembers']) || cellIds.has(cell.id)
      || !value.shapes.some(item => item.id === cell.id && !item.kind) || !Array.isArray(cell.members)
      || Object.hasOwn(cell, 'radius') && !number(cell.radius, 0, 160)
      || Object.hasOwn(cell, 'content') && cell.content !== null && !builtins.has(cell.content) && !value.links?.some(link => link.id === cell.content)
      || !exact(cell.mobile, ['columns', 'height'], ['placements', 'referenceWidth']) || ![1, 2].includes(cell.mobile.columns)
      || Object.hasOwn(cell.mobile, 'referenceWidth') && !number(cell.mobile.referenceWidth, 1, 16384)
      || !Number.isInteger(cell.mobile.height) || !number(cell.mobile.height, 80, 1200)) return false;
    cellIds.add(cell.id);
    if (Object.hasOwn(cell, 'contentLayout') && (!exact(cell.contentLayout, ['padding', 'alignX', 'alignY'])
      || !number(cell.contentLayout.padding, 0, 128) || !['left', 'center', 'right'].includes(cell.contentLayout.alignX)
      || !['top', 'center', 'bottom'].includes(cell.contentLayout.alignY))) return false;
    for (const id of cell.members) {
      if (!all.has(id) || id === cell.id || members.has(id)) return false;
      members.add(id);
    }
    if (Object.hasOwn(cell, 'lockedMembers') && (!Array.isArray(cell.lockedMembers) || new Set(cell.lockedMembers).size !== cell.lockedMembers.length
      || cell.lockedMembers.some(id => !cell.members.includes(id)))) return false;
    if (Object.hasOwn(cell.mobile, 'placements')) {
      const placed = new Set();
      if (!Array.isArray(cell.mobile.placements)) return false;
      for (const item of cell.mobile.placements) {
        if (!exact(item, ['id', 'window']) || !cell.members.includes(item.id) || placed.has(item.id) || !validWindow(item.window)) return false;
        placed.add(item.id);
      }
    }
  }
  if ([...cellIds].some(id => members.has(id))) return false;
  return !Object.hasOwn(value, 'arrangement') || validReceptionArrangement(value.arrangement, value.cells);
}
export function assertReceptionEditorDocument(value) {
  if (!validReceptionEditorDocument(value)) throw new Error('The Reception cells or artwork are invalid. Your saved work is unchanged.');
  return value;
}
const filterLayout = (workbench, allowed) => ({ ...workbench, ...Object.fromEntries(keys.map(key => [key, (workbench[key] || []).filter(item => allowed.has(item.id))])) });
const privateCells = value => value.cells.filter(cell => value.shapes.find(item => item.id === cell.id)?.visibility === 'PRIVATE');
const pruneCellMembers = (cell, allowed) => ({ ...cell, members: cell.members.filter(id => allowed.has(id)),
  ...(cell.lockedMembers ? { lockedMembers: cell.lockedMembers.filter(id => allowed.has(id)) } : {}),
  mobile: { ...cell.mobile, ...(cell.mobile.placements ? { placements: cell.mobile.placements.filter(item => allowed.has(item.id)) } : {}) } });
export function projectReceptionEditorDocument(value) {
  const hidden = new Set(privateCells(value).flatMap(cell => [cell.id, ...cell.members]));
  const project = (items, fn) => fn(items.filter(item => !hidden.has(item.id)).map(item => ({ ...item, visibility: item.visibility || 'PUBLIC' })));
  const records = { shapes: project(value.shapes, projectShapes), imageModules: project(value.imageModules, projectImageModules), texts: project(value.texts, projectTextModules) };
  const allowed = new Set(idsOf(records));
  const cells = value.cells.filter(cell => allowed.has(cell.id)).map(cell => pruneCellMembers(cell, allowed));
  return structuredClone({ ...value, ...records, cells, workbench: filterLayout(value.workbench, allowed),
    artworkLayers: layerIds(artworkLayers(value)).filter(id => allowed.has(id)),
    ...(value.arrangement ? { arrangement: pruneReceptionArrangement(value.arrangement, cells.map(cell => cell.id)) } : {}),
    branding: { ...value.branding, logo: allowed.has(value.branding.logo) ? value.branding.logo : null },
    ...(value.links ? { links: value.links.filter(link => cells.some(cell => cell.content === link.id)) } : {}) });
}
export const restoreReceptionEditorDocument = value => ({ ...structuredClone(value), shapes: restoreShapes(value.shapes),
  imageModules: restoreImageModules(value.imageModules), texts: restoreTextModules(value.texts) });

export function createReceptionEditorDocument(value, { width = 1440 } = {}) {
  if (value?.version === 3) return assertReceptionEditorDocument(structuredClone(value));
  const workbench = createDefaultWorkbenchPresentation();
  workbench.display.open = false; workbench.display.shortcut.visible = false;
  workbench.area = { left: 0, top: 0, width: Math.round(width), height: value?.height || 900 };
  for (const key of keys) workbench[key] = [];
  let next = { version: 3, branding: { name: value?.branding.name || '', logo: value?.branding.logo || null }, workbench,
    imageModules: structuredClone(value?.imageModules || []), texts: structuredClone(value?.texts || []), shapes: structuredClone(value?.shapes || []), artworkLayers: [], cells: [],
    ...(Object.hasOwn(value || {}, 'surface') ? { surface: value.surface } : {}), ...(value?.links ? { links: structuredClone(value.links) } : {}) };
  if (!value) return next;
  if (next.shapes.length + value.regions.length > MAX_SHAPES) throw new Error('This Reception needs more shapes than the Editor supports. Your existing Reception is unchanged.');
  const remap = new Map(), ordered = value.mobile.map(item => value.regions.find(region => region.id === item.id));
  for (const region of ordered) {
    let id = `shape:cell-${region.id.slice(7, 72)}`;
    if (next.shapes.some(item => item.id === id)) id = `shape:${crypto.randomUUID()}`;
    remap.set(region.id, id);
    const gutter = value.arrangement ? 0 : value.gutter;
    const frame = { left: region.x / 10000 * (width + gutter), top: region.y / 10000 * (value.height + gutter),
      width: Math.max(8, region.width / 10000 * (width + gutter) - gutter), height: Math.max(8, region.height / 10000 * (value.height + gutter) - gutter) };
    const color = region.surface || value.surface || '#171717';
    next.shapes.push({ id, name: `Cell ${next.cells.length + 1}`, color, opacity: region.surface || value.surface ? 1 : 0, visibility: 'PUBLIC' });
    next = withReceptionModuleWindow(next, id, frame);
    const mobile = value.mobile.find(item => item.id === region.id), members = region.scene ? region.scene.placements.map(item => item.id)
      : idsOf(next).includes(region.content) ? [region.content] : [];
    const cell = { id, members, mobile: { columns: mobile.columns, height: mobile.height }, radius: value.radius,
      ...(region.content && !members.length ? { content: region.content, contentLayout: {
        padding: region.padding ?? value.padding, alignX: region.alignX, alignY: region.alignY } } : {}) };
    const padding = region.scene || next.imageModules.some(image => image.id === region.content) ? 0 : region.padding ?? (members.length ? 24 : value.padding);
    for (const member of members) {
      const placement = region.scene?.placements.find(item => item.id === member), grid = region.scene?.geometry;
      const rect = placement ? { left: frame.left + placement.column / grid.columns * frame.width, top: frame.top + placement.row / grid.rows * frame.height,
        width: placement.columnSpan / grid.columns * frame.width, height: placement.rowSpan / grid.rows * frame.height }
        : { left: frame.left + padding, top: frame.top + padding, width: Math.max(1, frame.width - 2 * padding), height: Math.max(1, frame.height - 2 * padding) };
      next = withReceptionModuleWindow(next, member, rect);
    }
    if (region.scene?.mobile) {
      cell.mobile.referenceWidth = mobile.columns === 2 ? 390 : 189;
      cell.mobile.placements = region.scene.mobile.map(item => ({ id: item.id, window: {
        left: item.column / region.scene.geometry.columns * cell.mobile.referenceWidth, top: item.row / region.scene.geometry.rows * mobile.height,
        width: item.columnSpan / region.scene.geometry.columns * cell.mobile.referenceWidth, height: item.rowSpan / region.scene.geometry.rows * mobile.height } }));
    }
    const locked = region.scene?.placements.filter(item => item.locked).map(item => item.id);
    if (locked?.length) cell.lockedMembers = locked;
    next.cells.push(cell); next.artworkLayers.push(id, ...members);
  }
  for (const key of keys) for (const record of next[key]) if (!next.workbench[key].some(item => item.id === record.id)) {
    const frame = { left: 0, top: 0, width: key === 'texts' ? 320 : record.width || 288, height: key === 'texts' ? 240 : record.height || 288 };
    next = withReceptionModuleWindow(next, record.id, frame);
    next.workbench[key] = next.workbench[key].map(item => item.id === record.id ? { ...item, open: false } : item);
    next.artworkLayers.push(record.id);
  }
  if (value.arrangement) next.arrangement = { groups: value.arrangement.groups.map(group => ({ ...group, members: group.members.map(id => remap.get(id)),
    gapX: Math.round(group.gapX / 10000 * width), gapY: Math.round(group.gapY / 10000 * value.height) })) };
  return assertReceptionEditorDocument(next);
}

// Deleting content prunes membership; changing a cell rect carries untouched
// children once. Explicit child transforms from a group gesture win unchanged.
export function reconcileReceptionCells(previous, candidate, { resizeContents = true } = {}) {
  let next = reconcileArtworkLayers(previous, candidate);
  const available = new Set(idsOf(next));
  next = { ...next, cells: next.cells.filter(cell => next.shapes.some(shape => shape.id === cell.id)).map(cell => pruneCellMembers(cell, available)) };
  // Removing a private background keeps its native content and effective privacy.
  // Explicit membership changes and merges into surviving cells retain their flags.
  const contained = new Set(next.cells.flatMap(cell => cell.members));
  const newlyIndependentPrivate = new Set(privateCells(previous).filter(cell => !available.has(cell.id))
    .flatMap(cell => cell.members).filter(id => !contained.has(id)));
  if (newlyIndependentPrivate.size) for (const key of keys) {
    next[key] = next[key].map(item => newlyIndependentPrivate.has(item.id) ? { ...item, visibility: 'PRIVATE' } : item);
  }
  if (next.arrangement) next.arrangement = pruneReceptionArrangement(next.arrangement, next.cells.map(cell => cell.id));
  for (const cell of next.cells) {
    const before = receptionModuleWindow(previous, cell.id), after = receptionModuleWindow(next, cell.id);
    if (!resizeContents || !before || !after || same(before, after)) continue;
    for (const id of cell.members) {
      const old = receptionModuleWindow(previous, id), current = receptionModuleWindow(next, id);
      if (!old || !same(old, current)) continue;
      next = withReceptionModuleWindow(next, id, projectReceptionMember(before, after, old));
    }
  }
  if (!available.has(next.branding.logo)) next.branding = { ...next.branding, logo: null };
  return assertReceptionEditorDocument(next);
}

export function receptionResponsiveLayout(value, viewportWidth) {
  const area = workbenchArea(value.workbench), mobile = viewportWidth <= 640;
  // A wider screen gives the authored canvas room; it does not magnify it.
  // Keep the viewport separate so centering a small canvas cannot select the
  // phone layout merely because its own authored width is below the breakpoint.
  const width = Math.min(viewportWidth, area.width), scale = width / area.width;
  const open = id => keys.some(key => value.workbench[key]?.some(item => item.id === id && item.open));
  const hidden = new Set(value.cells.filter(cell => !open(cell.id)).flatMap(cell => [cell.id, ...cell.members]));
  const windows = Object.fromEntries(idsOf(value).filter(id => open(id) && !hidden.has(id)).map(id => {
    const rect = receptionModuleWindow(value, id);
    return [id, { left: (rect.left - area.left) * scale, top: (rect.top - area.top) * scale, width: rect.width * scale, height: rect.height * scale }];
  }));
  let bottom = 0, rowTop = 0, column = 0, rowHeight = 0;
  const gap = Math.min(12, Math.max(0, width - 2));
  const cells = value.cells.filter(cell => open(cell.id)).map(cell => {
    const original = receptionModuleWindow(value, cell.id);
    let window = windows[cell.id];
    if (mobile) {
      const columns = cell.mobile.columns;
      if (column + columns > 2) { rowTop += rowHeight + gap; column = 0; rowHeight = 0; }
      window = { left: column * (width + gap) / 2, top: rowTop, width: columns === 2 ? width : (width - gap) / 2, height: cell.mobile.height };
      column += columns; rowHeight = Math.max(rowHeight, window.height); bottom = Math.max(bottom, window.top + window.height);
      if (column === 2) { rowTop += rowHeight + gap; column = 0; rowHeight = 0; }
      windows[cell.id] = window;
      for (const id of cell.members) {
        if (!windows[id]) continue;
        const rect = receptionModuleWindow(value, id), override = cell.mobile.placements?.find(item => item.id === id)?.window;
        const overrideScale = window.width / (cell.mobile.referenceWidth || (cell.mobile.columns === 2 ? 390 : 189));
        windows[id] = override ? { left: window.left + override.left * overrideScale, top: window.top + override.top * overrideScale,
          width: override.width * overrideScale, height: override.height * overrideScale }
          : { left: window.left + (rect.left - original.left) / original.width * window.width,
            top: window.top + (rect.top - original.top) / original.height * window.height,
            width: rect.width / original.width * window.width, height: rect.height / original.height * window.height };
      }
    }
    return { ...cell, radius: (cell.radius || 0) * (mobile ? 1 : scale), window };
  });
  const contained = new Set(value.cells.flatMap(cell => [cell.id, ...cell.members]));
  const freeBottom = Math.max(0, ...Object.entries(windows).filter(([id]) => !contained.has(id)).map(([, rect]) => rect.top + rect.height));
  return { viewportWidth, width, height: mobile && cells.length ? Math.max(bottom, freeBottom) : area.height * scale, scale, windows, cells, mobile };
}
