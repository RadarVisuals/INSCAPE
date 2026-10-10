// Editorial landing-page choice, independent of directory order and search.
export const FEATURED_WORLD_PROFILE_ADDRESS = '0xf3c189819fd5b042f692983bfbfd57ab607ee709';

export function selectFeaturedWorld(profiles = []) {
  return profiles.find(({ address }) => address?.toLowerCase() === FEATURED_WORLD_PROFILE_ADDRESS)
    || { address: FEATURED_WORLD_PROFILE_ADDRESS, name: null, avatarUrl: null };
}
