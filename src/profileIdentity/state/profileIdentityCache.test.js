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
