import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../../library/config.js';
import { PROFILE_CONTRACT_FACT_STATUS } from '../../profileIdentity/domain/profileContractFacts.js';
import { PROFILE_IDENTITY_STATUS } from '../../profileIdentity/domain/profileIdentity.js';

const cleanOverlayText = (value, maximum) => typeof value === 'string' && !/[\u0000-\u001f\u007f]/u.test(value)
  ? value.trim().slice(0, maximum) : '';
const resolved = (fact) => fact?.status === PROFILE_CONTRACT_FACT_STATUS.RESOLVED;
const freezeEntries = (entries) => Object.freeze(entries.map((entry) => Object.freeze(entry)));

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

function canonicalInscapeUrl(locationLike, address) {
  try {
    const url = new URL(locationLike?.href || String(locationLike));
    url.search = '';
    url.hash = '';
    url.searchParams.set('view', address);
    return url.toString();
  } catch { return null; }
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
  publishedResolution,
  locationLike = globalThis.location
} = {}) {
  const address = normalizeProfileAddress(contractFacts?.address?.value || identity?.normalizedAddress || identity?.address);
  if (!address) return null;
  const metadataResolved = identity?.status === PROFILE_IDENTITY_STATUS.RESOLVED;
  const presentation = identityPresentation && typeof identityPresentation === 'object' ? identityPresentation : {};
  const alias = cleanOverlayText(presentation.alias, 80);
  const officialName = metadataResolved ? identity?.name || null : null;
  const displayName = alias || officialName || 'UNNAMED PROFILE';
  const nameProvenance = alias ? 'INSCAPE_DRAFT_ALIAS' : officialName ? 'LSP3_NAME' : 'FALLBACK';

  const avatarMode = presentation.avatar?.mode === 'inscape' ? 'inscape' : 'official';
  const officialProfileImage = selectUrlCandidate(identity?.profileImageCandidates, 64);
  const draftAvatarAsset = avatarMode === 'inscape'
    ? resolveAsset(assetRecords, presentation.avatar?.stableAssetId) : null;
  const avatarUrl = avatarMode === 'inscape'
    ? draftAvatarAsset?.imageUrl || draftAvatarAsset?.originalImageUrl || draftAvatarAsset?.thumbnailUrl || null
    : metadataResolved ? officialProfileImage?.url || identity?.avatarUrl || null : null;
  const avatarProvenance = avatarMode === 'inscape' && avatarUrl ? 'INSCAPE_DRAFT_ASSET'
    : avatarUrl ? 'LSP3_PROFILE_IMAGE' : 'UNRESOLVED';

  const bioMode = ['official', 'inscape', 'hidden'].includes(presentation.bio?.mode) ? presentation.bio.mode : 'official';
  const officialDescription = metadataResolved ? identity?.description || null : null;
  const description = bioMode === 'hidden' ? null
    : bioMode === 'inscape' ? cleanOverlayText(presentation.bio?.customText, 480) || null : officialDescription;
  const descriptionProvenance = description
    ? bioMode === 'inscape' ? 'INSCAPE_DRAFT_BIO' : 'LSP3_DESCRIPTION' : 'UNRESOLVED';

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
  const inscapeUrl = canonicalInscapeUrl(locationLike, address);
  const systemLinks = [
    { id: 'universal-everything', label: 'UNIVERSAL EVERYTHING', url: `https://universaleverything.io/${address}` },
    ...(networkVerified ? [{ id: 'explorer', label: 'LUKSO EXPLORER', url: `https://explorer.execution.mainnet.lukso.network/address/${address}` }] : []),
    ...(inscapeUrl ? [{ id: 'inscape-profile', label: 'INSCAPE PROFILE', url: inscapeUrl }] : [])
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
