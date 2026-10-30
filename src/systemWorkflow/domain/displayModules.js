// The original Display remains in the root envelope for byte-compatible reads.
// Additional instances own only composition data; identity and storage authority
// belong to the profile. Projected drafts are operation inputs, never extra stores.
export const PRIMARY_DISPLAY_ID = 'display:primary';
export const MAX_DISPLAY_MODULES = 8;
export const DISPLAY_CONTENT_KEYS = ['artboard', 'geometry', 'appearance', 'grids'];
export const DISPLAY_CANVAS_LIMITS = Object.freeze({ minimum: 1, maximum: 512 });
const dimension = value => Number.isSafeInteger(value)
  && value >= DISPLAY_CANVAS_LIMITS.minimum && value <= DISPLAY_CANVAS_LIMITS.maximum;
const gcd = (a, b) => b ? gcd(b, a % b) : a;

export function displayPreset(geometry) {
  if (geometry?.columns === 32 && geometry?.rows === 18) return 'LANDSCAPE';
  if (geometry?.columns === 18 && geometry?.rows === 32) return 'PORTRAIT';
  return 'CUSTOM';
}

export function displayModuleIds(draft) {
  return [...(draft.grids.length ? [PRIMARY_DISPLAY_ID] : []), ...(draft.displays || []).map(module => module.id)];
}

export function displayContent(draft, id = PRIMARY_DISPLAY_ID) {
  if (id === PRIMARY_DISPLAY_ID) return draft;
  const module = draft.displays?.find(module => module.id === id);
  if (!module) throw new TypeError('This Display Module is no longer available');
  return module;
}

export function projectDisplayDraft(draft, id = PRIMARY_DISPLAY_ID) {
  const content = displayContent(draft, id);
  // The existing authoring validator needs this envelope, including identity.
  // Enumerate it so adding a Workbench module cannot expand Display's input.
  // mergeDisplayDraft accepts only the four Display-owned content fields.
  return {
    profileAddress: draft.profileAddress,
    draftVersion: draft.draftVersion,
    artboard: content.artboard,
    geometry: content.geometry,
    appearance: content.appearance,
    identityPresentation: draft.identityPresentation,
    grids: content.grids,
  };
}

export function mergeDisplayDraft(draft, id, candidate) {
  const content = Object.fromEntries(DISPLAY_CONTENT_KEYS.map(key => [key, candidate[key]]));
  if (id === PRIMARY_DISPLAY_ID) return { ...draft, ...content };
  displayContent(draft, id); // Reject an obsolete operation rather than resurrecting it.
  return { ...draft, displays: draft.displays.map(module => module.id === id ? { ...module, ...content } : module) };
}

export function isDisplayFormat(artboard, geometry) {
  if (!artboard || !geometry || Array.isArray(artboard) || Array.isArray(geometry)
    || Object.keys(artboard).length !== 2 || Object.keys(geometry).length !== 2
    || !dimension(geometry.columns) || !dimension(geometry.rows)) return false;
  const divisor = gcd(geometry.columns, geometry.rows);
  return artboard.aspectWidth === geometry.columns / divisor && artboard.aspectHeight === geometry.rows / divisor;
}

// The existing geometry remains authoritative; artboard is its reduced ratio.
// Old 32x18 / 18x32 documents already use exactly this representation.
export function displayFormat(size) {
  const { width, height } = size === 'LANDSCAPE' ? { width: 32, height: 18 }
    : size === 'PORTRAIT' ? { width: 18, height: 32 } : size || {};
  if (!dimension(width) || !dimension(height)) throw new TypeError('Choose whole canvas dimensions from 1 to 512 units.');
  const divisor = gcd(width, height);
  return { artboard: { aspectWidth: width / divisor, aspectHeight: height / divisor }, geometry: { columns: width, rows: height } };
}
