import { normalizeProfileAddress } from '../../library/config.js';

export const PROFILE_PRESENTATION_KEY_PREFIX = 'os-underneath.restored-presentation.v1:';
export const profilePresentationKey = (address) => `${PROFILE_PRESENTATION_KEY_PREFIX}${normalizeProfileAddress(address) || 'invalid'}`;

export function loadRestoredPresentation(storage, address) {
  try {
    const input = JSON.parse(storage?.getItem(profilePresentationKey(address)) || 'null');
    if (!['abyssal_eye', 'skull_reaper'].includes(input?.keeperId) || typeof input?.stageId !== 'string') return null;
    if (input.version === 1) return { ...input, version: 4, environment: { type: 'illustrated', shaderId: 'neural-field' }, avatarShape: 'square', visitorNavigation: { showCategories: true, showCreations: false } };
    if (![2, 3, 4].includes(input.version) || !['illustrated', 'shader'].includes(input.environment?.type) || input.environment?.shaderId !== 'neural-field') return null;
    if (input.version === 3 && !['square', 'round'].includes(input.avatarShape)) return null;
    if (input.version === 4 && (typeof input.visitorNavigation?.showCategories !== 'boolean' || typeof input.visitorNavigation?.showCreations !== 'boolean')) return null;
    return { ...input, version: 4, avatarShape: input.avatarShape || 'square', visitorNavigation: input.visitorNavigation || { showCategories: true, showCreations: false } };
  } catch { return null; }
}

export function saveRestoredPresentation(storage, address, presentation) {
  const profileAddress = normalizeProfileAddress(address);
  const value = {
    version: 4,
    keeperId: presentation?.keeperId,
    stageId: presentation?.stageId,
    environment: presentation?.environment,
    avatarShape: presentation?.avatarShape || 'square',
    visitorNavigation: {
      showCategories: presentation?.visitorNavigation?.showCategories !== false,
      showCreations: presentation?.visitorNavigation?.showCreations === true
    }
  };
  if (!profileAddress || !['abyssal_eye', 'skull_reaper'].includes(value.keeperId) || typeof value.stageId !== 'string'
    || !['illustrated', 'shader'].includes(value.environment?.type) || value.environment?.shaderId !== 'neural-field'
    || !['square', 'round'].includes(value.avatarShape)
    || typeof value.visitorNavigation.showCategories !== 'boolean' || typeof value.visitorNavigation.showCreations !== 'boolean') return false;
  if (!storage?.setItem) return false;
  try { storage.setItem(profilePresentationKey(profileAddress), JSON.stringify(value)); return true; } catch { return false; }
}
