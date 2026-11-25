// Read cleanup for the founder's existing drafts. These fields no longer drive
// any interface. Immutable published bytes are validated without rewriting them.
export const RETIRED_INTERFACE_APPEARANCE_KEYS = ['menuSurfaceId', 'dossierSurfaceId'];
export const retiredInterfaceKeys = value => RETIRED_INTERFACE_APPEARANCE_KEYS.filter(key => Object.hasOwn(value || {}, key));

// Studio and its signed publications share the same artwork fields. Older
// ordinary works can carry inert page decoration alongside that artwork.
export function compositionArtworkFields(value) {
  if (!value || (!Object.hasOwn(value, 'branding') && !Object.hasOwn(value, 'lighting'))) return value;
  const clean = { ...value };
  delete clean.branding;
  delete clean.lighting;
  return clean;
}

export function withoutRetiredInterfaceAppearance(input) {
  return stripRetiredInterfaceAppearance(structuredClone(input));
}

// Only call on an owned, detached value.
export function stripRetiredInterfaceAppearance(result) {
  const clean = value => {
    if (!value || typeof value !== 'object') return;
    for (const key of RETIRED_INTERFACE_APPEARANCE_KEYS) if (value.appearance) delete value.appearance[key];
    if (value.composition) value.composition = compositionArtworkFields(value.composition);
    if (value.identityPresentation) delete value.identityPresentation.dossierSurface;
  };
  clean(result);
  if (result.shared) { delete result.shared.menuSurfaceId; clean(result.shared); }
  for (const item of result.workbenches || []) clean(item.content);
  return result;
}
