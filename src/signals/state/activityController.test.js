import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivityController } from './activityController.js';

const PROFILE_A = '0x1111111111111111111111111111111111111111';
const PROFILE_B = '0x2222222222222222222222222222222222222222';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, reject, resolve }; };

test('complete, partial, empty, refresh failure and retry retain honest Activity state', async () => {
  const replies = [
    { signals: [{ id: 'one' }], complete: true, totals: { transfers: 1 }, partialError: null },
    new Error('refresh failed'),
    { signals: [{ id: 'two' }], complete: false, totals: { transfers: 2 }, partialError: 'metadata partial' },
    { signals: [], complete: true, totals: {}, partialError: null },
  ];
  const repository = { loadRecentActivity: async () => { const reply = replies.shift(); if (reply instanceof Error) throw reply; return reply; } };
  const controller = createActivityController({ repository });
  controller.activate(PROFILE_A); await tick();
  assert.deepEqual(controller.getSnapshot().signals.map(({ id }) => id), ['one']);
  assert.equal(controller.getSnapshot().complete, true);

  await controller.refresh();
  assert.equal(controller.getSnapshot().status, 'error');
  assert.equal(controller.getSnapshot().error, 'refresh failed');
  assert.deepEqual(controller.getSnapshot().signals.map(({ id }) => id), ['one']);

  await controller.retry();
  assert.equal(controller.getSnapshot().status, 'partial');
  assert.equal(controller.getSnapshot().partialError, 'metadata partial');
  assert.equal(controller.getSnapshot().complete, false);
  await controller.refresh();
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.deepEqual(controller.getSnapshot().signals, []);
});

test('deactivation, profile replacement and stale generations cannot overwrite retained state', async () => {
  const first = deferred(); const second = deferred(); const third = deferred();
  const replies = [first, second, third];
  const repository = { loadRecentActivity: () => replies.shift().promise };
  const controller = createActivityController({ repository });
  controller.activate(PROFILE_A);
  controller.deactivate();
  first.resolve({ signals: [{ id: 'stale-closed' }] }); await tick();
  assert.deepEqual(controller.getSnapshot().signals, []);

  controller.activate(PROFILE_A);
  second.resolve({ signals: [{ id: 'retained' }] }); await tick();
  controller.deactivate();
  assert.deepEqual(controller.getSnapshot().signals.map(({ id }) => id), ['retained']);

  controller.activate(PROFILE_B);
  third.resolve({ signals: [{ id: 'profile-b' }] }); await tick();
  assert.equal(controller.getSnapshot().profileAddress, PROFILE_B);
  assert.deepEqual(controller.getSnapshot().signals.map(({ id }) => id), ['profile-b']);
});

test('the injected timeout aborts immediately in tests and reports the accepted timeout copy', async () => {
  let timeout; let receivedSignal;
  const repository = { loadRecentActivity: (_profile, { signal }) => { receivedSignal = signal; return new Promise(() => {}); } };
  const controller = createActivityController({
    clearTimeoutImpl() {}, repository, setTimeoutImpl(callback) { timeout = callback; return 1; }, timeoutMs: 15_000,
  });
  controller.activate(PROFILE_A);
  timeout(); await tick();
  assert.equal(receivedSignal.aborted, true);
  assert.equal(controller.getSnapshot().status, 'error');
  assert.equal(controller.getSnapshot().error, 'ACTIVITY SOURCE DID NOT RESPOND');
});
