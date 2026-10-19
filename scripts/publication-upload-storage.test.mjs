import assert from 'node:assert/strict';
import test from 'node:test';
import { publicationQuotaStore, createUploadQuota } from '../netlify/lib/publicationUploadQuota.mjs';
import { uploadTestPolicy, UPLOAD_TEST_NOW } from './fixtures/publicationUpload.mjs';

test('the installed Blobs SDK sends site-wide strong reads and conditional writes; storage failures have no automatic backoff', async t => {
  const priorContext = globalThis.netlifyBlobsContext;
  // The real SDK and production adapter run against an in-process HTTP fixture.
  // No credentials, cloud storage, or filesystem emulation are involved.
  const context = { siteID: 'fixture-site', deployID: 'deploy-one', token: 'fixture-token',
    edgeURL: 'https://cached.invalid', uncachedEdgeURL: 'https://strong.invalid' };
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify(context)).toString('base64');
  t.after(() => { if (priorContext === undefined) delete globalThis.netlifyBlobsContext; else globalThis.netlifyBlobsContext = priorContext; });
  const rows = new Map(), calls = []; let revision = 0, failure = false;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers });
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(new URL(url).origin, 'https://strong.invalid');
    assert.match(new URL(url).pathname, /^\/fixture-site\/site:inscape-publication-uploads\//);
    if (failure) return new Response(null, { status: 429, headers: { 'x-ratelimit-reset': '9999999999' } });
    const key = new URL(url).pathname, row = rows.get(key);
    if (init.method.toLowerCase() === 'get') return row ? Response.json(row.value, { headers: { etag: row.etag } }) : new Response(null, { status: 404 });
    assert.equal(init.method.toLowerCase(), 'put');
    const headers = new Headers(init.headers);
    if ((headers.get('if-none-match') === '*' && row) || (headers.has('if-match') && headers.get('if-match') !== row?.etag)) return new Response(null, { status: 412 });
    const etag = `"version-${++revision}"`;
    rows.set(key, { value: JSON.parse(init.body), etag });
    return new Response(null, { headers: { etag } });
  });
  const store = publicationQuotaStore();
  assert.equal(await store.getWithMetadata('probe', { type: 'json' }), null);
  assert.equal((await store.setJSON('probe', { count: 1 }, { onlyIfNew: true })).modified, true);
  assert.equal((await store.setJSON('probe', { count: 2 }, { onlyIfNew: true })).modified, false);
  const read = await store.getWithMetadata('probe', { type: 'json' });
  assert.deepEqual(read.data, { count: 1 });
  assert.equal((await store.setJSON('probe', { count: 2 }, { onlyIfMatch: read.etag })).modified, true);
  assert.equal((await store.setJSON('probe', { count: 3 }, { onlyIfMatch: read.etag })).modified, false);
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify({ ...context, deployID: 'deploy-two' })).toString('base64');
  assert.deepEqual((await publicationQuotaStore().getWithMetadata('probe', { type: 'json' })).data, { count: 2 });
  failure = true;
  const before = calls.length;
  const profile = `0x${'1'.repeat(40)}`;
  const quota = createUploadQuota({ store, now: () => UPLOAD_TEST_NOW });
  await assert.rejects(() => quota.reserve({ issuedAt: UPLOAD_TEST_NOW, expiresAt: UPLOAD_TEST_NOW + 1000,
    profile, hash: `0x${'a'.repeat(64)}`, nonce: 'b'.repeat(32), bytes: 100 }, uploadTestPolicy([profile])), { code: 'UPLOAD_QUOTA_UNAVAILABLE' });
  assert.equal(calls.length, before + 1, '429 does not start SDK backoff or retry an uncertain write');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => publicationQuotaStore(controller.signal).getWithMetadata('probe', { type: 'json' }));
  assert.equal(calls.length, before + 1, 'expired Function deadline makes no further storage request');
});
