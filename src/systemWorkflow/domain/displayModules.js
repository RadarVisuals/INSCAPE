// The original Display remains in the root envelope for byte-compatible reads.
// Additional instances own only composition data; identity and storage authority
// belong to the profile. Projected drafts are operation inputs, never extra stores.
export const PRIMARY_DISPLAY_ID = 'display:primary';
export const MAX_DISPLAY_MODULES = 8;
export const DISPLAY_CONTENT_KEYS = ['artboard', 'geometry', 'appearance', 'grids'];

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
  const { displays: _displays, workbench: _workbench, animations: _animations, mobile: _mobile, miniApps: _miniApps, ...shared } = draft;
  const content = displayContent(draft, id);
  return { ...shared, ...Object.fromEntries(DISPLAY_CONTENT_KEYS.map(key => [key, content[key]])) };
}

export function mergeDisplayDraft(draft, id, candidate) {
  const content = Object.fromEntries(DISPLAY_CONTENT_KEYS.map(key => [key, candidate[key]]));
  if (id === PRIMARY_DISPLAY_ID) return { ...draft, ...content };
  displayContent(draft, id); // Reject an obsolete operation rather than resurrecting it.
  return { ...draft, displays: draft.displays.map(module => module.id === id ? { ...module, ...content } : module) };
}

export function isDisplayFormat(artboard, geometry) {
  return Boolean(artboard && geometry && Object.keys(artboard).length === 2 && Object.keys(geometry).length === 2
    && ((artboard.aspectWidth === 16 && artboard.aspectHeight === 9 && geometry.columns === 32 && geometry.rows === 18)
      || (artboard.aspectWidth === 9 && artboard.aspectHeight === 16 && geometry.columns === 18 && geometry.rows === 32)));
}

export function displayFormat(orientation) {
  if (!['LANDSCAPE', 'PORTRAIT'].includes(orientation)) throw new TypeError('Choose Landscape or Portrait');
  return orientation === 'PORTRAIT'
    ? { artboard: { aspectWidth: 9, aspectHeight: 16 }, geometry: { columns: 18, rows: 32 } }
    : { artboard: { aspectWidth: 16, aspectHeight: 9 }, geometry: { columns: 32, rows: 18 } };
}
