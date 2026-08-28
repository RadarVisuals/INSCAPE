import { keccak256 } from 'viem';

export const ONCHAIN_DATA_URI_LIMITS = Object.freeze({
  jsonBytes: 384 * 1024,
  svgBytes: 288 * 1024,
  svgUriCharacters: 384 * 1024,
});

const VERIFICATION_METHODS = new Map([
  ['keccak256(utf8)', 'utf8'],
  ['0x6f357c6a', 'utf8'],
  ['keccak256(bytes)', 'bytes'],
  ['0x8019f9b1', 'bytes'],
]);
const HASH = /^0x[0-9a-f]{64}$/iu;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const SVG_FORBIDDEN_MARKUP = /<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b|<audio\b|<video\b/iu;
const SVG_EVENT_HANDLER = /\son[a-z][a-z0-9_-]*\s*=/iu;
const SVG_EXTERNAL_REFERENCE = /(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)/iu;
const SVG_EXTERNAL_CSS = /(?:@import|url\s*\(\s*["']?\s*(?:https?:|\/\/|data:|javascript:))/iu;

function authentic(bytes, verification) {
  const method = VERIFICATION_METHODS.get(String(verification?.method || '').toLowerCase());
  const expected = String(verification?.data || '').toLowerCase();
  if (!method || !HASH.test(expected) || !(bytes instanceof Uint8Array)) return false;
  return keccak256(bytes).toLowerCase() === expected;
}

function decodeBase64(value, maximumBytes) {
  if (!value || value.length % 4 !== 0 || !BASE64.test(value)) return null;
  const expectedBytes = value.length / 4 * 3
    - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
  if (expectedBytes <= 0 || expectedBytes > maximumBytes) return null;
  try {
    const binary = globalThis.atob(value);
    if (binary.length !== expectedBytes) return null;
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeUtf8(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return null; }
}

export function decodeVerifiedOnchainJsonDataUri(value, verification) {
  if (typeof value !== 'string' || value.length > ONCHAIN_DATA_URI_LIMITS.jsonBytes * 3) return null;
  const match = /^data:application\/json(?:;charset=utf-8)?,(.*)$/isu.exec(value);
  if (!match) return null;
  try {
    const json = decodeURIComponent(match[1]);
    const bytes = new TextEncoder().encode(json);
    if (bytes.byteLength === 0 || bytes.byteLength > ONCHAIN_DATA_URI_LIMITS.jsonBytes
      || !authentic(bytes, verification)) return null;
    const document = JSON.parse(json);
    return document && typeof document === 'object' && !Array.isArray(document) ? document : null;
  } catch {
    return null;
  }
}

export function inspectOnchainSvgDataUri(value, verification = null) {
  if (typeof value !== 'string' || value.length > ONCHAIN_DATA_URI_LIMITS.svgUriCharacters) return null;
  const match = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)$/u.exec(value);
  if (!match) return null;
  const bytes = decodeBase64(match[1], ONCHAIN_DATA_URI_LIMITS.svgBytes);
  if (!bytes || verification && !authentic(bytes, verification)) return null;
  const svg = decodeUtf8(bytes);
  if (!svg || !/^\s*<svg\b/iu.test(svg)
    || !/\sxmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/iu.test(svg)
    || SVG_FORBIDDEN_MARKUP.test(svg)
    || SVG_EVENT_HANDLER.test(svg)
    || SVG_EXTERNAL_REFERENCE.test(svg)
    || SVG_EXTERNAL_CSS.test(svg)) return null;
  return { bytes, svg, url: value };
}

export function resolveVerifiedOnchainSvgDataUri(value, verification) {
  return verification ? inspectOnchainSvgDataUri(value, verification)?.url || null : null;
}

export function isSafeOnchainSvgDataUri(value) {
  return Boolean(inspectOnchainSvgDataUri(value));
}
