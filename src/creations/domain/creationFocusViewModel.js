const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;

export function createCreationFocusEntry(creation, dimensions) {
  const src = creation?.originalImageUrl || creation?.imageUrl || creation?.thumbnailUrl || null;
  if (!src || !dimensions?.width || !dimensions?.height) return null;
  const creators = Array.isArray(creation.creators) ? creation.creators : [];
  const ownership = creation.ownershipKnown === true
    ? creation.isOwnedByViewedProfile === true ? 'OWNED BY VIEWED PROFILE' : 'NOT OWNED BY VIEWED PROFILE'
    : 'CURRENT OWNERSHIP UNRESOLVED';
  const technical = [
    creators.length ? { label: 'CREATORS / INDEXED ATTRIBUTION', value: creators.map((creator) => creator.name
      ? `${creator.name} — ${creator.address}` : creator.address).join('\n') } : null,
    creation.viewedProfileIsCreator === true ? { label: 'VIEWED PROFILE RELATIONSHIP', value: `CREATOR / ${String(creation.creatorAttributionLevel || 'INDEXED').toUpperCase()}` } : null,
    { label: 'CURRENT OWNERSHIP', value: ownership },
    creation.collectionName ? { label: 'COLLECTION / METADATA', value: creation.collectionName } : null,
    creation.contractAddress ? { label: 'CONTRACT', value: creation.contractAddress } : null,
    creation.tokenId ? { label: 'TOKEN ID / TOKEN', value: creation.tokenId } : null,
    creation.standard ? { label: 'STANDARD / INDEXED', value: String(creation.standard).toUpperCase() } : null,
    creation.chainId ? { label: 'CHAIN ID', value: String(creation.chainId) } : null,
    { label: 'SOURCE DIMENSIONS', value: `${dimensions.width} × ${dimensions.height} PX` },
    creation.contractAddress ? { label: 'EXPLORER / DERIVED', value: `https://explorer.lukso.network/address/${creation.contractAddress}`,
      href: `https://explorer.lukso.network/address/${creation.contractAddress}` } : null,
  ].filter(Boolean);
  return Object.freeze({
    accessibleLabel: clean(creation.name) || 'Untitled creation',
    dossier: { title: clean(creation.name), description: clean(creation.description),
      traits: (creation.attributes || []).map((attribute) => ({ label: clean(attribute.key), value: String(attribute.value ?? '') })).filter(({ label }) => label),
      technical },
    focusDimensions: dimensions,
    media: { accessibleLabel: clean(creation.name) || 'Untitled creation', src },
    placement: { id: creation.id },
  });
}
