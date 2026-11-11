// Read cleanup for the founder's existing drafts. These fields no longer drive
// any interface. Immutable published bytes are validated without rewriting them.
export const RETIRED_INTERFACE_APPEARANCE_KEYS = ['menuSurfaceId', 'dossierSurfaceId'];
export const retiredInterfaceKeys = value => RETIRED_INTERFACE_APPEARANCE_KEYS.filter(key => Object.hasOwn(value || {}, key));

export function withoutRetiredInterfaceAppearance(input) {
  const result = structuredClone(input);
  const clean = value => {
    if (!value || typeof value !== 'object') return;
    for (const key of RETIRED_INTERFACE_APPEARANCE_KEYS) if (value.appearance) delete value.appearance[key];
    if (value.identityPresentation) delete value.identityPresentation.dossierSurface;
    if (value.reception?.branding) delete value.reception.branding.theme;
    for (const display of value.displays || []) clean(display);
  };
  clean(result);
  if (result.shared) { delete result.shared.menuSurfaceId; clean(result.shared); }
  for (const item of result.workbenches || []) clean(item.content);
  return result;
}
