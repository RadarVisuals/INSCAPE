import { normalizeProfileAddress } from '../../library/config.js';
import { parsePublishedAssetUrl } from './publishedAssetUrl.js';

export function normalizeTokenId(value) {
  if (value === null || value === undefined || value === '') return null;
  const token = String(value).trim().toLowerCase();
  return /^(0x[a-f0-9]{1,128}|[0-9]{1,78})$/.test(token) ? token : null;
}
export function createCanonicalAssetId({ chainId, contractAddress, tokenId = null }) {
  const contract = normalizeProfileAddress(contractAddress); const chain = Number(chainId); const token = normalizeTokenId(tokenId);
  if (!Number.isInteger(chain) || chain <= 0 || !contract || (tokenId != null && !token)) return null;
  return `${chain}:${contract}:${token || 'contract'}`;
}
export function parseCanonicalAssetId(value) {
  const match = /^(\d+):(0x[a-fA-F0-9]{40}):(contract|0x[a-fA-F0-9]{1,128}|[0-9]{1,78})$/.exec(String(value || ''));
  if (!match) return null;
  const chainId = Number(match[1]); const contractAddress = normalizeProfileAddress(match[2]);
  const tokenId = match[3] === 'contract' ? null : normalizeTokenId(match[3]);
  const stableAssetId = createCanonicalAssetId({ chainId, contractAddress, tokenId });
  return stableAssetId ? { chainId, contractAddress, tokenId, stableAssetId } : null;
}
export function buildAssetReference(asset, stableId) {
  const parsed = parseCanonicalAssetId(asset?.id || stableId);
  const chainId = Number(asset?.chainId || parsed?.chainId);
  const contractAddress = normalizeProfileAddress(asset?.contractAddress) || parsed?.contractAddress;
  const tokenId = asset?.tokenId == null ? parsed?.tokenId ?? null : normalizeTokenId(asset.tokenId);
  const stableAssetId = createCanonicalAssetId({ chainId, contractAddress, tokenId });
  if (!stableAssetId) return null;
  const cachedName = typeof asset?.name === 'string' && asset.name.trim() ? asset.name.trim().slice(0, 80) : undefined;
  const previewCandidate = typeof asset?.thumbnailUrl === 'string' && asset.thumbnailUrl.trim() ? asset.thumbnailUrl.trim()
    : typeof asset?.imageUrl === 'string' && asset.imageUrl.trim() ? asset.imageUrl.trim() : '';
  const cachedPreviewUrl = parsePublishedAssetUrl(previewCandidate.slice(0, 2048))?.value;
  return { stableAssetId, network: 'lukso-mainnet', chainId,
    tokenStandard: asset?.standard === 'LSP7' || asset?.standard === 'LSP8' ? asset.standard : 'UNKNOWN',
    contractAddress, tokenId, ...(cachedName ? { cachedName } : {}), ...(cachedPreviewUrl ? { cachedPreviewUrl } : {}) };
}
