const LOCAL_PROFILE_FIXTURE = Object.freeze({
  name: 'Morrow, Beneath the Static',
  address: 'morrow.underneath',
  description: 'A resident signal moving through illustrated caverns, collecting fragments, sightings, and unfinished transmissions.',
  tags: ['resident', 'specimen 017', 'ink-born', 'signal-sensitive'],
  social: { followers: 1284, following: 73 },
  wallet: { connected: false }
});

function compactCount(value) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Math.max(0, Number(value) || 0));
}

export function normalizePublicProfile(source) {
  const tags = Array.isArray(source?.tags)
    ? source.tags.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 6)
    : [];

  return Object.freeze({
    name: String(source?.name || 'Unnamed resident'),
    address: String(source?.address || 'address unavailable'),
    description: String(source?.description || ''),
    tags: Object.freeze(tags),
    stats: Object.freeze([
      { label: 'Followers', value: compactCount(source?.social?.followers) },
      { label: 'Following', value: compactCount(source?.social?.following) }
    ]),
    wallet: Object.freeze({
      label: source?.wallet?.connected ? 'Wallet present' : 'Wallet not connected',
      connected: source?.wallet?.connected === true
    }),
    followAction: Object.freeze({
      label: 'Follow unavailable',
      disabled: true,
      explanation: 'Local preview only. No relationship or transaction has been loaded.'
    })
  });
}

export function getIdentityProfileViewModel() {
  return normalizePublicProfile(LOCAL_PROFILE_FIXTURE);
}
