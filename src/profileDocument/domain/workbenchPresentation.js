import { MIN_COMPOSITION_CELL_SIZE } from '../../composition/editorCellGeometry.js';
import { validWorkbenchArea } from '../../systemWorkflow/domain/workbenchArea.js';
import { MAX_TEXT_MODULES, TEXT_ID, exact } from '../../text/domain/article.js';
import { MAX_IMAGE_MODULES, IMAGE_MODULE_ID } from '../../imageModule/imageModule.js';
import { MAX_SHAPES, SHAPE_ID } from '../../shapes/shapes.js';
import { MAX_KEEPER_DOCKS, KEEPER_ID } from '../../keeper/keeper.js';

const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const maximumWindowSize = 16384;
export const TEXT_WINDOW_LIMITS = Object.freeze({ minimumWidth: 180, minimumHeight: 24, maximumWidth: maximumWindowSize, maximumHeight: maximumWindowSize });
export { MIN_COMPOSITION_CELL_SIZE };
export const CELL_TEXT_WINDOW_LIMITS = Object.freeze({ ...TEXT_WINDOW_LIMITS, minimumWidth: 1, minimumHeight: 1 });
export const SHAPE_WINDOW_LIMITS = Object.freeze({ minimumWidth: 8, minimumHeight: 8, maximumWidth: 7992, maximumHeight: 7992 });
const position = value => exact(value, ['left', 'top']) && number(value.left, -16384, 16384) && number(value.top, -16384, 16384);
const windowFrame = (value, height, minimumWidth = 180, minimumHeight = 100) => exact(value, height ? ['left', 'top', 'width', 'height'] : ['left', 'top', 'width'])
  && number(value.left, -16384, 16384) && number(value.top, -16384, 16384) && number(value.width, minimumWidth, maximumWindowSize)
  && (!height || number(value.height, minimumHeight, maximumWindowSize));

// The currently implemented modules only. Content remains owned by their existing
// validated Grid/Identity envelopes; this describes their public starting layout.
export function isValidWorkbenchPresentation(value, cells = [], { published = false } = {}) {
  if (!exact(value, ['version', 'identity'], ['area', ...(published ? [] : ['lockedLayerIds']), 'texts', 'imageModules', 'shapes', 'keeperDocks']) || value.version !== 1) return false;
  if (Object.hasOwn(value, 'lockedLayerIds') && (!Array.isArray(value.lockedLayerIds)
    || value.lockedLayerIds.length > MAX_IMAGE_MODULES + MAX_SHAPES + MAX_TEXT_MODULES
    || new Set(value.lockedLayerIds).size !== value.lockedLayerIds.length
    || value.lockedLayerIds.some(id => typeof id !== 'string' || ![IMAGE_MODULE_ID, SHAPE_ID, TEXT_ID].some(pattern => pattern.test(id))))) return false;
  if (Object.hasOwn(value, 'area') && !validWorkbenchArea(value.area)) return false;
  if (Object.hasOwn(value, 'keeperDocks')) {
    if (!Array.isArray(value.keeperDocks) || value.keeperDocks.length > MAX_KEEPER_DOCKS) return false;
    const ids = new Set();
    for (const item of value.keeperDocks) {
      if (!exact(item, ['id', 'position']) || typeof item.id !== 'string' || !KEEPER_ID.test(item.id) || ids.has(item.id) || !position(item.position)) return false;
      ids.add(item.id);
    }
  }
  if (Object.hasOwn(value, 'shapes')) {
    if (!Array.isArray(value.shapes) || value.shapes.length > MAX_SHAPES) return false;
    const ids = new Set();
    for (const item of value.shapes) {
      const frame = item?.window;
      if (!exact(item, ['id', 'open', 'window']) || !SHAPE_ID.test(item.id) || ids.has(item.id)
        || typeof item.open !== 'boolean' || !exact(frame, ['left', 'top', 'width', 'height'])
        || !position({ left: frame.left, top: frame.top })
        || !number(frame.width, SHAPE_WINDOW_LIMITS.minimumWidth, SHAPE_WINDOW_LIMITS.maximumWidth)
        || !number(frame.height, SHAPE_WINDOW_LIMITS.minimumHeight, SHAPE_WINDOW_LIMITS.maximumHeight)) return false;
      ids.add(item.id);
    }
  }
  if (Object.hasOwn(value, 'imageModules')) {
    if (!Array.isArray(value.imageModules) || value.imageModules.length > MAX_IMAGE_MODULES) return false;
    const ids = new Set();
    for (const item of value.imageModules) {
      if (!exact(item, ['id', 'open', 'position']) || !IMAGE_MODULE_ID.test(item.id) || ids.has(item.id)
        || typeof item.open !== 'boolean' || !position(item.position)) return false;
      ids.add(item.id);
    }
  }
  if (Object.hasOwn(value, 'texts')) {
    if (!Array.isArray(value.texts) || value.texts.length > MAX_TEXT_MODULES) return false;
    const ids = new Set(), frameIds = new Set();
    for (const item of value.texts) {
      const inCell = cells.some(cell => Array.isArray(cell?.members) && cell.members.includes(item?.id));
      const limits = inCell ? CELL_TEXT_WINDOW_LIMITS : TEXT_WINDOW_LIMITS;
      if (!exact(item, ['id', 'open', 'window'], ['frames']) || !TEXT_ID.test(item.id) || ids.has(item.id)
        || typeof item.open !== 'boolean' || !windowFrame(item.window, true, limits.minimumWidth, limits.minimumHeight)) return false;
      if (item.frames !== undefined) {
        if (!Array.isArray(item.frames) || !item.frames.length || item.frames.length > 7) return false;
        for (const frame of item.frames) {
          if (!exact(frame, ['id', 'window']) || !/^text-frame:[A-Za-z0-9_-]{1,80}$/u.test(frame.id)
            || frameIds.has(frame.id) || !windowFrame(frame.window, true, TEXT_WINDOW_LIMITS.minimumWidth, TEXT_WINDOW_LIMITS.minimumHeight)) return false;
          frameIds.add(frame.id);
        }
      }
      ids.add(item.id);
    }
  }
  const { identity } = value;
  return Boolean(exact(identity, ['open', 'window']) && typeof identity.open === 'boolean' && windowFrame(identity.window, false));
}

export function assertWorkbenchPresentation(value) {
  if (!isValidWorkbenchPresentation(value)) throw new TypeError('Invalid public Workbench configuration');
  return value;
}

export function createDefaultWorkbenchPresentation() {
  return { version: 1,
    identity: { open: false, window: { left: 28, top: 72, width: 840 } } };
}

export function createTextPresentation(id, index = 0) {
  return { id, open: true, window: { left: 120 + index * 24, top: 80 + index * 24, width: 720, height: 680 } };
}
