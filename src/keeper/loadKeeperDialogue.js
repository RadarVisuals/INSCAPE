import { lsp8CollectionMetadataResolver } from '../library/data/lsp8TokenMetadataResolver.js';
import { LUKSO_CHAIN_ID } from '../library/config.js';
import { resolveContentUrl } from '../library/data/resolveContentUrl.js';
import { fetchMetadataJson } from '../library/data/fetchMetadataJson.js';
import { KEEPER_DIALOGUE_FORMAT, KEEPER_DIALOGUE_MAX_BYTES, parseKeeperDialogue } from './keeperDialogue.js';

export async function loadKeeperDialogue(asset, { signal, resolver = lsp8CollectionMetadataResolver, fetchImpl = globalThis.fetch } = {}) {
  signal?.throwIfAborted();
  if (asset?.chainId !== LUKSO_CHAIN_ID || asset.tokenStandard !== 'LSP8' || !asset.tokenId) return null;
  const attachments = await resolver.resolveAttachments(asset.contractAddress, asset.tokenId, { signal });
  signal?.throwIfAborted();
  const candidates = attachments.filter(file => /^(text\/plain|application\/json)(?:;|$)/iu.test(file?.fileType || '')
    || /\.(txt|json)(?:[?#]|$)/iu.test(file?.url || ''));
  if (candidates.length > 8) throw new Error('This token has too many text attachments to inspect.');
  // Prefer the named package, but its format marker—not its filename—is authoritative.
  candidates.sort((a, b) => Number(/keeper-dialogue/iu.test(b.url)) - Number(/keeper-dialogue/iu.test(a.url)));
  let failure;
  for (const file of candidates) {
    signal?.throwIfAborted();
    try {
      const url = resolveContentUrl(file.url);
      if (!url) throw new Error('The attached dialogue URL is unsupported.');
      const document = await fetchMetadataJson(url, { fetchImpl, signal, maxBytes: KEEPER_DIALOGUE_MAX_BYTES,
        verification: file.verification, timeoutMs: 10_000 });
      if (document?.format === KEEPER_DIALOGUE_FORMAT) return parseKeeperDialogue(document);
      if (/keeper-dialogue/iu.test(file.url)) throw new Error('The attached file is not Keeper dialogue version 1.');
    } catch (error) {
      signal?.throwIfAborted();
      // Ordinary plain-text attachments are not dialogue. A named package, bad
      // hash or unreadable response is a failure, not successful empty content.
      if (!(error instanceof SyntaxError) || /keeper-dialogue/iu.test(file.url)) failure = error;
    }
  }
  if (failure) throw failure;
  return null;
}
