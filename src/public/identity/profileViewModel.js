import { getOfficialProfileUrl, PROFILE_IDENTITY_STATUS } from '../../profileIdentity/domain/profileIdentity.js';

const METADATA_STATUS_LABELS = Object.freeze({
  [PROFILE_IDENTITY_STATUS.IDLE]: 'Metadata pending',
  [PROFILE_IDENTITY_STATUS.LOADING]: 'Resolving metadata',
  [PROFILE_IDENTITY_STATUS.RESOLVED]: 'Metadata resolved',
  [PROFILE_IDENTITY_STATUS.UNAVAILABLE]: 'Metadata unavailable',
  [PROFILE_IDENTITY_STATUS.ERROR]: 'Metadata error'
});

function abbreviateAddress(address) {
  return typeof address === 'string' && address.length > 18
    ? `${address.slice(0, 10)}…${address.slice(-6)}`
    : address || 'Address unavailable';
}

export function getIdentityProfileViewModel(identity, { walletConnected = false } = {}) {
  const status = identity?.status || PROFILE_IDENTITY_STATUS.IDLE;
  const address = identity?.normalizedAddress || identity?.address || null;
  const metadataResolved = status === PROFILE_IDENTITY_STATUS.RESOLVED;
  const links = metadataResolved && Array.isArray(identity?.links) ? [...identity.links] : [];
  const officialUrl = getOfficialProfileUrl(address);
  if (officialUrl) links.unshift({ id: 'official-profile', label: 'Universal Profile', url: officialUrl, primary: true });

  return Object.freeze({
    address,
    displayAddress: abbreviateAddress(address),
    name: metadataResolved && identity?.name ? identity.name : 'Unnamed profile',
    avatarUrl: metadataResolved ? identity?.avatarUrl || null : null,
    bio: metadataResolved ? identity?.description || null : null,
    tags: Object.freeze(metadataResolved && Array.isArray(identity?.tags) ? [...identity.tags] : []),
    links: Object.freeze(links.map((link) => Object.freeze({ ...link }))),
    metadataStatus: status,
    metadataStatusLabel: METADATA_STATUS_LABELS[status] || 'Metadata unavailable',
    metadataResolved,
    walletConnected: walletConnected === true
  });
}

// LSP3 has no follower count. A real value needs a separate social graph/indexer.
export const FOLLOWERS_DISCLOSURE = 'Follower counts are not part of LSP3 metadata. A real count requires a separate social graph or indexer.';
