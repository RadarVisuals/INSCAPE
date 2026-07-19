export function searchCreations(creations, query) {
  const needle = String(query || '').trim().toLocaleLowerCase();
  if (!needle) return creations;
  return creations.filter((creation) => [
    creation.name, creation.description, creation.collectionName, creation.contractAddress, creation.tokenId,
    ...(creation.creators || []).flatMap((creator) => [creator.name, creator.address])
  ].some((value) => String(value || '').toLocaleLowerCase().includes(needle)));
}
