import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryMetadataDemand, mergeAssetMetadata } from './libraryMetadataDemand.js';

const token = id => ({ id, standard: 'LSP8', tokenId: `0x${id}`, name: id });
const turn = () => new Promise(setImmediate);

test('only demanded tokens refresh, selected order wins and duplicate requests use the cooldown', async () => {
  const calls = [], updates = [];
  const queue = createLibraryMetadataDemand({ onBatch: assets => updates.push(...assets),
    async *refresh(assets) { calls.push(assets.map(asset => asset.id)); yield { assets }; } });
  const visible = Array.from({ length: 9 }, (_, i) => token(String(i)));
  queue.set([visible[8], ...visible, { id: 'contract', standard: 'LSP7' }]);
  await turn();
  assert.deepEqual(calls, [['8', '0', '1', '2'], ['3', '4', '5', '6'], ['7']]);
  assert.equal(updates.length, 9);
  queue.set(visible); await turn();
  assert.equal(calls.length, 3);
  queue.cancel();
});

test('changing visible demand drops queued offscreen tokens before the next bounded batch', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  const queue = createLibraryMetadataDemand({ onBatch() {}, async *refresh(assets) {
    calls.push(assets.map(asset => asset.id)); await gate; yield { assets };
  } });
  queue.set(Array.from({ length: 5000 }, (_, i) => token(String(i))));
  queue.set([token('selected')]); release(); await turn();
  assert.deepEqual(calls, [['0', '1', '2', '3'], ['selected']]);
  queue.cancel();
});

test('cancel settles an abort-ignoring refresh and discards late metadata across profiles', { timeout: 2000 }, async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const updates = [];
  let calls = 0;
  const queue = createLibraryMetadataDemand({ onBatch: assets => updates.push(...assets), async *refresh(assets) {
    if (++calls === 1) await gate;
    yield { assets };
  } });
  queue.set([token('old')]); queue.cancel(); queue.set([token('new')]); await turn();
  assert.deepEqual(updates.map(asset => asset.id), ['new']);
  release(); await turn();
  assert.deepEqual(updates.map(asset => asset.id), ['new']);
  queue.cancel();
});

test('a failed refresh retains indexed fields and explicit retry recovers within the cooldown', async () => {
  let failing = true;
  const errors = [], updates = [];
  const queue = createLibraryMetadataDemand({ onError: error => errors.push(error), onBatch: assets => updates.push(...assets),
    async *refresh(assets) { if (failing) throw Error('gateway offline'); yield { assets }; } });
  queue.set([token('one')]); await turn();
  assert.equal(errors.length, 1); assert.equal(updates.length, 0);
  failing = false; queue.retry(); await turn();
  assert.equal(updates.length, 1);
  queue.cancel();
});

test('a stalled metadata provider times out without blocking a newly visible token', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const updates = [], errors = [];
  const queue = createLibraryMetadataDemand({ onBatch: assets => updates.push(...assets), onError: error => errors.push(error),
    async *refresh(assets) { if (assets[0].id === 'stalled') await new Promise(() => {}); yield { assets }; } });
  queue.set([token('stalled')]);
  t.mock.timers.tick(15000); await turn();
  queue.set([token('visible')]); await turn();
  assert.equal(errors.length, 1);
  assert.deepEqual(updates.map(asset => asset.id), ['visible']);
  queue.cancel();
});

test('metadata cannot overwrite relationship facts or erase fields it did not resolve', () => {
  const original = { ...token('one'), ownerAddress: 'holder', creators: ['artist'], imageUrl: 'indexed',
    fieldProvenance: { creators: { source: 'LSP4' } } };
  const [merged] = mergeAssetMetadata([original], [{ id: 'one', name: 'New name', ownerAddress: 'attacker',
    creators: [], fieldProvenance: { creators: { source: 'untrusted' }, name: { scope: 'tokenId', source: 'RPC' } } }]);
  assert.equal(merged.name, 'New name'); assert.equal(merged.imageUrl, 'indexed');
  assert.equal(merged.ownerAddress, 'holder'); assert.deepEqual(merged.creators, ['artist']);
  assert.deepEqual(merged.fieldProvenance.creators, { source: 'LSP4' });
});
