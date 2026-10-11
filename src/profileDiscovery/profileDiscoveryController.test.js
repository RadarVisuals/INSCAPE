import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfileDiscoveryController, filterProfileDiscoveryResults } from './profileDiscoveryController.js';

const A = { address: '0x1111111111111111111111111111111111111111', name: 'Alpha' };
const B = { address: '0x2222222222222222222222222222222222222222', name: 'Beta' };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };

test('search accepts only public name/address fields and distinguishes empty from filtered-empty', () => {
  assert.deepEqual(filterProfileDiscoveryResults([A, B], 'beta'), [B]);
  assert.deepEqual(filterProfileDiscoveryResults([A, B], '0x1111'), [A]);
  assert.deepEqual(filterProfileDiscoveryResults([{ ...A, source: 'needle' }], 'needle'), []);
  assert.deepEqual(filterProfileDiscoveryResults([], ''), []);
});

test('loading, ready, retry failure and retained inactive state are deterministic', async () => {
  let fail = false;
  const repository = { list: async () => { if (fail) throw new Error('directory failed'); return [A, B]; } };
  const controller = createProfileDiscoveryController({ repository });
  controller.activate(); await tick();
  assert.equal(controller.getSnapshot().status, 'ready');
  controller.setQuery('beta');
  assert.deepEqual(controller.getResults(), [B]);
  controller.deactivate();
  assert.equal(controller.getSnapshot().query, 'beta');
  assert.deepEqual(controller.getResults(), [B]);
  fail = true; controller.activate(); await tick();
  assert.equal(controller.getSnapshot().status, 'error');
  assert.equal(controller.getSnapshot().error, 'directory failed');
  assert.deepEqual(controller.getSnapshot().profiles, []);
});

test('active movement wraps and selection returns only a normalized safe result', async () => {
  const controller = createProfileDiscoveryController({ repository: { list: async () => [A, B] } });
  controller.activate(); await tick();
  assert.equal(controller.moveActive(-1).address, B.address);
  assert.equal(controller.moveActive(1).address, A.address);
  assert.equal(controller.resolveSelection().address, A.address);
  assert.equal(controller.resolveSelection({ address: 'invalid' }), null);
});

test('aborted and stale directory requests cannot overwrite newer state', async () => {
  const first = deferred(); const second = deferred();
  const replies = [first, second];
  const controller = createProfileDiscoveryController({ repository: { list: () => replies.shift().promise } });
  controller.activate();
  controller.deactivate();
  first.resolve([A]); await tick();
  assert.deepEqual(controller.getSnapshot().profiles, []);
  controller.activate(); second.resolve([B]); await tick();
  assert.deepEqual(controller.getSnapshot().profiles, [B]);
});
