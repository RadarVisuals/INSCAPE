import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLsp3Identity, createUnavailableIdentity } from '../domain/profileIdentity.js';
import { ProfileIdentityCache } from './profileIdentityCache.js';

const addresses = Array.from({ length: 5 }, (_, index) => `0x${String(index + 1).padStart(40, '0')}`);

test('reuses successful results and deduplicates concurrent requests', async () => {
  let calls = 0; const repository = { source: 'LIVE', resolve: async (address) => { calls += 1; return normalizeLsp3Identity(address, { name: 'RADAR' }); } };
  const cache = new ProfileIdentityCache({ repository });
  const first = cache.resolve(addresses[0]); const second = cache.resolve(addresses[0]);
  assert.strictEqual(first, second); await first; await cache.resolve(addresses[0]); assert.equal(calls, 1);
});

test('bounds resolver concurrency', async () => {
  let active = 0; let peak = 0; const releases = [];
  const repository = { source: 'LIVE', resolve: (address) => new Promise((resolve) => { active += 1; peak = Math.max(peak, active); releases.push(() => { active -= 1; resolve(normalizeLsp3Identity(address, { name: 'Profile' })); }); }) };
  const cache = new ProfileIdentityCache({ repository, maxConcurrent: 2 });
  const pending = addresses.map((address) => cache.resolve(address));
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(peak, 2);
  while (releases.length) { releases.shift()(); await new Promise((resolve) => setImmediate(resolve)); }
  await Promise.all(pending); assert.equal(peak, 2);
});

test('expires unavailable results quickly and retries', async () => {
  let now = 0; let calls = 0; const repository = { source: 'LIVE', resolve: async (address) => { calls += 1; return createUnavailableIdentity(address); } };
  const cache = new ProfileIdentityCache({ repository, failureTtlMs: 10, now: () => now });
  await cache.resolve(addresses[0]); now = 9; await cache.resolve(addresses[0]); assert.equal(calls, 1);
  now = 11; await cache.resolve(addresses[0]); assert.equal(calls, 2);
});

test('unsubscribed listeners provide stale-result protection', async () => {
  let release; const repository = { source: 'LIVE', resolve: (address) => new Promise((resolve) => { release = () => resolve(normalizeLsp3Identity(address, { name: 'Late' })); }) };
  const cache = new ProfileIdentityCache({ repository }); let updates = 0;
  const unsubscribe = cache.subscribe(addresses[0], () => { updates += 1; }); const pending = cache.resolve(addresses[0]); unsubscribe(); release(); await pending;
  assert.equal(updates, 1); // LOADING emitted before the address subscription was removed; completion was ignored.
});

test('clearing settles queued and active requests and late responses cannot replace a new result', async () => {
  const releases = [];
  const cache = new ProfileIdentityCache({ maxConcurrent: 1, repository: { resolve: address => new Promise(resolve => {
    releases.push(name => resolve(normalizeLsp3Identity(address, { name })));
  }) } });
  const first = cache.resolve(addresses[0]); const queued = cache.resolve(addresses[1]);
  cache.clear(); await Promise.all([first, queued]);
  assert.equal(cache.active, 0); assert.equal(cache.pending.size, 0); assert.equal(cache.entries.size, 0);
  const fresh = cache.resolve(addresses[0]); releases[1]('Fresh'); await fresh;
  const accepted = cache.get(addresses[0]);
  releases[0]('Late'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(cache.get(addresses[0]), accepted);
});

test('synchronous repository failure releases its slot and retries', async () => {
  let failing = true;
  const cache = new ProfileIdentityCache({ repository: { resolve: address => {
    if (failing) throw new Error('sync failure');
    return normalizeLsp3Identity(address, { name: 'Recovered' });
  } } });
  await cache.resolve(addresses[0]);
  assert.equal(cache.active, 0); assert.equal(cache.pending.size, 0);
  failing = false;
  assert.equal((await cache.resolve(addresses[0], { force: true })).status, 'RESOLVED');
});

test('timed-out work releases the queue even if the repository ignores cancellation', async () => {
  const cache = new ProfileIdentityCache({ maxConcurrent: 1, timeoutMs: 5,
    repository: { resolve: address => address === addresses[0] ? new Promise(() => {}) : normalizeLsp3Identity(address, { name: 'Next' }) } });
  const pending = cache.resolve(addresses[0]); const next = cache.resolve(addresses[1]);
  assert.equal((await pending).status, 'ERROR');
  assert.equal((await next).status, 'RESOLVED');
  assert.equal(cache.active, 0);
});

test('caller cancellation settles queued work without dispatching it', async () => {
  let calls = 0;
  const cache = new ProfileIdentityCache({ maxConcurrent: 1, repository: { resolve: () => { calls++; return new Promise(() => {}); } } });
  const first = cache.resolve(addresses[0]); const controller = new AbortController();
  const queued = cache.resolve(addresses[1], { signal: controller.signal });
  controller.abort(); await queued;
  assert.equal(calls, 1); cache.clear(); await first;
});

test('cache eviction retains a stable current snapshot and subscribed identities', async () => {
  const cache = new ProfileIdentityCache({ maxEntries: 2, repository: {
    resolve: address => normalizeLsp3Identity(address, { name: 'Cached' }),
  } });
  const unsubscribe = cache.subscribe(addresses[0], () => {});
  await cache.resolve(addresses[0]); await cache.resolve(addresses[1]); await cache.resolve(addresses[2]);
  assert.equal(cache.entries.size, 2);
  assert.equal(cache.entries.has(addresses[0]), true);
  const snapshot = cache.get(addresses[3]);
  assert.equal(cache.get(addresses[3]), snapshot);
  assert.equal(cache.entries.size, 2);
  unsubscribe();
});
