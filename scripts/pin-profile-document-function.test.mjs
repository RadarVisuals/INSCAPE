import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfileDocumentV3, buildProfileDocumentV8 } from '../src/profileDocument/domain/profileDocumentBuilder.js';
import { canonicalSerializeProfileDocument } from '../src/profileDocument/domain/profileDocumentSerialization.js';
import { createPinProfileDocumentHandler } from '../netlify/functions/pin-profile-document.mjs';
import { createEmptyLatticeProductionDraft } from '../src/lattice/domain/latticeProductionDraft.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';

function publication() {
  return buildProfileDocumentV3({
    profileAddress: PROFILE,
    workspace: { version: 3, profileAddress: PROFILE, favorites: [], folders: [], canvas: { launchers: [], objects: [] } },
    assets: [],
    publicPresentation: { keeperId: 'abyssal_eye', stageId: 'black' },
    signalSettings: { notifications: true, speech: true, visualEffects: true, audio: false },
    profileIdentity: { name: 'INSCAPE test' },
    documentId: 'profile:netlify-upload', revision: 1, createdAt: 1, exportedAt: 2
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
  const body = canonicalSerializeProfileDocument(publication());
  let pinataRequest;
  const handler = createPinProfileDocumentHandler({ getJwt: () => 'server-only-jwt', fetchImpl: async (url, init) => {
    pinataRequest = { url, init };
    return Response.json({ data: { cid: CID } });
  } });
  const response = await handler(requestFor(body));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { cid: CID });
  assert.equal(pinataRequest.url, 'https://uploads.pinata.cloud/v3/files');
  assert.equal(pinataRequest.init.headers.authorization, 'Bearer server-only-jwt');
  assert.equal(pinataRequest.init.body.get('network'), 'public');
  assert.equal(await pinataRequest.init.body.get('file').text(), body);
});

test('Netlify publication upload rejects cross-origin, noncanonical, and unconfigured requests before Pinata', async () => {
  const body = canonicalSerializeProfileDocument(publication());
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

test('Netlify publication upload accepts canonical v8 through the same server boundary', async () => {
  let credentialReads = 0;
  let pinataCalls = 0;
  const version8 = buildProfileDocumentV8({
    profileAddress: PROFILE,
    workspace: { version: 8, profileAddress: PROFILE, favorites: [], folders: [], canvas: { launchers: [], objects: [] } },
    assets: [], publicPresentation: { keeperId: 'abyssal_eye', stageId: 'black' },
    signalSettings: {}, profileIdentity: { name: 'Readable only' }, createdAt: 1, exportedAt: 2,
    latticeDraft: createEmptyLatticeProductionDraft(PROFILE),
  });
  const body = canonicalSerializeProfileDocument(version8);
  const handler = createPinProfileDocumentHandler({
    getJwt: () => { credentialReads += 1; return 'server-only-jwt'; },
    fetchImpl: async () => { pinataCalls += 1; return Response.json({ data: { cid: CID } }); },
  });
  const response = await handler(requestFor(body));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { cid: CID });
  assert.equal(credentialReads, 1);
  assert.equal(pinataCalls, 1);
});
