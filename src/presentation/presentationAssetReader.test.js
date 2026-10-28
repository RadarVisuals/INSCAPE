import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationAssetReader } from './presentationAssetReader.js';
const profile = '0x' + '1'.repeat(40);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
test('presentation source reads are bounded, retry missing records and never write storage', async () => {
  let attempt = 0;
  const storage = { getItem: () => null, setItem: () => { throw Error('must never write'); } };
  const repository = { async *loadReferencedCreations(address, ids) {
    assert.equal(address, profile); assert.deepEqual(ids, ['wanted']);
    if (!attempt++) throw Error('offline');
    yield { assets: [{ id: 'wanted' }, { id: 'unrequested' }] };
  } };
  const reader = createPresentationAssetReader(profile, ['wanted', 'wanted'], { repository, storage });
  const stop = reader.subscribe(() => {}); await tick();
  assert.equal(reader.getSnapshot().status, 'unavailable');
  await reader.refresh(); assert.equal(reader.getSnapshot().status, 'ready');
  assert.deepEqual([...reader.getSnapshot().assets.keys()], ['wanted']); stop();
});
test('unmount revokes obsolete artwork batches and a fresh subscription can recover', async () => {
  const pending = []; let attempts = 0;
  const repository = { async *loadReferencedCreations(address, ids, { signal }) {
    const attempt = ++attempts; await new Promise(resolve => pending.push({ resolve, signal }));
    yield { assets: [{ id: 'wanted', name: `attempt ${attempt}` }] };
  } };
  const reader = createPresentationAssetReader(profile, ['wanted'], { repository, storage: { getItem: () => null } });
  const stop = reader.subscribe(() => {}); stop();
  assert.equal(pending[0].signal.aborted, true);
  const finalStop = reader.subscribe(() => {});
  pending[1].resolve(); await tick(); assert.equal(reader.getSnapshot().assets.get('wanted').name, 'attempt 2');
  pending[0].resolve(); await tick(); assert.equal(reader.getSnapshot().assets.get('wanted').name, 'attempt 2'); finalStop();
});
