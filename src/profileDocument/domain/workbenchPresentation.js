import { validateProfileDocumentV9Asset } from './profileDocumentV9Asset.js';
import { MAX_MINI_APPS, MINI_APP_ID } from '../../miniApps/domain/miniApps.js';
import { MAX_TEXT_MODULES, TEXT_ID } from '../../text/domain/article.js';
import { MAX_IMAGE_MODULES, IMAGE_MODULE_ID } from '../../imageModule/imageModule.js';
import { MAX_SHAPES, SHAPE_ID } from '../../shapes/shapes.js';
import { MAX_KEEPER_DOCKS, KEEPER_ID } from '../../keeper/keeper.js';
import { displayFormat, displayPreset } from '../../systemWorkflow/domain/displayModules.js';

const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const position = value => exact(value, ['left', 'top']) && number(value.left, 0, 16384) && number(value.top, 0, 16384);
const windowFrame = (value, height, minimumWidth = 180, minimumHeight = 100) => exact(value, height ? ['left', 'top', 'width', 'height'] : ['left', 'top', 'width'])
  && number(value.left, 0, 16384) && number(value.top, 0, 16384) && number(value.width, minimumWidth, 16384)
  && (!height || number(value.height, minimumHeight, 16384));

// The currently implemented modules only. Content remains owned by their existing
// validated Grid/Identity envelopes; this describes their public starting layout.
export function isValidWorkbenchPresentation(value) {
  if (!exact(value, ['version', 'display', 'identity', ...['displays', 'miniApps', 'texts', 'imageModules', 'shapes', 'keeperDocks'].filter(key => Object.hasOwn(value || {}, key))]) || value.version !== 1) return false;
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
        || !position({ left: frame.left, top: frame.top }) || !number(frame.width, 8, 7992) || !number(frame.height, 8, 7992)) return false;
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
      if (!exact(item, ['id', 'open', 'window', ...(Object.hasOwn(item || {}, 'frames') ? ['frames'] : [])]) || !TEXT_ID.test(item.id) || ids.has(item.id)
        || typeof item.open !== 'boolean' || !windowFrame(item.window, true)) return false;
      if (item.frames !== undefined) {
        if (!Array.isArray(item.frames) || !item.frames.length || item.frames.length > 7) return false;
        for (const frame of item.frames) {
          if (!exact(frame, ['id', 'window']) || !/^text-frame:[A-Za-z0-9_-]{1,80}$/u.test(frame.id)
            || frameIds.has(frame.id) || !windowFrame(frame.window, true)) return false;
          frameIds.add(frame.id);
        }
      }
      ids.add(item.id);
    }
  }
  if (Object.hasOwn(value, 'miniApps')) {
    if (!Array.isArray(value.miniApps) || value.miniApps.length > MAX_MINI_APPS) return false;
    const ids = new Set();
    for (const item of value.miniApps) {
      if (!exact(item, ['id', 'open', 'window']) || !MINI_APP_ID.test(item.id) || ids.has(item.id)
        || typeof item.open !== 'boolean' || !windowFrame(item.window, true)) return false;
      ids.add(item.id);
    }
  }
  if (Object.hasOwn(value, 'displays')) {
    if (!Array.isArray(value.displays) || value.displays.length > 7) return false;
    const ids = new Set(['display:primary']);
    for (const item of value.displays) {
      if (!item || !/^display:[A-Za-z0-9_-]{1,80}$/u.test(item.id) || ids.has(item.id)) return false;
      ids.add(item.id);
      const { id, ...display } = item;
      if (!isValidWorkbenchPresentation({ version: 1, display, identity: value.identity })) return false;
    }
  }
  const { display, identity } = value;
  if (!exact(display, ['name', 'open', 'window', 'shortcut']) || typeof display.name !== 'string'
    || !display.name.trim() || display.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(display.name)
    || typeof display.open !== 'boolean' || !windowFrame(display.window, true, .01, .01)) return false;
  const shortcut = display.shortcut;
  if (!exact(shortcut, ['position', 'visible', 'icon', 'iconPresentation']) || !position(shortcut.position)
    || typeof shortcut.visible !== 'boolean' || !(shortcut.icon === null || validateProfileDocumentV9Asset(shortcut.icon)
      && shortcut.icon.media.type === 'image' && typeof shortcut.icon.media.url === 'string')) return false;
  const icon = shortcut.iconPresentation;
  if (!exact(icon, ['labelSize', 'offsetX', 'offsetY', 'scale', 'size'])
    || !number(icon.labelSize, 7, 20) || !number(icon.offsetX, -150, 150) || !number(icon.offsetY, -150, 150)
    || !number(icon.scale, .75, 3) || !number(icon.size, 40, 150)) return false;
  return Boolean(exact(identity, ['open', 'window']) && typeof identity.open === 'boolean' && windowFrame(identity.window, false));
}

export function assertWorkbenchPresentation(value) {
  if (!isValidWorkbenchPresentation(value)) throw new TypeError('Invalid public Workbench configuration');
  return value;
}

export function createDefaultWorkbenchPresentation() {
  return { version: 1,
    display: { name: 'DISPLAY MODULE', open: true, window: { left: 32, top: 64, width: 960, height: 572 },
      shortcut: { position: { left: 24, top: 72 }, visible: true, icon: null,
        iconPresentation: { labelSize: 8, offsetX: 0, offsetY: 0, scale: 1, size: 60 } } },
    identity: { open: false, window: { left: 28, top: 72, width: 840 } } };
}

export function createMiniAppPresentation(id, index = 0) {
  return { id, open: true, window: { left: 96 + index * 32, top: 88 + index * 24, width: 720, height: 540 } };
}

export function createTextPresentation(id, index = 0) {
  return { id, open: true, window: { left: 120 + index * 24, top: 80 + index * 24, width: 720, height: 680 } };
}

export const DISPLAY_DEFAULT_WINDOW_SIZES = Object.freeze({
  LANDSCAPE: Object.freeze({ width: 960, height: 540 }),
  PORTRAIT: Object.freeze({ width: 405, height: 720 }),
});

// Shared creation/format sizing; existing documents retain their saved presentation.
export function defaultDisplayWindowSize(geometry) {
  const preset = DISPLAY_DEFAULT_WINDOW_SIZES[displayPreset(geometry)];
  if (preset) return preset;
  const scale = Math.min(30, 960 / geometry.columns, 720 / geometry.rows);
  return { width: geometry.columns * scale, height: geometry.rows * scale };
}

export function createNewDisplayPresentation(format = 'LANDSCAPE', index = 0) {
  const geometry = typeof format === 'string' ? displayFormat(format).geometry : format;
  const display = createDefaultWorkbenchPresentation().display;
  return { ...display, name: index ? `DISPLAY ${index + 1}` : 'DISPLAY MODULE',
    window: { left: 96 + index * 24, top: 96 + index * 24,
      ...defaultDisplayWindowSize(geometry) },
    shortcut: { ...display.shortcut, position: { left: 24 + index * 96, top: 72 } } };
}
