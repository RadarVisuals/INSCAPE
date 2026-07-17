export const IDENTITY_PROTOTYPE_PROFILE = Object.freeze({
  artistName: 'VXCTXR',
  pfpSrc: '/assets/PFP/PFP.webp',
  collectionName: 'Human Underneath',
  tags: Object.freeze(['Digital Art', 'Creature Design', 'Animation']),
  links: Object.freeze([
    Object.freeze({ id: 'universal', label: 'Universal profile', mark: 'UP', primary: true }),
    Object.freeze({ id: 'x', label: 'X / Twitter', mark: 'X' }),
    Object.freeze({ id: 'instagram', label: 'Instagram', mark: 'IG' }),
    Object.freeze({ id: 'facebook', label: 'Facebook', mark: 'FB' })
  ]),
  badges: Object.freeze([
    Object.freeze({ id: 'origin', label: 'Origin member', mark: '01' }),
    Object.freeze({ id: 'creator', label: 'Verified creator', mark: 'CR' }),
    Object.freeze({ id: 'signal', label: 'Signal keeper', mark: 'SK' })
  ]),
  followers: 1204,
  connected: true
});

export function normalizePublicProfile(source) {
  const tags = Array.isArray(source?.tags)
    ? source.tags.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 6)
    : [];
  const links = Array.isArray(source?.links)
    ? source.links.filter((link) => link?.id && link?.label).slice(0, 6).map((link) => Object.freeze({
      id: String(link.id),
      label: String(link.label),
      mark: String(link.mark || link.label),
      primary: link.primary === true
    }))
    : [];
  const badges = Array.isArray(source?.badges)
    ? source.badges.filter((badge) => badge?.id && badge?.label).slice(0, 8).map((badge) => Object.freeze({
      id: String(badge.id),
      label: String(badge.label),
      mark: String(badge.mark || badge.label)
    }))
    : [];

  return Object.freeze({
    artistName: String(source?.artistName || 'Unnamed artist'),
    pfpSrc: String(source?.pfpSrc || ''),
    collectionName: String(source?.collectionName || ''),
    tags: Object.freeze(tags),
    links: Object.freeze(links),
    badges: Object.freeze(badges),
    followers: Math.max(0, Math.round(Number(source?.followers) || 0)),
    connected: source?.connected === true
  });
}

export function getIdentityProfileViewModel() {
  return normalizePublicProfile(IDENTITY_PROTOTYPE_PROFILE);
}
