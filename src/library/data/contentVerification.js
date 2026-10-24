import { keccak256 } from 'viem';

const METHODS = new Set(['keccak256(utf8)', '0x6f357c6a', 'keccak256(bytes)', '0x8019f9b1']);

// LSP2/LSP4 hash the original UTF-8 bytes, before JSON parsing or reformatting.
export function authenticContent(bytes, verification) {
  const method = String(verification?.method || '').toLowerCase();
  const expected = String(verification?.data || '').toLowerCase();
  return METHODS.has(method) && /^0x[0-9a-f]{64}$/u.test(expected)
    && bytes instanceof Uint8Array && keccak256(bytes).toLowerCase() === expected;
}
