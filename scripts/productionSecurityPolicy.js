import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const NETLIFY_HEADERS_FILE = '_headers';

const DEFAULT_ENDPOINTS = Object.freeze({
  VITE_LUKSO_RPC_URL: 'https://rpc.mainnet.lukso.network',
  VITE_LUKSO_INDEXER_URL: 'https://envio.lukso-mainnet.universal.tech/v1/graphql',
  VITE_CHILLWHALES_INDEXER_URL: 'https://indexer.chillwhales.dev/v1/graphql',
  VITE_IPFS_GATEWAY_URL: 'https://api.universalprofile.cloud/ipfs/',
  VITE_LUKSO_WSS_RPC_URL: 'wss://ws-rpc.mainnet.lukso.network'
});

// The locked @lukso/up-modal standalone path enables WalletConnect. These are
// the exact retained service origins in that production chunk, not the much
// broader generic allowlist published for every Reown/AppKit feature.
const WALLET_CONNECT_ORIGINS = Object.freeze([
  'https://api.web3modal.org',
  'https://echo.walletconnect.com',
  'https://explorer-api.walletconnect.com',
  'https://pulse.walletconnect.org',
  'https://rpc.walletconnect.org',
  'https://verify.walletconnect.com',
  'https://verify.walletconnect.org',
  'wss://relay.walletconnect.org'
]);

export const UNIVERSAL_PROFILE_PARENT_ORIGINS = Object.freeze([
  "'self'",
  'https://universaleverything.io'
]);

const splitEndpoints = (value) => String(value || '').split(/[\n,]/u).map((entry) => entry.trim()).filter(Boolean);

function endpointOrigin(value, { protocols, label }) {
  let parsed;
  try { parsed = new URL(String(value || '').trim()); }
  catch { throw new TypeError(`${label} must be an absolute URL`); }
  if (!protocols.includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError(`${label} must use ${protocols.join(' or ')} without credentials`);
  }
  if (parsed.hostname.endsWith('.example') || parsed.hostname.includes('*')) {
    throw new TypeError(`${label} contains a placeholder or wildcard host`);
  }
  return parsed.origin;
}

function configuredEndpoint(env, name, fallback, options) {
  return endpointOrigin(env?.[name] || fallback, { ...options, label: name });
}

function configuredEndpointList(env, name, options) {
  return splitEndpoints(env?.[name]).map((value, index) => endpointOrigin(value, {
    ...options, label: `${name}[${index}]`
  }));
}

export function productionConnectOrigins(env = {}) {
  const https = { protocols: ['https:'] };
  const wss = { protocols: ['wss:'] };
  const ipfsGateway = env.VITE_IPFS_GATEWAY_URL || DEFAULT_ENDPOINTS.VITE_IPFS_GATEWAY_URL;
  const profileGateway = env.VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL || ipfsGateway;
  const origins = [
    // These two remain hard-coded in the provider/metadata authority even when
    // the Library and published-document readers receive deployment overrides.
    endpointOrigin(DEFAULT_ENDPOINTS.VITE_LUKSO_RPC_URL, { ...https, label: 'wallet LUKSO RPC' }),
    endpointOrigin(DEFAULT_ENDPOINTS.VITE_IPFS_GATEWAY_URL, { ...https, label: 'wallet metadata IPFS gateway' }),
    configuredEndpoint(env, 'VITE_LUKSO_RPC_URL', DEFAULT_ENDPOINTS.VITE_LUKSO_RPC_URL, https),
    ...configuredEndpointList(env, 'VITE_LUKSO_RPC_FALLBACK_URLS', https),
    configuredEndpoint(env, 'VITE_LUKSO_INDEXER_URL', DEFAULT_ENDPOINTS.VITE_LUKSO_INDEXER_URL, https),
    configuredEndpoint(env, 'VITE_CHILLWHALES_INDEXER_URL', DEFAULT_ENDPOINTS.VITE_CHILLWHALES_INDEXER_URL, https),
    endpointOrigin(ipfsGateway, { ...https, label: 'VITE_IPFS_GATEWAY_URL' }),
    endpointOrigin(profileGateway, { ...https, label: 'VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL' }),
    ...configuredEndpointList(env, 'VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS', https),
    configuredEndpoint(env, 'VITE_LUKSO_WSS_RPC_URL', DEFAULT_ENDPOINTS.VITE_LUKSO_WSS_RPC_URL, wss),
    ...WALLET_CONNECT_ORIGINS
  ];
  return [...new Set(origins)].sort();
}

export function createProductionContentSecurityPolicy(env = {}) {
  const directives = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' https: data:",
    `connect-src 'self' ${productionConnectOrigins(env).join(' ')}`,
    "worker-src 'none'",
    "frame-src 'none'",
    `frame-ancestors ${UNIVERSAL_PROFILE_PARENT_ORIGINS.join(' ')}`,
    "form-action 'self'",
    "manifest-src 'self'",
    'upgrade-insecure-requests'
  ];
  return directives.join('; ');
}

export function productionResponseSecurityHeaders(env = {}) {
  return Object.freeze({
    'Content-Security-Policy': createProductionContentSecurityPolicy(env),
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'X-Content-Type-Options': 'nosniff'
  });
}

export const FUNCTION_RESPONSE_SECURITY_HEADERS = Object.freeze({
  'content-security-policy': "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'",
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'x-content-type-options': 'nosniff'
});

function manifestFiles(manifest) {
  return [...new Set(Object.values(manifest).flatMap((record) => [
    record.file,
    ...(record.css || []),
    ...(record.assets || [])
  ]).filter(Boolean))].sort();
}

export function createNetlifyHeaders({ env = {}, manifest = {} } = {}) {
  const responseHeaders = productionResponseSecurityHeaders(env);
  const lines = [
    '/*',
    ...Object.entries(responseHeaders).map(([name, value]) => `  ${name}: ${value}`),
    '',
    '/',
    '  Cache-Control: public, max-age=0, must-revalidate',
    '',
    '/index.html',
    '  Cache-Control: public, max-age=0, must-revalidate'
  ];
  for (const file of manifestFiles(manifest)) {
    lines.push('', `/${file}`, '  Cache-Control: public, max-age=31536000, immutable');
  }
  return `${lines.join('\n')}\n`;
}

export async function writeNetlifyHeaders(outputDirectory, { env = {} } = {}) {
  const manifest = JSON.parse(await readFile(resolve(outputDirectory, '.vite/manifest.json'), 'utf8'));
  const headers = createNetlifyHeaders({ env, manifest });
  await writeFile(resolve(outputDirectory, NETLIFY_HEADERS_FILE), headers);
  return headers;
}
