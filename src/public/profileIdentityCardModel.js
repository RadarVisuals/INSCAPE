export const PROFILE_IDENTITY_CARD_STATE = Object.freeze({
  AVATAR: 'avatar',
  COMPACT: 'compact',
  EXPANDED: 'expanded'
});

export function identityCode(address) {
  const normalized = typeof address === 'string' ? address.trim() : '';
  const body = normalized.toLowerCase().startsWith('0x') ? normalized.slice(2) : normalized;
  return body ? `#${body.slice(0, 4).toUpperCase()}` : '#----';
}

export function selectProfileCardLinks(links) {
  const safe = (Array.isArray(links) ? links : []).filter((link) => {
    if (!link || typeof link.label !== 'string') return false;
    try {
      const url = new URL(link.url);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  });
  const metadataLinks = safe.filter((link) => link.id !== 'official-profile');
  return (metadataLinks.length ? metadataLinks : safe).slice(0, 3);
}

export function transitionProfileIdentityCard(state, action) {
  const current = Object.values(PROFILE_IDENTITY_CARD_STATE).includes(state)
    ? state
    : PROFILE_IDENTITY_CARD_STATE.AVATAR;

  if (action === 'escape' || action === 'close') return PROFILE_IDENTITY_CARD_STATE.AVATAR;
  if (action === 'avatar') {
    if (current === PROFILE_IDENTITY_CARD_STATE.AVATAR) return PROFILE_IDENTITY_CARD_STATE.COMPACT;
    if (current === PROFILE_IDENTITY_CARD_STATE.COMPACT) return PROFILE_IDENTITY_CARD_STATE.EXPANDED;
    return PROFILE_IDENTITY_CARD_STATE.AVATAR;
  }
  if (action === 'toggle') {
    return current === PROFILE_IDENTITY_CARD_STATE.EXPANDED
      ? PROFILE_IDENTITY_CARD_STATE.AVATAR
      : PROFILE_IDENTITY_CARD_STATE.EXPANDED;
  }
  return current;
}
