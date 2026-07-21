export const PUBLISHED_IDENTITY_RACK_MODULES = Object.freeze({
  profile: Object.freeze({ label: 'PROFILE' }),
  bio: Object.freeze({ label: 'BIO' }),
  'links-tags': Object.freeze({ label: 'LINKS / TAGS' })
});

const abbreviatedAddress = (address) => `${address.slice(0, 8)}…${address.slice(-6)}`;

export function projectPublishedIdentityRack(document) {
  const rack = document?.presentation?.racks?.find((candidate) => candidate?.id === 'identity' && candidate.visible === true);
  if (!rack) return null;
  const modules = (Array.isArray(rack.modules) ? rack.modules : [])
    .filter((module) => PUBLISHED_IDENTITY_RACK_MODULES[module?.id] && module.visible === true)
    .sort((first, second) => first.order - second.order)
    .map((module) => ({ ...module, label: PUBLISHED_IDENTITY_RACK_MODULES[module.id].label }));
  if (!modules.length) return null;
  const identity = document.profile.cachedIdentity;
  return {
    id: rack.id,
    modules,
    identity,
    displayName: identity.name || abbreviatedAddress(document.profile.address),
    displayAddress: abbreviatedAddress(document.profile.address),
    address: document.profile.address,
    officialProfileUrl: `https://universaleverything.io/${document.profile.address}`
  };
}
