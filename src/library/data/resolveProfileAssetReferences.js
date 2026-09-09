let activeController = null;

export async function resolveProfileAssetReferences(profileAddress, stableAssetIds) {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const assets = [];
  const consume = async (repository, method, options) => {
    for await (const batch of repository[method](profileAddress, stableAssetIds,
      { signal: controller.signal, ...options })) {
      if (batch.assets?.length) assets.push(...batch.assets);
    }
  };
  try {
    const { chillwhalesProfileReferencesRepository } = await import('./chillwhalesProfileReferencesRepository.js');
    await consume(chillwhalesProfileReferencesRepository, 'loadProfileAssetReferences');
    return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
  } finally {
    if (activeController === controller) activeController = null;
  }
}
