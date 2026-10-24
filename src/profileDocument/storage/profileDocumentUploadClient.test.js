import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { buildProfileDocumentV9 } from '../domain/profileDocumentV9Builder.js';
import { canonicalSerializeProfileDocumentV9 } from '../domain/profileDocumentV9Serialization.js';
import { uploadProfileDocument } from './profileDocumentUploadClient.js';
import { uploadTestContext, uploadTestChallenge, UPLOAD_TEST_NOW, UPLOAD_TEST_ORIGIN } from '../../../scripts/fixtures/publicationUpload.mjs';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const document = buildProfileDocumentV9({
  profileAddress: PROFILE, assetRecords: [], profileIdentity: { name: 'Upload client test' },
  createdAt: 1, exportedAt: 2,
  systemWorkflowDraft: createEmptySystemWorkflowDraft(PROFILE, { generateId: () => 'home' }),
});

function clientFixture({ challenge = uploadTestChallenge(document), upload = () => Response.json({ cid: CID }, { status: 201 }) } = {}) {
  const context = uploadTestContext(document);
  const requests = [], phases = [], signatures = [];
  const sign = context.walletClient.signMessage;
  context.walletClient.signMessage = async args => { signatures.push(args); return sign(args); };
  const options = { origin: UPLOAD_TEST_ORIGIN, getContext: () => context, now: () => UPLOAD_TEST_NOW,
    onPhase: phase => phases.push(phase), fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return url.endsWith('/challenge') ? Response.json(challenge) : upload(url, init);
    } };
  return { options, context, requests, phases, signatures };
}

test('upload client sends canonical bytes and validates the returned CID', async () => {
  const fixture = clientFixture();
  const result = await uploadProfileDocument(document, fixture.options);
  const request = fixture.requests[1];
  assert.equal(fixture.requests.length, 2);
  assert.equal(request.url, `${UPLOAD_TEST_ORIGIN}/api/profile-publications`);
  assert.equal(fixture.signatures.length, 1);
  assert.match(fixture.signatures[0].message, /Chain ID: 42/);
  assert.match(request.init.headers['x-inscape-upload-signature'], /^0x[0-9a-f]+$/);
  assert.ok(request.init.headers['x-inscape-upload-authorization']);
  assert.deepEqual(fixture.phases, ['AUTHORIZING', 'UPLOADING']);
  assert.equal(request.init.headers['content-type'], 'application/json');
  assert.equal(request.init.body, result.artifact.text);
  assert.equal(request.init.body, canonicalSerializeProfileDocumentV9(document));
  assert.equal(result.cid, CID);
  assert.equal(result.ipfsUri, `ipfs://${CID}`);
});

test('upload client does not accept a successful response without a valid CID', async () => {
  const fixture = clientFixture({ upload: () => Response.json({ cid: 'bad' }, { status: 201 }) });
  await assert.rejects(() => uploadProfileDocument(document, fixture.options), /invalid IPFS CID/i);
});

test('plain Vite HTML fallback is identified as an unavailable publication function', async () => {
  await assert.rejects(() => uploadProfileDocument(document, {
    ...clientFixture().options,
    fetchImpl: async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html' } }),
  }), (error) => error.code === 'PUBLICATION_FUNCTION_UNAVAILABLE'
    && /Plain Vite cannot upload to IPFS/u.test(error.message));
});

test('upload client rejects v1-v8 and malformed payloads before the publication endpoint', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return Response.json({ cid: CID }, { status: 201 }); };
  for (let version = 1; version <= 8; version += 1) {
    await assert.rejects(() => uploadProfileDocument({ ...document, version }, { fetchImpl }));
  }
  for (const malformed of [null, {}, { documentType: 'INSCAPE_PROFILE', version: 9 }]) {
    await assert.rejects(() => uploadProfileDocument(malformed, { fetchImpl }));
  }
  assert.equal(calls, 0);
});

test('unconfigured service and a non-JSON edge rate limit never open the wallet', async () => {
  for (const response of [Response.json({ error: { code: 'UPLOAD_NOT_CONFIGURED', message: 'Upload service not configured' } }, { status: 503 }),
    new Response('Rate limited', { status: 429, headers: { 'retry-after': '60' } })]) {
    const fixture = clientFixture();
    fixture.options.fetchImpl = async () => response;
    await assert.rejects(() => uploadProfileDocument(document, fixture.options), error => {
      assert.ok(['UPLOAD_NOT_CONFIGURED', 'UPLOAD_RATE_LIMITED'].includes(error.code));
      if (response.status === 429) assert.equal(error.retryAfter, '60');
      return true;
    });
    assert.equal(fixture.signatures.length, 0);
  }
});

test('wrong domain, profile, bytes, hash, expiry or message is rejected before signing', async () => {
  for (const change of [value => value.permit.origin = 'https://other.example', value => value.permit.profile = `0x${'2'.repeat(40)}`,
    value => value.permit.bytes++, value => value.permit.hash = `0x${'b'.repeat(64)}`,
    value => value.permit.expiresAt = UPLOAD_TEST_NOW, value => value.message += '\nUnexpected authorization']) {
    const challenge = uploadTestChallenge(document); change(challenge);
    const fixture = clientFixture({ challenge });
    await assert.rejects(() => uploadProfileDocument(document, fixture.options), { code: 'UPLOAD_CHALLENGE_INVALID' });
    assert.equal(fixture.signatures.length, 0);
    assert.equal(fixture.requests.length, 1);
  }
});

test('wallet refusal, expired approval and cancellation do not post publication bytes', async () => {
  for (const scenario of ['refuse', 'expire', 'cancel']) {
    const fixture = clientFixture(), controller = new AbortController();
    let time = UPLOAD_TEST_NOW;
    fixture.options.now = () => time;
    fixture.options.signal = controller.signal;
    fixture.context.walletClient.signMessage = async () => {
      if (scenario === 'refuse') throw Error('Rejected');
      if (scenario === 'expire') time += 600_000;
      if (scenario === 'cancel') controller.abort();
      return `0x${'a'.repeat(130)}`;
    };
    await assert.rejects(() => uploadProfileDocument(document, fixture.options), { code: {
      refuse: 'UPLOAD_AUTH_NOT_COMPLETED', expire: 'UPLOAD_AUTH_INVALID', cancel: 'UPLOAD_CANCELLED',
    }[scenario] });
    assert.equal(fixture.requests.length, 1);
  }
});

test('profile, controller, chain, draft or generation changes while signing invalidate the upload', async () => {
  const changes = [context => context.isWalletConnected = false, context => context.chainId = 1,
    context => context.hostProfileAddress = `0x${'2'.repeat(40)}`, context => context.viewedProfileAddress = `0x${'2'.repeat(40)}`,
    context => context.walletClient.account = `0x${'3'.repeat(40)}`, context => context.provider = {},
    context => context.walletClient = { ...context.walletClient }, context => context.publicationContextGeneration++,
    context => context.snapshotGeneration++, context => context.draftGeneration++, context => context.snapshotStale = true];
  for (const change of changes) {
    const fixture = clientFixture();
    fixture.context.walletClient.signMessage = async () => { change(fixture.context); return '0xaa'; };
    await assert.rejects(() => uploadProfileDocument(document, fixture.options), { code: 'UPLOAD_CONTEXT_CHANGED' });
    assert.equal(fixture.requests.length, 1);
  }
});

test('changes during challenge or upload cannot advance the next publication step', async () => {
  for (const boundary of ['challenge', 'upload']) {
    const fixture = clientFixture();
    const fetchImpl = fixture.options.fetchImpl;
    fixture.options.fetchImpl = async (url, init) => {
      const response = await fetchImpl(url, init);
      if (url.endsWith('/challenge') === (boundary === 'challenge')) fixture.context.draftGeneration++;
      return response;
    };
    await assert.rejects(() => uploadProfileDocument(document, fixture.options), { code: 'UPLOAD_CONTEXT_CHANGED' });
    assert.equal(fixture.requests.length, boundary === 'challenge' ? 1 : 2);
    assert.equal(fixture.signatures.length, boundary === 'challenge' ? 0 : 1);
  }
});

test('cross-deployment endpoint and stale snapshot are rejected without any request', async () => {
  const fixture = clientFixture();
  await assert.rejects(() => uploadProfileDocument(document, { ...fixture.options, endpoint: 'https://elsewhere.example/api/profile-publications' }), { code: 'UPLOAD_ORIGIN_INVALID' });
  fixture.context.snapshotStale = true;
  await assert.rejects(() => uploadProfileDocument(document, fixture.options), { code: 'UPLOAD_CONTEXT_CHANGED' });
  assert.equal(fixture.requests.length, 0);
});

