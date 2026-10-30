import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../../library/config.js';
import { PROFILE_CONTRACT_FACT_STATUS } from '../../profileIdentity/domain/profileContractFacts.js';
import { PROFILE_IDENTITY_STATUS } from '../../profileIdentity/domain/profileIdentity.js';
import { resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';

const cleanOverlayText = (value, maximum) => typeof value === 'string' && !/[\u0000-\u001f\u007f]/u.test(value)
  ? value.trim().slice(0, maximum) : '';
const resolved = (fact) => fact?.status === PROFILE_CONTRACT_FACT_STATUS.RESOLVED;
const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze(entry)));
// Product designation, independent of editable names, titles, tags and published card content.
const INSCAPE_FOUNDER_PROFILE = '0x001048331cd14cef40dd5da644a738e7324fe691';

function selectUrlCandidate(candidates, minimumWidth = 0) {
  const urls = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.kind === 'URL' && candidate.url)
    .slice().sort((left, right) => (left.width || 0) - (right.width || 0));
  return urls.find((candidate) => (candidate.width || 0) >= minimumWidth) || urls.at(-1) || null;
}

function findTokenReference(candidates) {
  const candidate = (Array.isArray(candidates) ? candidates : []).find((entry) => entry?.kind === 'TOKEN_REFERENCE');
  return candidate ? Object.freeze({ address: candidate.address, tokenId: candidate.tokenId, provenance: candidate.source }) : null;
}

function resolveAsset(assetRecords, stableAssetId) {
  if (!stableAssetId) return null;
  if (assetRecords instanceof Map) return assetRecords.get(stableAssetId) || null;
  return (Array.isArray(assetRecords) ? assetRecords : []).find((asset) => asset?.id === stableAssetId) || null;
}

function verifiedPublishedAt(publishedResolution) {
  if (!['RESOLVED', 'STALE'].includes(publishedResolution?.status)) return null;
  const exportedAt = publishedResolution?.document?.exportedAt;
  const timestamp = typeof exportedAt === 'string' ? Date.parse(exportedAt) : Number.NaN;
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toISOString() : null;
}

export function createProductionIdentityDossierViewModel({
  identity,
  contractFacts,
  identityPresentation,
  assetRecords,
  cachedIdentity = null,
  presentationScope = 'owner',
  publishedResolution,
} = {}) {
  const address = normalizeProfileAddress(contractFacts?.address?.value || identity?.normalizedAddress || identity?.address);
  if (!address) return null;
  const metadataResolved = identity?.status === PROFILE_IDENTITY_STATUS.RESOLVED;
  const presentation = identityPresentation && typeof identityPresentation === 'object' ? identityPresentation : {};
  const alias = cleanOverlayText(presentation.alias, 80);
  const cachedName = cleanOverlayText(cachedIdentity?.name, 80) || null;
  const officialName = metadataResolved ? identity?.name || cachedName : cachedName;
  const displayName = alias || officialName || 'UNNAMED PROFILE';
  const nameProvenance = alias ? presentationScope === 'published' ? 'INSCAPE_PUBLISHED_ALIAS' : 'INSCAPE_DRAFT_ALIAS'
    : metadataResolved && identity?.name ? 'LSP3_NAME' : cachedName ? 'PUBLISHED_IDENTITY_CACHE' : 'FALLBACK';

  const avatarMode = presentation.avatar?.mode === 'inscape' ? 'inscape' : 'official';
  const officialProfileImage = selectUrlCandidate(identity?.profileImageCandidates, 256);
  const draftAvatarAsset = avatarMode === 'inscape'
    ? resolveAsset(assetRecords, presentation.avatar?.stableAssetId) : null;
  const cachedAvatarUrl = cleanOverlayText(cachedIdentity?.avatarUrl, 2048) || null;
  const avatarUrl = avatarMode === 'inscape'
    ? presentation.avatar?.selectedMedia?.url || draftAvatarAsset?.originalImageUrl || draftAvatarAsset?.imageUrl || draftAvatarAsset?.thumbnailUrl || null
    : metadataResolved ? officialProfileImage?.url || identity?.avatarUrl || cachedAvatarUrl : cachedAvatarUrl;
  const avatarProvenance = avatarMode === 'inscape' && avatarUrl
    ? presentationScope === 'published' ? 'INSCAPE_PUBLISHED_ASSET' : 'INSCAPE_DRAFT_ASSET'
    : metadataResolved && avatarUrl ? 'LSP3_PROFILE_IMAGE' : avatarUrl ? 'PUBLISHED_IDENTITY_CACHE' : 'UNRESOLVED';

  const bioMode = ['official', 'inscape', 'hidden'].includes(presentation.bio?.mode) ? presentation.bio.mode : 'official';
  const officialDescription = metadataResolved ? identity?.description || null : null;
  const description = bioMode === 'hidden' ? null
    : bioMode === 'inscape' ? cleanOverlayText(presentation.bio?.customText, 480) || null : officialDescription;
  const descriptionProvenance = description
    ? bioMode === 'inscape' ? presentationScope === 'published' ? 'INSCAPE_PUBLISHED_BIO' : 'INSCAPE_DRAFT_BIO'
      : 'LSP3_DESCRIPTION' : 'UNRESOLVED';

  const officialTags = metadataResolved && presentation.tags?.includeOfficial !== false && Array.isArray(identity?.tags)
    ? identity.tags : [];
  const additionalTags = Array.isArray(presentation.tags?.additional)
    ? presentation.tags.additional.map((tag) => cleanOverlayText(tag, 48)).filter(Boolean) : [];
  const tags = [...new Set([...officialTags, ...additionalTags])];
  const background = metadataResolved ? selectUrlCandidate(identity?.backgroundImageCandidates, 1200) : null;
  const linksVisible = presentation.visibility?.links !== false;
  const networkVerified = presentation.visibility?.network !== false
    && resolved(contractFacts?.chain) && contractFacts.chain.value === LUKSO_CHAIN_ID;
  const authoredLinks = metadataResolved && Array.isArray(identity?.links) ? identity.links.map((link) => ({
    id: `authored-${link.id}`, label: link.label, url: link.url, kind: 'AUTHORED',
    provenance: 'LSP3_PROFILE_AUTHORED', verificationStatus: 'AUTHORED_NOT_VERIFIED'
  })) : [];
  const systemLinks = [
    { id: 'universal-everything', label: 'UNIVERSAL EVERYTHING', url: `https://universaleverything.io/${address}` },
    ...(networkVerified ? [{ id: 'explorer', label: 'LUKSO EXPLORER', url: `https://explorer.execution.mainnet.lukso.network/address/${address}` }] : []),
  ].map((link) => ({ ...link, kind: 'SYSTEM', provenance: 'CANONICAL_SYSTEM_ROUTE', verificationStatus: 'CANONICAL_ROUTE' }));
  const links = linksVisible ? [...authoredLinks, ...systemLinks] : [];

  const metadataIntegrity = metadataResolved ? identity?.metadataIntegrity || 'UNVERIFIED' : 'UNRESOLVED';
  const technical = [
    { id: 'address', label: 'UNIVERSAL PROFILE ADDRESS', value: address, provenance: 'CANONICAL_ADDRESS' },
    { id: 'metadata-integrity', label: 'LSP3 METADATA INTEGRITY', value: metadataIntegrity, provenance: metadataResolved ? 'LSP3_METADATA' : 'RESOLUTION_STATUS' }
  ];
  if (networkVerified) {
    technical.push({ id: 'network', label: 'NETWORK', value: 'LUKSO / CHAIN 42', provenance: 'DIRECT_RPC' });
  }
  if (resolved(contractFacts?.isUniversalProfile) && contractFacts.isUniversalProfile.value === true) {
    technical.push({ id: 'type', label: 'PROFILE TYPE', value: 'LSP0 UNIVERSAL PROFILE', provenance: 'DIRECT_RPC' });
  }
  const lastPublished = presentation.visibility?.publicationDate === false ? null : verifiedPublishedAt(publishedResolution);
  if (lastPublished) technical.push({ id: 'last-published', label: 'LAST PUBLISHED', value: lastPublished, provenance: 'VERIFIED_PUBLICATION' });
  if (presentation.visibility?.counts !== false) {
    if (resolved(contractFacts?.receivedAssetContracts) && Number.isSafeInteger(contractFacts.receivedAssetContracts.value)) {
      technical.push({ id: 'received', label: 'RECEIVED ASSET CONTRACTS', value: String(contractFacts.receivedAssetContracts.value), provenance: 'DIRECT_LSP5' });
    }
    if (resolved(contractFacts?.issuedAssetContracts) && Number.isSafeInteger(contractFacts.issuedAssetContracts.value)) {
      technical.push({ id: 'issued', label: 'ISSUED ASSET CONTRACTS', value: String(contractFacts.issuedAssetContracts.value), provenance: 'DIRECT_LSP12' });
    }
  }

  return Object.freeze({
    key: address,
    address,
    designation: address === INSCAPE_FOUNDER_PROFILE && resolved(contractFacts?.chain)
      && contractFacts.chain.value === LUKSO_CHAIN_ID
      ? Object.freeze({ label: 'Founder', title: 'INSCAPE founder' }) : null,
    card: resolveIdentityCard(presentation),
    cardConfigured: Object.hasOwn(presentation, 'card'),
    officialProfile: Object.freeze({
      name: officialName || 'UNNAMED PROFILE',
      description: bioMode === 'hidden' ? null : officialDescription,
      tags: Object.freeze(officialTags),
      avatarUrl: metadataResolved ? officialProfileImage?.url || identity?.avatarUrl || cachedAvatarUrl : cachedAvatarUrl,
      url: `https://universaleverything.io/${address}`,
    }),
    authoredProfile: Object.freeze({
      title: alias,
      description: bioMode === 'inscape' ? description : null,
      tags: Object.freeze(additionalTags),
    }),
    profile: Object.freeze({
      displayName, nameProvenance, avatarUrl, avatarProvenance,
      avatarShape: presentation.avatar?.shape === 'round' ? 'round' : 'square',
      profileImageTokenReference: avatarMode === 'official' ? findTokenReference(identity?.profileImageCandidates) : null,
      backgroundUrl: background?.url || null,
      backgroundProvenance: background?.source || null,
      description, descriptionProvenance,
      tags: Object.freeze(tags),
      metadataIntegrity
    }),
    links: freezeEntries(links),
    technical: freezeEntries(technical),
    status: Object.freeze({ metadata: identity?.status || 'IDLE' })
  });
}
