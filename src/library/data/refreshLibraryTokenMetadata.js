import { lsp8CollectionMetadataResolver } from './lsp8TokenMetadataResolver.js';
import { selectImageGroups, selectImageUrls } from './resolveContentUrl.js';

// Metadata refresh never discovers holdings or changes creator/owner authority.
// Small sequential batches bound RPC and media work across contracts.
export async function* refreshLibraryTokenMetadata(assets, { signal, resolver = lsp8CollectionMetadataResolver } = {}) {
  const contracts = new Map();
  for (const asset of assets) {
    if (asset.standard !== 'LSP8' || !/^0x[0-9a-f]{64}$/iu.test(asset.tokenId || '')) continue;
    const tokens = contracts.get(asset.contractAddress) || [];
    tokens.push(asset); contracts.set(asset.contractAddress, tokens);
  }
  for (const [contract, tokens] of contracts) {
    for (let offset = 0; offset < tokens.length; offset += 8) {
      signal?.throwIfAborted();
      const batch = tokens.slice(offset, offset + 8);
      const metadata = await resolver.resolve(contract, batch, { signal });
      signal?.throwIfAborted();
      const refreshed = [];
      for (const asset of batch) {
        const record = metadata.get(asset.tokenId.toLowerCase());
        if (!record) continue;
        const urls = selectImageUrls(record.images);
        const provenance = { scope: 'tokenId', source: record.metadataSource };
        refreshed.push({ ...asset,
          name: record.name || asset.name, description: record.description,
          imageUrl: urls.imageUrl, thumbnailUrl: urls.thumbnailUrl, originalImageUrl: urls.originalImageUrl,
          imageWidth: urls.width, imageHeight: urls.height, mediaFileType: urls.fileType || null,
          imageGroups: selectImageGroups(record.images),
          attributes: record.attributes.map(({ key, value, attributeType, type }) => ({ key, value, type: attributeType || type })),
          metadataStatus: urls.imageUrl ? 'ready' : 'partial',
          fieldProvenance: { ...asset.fieldProvenance, ...(record.name ? { name: provenance } : {}),
            description: provenance, images: provenance, attributes: provenance },
          rawMetadata: { ...asset.rawMetadata, originalImageUrl: urls.originalImageUrl },
        });
      }
      yield { assets: refreshed, failures: batch.length - refreshed.length };
    }
  }
}
