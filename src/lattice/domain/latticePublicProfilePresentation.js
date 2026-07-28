export const PUBLIC_PROFILE_PRESENTATION_STATUS = Object.freeze({
  UNRESOLVED: 'UNRESOLVED',
  RESOLVED: 'RESOLVED',
});

const PROFILE_ADDRESS = /^0x[0-9a-f]{40}$/iu;
const cleanText = (value, maximum) => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return clean ? clean.slice(0, maximum) : null;
};
const cleanTags = (value) => {
  const tags = [];
  for (const candidate of Array.isArray(value) ? value : []) {
    const tag = cleanText(candidate, 48);
    if (!tag || tags.some((entry) => entry.toLocaleLowerCase() === tag.toLocaleLowerCase())) continue;
    tags.push(tag);
    if (tags.length === 16) break;
  }
  return tags;
};
const cleanMediaUrl = (value) => {
  const clean = cleanText(value, 2048);
  if (!clean) return null;
  if (clean.startsWith('/')) return clean;
  try {
    const url = new URL(clean);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};
const cleanWorkspaceUrl = (value) => {
  const clean = cleanText(value, 2048);
  if (!clean) return null;
  try {
    const url = new URL(clean);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};

export function createUnresolvedPublicProfilePresentation() {
  return {
    status: PUBLIC_PROFILE_PRESENTATION_STATUS.UNRESOLVED,
    official: {
      address: null,
      handle: null,
      avatarUrl: null,
      bio: null,
      tags: [],
      network: null,
      verified: null,
    },
    overlay: {
      alias: null,
      avatar: { mode: 'official', url: null, shape: 'square' },
      bio: { mode: 'official', text: null },
      tags: [],
    },
    counts: { assets: null, collections: null },
    workspaceUrl: null,
  };
}

export function normalizePublicProfilePresentation(input) {
  const unresolved = createUnresolvedPublicProfilePresentation();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return unresolved;

  const address = typeof input.official?.address === 'string'
    && PROFILE_ADDRESS.test(input.official.address)
    ? input.official.address.toLowerCase()
    : null;
  const resolved = input.status === PUBLIC_PROFILE_PRESENTATION_STATUS.RESOLVED && Boolean(address);
  if (!resolved) return unresolved;

  const avatarMode = input.overlay?.avatar?.mode === 'inscape' ? 'inscape' : 'official';
  const bioMode = ['official', 'inscape', 'hidden'].includes(input.overlay?.bio?.mode)
    ? input.overlay.bio.mode
    : 'official';
  return {
    status: PUBLIC_PROFILE_PRESENTATION_STATUS.RESOLVED,
    official: {
      address,
      handle: cleanText(input.official?.handle, 80),
      avatarUrl: cleanMediaUrl(input.official?.avatarUrl),
      bio: cleanText(input.official?.bio, 480),
      tags: cleanTags(input.official?.tags),
      network: cleanText(input.official?.network, 80),
      verified: typeof input.official?.verified === 'boolean' ? input.official.verified : null,
    },
    overlay: {
      alias: cleanText(input.overlay?.alias, 80),
      avatar: {
        mode: avatarMode,
        url: avatarMode === 'inscape' ? cleanMediaUrl(input.overlay?.avatar?.url) : null,
        shape: input.overlay?.avatar?.shape === 'round' ? 'round' : 'square',
      },
      bio: {
        mode: bioMode,
        text: bioMode === 'inscape' ? cleanText(input.overlay?.bio?.text, 480) : null,
      },
      tags: cleanTags(input.overlay?.tags),
    },
    counts: {
      assets: Number.isSafeInteger(input.counts?.assets) && input.counts.assets >= 0 ? input.counts.assets : null,
      collections: Number.isSafeInteger(input.counts?.collections) && input.counts.collections >= 0 ? input.counts.collections : null,
    },
    workspaceUrl: cleanWorkspaceUrl(input.workspaceUrl),
  };
}

export function publicProfileResidentCode(address) {
  return PROFILE_ADDRESS.test(String(address || '')) ? String(address).slice(2, 5).toUpperCase() : null;
}

export function compactPublicProfileAddress(address) {
  return PROFILE_ADDRESS.test(String(address || ''))
    ? `${String(address).slice(0, 5)}\u2026${String(address).slice(-4)}`
    : null;
}

export function selectPublicProfilePresentation(input) {
  const presentation = normalizePublicProfilePresentation(input);
  const resolved = presentation.status === PUBLIC_PROFILE_PRESENTATION_STATUS.RESOLVED;
  const avatarUrl = presentation.overlay.avatar.mode === 'inscape'
    ? presentation.overlay.avatar.url
    : presentation.official.avatarUrl;
  const bio = presentation.overlay.bio.mode === 'hidden'
    ? null
    : presentation.overlay.bio.mode === 'inscape'
      ? presentation.overlay.bio.text
      : presentation.official.bio;
  const tags = presentation.overlay.tags.reduce((combined, tag) => (
    combined.some((entry) => entry.toLocaleLowerCase() === tag.toLocaleLowerCase())
      ? combined
      : [...combined, tag]
  ), [...presentation.official.tags]);
  return {
    ...presentation,
    resolved,
    residentCode: publicProfileResidentCode(presentation.official.address),
    compactAddress: compactPublicProfileAddress(presentation.official.address),
    displayName: presentation.overlay.alias || presentation.official.handle,
    avatarUrl,
    avatarSource: presentation.overlay.avatar.mode === 'inscape' ? 'INSCAPE PRESENTATION' : 'UNIVERSAL PROFILE',
    bio,
    bioHidden: presentation.overlay.bio.mode === 'hidden',
    bioSource: presentation.overlay.bio.mode === 'inscape' ? 'INSCAPE PRESENTATION' : 'UNIVERSAL PROFILE',
    tags,
  };
}
