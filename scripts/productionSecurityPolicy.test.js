import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNetlifyHeaders,
  createProductionContentSecurityPolicy,
  productionResponseSecurityHeaders,
  productionConnectOrigins,
  UNIVERSAL_PROFILE_PARENT_ORIGINS
} from './productionSecurityPolicy.js';

const directive = (policy, name) => policy.split('; ').find((entry) => entry.startsWith(`${name} `));

test('production CSP contains the complete enforced directive set without placeholders or unsafe evaluation', () => {
  const policy = createProductionContentSecurityPolicy();
  for (const name of ['default-src', 'base-uri', 'object-src', 'script-src', 'style-src', 'font-src', 'img-src',
    'connect-src', 'worker-src', 'frame-src', 'frame-ancestors', 'form-action', 'manifest-src']) {
    assert.ok(directive(policy, name), name);
  }
  assert.doesNotMatch(policy, /\[[^\]]+\]|\.example|unsafe-eval/u);
  assert.equal(directive(policy, 'script-src'), "script-src 'self'");
  assert.equal(directive(policy, 'style-src'), "style-src 'self' 'unsafe-inline'");
  assert.equal(directive(policy, 'font-src'), "font-src 'self'");
  assert.equal(directive(policy, 'img-src'), "img-src 'self' https: data:");
  assert.equal(directive(policy, 'worker-src'), "worker-src 'none'");
  assert.equal(directive(policy, 'frame-src'), "frame-src 'none'");
  assert.equal(directive(policy, 'frame-ancestors'), `frame-ancestors ${UNIVERSAL_PROFILE_PARENT_ORIGINS.join(' ')}`);
});

test('connect-src derives exact origins from every supported public endpoint override and fallback', () => {
  const env = {
    VITE_LUKSO_RPC_URL: 'https://rpc.release.invalid/path',
    VITE_LUKSO_RPC_FALLBACK_URLS: 'https://rpc-a.release.invalid,\nhttps://rpc-b.release.invalid/path',
    VITE_LUKSO_INDEXER_URL: 'https://envio.release.invalid/v1/graphql',
    VITE_CHILLWHALES_INDEXER_URL: 'https://chill.release.invalid/v1/graphql',
    VITE_IPFS_GATEWAY_URL: 'https://media.release.invalid/ipfs/',
    VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_URL: 'https://documents.release.invalid/ipfs/',
    VITE_PROFILE_DOCUMENT_IPFS_GATEWAY_FALLBACK_URLS: 'https://documents-a.release.invalid/ipfs/,https://documents-b.release.invalid/ipfs/',
    VITE_LUKSO_WSS_RPC_URL: 'wss://events.release.invalid/socket'
  };
  const origins = productionConnectOrigins(env);
  for (const expected of ['https://rpc.release.invalid', 'https://rpc-a.release.invalid', 'https://rpc-b.release.invalid',
    'https://envio.release.invalid', 'https://chill.release.invalid', 'https://media.release.invalid',
    'https://documents.release.invalid', 'https://documents-a.release.invalid', 'https://documents-b.release.invalid',
    'wss://events.release.invalid']) assert.ok(origins.includes(expected), expected);
  assert.ok(origins.includes('https://rpc.mainnet.lukso.network'));
  assert.ok(origins.includes('https://api.universalprofile.cloud'));
  assert.ok(origins.includes('wss://relay.walletconnect.org'));
  assert.equal(new Set(origins).size, origins.length);
});

test('endpoint inventory fails closed on insecure, credentialed, placeholder, or wildcard values', () => {
  for (const value of ['http://rpc.invalid', 'https://user:secret@rpc.invalid', 'https://gateway.example/ipfs/', 'https://*.invalid']) {
    assert.throws(() => productionConnectOrigins({ VITE_LUKSO_RPC_URL: value }), /must use|placeholder|wildcard/u);
  }
  assert.throws(() => productionConnectOrigins({ VITE_LUKSO_WSS_RPC_URL: 'https://events.invalid' }), /must use/u);
});

test('Netlify response configuration enforces headers globally and immutable caching only on emitted files', () => {
  const headers = createNetlifyHeaders({ manifest: {
    'index.html': { file: 'assets/index-a1b2.js', css: ['assets/index-a1b2.css'], assets: ['assets/font-c3d4.woff2'] }
  } });
  for (const header of ['Content-Security-Policy', 'Referrer-Policy: no-referrer', 'Permissions-Policy:', 'X-Content-Type-Options: nosniff']) {
    assert.match(headers, new RegExp(header));
  }
  assert.match(headers, /\/assets\/index-a1b2\.js\n  Cache-Control: public, max-age=31536000, immutable/u);
  assert.match(headers, /\/assets\/index-a1b2\.css\n  Cache-Control: public, max-age=31536000, immutable/u);
  assert.match(headers, /\/assets\/font-c3d4\.woff2\n  Cache-Control: public, max-age=31536000, immutable/u);
  assert.match(headers, /\/index\.html\n  Cache-Control: public, max-age=0, must-revalidate/u);
  assert.doesNotMatch(headers, /X-Frame-Options|frame-ancestors 'none'|connect-src[^\n;]*\*/u);
});

test('production preview uses the same enforced response policy without changing the development server', () => {
  const headers = productionResponseSecurityHeaders();
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'self' https:\/\/universaleverything\.io/u);
  assert.equal(Object.hasOwn(headers, 'Content-Security-Policy-Report-Only'), false);
});
