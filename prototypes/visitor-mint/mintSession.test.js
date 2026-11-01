import assert from 'node:assert/strict';
import test from 'node:test';
import { createMintSession, createDemoJournal } from './mintSession.js';
import { createSimulation, DEMO_LEDGER_KEY } from './simulation.js';

const hash = 'demo-00000000-0000-0000-0000-000000000001';
const offer = { revision: 1, priceWei: '2000000000000000000', open: true, remaining: 25, eligible: true };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function memoryStorage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
function fixture(overrides = {}) {
  const storage = memoryStorage(), journal = createDemoJournal(storage);
  let submissions = 0;
  const adapter = { scope: 'test-sale', readOffer: async () => offer, cancelConfirmation() {},
    submit: async () => { submissions++; return hash; },
    check: async () => ({ status: 'confirmed', scope: 'test-sale', buyer: 'visitor-a', hash, tokenId: 'demo-token-1' }), ...overrides };
  const session = createMintSession({ adapter, journal });
  return { session, adapter, journal, storage, submissions: () => submissions };
}

test('mint requires a buyer; only a verified matching result confirms; reload retains confirmation', async () => {
  const f = fixture();
  await f.session.refresh(); await f.session.mint();
  assert.equal(f.submissions(), 0);
  await f.session.setBuyer('visitor-a'); await f.session.mint();
  assert.equal(f.session.getState().phase, 'pending');
  assert.equal(f.submissions(), 1);
  await f.session.check();
  assert.equal(f.session.getState().phase, 'confirmed');
  const reopened = createMintSession(f);
  await reopened.setBuyer('visitor-a');
  assert.equal(reopened.getState().record.tokenId, 'demo-token-1');
  await reopened.mint(); assert.equal(f.submissions(), 1);
});

test('rapid clicks and recovery never duplicate a submission', async () => {
  const submitted = deferred(); let calls = 0;
  const f = fixture({ submit: () => { calls++; return submitted.promise; }, check: async () => ({ status: 'pending' }) });
  await f.session.setBuyer('visitor-a');
  const request = f.session.mint();
  await f.session.mint(); await Promise.resolve();
  submitted.resolve(hash); await request;
  await f.session.mint(); await f.session.check(); await f.session.mint();
  assert.equal(calls, 1); assert.equal(f.session.getState().phase, 'recovery');
});

test('explicit cancellation releases the reservation for a deliberate retry', async () => {
  const f = fixture({ submit: async () => { throw Object.assign(new Error('Rejected'), { code: 4001 }); } });
  await f.session.setBuyer('visitor-a'); await f.session.mint();
  assert.equal(f.session.getState().phase, 'ready');
  assert.equal(f.journal.read('test-sale:visitor-a'), null);
  assert.match(f.session.getState().message, /cancelled/);
});

test('ambiguous submission survives reload and blocks a second mint', async () => {
  let submissions = 0;
  const f = fixture({ submit: async () => { submissions++; throw new Error('Connection lost'); } });
  await f.session.setBuyer('visitor-a'); await f.session.mint();
  const reopened = createMintSession(f);
  await reopened.setBuyer('visitor-a');
  assert.equal(reopened.getState().phase, 'recovery');
  await reopened.mint(); assert.equal(submissions, 1);
  await reopened.check(); assert.equal(reopened.getState().phase, 'confirmed');
});

test('changed terms require another deliberate review before confirmation', async () => {
  let reads = 0;
  const f = fixture({ readOffer: async () => ++reads === 1 ? offer : { ...offer, revision: 2, priceWei: '3000000000000000000' } });
  await f.session.setBuyer('visitor-a'); await f.session.mint();
  assert.equal(f.submissions(), 0);
  assert.match(f.session.getState().message, /sale changed/);
  assert.equal(f.session.getState().offer.priceWei, '3000000000000000000');
  await f.session.mint(); assert.equal(f.submissions(), 1);
});

test('paused, sold out and ineligible offers cannot reach confirmation', async () => {
  for (const patch of [{ open: false }, { remaining: 0 }, { eligible: false }]) {
    const f = fixture({ readOffer: async () => ({ ...offer, ...patch }) });
    await f.session.setBuyer('visitor-a'); await f.session.mint();
    assert.equal(f.submissions(), 0);
  }
});

test('switching buyer ignores late reads from the previous buyer', async () => {
  const old = deferred();
  const f = fixture({ readOffer: async buyer => buyer === 'visitor-a' ? old.promise : offer });
  const first = f.session.setBuyer('visitor-a');
  await f.session.setBuyer('visitor-b');
  old.resolve({ ...offer, remaining: 0 }); await first;
  assert.equal(f.session.getState().buyer, 'visitor-b');
  assert.equal(f.session.getState().offer.remaining, 25);
});

test('late submission result is retained for its original buyer after disposal', async () => {
  const submitted = deferred();
  const f = fixture({ submit: () => submitted.promise });
  await f.session.setBuyer('visitor-a');
  const request = f.session.mint(); await Promise.resolve();
  assert.equal(f.session.getState().phase, 'wallet');
  f.session.dispose(); submitted.resolve(hash); await request;
  assert.equal(f.journal.read('test-sale:visitor-a').hash, hash);
  assert.equal(f.journal.read('test-sale:visitor-b'), null);
});

test('failed persistence prevents a confirmation request', async () => {
  const f = fixture();
  f.storage.setItem = () => { throw new Error('Quota'); };
  await f.session.setBuyer('visitor-a'); await f.session.mint();
  assert.equal(f.submissions(), 0); assert.equal(f.session.getState().phase, 'unavailable');
});

test('mismatched results and failed receipt reads remain recoverable', async () => {
  const f = fixture({ check: async () => ({ status: 'confirmed', scope: 'other-sale', buyer: 'visitor-a', hash, tokenId: 'demo-token-1' }) });
  await f.session.setBuyer('visitor-a'); await f.session.mint(); await f.session.check();
  assert.equal(f.session.getState().phase, 'recovery');
  f.adapter.check = async () => { throw new Error('Offline'); };
  await f.session.check();
  assert.equal(f.session.getState().record.hash, hash);
  assert.match(f.session.getState().message, /could not be checked/);
});

test('read failure is unavailable, never an empty or sold-out collection; retry rereads', async () => {
  const f = fixture({ readOffer: async () => { throw new Error('Offline'); } });
  await f.session.refresh();
  assert.equal(f.session.getState().phase, 'unavailable'); assert.equal(f.session.getState().offer, null);
  f.adapter.readOffer = async () => offer; await f.session.refresh();
  assert.equal(f.session.getState().phase, 'ready');
});

test('malformed saved recovery is retained and blocks submission', async () => {
  const f = fixture();
  const key = 'inscape:prototype:visitor-mint:recovery:v1:test-sale:visitor-a';
  f.storage.setItem(key, '{bad');
  await f.session.setBuyer('visitor-a'); await f.session.mint();
  assert.equal(f.session.getState().phase, 'unavailable'); assert.equal(f.submissions(), 0);
  assert.equal(f.storage.getItem(key), '{bad');
});

test('simulated interrupted transaction recovers after reload without adding supply twice', async () => {
  const storage = memoryStorage(); let time = 100;
  const adapter = createSimulation({ storage, scenario: 'interrupted', now: () => time });
  const journal = createDemoJournal(storage), first = createMintSession({ adapter, journal });
  await first.setBuyer('visitor-a');
  const request = first.mint(); await Promise.resolve(); adapter.confirm(); await request;
  assert.equal(first.getState().phase, 'recovery');
  first.dispose();
  const second = createMintSession({ adapter, journal });
  await second.setBuyer('visitor-a'); await second.check();
  assert.equal(second.getState().phase, 'recovery');
  time += 2000; await second.check();
  assert.equal(second.getState().phase, 'confirmed');
  assert.equal((await adapter.readOffer('visitor-a')).remaining, 24);
  assert.equal(JSON.parse(storage.getItem(DEMO_LEDGER_KEY)).length, 1);
  await second.setBuyer('visitor-b');
  assert.equal(second.getState().phase, 'ready'); assert.equal(second.getState().record, null);
});

test('a reverted simulation clears recovery but consumes no edition', async () => {
  const storage = memoryStorage(); let time = 0;
  const adapter = createSimulation({ storage, scenario: 'reverted', now: () => time });
  const session = createMintSession({ adapter, journal: createDemoJournal(storage) });
  await session.setBuyer('visitor-a');
  const request = session.mint(); await Promise.resolve(); adapter.confirm(); await request;
  time = 2000; await session.check();
  assert.equal(session.getState().phase, 'ready');
  assert.match(session.getState().message, /transaction failed/);
  assert.equal((await adapter.readOffer('visitor-a')).remaining, 25);
});
