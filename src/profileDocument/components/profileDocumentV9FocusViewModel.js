import { adaptProfileDocumentV9Media, PROFILE_DOCUMENT_V9_MEDIA_STATUS } from './profileDocumentV9Media.js';

const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const shortAddress = (value) => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : null;

export function createProfileDocumentV9FocusViewModel(placement) {
  const published = placement?.asset;
  const media = adaptProfileDocumentV9Media(published);
  if (!published || media.status !== PROFILE_DOCUMENT_V9_MEDIA_STATUS.READY) return null;
  const dimensions = media.dimensions;
  const creatorGroups = new Map();
  for (const creator of published.creators) {
    const key = `${creator.source}\u0000${creator.scope}`;
    const group = creatorGroups.get(key) || { source: creator.source, scope: creator.scope, creators: [] };
    group.creators.push(creator); creatorGroups.set(key, group);
  }
  const technical = [
    ...[...creatorGroups.values()].map((group) => ({
      label: group.scope === 'tokenId' ? 'CREATORS / TOKEN' : 'CREATORS / CONTRACT',
      value: group.creators.map((creator) => clean(creator.name) ? `${creator.name} — ${creator.address}` : creator.address).join('\n'),
      provenance: `${group.source} / ${group.scope}`,
    })),
    published.contractAddress ? { label: 'CONTRACT', value: published.contractAddress } : null,
    published.tokenId && published.tokenStandard === 'LSP8' ? { label: 'TOKEN ID / TOKEN', value: published.tokenId } : null,
    published.tokenStandard !== 'UNKNOWN' ? { label: 'STANDARD / CONTRACT', value: published.tokenStandard } : null,
    { label: 'NETWORK', value: published.network === 'lukso-mainnet' ? 'LUKSO MAINNET' : published.network },
    dimensions ? { label: 'SOURCE DIMENSIONS', value: `${dimensions.width} × ${dimensions.height} PX` } : null,
    published.contractAddress ? { label: 'EXPLORER / DERIVED', value: `https://explorer.lukso.network/address/${published.contractAddress}`,
      href: `https://explorer.lukso.network/address/${published.contractAddress}` } : null,
  ].filter(Boolean);
  return Object.freeze({
    dossier: { title: clean(published.name), description: clean(published.description),
      traits: published.attributes.map((attribute) => ({ label: clean(attribute.key), value: String(attribute.value ?? '') }))
        .filter((attribute) => attribute.label), technical },
    focusDimensions: dimensions, media, placement,
    accessibleLabel: clean(published.name) || shortAddress(published.contractAddress) || 'Artwork',
  });
}
