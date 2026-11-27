import { lsp8CollectionMetadataResolver } from '../library/data/lsp8TokenMetadataResolver.js';
import { keeperMetadataReference, keeperMetadataResult } from './keeperMetadata.js';

export async function loadKeeperMetadata(reference, { signal, resolver = lsp8CollectionMetadataResolver } = {}) {
  const ref = keeperMetadataReference(reference?.stableAssetId, reference?.tokenStandard);
  if (!ref) throw new Error('Unsupported artwork metadata reference.');
  signal?.throwIfAborted();
  let abort;
  try {
    // The shared RPC transport can outlive its caller. Stop waiting immediately
    // on closure/timeout and discard that late result without changing Library.
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
    });
    const records = await Promise.race([resolver.resolve(ref.contractAddress, [{ tokenId: ref.tokenId }], { signal, strict: true }), cancelled]);
    signal?.throwIfAborted();
    const record = records.get(ref.tokenId);
    if (!record?.metadataResolved) return { ...ref, status: 'unavailable' };
    return keeperMetadataResult({ ...ref, status: 'available', source: record.metadataSource, readAt: Date.now(),
      name: record.name, description: record.description,
      attributes: record.attributes?.map(item => ({ ...item, type: item.attributeType })),
    }, ref);
  } catch {
    signal?.throwIfAborted();
    // A gateway, RPC or verification failure is not successful empty metadata.
    return { ...ref, status: 'failed' };
  } finally { signal?.removeEventListener('abort', abort); }
}
