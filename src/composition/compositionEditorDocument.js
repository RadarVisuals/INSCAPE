import { compositionArtworkFields } from '../systemWorkflow/domain/retiredInterfaceAppearance.js';
import { validSlides, pruneSwipeLinks } from './cellSlides.js';
import { compositionReadingOrder, progressiveCompositionFrames, COMPOSITION_READING_WIDTH, responsiveCellImage, responsiveImageHeight, responsiveImageFrame,
  responsiveCellArtwork, responsiveArtworkHeight, responsiveArtworkFrames } from './compositionResponsiveImages.js';
import { MIN_COMPOSITION_CELL_SIZE, editorCellWindow, projectCompositionCellMembers, positionCompositionMembers, compositionMemberAnchor } from './editorCellGeometry.js';
import { validShapes, validShapeOutline, projectShapes, restoreShapes } from '../shapes/shapes.js';
import { validImageModules, projectImageModules, restoreImageModules, imageSizeLimits } from '../imageModule/imageModule.js';
import { validTextModules, projectTextModules, restoreTextModules, exact } from '../text/domain/article.js';
import { createDefaultWorkbenchPresentation, isValidWorkbenchPresentation, TEXT_WINDOW_LIMITS, CELL_TEXT_WINDOW_LIMITS, SHAPE_WINDOW_LIMITS } from '../profileDocument/domain/workbenchPresentation.js';
import { validCompositionLinks } from '../profileDocument/domain/compositionLinks.js';
import { artworkLayers, layerIds, validArtworkLayers, reconcileArtworkLayers } from '../systemWorkflow/domain/artworkLayers.js';
import { workbenchArea } from '../systemWorkflow/domain/workbenchArea.js';
import { validCompositionArrangement, pruneCompositionArrangement } from './compositionArrangement.js';
import { MIN_CROP_PROJECTION_ZOOM } from '../lattice/rendering/latticeCrop.js';

export const COMPOSITION_CELL_LIMIT = 16;
export { MIN_COMPOSITION_CELL_SIZE };
export function compositionModuleLimits(id, inCell = true) {
  if (id.startsWith('text:')) return inCell ? CELL_TEXT_WINDOW_LIMITS : TEXT_WINDOW_LIMITS;
  return id.startsWith('image:') ? imageSizeLimits(inCell) : SHAPE_WINDOW_LIMITS;
}
export function compositionModuleSizeReason(id, frame, inCell = true) {
  const limits = compositionModuleLimits(id, inCell);
  const name = id.startsWith('image:') ? 'Image' : id.startsWith('text:') ? 'Text' : 'Shape';
  return ['width', 'height'].some(axis => !Number.isFinite(frame[axis])
    || frame[axis] < limits[axis === 'width' ? 'minimumWidth' : 'minimumHeight']
    || frame[axis] > limits[axis === 'width' ? 'maximumWidth' : 'maximumHeight'])
    ? `${name} needs a frame between ${limits.minimumWidth} \u00d7 ${limits.minimumHeight} and ${limits.maximumWidth} \u00d7 ${limits.maximumHeight} px. Enlarge the cell or resize its contents first.` : null;
}

// Bound the cell by the proportional size of every native member. Empty cells
// retain their smaller minimum; native Text/Image validators remain authoritative.
export function compositionCellSizeLimits(value, id) {
  const frame = compositionModuleWindow(value, id);
  const limits = { ...SHAPE_WINDOW_LIMITS, minimumWidth: MIN_COMPOSITION_CELL_SIZE.width, minimumHeight: MIN_COMPOSITION_CELL_SIZE.height };
  const cell = value.cells.find(cell => cell.id === id);
  for (const member of cell?.members || []) {
    if (compositionMemberAnchor(cell, [member]) || cell.fitText?.includes(member)) continue;
    const content = compositionModuleWindow(value, member), native = compositionModuleLimits(member);
    if (!content) continue;
    for (const [axis, minimum, maximum] of [['width', 'minimumWidth', 'maximumWidth'], ['height', 'minimumHeight', 'maximumHeight']]) {
      if (axis === 'height' && member.startsWith('text:')) continue;
      limits[minimum] = Math.max(limits[minimum], native[minimum] * frame[axis] / content[axis]);
      limits[maximum] = Math.min(limits[maximum], native[maximum] * frame[axis] / content[axis]);
    }
  }
  return limits;
}
export function compositionCellResizeReason(value, id, nextFrame) {
  const frame = compositionModuleWindow(value, id), cell = value.cells.find(cell => cell.id === id);
  const frames = Object.fromEntries((cell?.members || []).map(member => [member, compositionModuleWindow(value, member)]));
  const projected = projectCompositionCellMembers(frame, nextFrame, frames, cell || {});
  for (const [member, content] of Object.entries(projected)) {
    const reason = compositionModuleSizeReason(member, content);
    if (reason) return reason;
  }
  return compositionModuleSizeReason(id, nextFrame);
}
const keys = ['shapes', 'imageModules', 'texts'];
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const idsOf = value => keys.flatMap(key => value[key].map(item => item.id));
const validWindow = v => exact(v, ['left', 'top', 'width', 'height']) && number(v.left, -16384, 16384)
  && number(v.top, -16384, 16384) && number(v.width, 1, 16384) && number(v.height, 1, 16384);

export const validCompositionMemberAnchor = (anchor, members) => exact(anchor, ['members', 'alignX', 'alignY', 'paddingX', 'paddingY'])
  && Array.isArray(anchor.members) && anchor.members.length > 0 && new Set(anchor.members).size === anchor.members.length
  && anchor.members.every(id => members.includes(id)) && ['left', 'center', 'right'].includes(anchor.alignX)
  && ['top', 'center', 'bottom'].includes(anchor.alignY) && number(anchor.paddingX, 0, 512) && number(anchor.paddingY, 0, 512);

export function withCompositionMemberAnchors(cell, anchors) {
  const { memberAnchors: _previous, ...rest } = cell;
  return anchors.length ? { ...rest, memberAnchors: anchors } : rest;
}

// Native Image dimensions belong to the image record; Text/Shape dimensions
// belong to their existing Workbench presentation. There is no second cell rect.
export function compositionModuleWindow(value, id) {
  return editorCellWindow(value.workbench, id, value) ?? null;
}
export function withCompositionModuleWindow(value, id, window) {
  if (!validWindow(window)) throw new Error('Choose a valid layer position and size.');
  const reason = compositionModuleSizeReason(id, window, value.cells.some(cell => cell.members.includes(id)));
  if (reason) throw new Error(reason);
  const key = keys.find(key => value[key]?.some(item => item.id === id));
  if (!key) throw new Error('This layer is no longer available.');
  const image = key === 'imageModules';
  const entries = value.workbench[key] || [];
  const previous = entries.find(item => item.id === id);
  const base = previous || { id, open: true };
  const placement = image ? { ...base, position: { left: window.left, top: window.top } } : { ...base, window: { ...window } };
  return { ...value, ...(image ? { imageModules: value.imageModules.map(item => item.id === id
    ? { ...item, width: Math.round(window.width), height: Math.round(window.height) } : item) } : {}),
  workbench: { ...value.workbench, [key]: previous ? entries.map(item => item === previous ? placement : item) : [...entries, placement] } };
}
export function validCompositionInnerLines(lines) {
  if (lines?.hidden !== true) return validShapeOutline(lines);
  const { hidden: _hidden, ...outline } = lines;
  return validShapeOutline(outline);
}

export const visibleCompositionInnerLines = lines => lines?.hidden ? null : lines;

export function validCompositionEditorDocument(value, published = false) {
  if (published) value = compositionArtworkFields(value);
  if (!exact(value, ['version', 'workbench', 'imageModules', 'texts', 'shapes', 'artworkLayers', 'cells'], ['surface', 'surfaceOpacity', 'frameOpacity', 'frameColor', 'backgroundColor', 'frameRadius', 'links', 'arrangement', 'bento', 'showFrame', 'innerLines', 'stackOrder'])
    || Object.hasOwn(value, 'stackOrder') && value.stackOrder !== 'manual'
    || value.version !== 3 || !Array.isArray(value.cells) || value.cells.length > 32
    || !isValidWorkbenchPresentation(value.workbench, value.cells, { published })
    || !validShapes(value.shapes, published) || !validImageModules(value.imageModules, published, { minimumCropZoom: MIN_CROP_PROJECTION_ZOOM,
      isCellMember: id => value.cells.some(cell => Array.isArray(cell?.members) && cell.members.includes(id)) })
    || !validTextModules(value.texts, published) || value.texts.some(item => item.pagination)
    || value.workbench.texts?.some(item => Object.hasOwn(item, 'frames'))
    || !validArtworkLayers(value.artworkLayers, value, published)
    || ['surface', 'frameColor', 'backgroundColor'].some(key => Object.hasOwn(value, key) && value[key] !== null && (typeof value[key] !== 'string' || !/^#[0-9a-f]{6}$/iu.test(value[key])))
    || Object.hasOwn(value, 'links') && !validCompositionLinks(value.links)
    || ['surfaceOpacity', 'frameOpacity'].some(key => Object.hasOwn(value, key) && !number(value[key], 0, 1))
    || Object.hasOwn(value, 'frameRadius') && !number(value.frameRadius, 0, 160)
    || Object.hasOwn(value, 'showFrame') && typeof value.showFrame !== 'boolean'
    || Object.hasOwn(value, 'innerLines') && value.innerLines !== null && !validCompositionInnerLines(value.innerLines)
    || Object.hasOwn(value, 'bento') && (!exact(value.bento, ['gap', 'padding']) || ![value.bento.gap, value.bento.padding].every(n => Number.isInteger(n) && number(n, 0, 256)))) return false;
  if (['displays', 'keeperDocks'].some(key => value.workbench[key]?.length)) return false;
  const all = new Set(idsOf(value)), cellIds = new Set(), members = new Set();
  for (const key of keys) {
    const placed = value.workbench[key] || [];
    if (placed.length !== value[key].length || placed.some(item => !value[key].some(record => record.id === item.id))) return false;
  }
  for (const cell of value.cells) {
    if (!exact(cell, ['id', 'members', 'mobile'], ['radius', 'content', 'contentLayout', 'lockedMembers', 'slides', 'swipeLink', 'swipeDirection', 'memberAnchors', 'clipContent', 'grainOverContent', 'fitText', 'singleLine']) || cellIds.has(cell.id)
      || !value.shapes.some(item => item.id === cell.id && !item.kind) || !Array.isArray(cell.members)
      || Object.hasOwn(cell, 'radius') && !number(cell.radius, 0, 160)
      || Object.hasOwn(cell, 'singleLine') && typeof cell.singleLine !== 'boolean'
      || Object.hasOwn(cell, 'grainOverContent') && typeof cell.grainOverContent !== 'boolean'
    || Object.hasOwn(cell, 'clipContent') && typeof cell.clipContent !== 'boolean'
      || Object.hasOwn(cell, 'content') && cell.content !== null && !value.links?.some(link => link.id === cell.content)
      || !exact(cell.mobile, ['columns', 'height'], ['placements', 'referenceWidth', 'autoHeight']) || ![1, 2].includes(cell.mobile.columns)
      || Object.hasOwn(cell.mobile, 'autoHeight') && typeof cell.mobile.autoHeight !== 'boolean'
      || Object.hasOwn(cell.mobile, 'referenceWidth') && !number(cell.mobile.referenceWidth, 1, 16384)
      || !Number.isInteger(cell.mobile.height) || !number(cell.mobile.height, 80, 1200)) return false;
    if (!validSlides(cell)) return false;
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
    if (Object.hasOwn(cell, 'fitText') && (!Array.isArray(cell.fitText) || new Set(cell.fitText).size !== cell.fitText.length
      || cell.fitText.some(id => !cell.members.includes(id) || !value.texts.some(text => text.id === id)))) return false;
    if (Object.hasOwn(cell, 'memberAnchors')) {
      if (!Array.isArray(cell.memberAnchors) || cell.memberAnchors.some(anchor => !validCompositionMemberAnchor(anchor, cell.members))) return false;
      const anchored = cell.memberAnchors.flatMap(anchor => anchor.members);
      if (new Set(anchored).size !== anchored.length) return false;
    }
    if (Object.hasOwn(cell.mobile, 'placements')) {
      const placed = new Set();
      if (!Array.isArray(cell.mobile.placements)) return false;
      for (const item of cell.mobile.placements) {
        if (!exact(item, ['id', 'window']) || !cell.members.includes(item.id) || placed.has(item.id) || !validWindow(item.window)) return false;
        placed.add(item.id);
      }
    }
  }
  const counts = new Map();
  for (const cell of value.cells.filter(cell => cell.swipeLink)) {
    if (counts.has(cell.swipeLink) && counts.get(cell.swipeLink) !== cell.slides.length) return false;
    counts.set(cell.swipeLink, cell.slides.length);
  }
  if ([...cellIds].some(id => members.has(id))) return false;
  return !Object.hasOwn(value, 'arrangement') || validCompositionArrangement(value.arrangement, value.cells);
}
export function assertCompositionEditorDocument(value) {
  if (!validCompositionEditorDocument(value)) throw new Error('The Bento cells or artwork are invalid. Your saved work is unchanged.');
  return value;
}
const filterLayout = (workbench, allowed) => ({ ...workbench, ...Object.fromEntries(keys.map(key => [key, (workbench[key] || []).filter(item => allowed.has(item.id))])) });
const privateCells = value => value.cells.filter(cell => value.shapes.find(item => item.id === cell.id)?.visibility === 'PRIVATE');
export const pruneCellMembers = (cell, allowed) => {
  const members = cell.members.filter(id => allowed.has(id)), included = new Set(members);
  return { ...withCompositionMemberAnchors(cell, (cell.memberAnchors || []).map(anchor => ({ ...anchor,
    members: anchor.members.filter(id => included.has(id)) })).filter(anchor => anchor.members.length)), members,
  ...(cell.slides ? { slides: cell.slides.map(slide => slide.filter(id => included.has(id))) } : {}),
  ...(cell.lockedMembers ? { lockedMembers: cell.lockedMembers.filter(id => included.has(id)) } : {}),
  ...(cell.fitText ? { fitText: cell.fitText.filter(id => included.has(id)) } : {}),
  mobile: { ...cell.mobile, ...(cell.mobile.placements ? { placements: cell.mobile.placements.filter(item => included.has(item.id)) } : {}) } };
};
export function projectCompositionEditorDocument(value) {
  const hidden = new Set(privateCells(value).flatMap(cell => [cell.id, ...cell.members]));
  const project = (items, fn) => fn(items.filter(item => !hidden.has(item.id)).map(item => ({ ...item, visibility: item.visibility || 'PUBLIC' })));
  const records = { shapes: project(value.shapes, projectShapes), imageModules: project(value.imageModules, projectImageModules), texts: project(value.texts, projectTextModules) };
  const allowed = new Set(idsOf(records));
  const cells = pruneSwipeLinks(value.cells.filter(cell => allowed.has(cell.id)).map(cell => pruneCellMembers(cell, allowed)));
  const workbench = filterLayout(value.workbench, allowed);
  delete workbench.lockedLayerIds;
  return structuredClone({ ...compositionArtworkFields(value), ...records, cells, workbench,
    artworkLayers: layerIds(artworkLayers(value)).filter(id => allowed.has(id)),
    ...(value.arrangement ? { arrangement: pruneCompositionArrangement(value.arrangement, cells.map(cell => cell.id)) } : {}),
    ...(value.links ? { links: value.links.filter(link => cells.some(cell => cell.content === link.id)) } : {}) });
}
export const restoreCompositionEditorDocument = value => ({ ...structuredClone(compositionArtworkFields(value)),
  workbench: { ...createDefaultWorkbenchPresentation(), ...structuredClone(value.workbench) }, shapes: restoreShapes(value.shapes),
  imageModules: restoreImageModules(value.imageModules), texts: restoreTextModules(value.texts) });

export function createCompositionEditorDocument() {
  const workbench = createDefaultWorkbenchPresentation();
  workbench.area = { left: 0, top: 0, width: 1440, height: 900 };
  for (const key of keys) workbench[key] = [];
  return { version: 3, workbench, imageModules: [], texts: [], shapes: [], artworkLayers: [], cells: [] };
}

// Deleting content prunes membership; changing a cell rect carries untouched
// children once. Explicit child transforms from a group gesture win unchanged.
export function reconcileCompositionCells(previous, candidate, { resizeContents = true, preserveMemberAnchors = false, moveContents = false } = {}) {
  const backgrounds = new Set(candidate.shapes.map(shape => shape.id));
  const retained = new Set(candidate.cells.filter(cell => backgrounds.has(cell.id)).flatMap(cell => cell.members));
  // Deleting a cell also deletes its native contents. Merges explicitly transfer
  // members to a surviving cell, so those records remain owned and intact.
  const removed = new Set(previous.cells.filter(cell => !backgrounds.has(cell.id))
    .flatMap(cell => cell.members).filter(id => !retained.has(id)));
  const records = removed.size ? Object.fromEntries(keys.map(key => [key, candidate[key].filter(item => !removed.has(item.id))])) : null;
  let next = records ? { ...candidate, ...records, workbench: filterLayout(candidate.workbench, new Set(idsOf(records))) } : candidate;
  next = reconcileArtworkLayers(previous, next);
  const available = new Set(idsOf(next));
  next = { ...next, cells: pruneSwipeLinks(next.cells.filter(cell => next.shapes.some(shape => shape.id === cell.id)).map(cell => pruneCellMembers(cell, available))) };
  const contained = new Set(next.cells.flatMap(cell => cell.members));
  // Explicitly released members must meet their native Canvas minima.
  for (const id of previous.cells.flatMap(cell => cell.members)) {
    if (contained.has(id) || !available.has(id)) continue;
    const limits = compositionModuleLimits(id, false), frame = compositionModuleWindow(next, id);
    if (frame && (frame.width < limits.minimumWidth || frame.height < limits.minimumHeight))
      next = withCompositionModuleWindow(next, id, { ...frame, width: Math.max(frame.width, limits.minimumWidth), height: Math.max(frame.height, limits.minimumHeight) });
  }
  if (next.arrangement) next.arrangement = pruneCompositionArrangement(next.arrangement, next.cells.map(cell => cell.id));
  for (const cell of next.cells) {
    const before = compositionModuleWindow(previous, cell.id), after = compositionModuleWindow(next, cell.id);
    if (!before || !after) continue;
    const parentChanged = !same(before, after);
    if (!parentChanged && !cell.memberAnchors?.length) continue;
    const oldCell = previous.cells.find(item => item.id === cell.id);
    const oldFrames = Object.fromEntries(cell.members.map(id => [id, compositionModuleWindow(previous, id)]));
    const currentFrames = Object.fromEntries(cell.members.map(id => [id, compositionModuleWindow(next, id)]));
    const expected = projectCompositionCellMembers(before, after, oldFrames, cell, { moveContents });
    const near = (a, b) => a && b && Object.keys(a).every(key => Math.abs(a[key] - b[key]) < 0.001);
    // A native free move releases the affected anchor in the same operation.
    // Changing a member's size keeps its anchor and centres the new bounds.
    const anchors = (cell.memberAnchors || []).filter(anchor => preserveMemberAnchors
      || !oldCell?.memberAnchors?.some(old => same(old, anchor))
      || !anchor.members.some(id => {
        const old = oldFrames[id], current = currentFrames[id];
        if (!old || !current || near(old, current)) return false;
        if (parentChanged) return !near(current, expected[id]);
        return old.width === current.width && old.height === current.height && (old.left !== current.left || old.top !== current.top);
      }));
    if (anchors.length !== (cell.memberAnchors || []).length) next = { ...next,
      cells: next.cells.map(item => item.id === cell.id ? withCompositionMemberAnchors(item, anchors) : item) };
    const anchored = new Set(anchors.flatMap(anchor => anchor.members));
    for (const id of cell.members) {
      if (anchored.has(id) || !resizeContents || !parentChanged || !oldFrames[id] || !same(oldFrames[id], currentFrames[id])) continue;
      // Use the surviving constraints: a released member is free from now on.
      next = withCompositionModuleWindow(next, id, expected[id]);
    }
    for (const anchor of anchors) {
      const positioned = parentChanged && oldCell?.memberAnchors?.some(old => same(old, anchor))
        ? expected : positionCompositionMembers(after, currentFrames, anchor);
      for (const id of anchor.members) {
        const frame = positioned[id];
        if (frame && !near(frame, compositionModuleWindow(next, id))) next = withCompositionModuleWindow(next, id, frame);
      }
    }
  }
  return assertCompositionEditorDocument(next);
}

export function compositionResponsiveLayout(value, viewportWidth) {
  const area = workbenchArea(value.workbench);
  const mobile = value.bento && value.cells.length > 1 ? viewportWidth < COMPOSITION_READING_WIDTH * 2 : viewportWidth <= 640;
  const width = Math.min(viewportWidth, area.width), scale = width / area.width;
  const open = id => keys.some(key => value.workbench[key]?.some(item => item.id === id && item.open));
  let visible = value.cells.filter(cell => open(cell.id));
  const hidden = new Set(value.cells.filter(cell => !open(cell.id)).flatMap(cell => [cell.id, ...cell.members]));
  const windows = Object.fromEntries(idsOf(value).filter(id => open(id) && !hidden.has(id)).map(id => {
    const r = compositionModuleWindow(value, id);
    return [id, { left: (r.left - area.left) * scale, top: (r.top - area.top) * scale, width: r.width * scale, height: r.height * scale }];
  }));
  const originalGap = value.bento?.gap ?? 0;
  const gap = Math.min(originalGap * scale, Math.max(0, width - 2));
  const height = area.height * scale;
  const progressive = !mobile && scale < 1 && visible.length > 1 && value.bento
    ? progressiveCompositionFrames(value, visible, scale, gap, (cell, cellWidth) => {
      const original = compositionModuleWindow(value, cell.id), image = responsiveCellImage(value, cell), artwork = responsiveCellArtwork(value, cell);
      return cell.mobile.autoHeight === false ? cell.mobile.height
        : image ? responsiveImageHeight(image, cellWidth) : artwork ? responsiveArtworkHeight(artwork, cellWidth)
        : Math.max(80, original.height * cellWidth / original.width);
    }) : null;
  const stacked = Boolean(progressive && visible.some(cell => compositionModuleWindow(value, cell.id).width * scale < COMPOSITION_READING_WIDTH));
  let bottom = 0, rowTop = 0, column = 0, rowHeight = 0;
  const reflowed = mobile || stacked;
  if (reflowed) visible = compositionReadingOrder(value, visible);
  const cells = visible.map(cell => {
    const original = compositionModuleWindow(value, cell.id);
    const image = responsiveCellImage(value, cell);
    const artwork = responsiveCellArtwork(value, cell);
    let window = windows[cell.id];
    if (progressive) {
      window = progressive[cell.id]; windows[cell.id] = window;
      bottom = Math.max(bottom, window.top + window.height);
    } else if (mobile) {
      const columns = cell.mobile.columns;
      if (column + columns > 2) { rowTop += rowHeight + gap; column = 0; rowHeight = 0; }
      const cellWidth = columns === 2 ? width : (width - gap) / 2;
      const baseHeight = cell.singleLine ? original.height : image && cell.mobile.autoHeight !== false ? responsiveImageHeight(image, cellWidth)
        : artwork && cell.mobile.autoHeight !== false ? responsiveArtworkHeight(artwork, cellWidth)
        : mobile || cell.mobile.autoHeight === false ? cell.mobile.height : Math.max(80, original.height * scale);
      window = { left: column * (width + gap) / 2, top: rowTop, width: cellWidth,
        height: baseHeight };
      column += columns; rowHeight = Math.max(rowHeight, window.height); bottom = Math.max(bottom, window.top + window.height);
      if (column === 2) { rowTop += rowHeight + gap; column = 0; rowHeight = 0; }
      windows[cell.id] = window;
    }
    if (mobile || scale !== 1) {
      const frames = Object.fromEntries(cell.members.map(id => [id, compositionModuleWindow(value, id)]));
      // Reflow fits content to a new cell shape; proportional views shrink the
      // authored group with its cell while preserving the chosen alignment.
      const projected = projectCompositionCellMembers(original, window, frames, cell,
        { responsive: true, anchorScale: reflowed || cell.singleLine ? 1 : undefined });
      const artworkFrames = reflowed && artwork ? responsiveArtworkFrames(artwork, frames, original, window) : {};
      for (const id of cell.members) {
        if (!windows[id]) continue;
        const override = mobile && cell.mobile.placements?.find(item => item.id === id)?.window;
        const overrideScale = window.width / (cell.mobile.referenceWidth || (cell.mobile.columns === 2 ? 390 : 189));
        let frame = override ? { left: window.left + override.left * overrideScale, top: window.top + override.top * overrideScale,
          width: override.width * overrideScale, height: override.height * overrideScale } : projected[id];
        // A desktop crop covering its cell remains cell-filling after reflow.
        // Position anchors must not shrink that viewport; explicit phone edits win.
        if (!override && reflowed && image?.id === id && (image.fillsCell || !compositionMemberAnchor(cell, [id])))
          frame = responsiveImageFrame(image, original, window);
        if (!override && artworkFrames[id] && !compositionMemberAnchor(cell, [id])) frame = artworkFrames[id];
        if (!override && id.startsWith('text:') && !compositionMemberAnchor(cell, [id])) {
          const oldWidth = frame.width, source = frames[id], fitted = cell.fitText?.includes(id);
          frame = { ...frame, width: fitted ? Math.min(source.width, window.width) : source.width / original.width * window.width,
            height: source.height * (reflowed || cell.singleLine ? window.height / original.height : scale),
            top: window.top + (source.top - original.top) * window.height / original.height };
          if (fitted) frame.left += (oldWidth - frame.width) / 2;
        }
        if (!override && cell.singleLine && id.startsWith('text:')) {
          const source = frames[id], anchor = compositionMemberAnchor(cell, [id]);
          const padding = anchor?.members.length === 1 ? anchor.paddingX : 0;
          const room = Math.max(1, window.width - padding * 2), width = Math.min(source.width, room);
          const position = anchor?.members.length === 1 ? { left: 0, center: .5, right: 1 }[anchor.alignX]
            : Math.max(0, Math.min(1, (source.left - original.left) / Math.max(1, original.width - source.width)));
          frame = { ...frame, left: window.left + padding + (room - width) * position, width, height: source.height };
        }
        windows[id] = frame;
      }
    }
    return { ...cell, radius: (cell.radius || 0) * (mobile ? 1 : scale), window };
  });
  const contained = new Set(value.cells.flatMap(cell => [cell.id, ...cell.members]));
  const freeBottom = Math.max(0, ...Object.entries(windows).map(([id, r]) => contained.has(id) ? 0 : r.top + r.height));
  return { viewportWidth, width, height: Math.max((mobile || progressive) && cells.length ? bottom : height, freeBottom), scale, gap, windows, cells, mobile, stacked };
}
