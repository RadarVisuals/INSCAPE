import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createPinProfileDocumentHandler } from '../netlify/functions/pin-profile-document.mjs';
import { readUploadPolicy } from '../netlify/lib/publicationUploadAuth.mjs';
import { createUploadQuota } from '../netlify/lib/publicationUploadQuota.mjs';
import { memoryQuotaStore, uploadTestPolicy, uploadTestChallenge, uploadRequest, uploadTestVerifier,
  UPLOAD_TEST_NOW, UPLOAD_TEST_ORIGIN, UPLOAD_TEST_SIGNER } from './fixtures/publicationUpload.mjs';

const PROFILE = `0x${'3'.repeat(40)}`, OTHER = `0x${'4'.repeat(40)}`;
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const document = (revision = 1, profile = PROFILE) => buildProfileDocumentV9({ profileAddress: profile, assetRecords: [],
  createdAt: 1, exportedAt: revision + 1, revision, systemWorkflowDraft: createEmptySystemWorkflowDraft(profile, { generateId: () => 'home' }) });
const sign = challenge => UPLOAD_TEST_SIGNER.signMessage({ message: challenge.message });
function setup(overrides = {}) {
  let upstreamCalls = 0, signatureChecks = 0;
  const store = memoryQuotaStore();
  const policy = uploadTestPolicy([PROFILE, OTHER]);
  const verify = uploadTestVerifier(PROFILE);
  const options = { getJwt: () => 'synthetic-upstream-only', getPolicy: () => policy, getQuotaStore: () => store,
    now: () => UPLOAD_TEST_NOW, verifySignature: async (...args) => { signatureChecks++; await verify(...args); },
    fetchImpl: async () => { upstreamCalls++; return Response.json({ data: { cid: CID } }); }, ...overrides };
  return { store, policy, options, handler: createPinProfileDocumentHandler(options), calls: () => upstreamCalls, signatureChecks: () => signatureChecks };
}
async function send(handler, doc = document(), challenge = uploadTestChallenge(doc)) {
  return handler(uploadRequest(doc, challenge, await sign(challenge)));
}

test('anonymous callers and unavailable admission configuration never reach Pinata', async () => {
  const state = setup();
  assert.equal((await state.handler(uploadRequest(document()))).status, 401);
  for (const values of [{}, { INSCAPE_UPLOAD_ALLOWED_PROFILES: '*' },
    { INSCAPE_UPLOAD_ALLOWED_PROFILES: PROFILE, INSCAPE_UPLOAD_AUTH_SECRET: 'short' },
    { INSCAPE_UPLOAD_ALLOWED_PROFILES: PROFILE, INSCAPE_UPLOAD_AUTH_SECRET: '2'.repeat(64), INSCAPE_UPLOAD_MONTHLY_LIMIT: '-1' }]) {
    assert.throws(() => readUploadPolicy(values), error => error.code === 'UPLOAD_NOT_CONFIGURED');
  }
  assert.equal(state.calls(), 0);
});

test('server challenge uses its own deployment, immutable byte hash, expiry and selected profile', async () => {
  const state = setup(); const challenge = uploadTestChallenge(document());
  const metadata = ({ profile, hash, bytes }) => JSON.stringify({ profile, hash, bytes });
  const request = body => new Request(`${UPLOAD_TEST_ORIGIN}/api/profile-publications/challenge`, {
    method: 'POST', headers: { origin: UPLOAD_TEST_ORIGIN, 'content-type': 'application/json' }, body });
  const response = await state.handler(request(metadata(challenge.permit)));
  assert.equal(response.status, 200);
  const returned = await response.json();
  assert.equal(returned.permit.origin, UPLOAD_TEST_ORIGIN);
  assert.equal(returned.permit.expiresAt, UPLOAD_TEST_NOW + 300_000);
  assert.match(returned.message, /Chain ID: 42/u);
  assert.ok(returned.message.includes(challenge.permit.hash));
  assert.equal((await state.handler(request(metadata({ ...challenge.permit, profile: `0x${'9'.repeat(40)}` })))).status, 403);
  assert.equal((await state.handler(request(JSON.stringify({ ...challenge.permit, origin: 'https://evil.example' })))).status, 422);
  assert.equal(state.calls(), 0); assert.equal(state.store.records.size, 0, 'unauthenticated challenges do not allocate quota storage');
});

test('changed bytes, wrong origin, expired or tampered permit, and invalid controller signature fail before accounting', async () => {
  const state = setup(); const doc = document(), challenge = uploadTestChallenge(doc), signature = await sign(challenge);
  const tampered = { ...challenge, authorization: `${challenge.authorization.slice(0, -43)}${'x'.repeat(43)}` };
  const expired = uploadTestChallenge(doc, { now: UPLOAD_TEST_NOW - 300_000 });
  const cases = [
    uploadRequest(document(2), challenge, signature), uploadRequest(doc, challenge, signature, 'https://other.example'),
    uploadRequest(doc, tampered, signature), uploadRequest(doc, expired, await sign(expired)),
    uploadRequest(doc, challenge, `0x${'a'.repeat(130)}`),
  ];
  for (const request of cases) assert.ok([401, 503].includes((await state.handler(request)).status));
  assert.equal(state.calls(), 0); assert.equal(state.store.records.size, 0);
});

test('profile permission is checked again on each request, including a cached successful upload', async () => {
  let permitted = true;
  const state = setup({ verifySignature: (permit, signature) => uploadTestVerifier(PROFILE, { authorized: permitted })(permit, signature) });
  assert.equal((await send(state.handler)).status, 201);
  permitted = false;
  assert.equal((await send(state.handler)).status, 401);
  assert.equal(state.calls(), 1);
});

test('wrong RPC network and unavailable quota storage fail closed before upload', async () => {
  for (const overrides of [{ verifySignature: uploadTestVerifier(PROFILE, { chain: 4201 }) },
    { getQuotaStore: () => ({ getWithMetadata: async () => { throw Error('private service details'); } }) }]) {
    const state = setup(overrides); const response = await send(state.handler);
    assert.equal(response.status, 503); assert.equal(state.calls(), 0);
    assert.doesNotMatch(await response.text(), /private service details|synthetic-upstream/u);
  }
});

test('concurrent function instances submit identical bytes once and retain the completed CID', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; }); let calls = 0;
  const state = setup({ fetchImpl: async () => { calls++; await pending; return Response.json({ data: { cid: CID } }); } });
  const first = send(state.handler);
  while (!calls) await new Promise(resolve => setImmediate(resolve));
  const other = createPinProfileDocumentHandler(state.options);
  const blocked = await Promise.all(Array.from({ length: 8 }, () => send(other)));
  assert.ok(blocked.every(response => response.status === 409)); assert.equal(calls, 1);
  release(); assert.equal((await first).status, 201);
  const reused = await send(other);
  assert.equal(reused.status, 200); assert.deepEqual(await reused.json(), { cid: CID }); assert.equal(calls, 1);
  assert.equal(state.store.records.get('month-2026-10').data.entries.length, 1);
});

test('concurrent distinct documents cannot exceed one atomic profile/global quota', async () => {
  const state = setup(); state.policy.hourlyPerProfile = 2;
  const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => send(createPinProfileDocumentHandler(state.options), document(index + 1))));
  assert.equal(responses.filter(response => response.status === 201).length, 2);
  assert.ok(responses.filter(response => response.status !== 201).every(response => response.status === 429));
  assert.equal(state.calls(), 2);
  for (const response of responses.filter(response => response.status === 429)) assert.equal(response.headers.get('retry-after'), '3600');
});

test('global count and exact byte limits apply across profiles, and redeploys do not reset them', async () => {
  for (const type of ['count', 'bytes']) {
    const store = memoryQuotaStore(); const first = uploadTestChallenge(document()).permit;
    const second = uploadTestChallenge(document(2, OTHER)).permit;
    const policy = uploadTestPolicy([PROFILE, OTHER], type === 'count' ? { monthlyUploads: 1 } : { monthlyBytes: first.bytes + second.bytes - 1 });
    await createUploadQuota({ store, now: () => UPLOAD_TEST_NOW }).reserve(first, policy);
    await assert.rejects(() => createUploadQuota({ store, now: () => UPLOAD_TEST_NOW }).reserve(second, policy), error => error.code === 'UPLOAD_SERVICE_QUOTA');
    assert.equal(store.records.get('month-2026-10').data.entries.length, 1);
  }
});

test('unknown upstream result stays reserved; a confirmed rejection requires a new authorization', async () => {
  const state = setup({ fetchImpl: async () => { throw Error('contains synthetic-upstream-only and private data'); } });
  const response = await send(state.handler);
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /synthetic-upstream-only|private data/u);
  assert.equal((await send(createPinProfileDocumentHandler(state.options))).status, 409);
  let calls = 0;
  const rejected = setup({ fetchImpl: async () => ++calls === 1 ? new Response(null, { status: 403 }) : Response.json({ data: { cid: CID } }) });
  const challenge = uploadTestChallenge(document());
  assert.equal((await send(rejected.handler, document(), challenge)).status, 502);
  assert.equal((await send(rejected.handler, document(), challenge)).status, 409);
  assert.equal((await send(rejected.handler)).status, 201);
  assert.equal(rejected.store.records.get('month-2026-10').data.entries.length, 2);
});

test('lost completion acknowledgement is recoverable without a second upstream upload', async () => {
  const state = setup(); const write = state.store.setJSON;
  state.store.setJSON = async (...args) => { const result = await write(...args); if (args[1].entries.some(entry => entry.status === 'COMPLETE')) throw Error('lost acknowledgement'); return result; };
  assert.equal((await send(state.handler)).status, 503);
  assert.equal((await send(createPinProfileDocumentHandler(state.options))).status, 200);
  assert.equal(state.calls(), 1);
});

test('quota corruption and conditional-write conflicts do not permit a fallback upload', async () => {
  for (const store of [{ getWithMetadata: async () => ({ etag: 'broken', data: { version: 1, month: '2026-10', entries: [{ bytes: -1 }] } }) },
    { getWithMetadata: async () => null, setJSON: async () => ({ modified: false }) }]) {
    const state = setup({ getQuotaStore: () => store });
    assert.equal((await send(state.handler)).status, 503); assert.equal(state.calls(), 0);
  }
});

test('permits expire at the month boundary and the new month has its own bounded ledger', async () => {
  const lastMinute = Date.parse('2026-10-31T23:59:30Z');
  const challenge = uploadTestChallenge(document(), { now: lastMinute });
  assert.equal(challenge.permit.expiresAt, Date.parse('2026-11-01T00:00:00Z'));
  const state = setup({ now: () => challenge.permit.expiresAt });
  assert.equal((await send(state.handler, document(), challenge)).status, 401);
  const fresh = uploadTestChallenge(document(), { now: challenge.permit.expiresAt });
  assert.equal((await send(state.handler, document(), fresh)).status, 201);
  assert.ok(state.store.records.has('month-2026-11'));
});

test('chunked oversize input is cancelled at the byte limit before parsing or credentials', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(300_000)); }, cancel() { cancelled = true; } });
  const state = setup();
  const response = await state.handler(new Request(`${UPLOAD_TEST_ORIGIN}/api/profile-publications`, {
    method: 'POST', headers: { origin: UPLOAD_TEST_ORIGIN, 'content-type': 'application/json' }, body: stream, duplex: 'half',
  }));
  assert.equal(response.status, 413); assert.equal(cancelled, true); assert.equal(state.calls(), 0);
});
