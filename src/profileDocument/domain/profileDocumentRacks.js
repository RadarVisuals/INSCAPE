export const PROFILE_DOCUMENT_RACK_IDS = Object.freeze(['identity']);
export const PROFILE_DOCUMENT_RACK_MODULE_IDS = Object.freeze({
  identity: Object.freeze(['profile', 'bio', 'links-tags'])
});

const DEFAULT_IDENTITY_MODULES = Object.freeze([
  Object.freeze({ id: 'profile', order: 0, visible: true, startOpen: false }),
  Object.freeze({ id: 'bio', order: 1, visible: false, startOpen: false }),
  Object.freeze({ id: 'links-tags', order: 2, visible: false, startOpen: false })
]);

export function createDefaultIdentityRack({ visible = true, profileStartOpen = false } = {}) {
  return {
    id: 'identity', order: 0, visible: visible === true,
    modules: DEFAULT_IDENTITY_MODULES.map((module) => ({
      ...module,
      ...(module.id === 'profile' ? { startOpen: profileStartOpen === true } : {})
    }))
  };
}

function normalizeIdentityModules(candidate) {
  const requested = new Map((Array.isArray(candidate) ? candidate : []).flatMap((module) => (
    module && PROFILE_DOCUMENT_RACK_MODULE_IDS.identity.includes(module.id) ? [[module.id, module]] : []
  )));
  return DEFAULT_IDENTITY_MODULES.map((fallback) => {
    const module = requested.get(fallback.id);
    return {
      id: fallback.id,
      order: Number.isInteger(module?.order) ? module.order : fallback.order,
      visible: module?.visible === true,
      startOpen: module?.startOpen === true
    };
  }).sort((first, second) => first.order - second.order || first.id.localeCompare(second.id))
    .map((module, order) => ({ ...module, order }));
}

export function createIdentityRackPresentation(candidate, legacyIdentityModule = null) {
  if (!candidate || candidate.id !== 'identity') {
    return createDefaultIdentityRack({
      visible: legacyIdentityModule?.visible !== false,
      profileStartOpen: legacyIdentityModule?.startOpen === true
    });
  }
  return {
    id: 'identity', order: 0, visible: candidate.visible === true,
    modules: normalizeIdentityModules(candidate.modules)
  };
}

export function identityRackModuleIsVisible(racks, moduleId) {
  const rack = Array.isArray(racks) ? racks.find((candidate) => candidate?.id === 'identity' && candidate.visible === true) : null;
  return Boolean(rack?.modules?.some((module) => module?.id === moduleId && module.visible === true));
}
