import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchMetadataJson } from './fetchMetadataJson.js';

test('reads bounded UTF-8 metadata and rejects malformed JSON', async () => {
  assert.deepEqual(await fetchMetadataJson('https://metadata.test', { fetchImpl: async () => Response.json({ name: 'zerO' }) }), { name: 'zerO' });
  await assert.rejects(fetchMetadataJson('https://metadata.test', { fetchImpl: async () => new Response('{') }), SyntaxError);
});

test('deadline covers a stalled body and cancels its reader', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  await assert.rejects(fetchMetadataJson('https://metadata.test', { timeoutMs: 5,
    fetchImpl: async () => new Response(body) }), { code: 'METADATA_TIMEOUT' });
  assert.equal(cancelled, true);
});

test('deadline settles even when fetch ignores abort', async () => {
  await assert.rejects(fetchMetadataJson('https://metadata.test', { timeoutMs: 5,
    fetchImpl: () => new Promise(() => {}) }), { code: 'METADATA_TIMEOUT' });
});

test('caller abort cancels body reading and an already aborted request never starts', async () => {
  const controller = new AbortController(); let started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = fetchMetadataJson('https://metadata.test', { signal: controller.signal,
    fetchImpl: async () => { started(); return new Response(new ReadableStream()); } });
  await ready; controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(fetchMetadataJson('https://metadata.test', { signal: controller.signal,
    fetchImpl: () => { throw new Error('must not start'); } }), { name: 'AbortError' });
});

test('enforces actual byte length even without an honest content-length header', async () => {
  for (const headers of [{}, { 'content-length': '1' }, { 'content-length': '900' }]) {
    await assert.rejects(fetchMetadataJson('https://metadata.test', { maxBytes: 4,
      fetchImpl: async () => new Response('{"value":123}', { headers }) }), { code: 'METADATA_TOO_LARGE' });
  }
});
