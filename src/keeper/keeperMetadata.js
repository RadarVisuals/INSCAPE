import { LUKSO_CHAIN_ID } from '../library/config.js';
import { parseCanonicalAssetId } from '../profileDocument/domain/assetReference.js';

const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
const traitValue = value => ['string', 'number', 'boolean'].includes(typeof value) ? String(value).slice(0, 400) : '';
const sources = ['LSP4MetadataForTokenId', 'LSP8TokenMetadataBaseURI', 'LSP8TokenMetadataBaseURIForTokenId'];

// Only explicit token identities published by the artwork host are eligible.
// Model output supplies scene IDs, never addresses, URLs or ERC725Y keys.
export function keeperMetadataReference(stableAssetId, standard) {
  const ref = parseCanonicalAssetId(stableAssetId);
  if (standard !== 'LSP8' || ref?.chainId !== LUKSO_CHAIN_ID || !/^0x[a-f0-9]{64}$/.test(ref.tokenId || '')) return null;
  return { ...ref, tokenStandard: 'LSP8' };
}

// Apply the same bounded projection in the browser and at the local AI boundary.
// Descriptions/traits are public token metadata, not verified authorship/holding.
export function keeperMetadataResult(value, reference) {
  if (!reference || value?.stableAssetId !== reference.stableAssetId) throw new Error('Metadata does not match the requested artwork.');
  const base = { ...reference, status: value.status };
  if (['unavailable', 'failed', 'changed'].includes(value.status)) return base;
  if (value.status !== 'available' || !sources.some(source => value.source === `${source} (DIRECT LUKSO RPC)`)
    || !Number.isFinite(value.readAt)) throw new Error('Invalid artwork metadata result.');
  const traits = Array.isArray(value.attributes) ? value.attributes : [];
  return { ...base, source: value.source, readAt: value.readAt,
    name: text(value.name, 160), description: text(value.description, 4000),
    attributes: traits.slice(0, 32).map(item => ({ key: text(item?.key, 80), value: traitValue(item?.value), type: text(item?.type, 40) })),
    truncated: value.truncated === true || traits.length > 32 || String(value.description || '').length > 4000,
  };
}
