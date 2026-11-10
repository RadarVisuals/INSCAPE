import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { stat } from 'node:fs/promises';
import { launchOwnedChromium, ownedChromiumArguments } from './owned-chromium.mjs';

function fixture({ rootIdentity, connectError, endpointMissing = false } = {}) {
  const child = new EventEmitter();
  Object.assign(child, { pid: 45000, exitCode: null, signalCode: null, stderr: { resume() {} } });
  const calls = []; let startedAt, connected = false, session;
  const exit = () => { child.exitCode = 0; child.emit('exit', 0); };
  child.kill = signal => { calls.push(['direct', signal]); exit(); };
  const browser = {
    isConnected: () => connected,
    close: async () => { calls.push(['disconnect']); connected = false; },
    newBrowserCDPSession: async () => ({ send: async method => { calls.push([method]); exit(); }, detach: async () => {} }),
  };
  return { calls, child, browser, get session() { return session; }, dependencies: {
    spawnProcess: (executable, args, options) => {
      startedAt = Date.now(); calls.push(['spawn', executable, args, options]); return child;
    },
    inventory: async () => child.exitCode === null ? [{ pid: child.pid, parentPid: process.pid, identity: rootIdentity || `/Date(${startedAt})/` }] : [],
    terminateProcess: async entry => { calls.push(['terminate', entry.pid]); exit(); },
    readEndpoint: async () => { if (endpointMissing) throw Object.assign(Error('not ready'), { code: 'ENOENT' }); return '19000\n/devtools/browser/test-owned\n'; },
    connect: async (endpoint, options) => {
      calls.push(['connect', endpoint, options]); if (connectError) throw Error(connectError); connected = true; return browser;
    },
    onSession: value => { session = value; },
  } };
}

test('owned Chromium retains supported launch arguments and prevents profile/endpoint replacement', () => {
  const args = ownedChromiumArguments({ executablePath: 'chrome', headless: true, args: ['--use-fake-device-for-media-stream'] }, 'own-profile');
  assert.ok(args.includes('--headless'));
  assert.ok(args.includes('--force-color-profile=srgb'));
  assert.ok(args.includes('--hide-scrollbars'));
  assert.ok(args.includes('--use-fake-device-for-media-stream'));
  assert.ok(args.includes('--user-data-dir=own-profile'));
  for (const arg of ['--user-data-dir=/other', '--remote-debugging-pipe', '--remote-debugging-port=9222'])
    assert.throws(() => ownedChromiumArguments({ args: [arg] }, 'own-profile'), /belong to the test launcher/u);
  assert.throws(() => ownedChromiumArguments({ proxy: {} }, 'own-profile'), /Unsupported/u);
});

test('owned launch, CDP connection and graceful close keep unique profile ownership and are idempotent', async () => {
  const mock = fixture();
  const launched = await launchOwnedChromium({ executablePath: 'chrome', args: ['--example'], artifactsDir: 'artifacts', slowMo: 2 }, mock.dependencies);
  assert.equal(launched.browser, mock.browser);
  assert.equal(mock.calls[0][3].windowsHide, true);
  assert.ok(mock.calls[0][2].includes(`--user-data-dir=${mock.session.profile}`));
  const connect = mock.calls.find(call => call[0] === 'connect');
  assert.equal(connect[1], 'ws://127.0.0.1:19000/devtools/browser/test-owned');
  assert.equal(connect[2].artifactsDir, 'artifacts'); assert.equal(connect[2].slowMo, 2);
  const first = launched.browser.close(); assert.equal(first, launched.browser.close()); await first;
  assert.deepEqual(mock.calls.slice(-2), [['Browser.close'], ['disconnect']]);
  await assert.rejects(stat(mock.session.profile), { code: 'ENOENT' });
});

test('CDP setup failure closes only verified processes and removes its own fresh profile', async () => {
  const mock = fixture({ connectError: 'connection refused' });
  await assert.rejects(launchOwnedChromium({ executablePath: 'chrome' }, mock.dependencies), /connection refused/u);
  assert.ok(mock.calls.some(call => call[0] === 'terminate' && call[1] === mock.child.pid));
  assert.ok(!mock.calls.some(call => call[0] === 'direct'));
  await assert.rejects(stat(mock.session.profile), { code: 'ENOENT' });
});

test('a stalled shutdown-session detach cannot hang owned process and profile cleanup', async () => {
  const mock = fixture();
  const newSession = mock.browser.newBrowserCDPSession;
  mock.browser.newBrowserCDPSession = async () => ({ ...await newSession(), detach: () => new Promise(() => {}) });
  const launched = await launchOwnedChromium({ executablePath: 'chrome' }, mock.dependencies);
  await assert.rejects(launched.browser.close(), /Browser shutdown session detach deadline/u);
  assert.equal(mock.child.exitCode, 0);
  assert.ok(mock.calls.some(call => call[0] === 'disconnect'));
  await assert.rejects(stat(mock.session.profile), { code: 'ENOENT' });
});

test('launch deadline cleans the root without a Playwright tree-kill fallback', async () => {
  const mock = fixture({ endpointMissing: true });
  await assert.rejects(launchOwnedChromium({ executablePath: 'chrome', timeout: 10 }, mock.dependencies), /launch deadline/u);
  assert.deepEqual(mock.calls.filter(call => call[0] === 'terminate'), [['terminate', mock.child.pid]]);
  await assert.rejects(stat(mock.session.profile), { code: 'ENOENT' });
});

test('unknown ownership fails visibly and uses only its retained child handle', async () => {
  const mock = fixture({ rootIdentity: 'unknown' });
  await assert.rejects(launchOwnedChromium({ executablePath: 'chrome' }, mock.dependencies), error => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].message, /could not be verified/u);
    return true;
  });
  assert.ok(mock.calls.some(call => call[0] === 'direct'));
  assert.ok(!mock.calls.some(call => call[0] === 'terminate' || call[0] === 'connect'));
  await assert.rejects(stat(mock.session.profile), { code: 'ENOENT' });
});

test('temporary port-file locks retry within the launch deadline', async () => {
  const mock = fixture(); let reads = 0;
  const readEndpoint = mock.dependencies.readEndpoint;
  mock.dependencies.readEndpoint = async (...args) => {
    if (++reads <= 2) throw Object.assign(Error('port file is being written'), { code: reads === 1 ? 'EBUSY' : 'EPERM' });
    return readEndpoint(...args);
  };
  const launched = await launchOwnedChromium({ executablePath: 'chrome', timeout: 500 }, mock.dependencies);
  assert.equal(reads, 3);
  await launched.browser.close();
});

test('a persistently locked port file fails and cleans up within the same launch deadline', async () => {
  const mock = fixture();
  mock.dependencies.readEndpoint = async () => { throw Object.assign(Error('locked'), { code: 'EBUSY' }); };
  await assert.rejects(launchOwnedChromium({ executablePath: 'chrome', timeout: 10 }, mock.dependencies), /launch deadline/u);
  assert.ok(mock.calls.some(call => call[0] === 'terminate'));
  await assert.rejects(stat(mock.session.profile), { code: 'ENOENT' });
});
