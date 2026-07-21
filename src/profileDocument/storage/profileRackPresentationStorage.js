import { normalizeProfileAddress } from '../../library/config.js';
import { createDefaultIdentityRack, createIdentityRackPresentation } from '../domain/profileDocumentRacks.js';

export const PROFILE_RACK_PRESENTATION_KEY_PREFIX = 'os-underneath.profile-racks.v1:';
export const profileRackPresentationKey = (address) => `${PROFILE_RACK_PRESENTATION_KEY_PREFIX}${normalizeProfileAddress(address) || 'invalid'}`;

export function createDefaultProfileRackPresentation() {
  return { version: 1, identity: createDefaultIdentityRack() };
}

export function normalizeProfileRackPresentation(candidate) {
  const identity = createIdentityRackPresentation(candidate?.identity);
  return {
    version: 1,
    identity: {
      ...identity,
      visible: true,
      modules: identity.modules.map((module) => module.id === 'profile'
        ? { ...module, visible: true }
        : module)
    }
  };
}

export function loadProfileRackPresentation(storage, address) {
  try {
    const value = JSON.parse(storage?.getItem(profileRackPresentationKey(address)) || 'null');
    return value?.version === 1
      ? normalizeProfileRackPresentation(value)
      : createDefaultProfileRackPresentation();
  } catch {
    return createDefaultProfileRackPresentation();
  }
}

export function saveProfileRackPresentation(storage, address, presentation) {
  try {
    if (!normalizeProfileAddress(address)) return false;
    storage?.setItem(profileRackPresentationKey(address), JSON.stringify(normalizeProfileRackPresentation(presentation)));
    return true;
  } catch {
    return false;
  }
}

export function setIdentityDisclosureVisibility(presentation, moduleId, visible) {
  if (!['bio', 'links-tags'].includes(moduleId)) return normalizeProfileRackPresentation(presentation);
  const value = normalizeProfileRackPresentation(presentation);
  return {
    ...value,
    identity: {
      ...value.identity,
      modules: value.identity.modules.map((module) => module.id === moduleId
        ? { ...module, visible: visible === true }
        : module)
    }
  };
}

export function setIdentityModuleOrder(presentation, orderedIds) {
  const value = normalizeProfileRackPresentation(presentation);
  const knownIds = value.identity.modules.map(({ id }) => id);
  const requested = Array.isArray(orderedIds)
    ? orderedIds.filter((id, index) => knownIds.includes(id) && orderedIds.indexOf(id) === index)
    : [];
  const completeOrder = [...requested, ...knownIds.filter((id) => !requested.includes(id))];
  return {
    ...value,
    identity: {
      ...value.identity,
      modules: completeOrder.map((id, order) => ({
        ...value.identity.modules.find((module) => module.id === id),
        order
      }))
    }
  };
}
