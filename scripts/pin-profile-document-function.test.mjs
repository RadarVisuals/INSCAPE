import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { canonicalSerializeProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Serialization.js';
import { createPinProfileDocumentHandler } from '../netlify/functions/pin-profile-document.mjs';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';

function publication() {
  return buildProfileDocumentV9({
    profileAddress: PROFILE,
    assetRecords: [],
    profileIdentity: { name: 'INSCAPE test' },
    documentId: 'profile:netlify-upload', revision: 1, createdAt: 1, exportedAt: 2,
    systemWorkflowDraft: createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' }),
  });
}

function requestFor(body, overrides = {}) {
  return new Request('https://inscape.example/api/profile-publications', {
    method: 'POST',
    headers: { origin: 'https://inscape.example', 'content-type': 'application/json', ...(overrides.headers || {}) },
    body
  });
}

test('Netlify publication upload accepts only canonical profile documents and returns Pinata CID', async () => {
  const body = canonicalSerializeProfileDocumentV9(publication());
  let pinataRequest;
  const handler = createPinProfileDocumentHandler({ getJwt: () => 'server-only-jwt', fetchImpl: async (url, init) => {
    pinataRequest = { url, init };
    return Response.json({ data: { cid: CID } });
  } });
  const response = await handler(requestFor(body));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { cid: CID });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/u);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/u);
  assert.equal(pinataRequest.url, 'https://uploads.pinata.cloud/v3/files');
  assert.equal(pinataRequest.init.headers.authorization, 'Bearer server-only-jwt');
  assert.equal(pinataRequest.init.body.get('network'), 'public');
  assert.equal(await pinataRequest.init.body.get('file').text(), body);
});

test('Netlify publication upload rejects cross-origin, noncanonical, and unconfigured requests before Pinata', async () => {
  const body = canonicalSerializeProfileDocumentV9(publication());
  let calls = 0;
  const handler = createPinProfileDocumentHandler({ getJwt: () => '', fetchImpl: async () => { calls += 1; } });
  const crossOrigin = await handler(requestFor(body, { headers: { origin: 'https://attacker.example' } }));
  assert.equal(crossOrigin.status, 403);
  const noncanonical = await handler(requestFor(JSON.stringify(publication(), null, 2)));
  assert.equal(noncanonical.status, 422);
  const unconfigured = await handler(requestFor(body));
  assert.equal(unconfigured.status, 503);
  assert.equal(calls, 0);
});

test('Netlify publication upload rejects UTF-8 BOM-prefixed canonical JSON bytes before credentials or Pinata', async () => {
  const canonicalBytes = new TextEncoder().encode(canonicalSerializeProfileDocumentV9(publication()));
  const bytes = new Uint8Array(canonicalBytes.byteLength + 3);
  bytes.set([0xef, 0xbb, 0xbf]);
  bytes.set(canonicalBytes, 3);
  let credentialReads = 0;
  let pinataCalls = 0;
  const handler = createPinProfileDocumentHandler({
    getJwt: () => { credentialReads += 1; return 'server-only-jwt'; },
    fetchImpl: async () => { pinataCalls += 1; return Response.json({ data: { cid: CID } }); },
  });

  const response = await handler(requestFor(bytes));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, 'NON_CANONICAL_DOCUMENT');
  assert.equal(credentialReads, 0);
  assert.equal(pinataCalls, 0);
});

test('Netlify publication upload rejects every v1-v8 shape before credentials or Pinata', async () => {
  let credentialReads = 0;
  let pinataCalls = 0;
  const handler = createPinProfileDocumentHandler({
    getJwt: () => { credentialReads += 1; return 'server-only-jwt'; },
    fetchImpl: async () => { pinataCalls += 1; return Response.json({ data: { cid: CID } }); },
  });
  for (let version = 1; version <= 8; version += 1) {
    const response = await handler(requestFor(JSON.stringify({ ...publication(), version })));
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, 'INVALID_PROFILE_DOCUMENT');
  }
  assert.equal(credentialReads, 0);
  assert.equal(pinataCalls, 0);
});
