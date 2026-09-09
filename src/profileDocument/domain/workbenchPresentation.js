import { validateProfileDocumentV9Asset } from './profileDocumentV9Asset.js';

const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const number = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const position = value => exact(value, ['left', 'top']) && number(value.left, 0, 16384) && number(value.top, 0, 16384);
const windowFrame = (value, height) => exact(value, height ? ['left', 'top', 'width', 'height'] : ['left', 'top', 'width'])
  && number(value.left, 0, 16384) && number(value.top, 0, 16384) && number(value.width, 180, 16384)
  && (!height || number(value.height, 100, 16384));

// The currently implemented modules only. Content remains owned by their existing
// validated Grid/Identity envelopes; this describes their public starting layout.
export function isValidWorkbenchPresentation(value) {
  if (!exact(value, ['version', 'display', 'identity']) || value.version !== 1) return false;
  const { display, identity } = value;
  if (!exact(display, ['name', 'open', 'window', 'shortcut']) || typeof display.name !== 'string'
    || !display.name.trim() || display.name.length > 48 || /[\u0000-\u001f\u007f]/u.test(display.name)
    || typeof display.open !== 'boolean' || !windowFrame(display.window, true)) return false;
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
