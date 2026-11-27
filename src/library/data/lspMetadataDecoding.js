import { decodeDataSourceWithHash } from '@erc725/erc725.js';

// The full holding scan and targeted metadata refresh decode the same LSP data.
export function decodeMetadataPointer(value) {
  if (!value || value === '0x') return null;
  try {
    const pointer = decodeDataSourceWithHash(value);
    return pointer?.url ? pointer : null;
  } catch { return null; }
}

export function decodeStoredNumber(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/iu.test(value) || value.length > 66) return null;
  try { return Number(BigInt(value)); } catch { return null; }
}

export function decodeTokenIdForMetadata(tokenId, format) {
  if (typeof tokenId !== 'string' || !/^0x[0-9a-f]{64}$/iu.test(tokenId)) return null;
  if (format === 0) return BigInt(tokenId).toString(10);
  if (format === 1) {
    try { return new TextDecoder().decode(Uint8Array.from(tokenId.slice(2).match(/.{2}/gu)
      .map((byte) => Number.parseInt(byte, 16)))).replace(/\0+$/u, ''); } catch { return null; }
  }
  if (format === 2) return `0x${tokenId.slice(-40)}`;
  if (format === 3) return tokenId.replace(/0+$/u, '');
  return tokenId;
}
