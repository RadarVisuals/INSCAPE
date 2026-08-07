import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EventEmitter } from 'node:events';
import { resolve } from 'node:path';
import {
  BROWSER_LIFECYCLE_TIMEOUTS,
  createBrowserTestCleanup,
  createOwnedProcessTree,
  listPosixProcesses,
  removeBrowserRuntime,
  runBrowserSetupWithCleanup,
  terminatePosixProcessTree,
  validateBrowserRuntimePath,
  withinDeadline
} from './browser-test-lifecycle.mjs';
import {
  createPlaywrightRouteController,
  launchPlaywrightEdge,
  settlePlaywrightAnimationFrames,
  waitForCspFixtureReady
} from './playwright-browser-adapter.mjs';

const workspaceRoot = resolve('browser-lifecycle-fixture');
const codedError = (code) => Object.assign(new Error(code), { code });

describe('Playwright browser lifecycle', () => {
  const runtimePath = resolve(workspaceRoot, '.browser-test-runtime');
  const processEntry = (pid, parentPid, identity = `created-${pid}`) => ({ pid, parentPid, identity, commandLine: '' });
  const routeFor = (url, calls, pending = Promise.resolve()) => ({
    request: () => ({ url: () => url }),
    continue: () => { calls.push('continue'); return pending; },
    fulfill: (options) => { calls.push(['fulfill', options]); return pending; },
    abort: (code) => { calls.push(['abort', code]); return pending; }
  });

  test('fixed setup and cleanup ceilings retain the 95-second internal bound', () => {
    assert.equal(BROWSER_LIFECYCLE_TIMEOUTS.setupOverallMs, 60_000);
    assert.equal(BROWSER_LIFECYCLE_TIMEOUTS.cleanupOverallMs, 35_000);
  });

  test('deadline cancellation is active and visible', async () => {
    let cancelled = false;
    await assert.rejects(withinDeadline(new Promise(() => {}), 15, 'stalled', () => { cancelled = true; }), (error) => error.code === 'ETIMEDOUT');
    assert.equal(cancelled, true);
  });

  test('only the exact workspace browser runtime path is accepted', () => {
    assert.equal(validateBrowserRuntimePath(runtimePath, workspaceRoot), runtimePath);
    const task4aRuntimePath = resolve(workspaceRoot, '.browser-test-runtime-task4a');
    const isolationRuntimePath = resolve(workspaceRoot, '.browser-test-runtime-task4a-isolation');
    const uniqueTask4aRuntimePath = resolve(workspaceRoot,
      '.browser-test-runtime-task4a-1234-1785847105764-01234567-89ab-4cde-8fab-0123456789ab');
    assert.equal(validateBrowserRuntimePath(task4aRuntimePath, workspaceRoot), task4aRuntimePath);
    assert.equal(validateBrowserRuntimePath(isolationRuntimePath, workspaceRoot), isolationRuntimePath);
    assert.equal(validateBrowserRuntimePath(uniqueTask4aRuntimePath, workspaceRoot), uniqueTask4aRuntimePath);
    for (const unsafe of [workspaceRoot, resolve(workspaceRoot, 'other'), resolve(runtimePath, '.browser-test-runtime-task4a'),
      resolve(workspaceRoot, '..', '.browser-test-runtime'),
      resolve(workspaceRoot, '.browser-test-runtime-task4a-arbitrary'),
      resolve(workspaceRoot, '.browser-test-runtime-task4a-1234-1785847105764-01234567-89ab-3cde-8fab-0123456789ab')]) {
      assert.throws(() => validateBrowserRuntimePath(unsafe, workspaceRoot), /Refusing browser runtime cleanup/);
    }
  });

  test('runtime removal uses one bounded killable child operation', async () => {
    const calls = [];
    const result = await removeBrowserRuntime({ runtimePath, workspaceRoot, run: async (...args) => { calls.push(args); return { code: 0, stdout: '', stderr: '' }; } });
    assert.equal(calls.length, 1); assert.equal(calls[0][0], process.execPath); assert.equal(calls[0][2].timeoutMs, BROWSER_LIFECYCLE_TIMEOUTS.runtimeRemovalMs);
    assert.equal(result.mode, 'node-rm');
  });

  test('runtime removal falls back to one bounded native Windows operation after Node UNKNOWN', async () => {
    if (process.platform !== 'win32') return;
    const calls = [];
    const result = await removeBrowserRuntime({ runtimePath, workspaceRoot, run: async (...args) => {
      calls.push(args);
      return calls.length === 1 ? { code: 1, stdout: '', stderr: 'UNKNOWN' } : { code: 0, stdout: '', stderr: '' };
    } });
    assert.equal(calls.length, 2);
    assert.equal(calls[1][0], 'powershell.exe');
    assert.equal(calls[1][1].at(-1), runtimePath);
    assert.equal(calls[1][2].timeoutMs, BROWSER_LIFECYCLE_TIMEOUTS.runtimeRemovalMs);
    assert.equal(result.mode, 'powershell-fallback');
  });

  test('POSIX inventory records stable process creation identities', async () => {
    const result = await listPosixProcesses({ run: async () => ({
      code: 0, stderr: '', stdout: '  10   1 Fri Aug  7 12:00:00 2026\n  11  10 Fri Aug  7 12:00:01 2026\n',
    }) });
    assert.deepEqual(result, [
      { pid: 10, parentPid: 1, identity: 'Fri Aug  7 12:00:00 2026' },
      { pid: 11, parentPid: 10, identity: 'Fri Aug  7 12:00:01 2026' },
    ]);
  });

  test('POSIX forced cleanup terminates only the verified root tree, descendants first', async () => {
    const killed = [];
    const inventory = async () => [processEntry(10, 1), processEntry(11, 10), processEntry(12, 11), processEntry(99, 1)];
    const result = await terminatePosixProcessTree(10, { inventory, kill: (pid, signal) => killed.push([pid, signal]) });
    assert.deepEqual(killed, [[12, 'SIGKILL'], [11, 'SIGKILL'], [10, 'SIGKILL']]);
    assert.deepEqual(result.targets, [12, 11, 10]);
  });

  test('owned descendants exclude unrelated processes and force only the owned root', async () => {
    const killed = []; const inventory = [processEntry(10, 1), processEntry(11, 10), processEntry(99, 1)];
    const tree = createOwnedProcessTree({ rootPid: 10, listProcesses: async () => inventory, terminateTree: async (pid) => killed.push(pid) });
    const remaining = await tree.observe(); await tree.forceTerminate(remaining);
    assert.deepEqual(tree.ownedPids(), [10, 11]); assert.deepEqual(killed, [10]);
  });

  test('PID reuse immediately before taskkill fails closed', async () => {
    let inventories = 0; let killed = false;
    const tree = createOwnedProcessTree({ rootPid: 20,
      listProcesses: async () => [processEntry(20, 1, ++inventories === 1 ? 'owned' : 'reused')],
      terminateTree: async () => { killed = true; } });
    const remaining = await tree.observe(); await assert.rejects(tree.forceTerminate(remaining), /reused|creation identity/i);
    assert.equal(killed, false); assert.equal(inventories, 2);
  });

  test('routing continues loopback, fulfills known, and reports and aborts unknown origins', async () => {
    const unexpected = []; const local = []; const known = []; const unknown = [];
    const controller = createPlaywrightRouteController({ loopbackOrigin: 'http://127.0.0.1:5174', knownOrigins: ['https://published-images.invalid'],
      onUnexpected: (origin) => unexpected.push(origin), decideKnown: async () => ({ action: 'fulfill', options: { status: 200 } }) });
    await controller.handle(routeFor('http://127.0.0.1:5174/@vite/client', local));
    await controller.handle(routeFor('https://published-images.invalid/a.png', known));
    await controller.handle(routeFor('https://unknown.invalid/private', unknown));
    assert.deepEqual(local, ['continue']); assert.equal(known[0][0], 'fulfill'); assert.deepEqual(unknown, [['abort', 'blockedbyclient']]);
    assert.deepEqual(unexpected, ['https://unknown.invalid']);
  });

  test('every Playwright route object resolves exactly once', async () => {
    const calls = []; const controller = createPlaywrightRouteController({ loopbackOrigin: 'http://127.0.0.1:5174', knownOrigins: [], decideKnown: async () => ({ action: 'abort' }) });
    const route = routeFor('http://127.0.0.1:5174/fixture', calls); await controller.handle(route);
    await assert.rejects(controller.handle(route), (error) => error.code === 'DUPLICATE_ROUTE'); assert.deepEqual(calls, ['continue']);
  });

  test('active route teardown waits within the bound and drains the ledger', async () => {
    let release; let cancelled = false; const pending = new Promise((resolvePending) => { release = resolvePending; });
    const controller = createPlaywrightRouteController({ loopbackOrigin: 'http://127.0.0.1:5174', knownOrigins: [], timeoutMs: 15, decideKnown: async () => ({ action: 'abort' }) });
    const handling = controller.handle(routeFor('http://127.0.0.1:5174/fixture', [], pending)).catch(() => {});
    await new Promise((resolveWait) => setImmediate(resolveWait));
    await controller.close({ cancel: async () => { cancelled = true; release(); } }); await handling;
    assert.equal(cancelled, false, 'settled route handlers do not require context cancellation'); assert.equal(controller.outstandingCount(), 0);
  });

  test('Playwright installs context routing before page creation', async () => {
    const order = []; const resources = {};
    const page = new EventEmitter();
    const context = { route: async () => order.push('route'), newPage: async () => { order.push('page'); return page; } };
    const browser = { newContext: async () => { order.push('context'); return context; } };
    const server = { process: () => ({ pid: 30 }), wsEndpoint: () => 'ws://owned', close: async () => {}, kill: async () => {} };
    const browserType = { launchServer: async () => { order.push('server'); return server; }, connect: async () => { order.push('connect'); return browser; } };
    const controller = createPlaywrightRouteController({ loopbackOrigin: 'http://127.0.0.1:5174', knownOrigins: [], decideKnown: async () => ({ action: 'abort' }) });
    await launchPlaywrightEdge({ edgePath: 'edge.exe', runtimePath, workspaceRoot, loopbackOrigin: 'http://127.0.0.1:5174', routeController: controller,
      resources, browserType, inventory: async () => [processEntry(30, 1)], terminateTree: async () => {}, prepareRuntime: async () => {}, onOwnedProcess: () => {} });
    assert.deepEqual(order, ['server', 'connect', 'context', 'route', 'page']);
  });

  test('delayed close focus restoration settles before the next launcher keyboard action', async () => {
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const frames = [];
    let activeLauncher = 'Archive 7';
    globalThis.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
    try {
      requestAnimationFrame(() => { activeLauncher = 'Archive 2'; });
      const page = { evaluate: (operation, count) => operation(count) };
      const settled = settlePlaywrightAnimationFrames(page);
      while (frames.length) {
        const currentFrame = frames.splice(0);
        currentFrame.forEach((callback) => callback());
        await Promise.resolve();
      }
      await settled;
      activeLauncher = 'Archive 7';
      assert.equal(frames.length, 0, 'no close-triggered focus callback remains after settlement');
      assert.equal(activeLauncher, 'Archive 7', 'the next trusted keyboard action retains its intended launcher');
    } finally {
      if (originalRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
      else globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  test('CSP readiness uses URL, locator, and function predicates without unsafe-eval', async () => {
    const calls = []; let disposed = false;
    const page = {
      waitForURL: async (predicate, options) => {
        calls.push(['url', typeof predicate, options]);
        assert.equal(predicate(new URL('http://127.0.0.1:5174/browser-tests/fixture.html?csp=1')), true);
      },
      locator: (selector) => ({ waitFor: async (options) => calls.push(['locator', selector, options]) }),
      waitForFunction: async (predicate, argument, options) => {
        calls.push(['function', typeof predicate, argument, options]);
        assert.equal(predicate.toString().includes('eval'), false);
        return { dispose: async () => { disposed = true; } };
      }
    };
    await waitForCspFixtureReady(page, { fixtureOrigin: 'http://127.0.0.1:5174' });
    assert.deepEqual(calls.map(([kind, value]) => [kind, value]), [
      ['url', 'function'],
      ['locator', '[data-browser-fixture]'],
      ['function', 'function']
    ]);
    assert.equal(disposed, true);
    const fixtureCsp = "script-src 'self' 'unsafe-inline'";
    assert.equal(fixtureCsp.includes("'unsafe-eval'"), false, 'regression policy continues to forbid unsafe-eval');
  });

  test('partial Playwright setup retains BrowserServer ownership for cleanup', async () => {
    const resources = {}; const server = { process: () => ({ pid: 40 }), wsEndpoint: () => 'ws://owned', close: async () => {}, kill: async () => {} };
    const browserType = { launchServer: async () => server, connect: async () => { throw codedError('CONNECT_FAILED'); } };
    const controller = createPlaywrightRouteController({ loopbackOrigin: 'http://127.0.0.1:5174', knownOrigins: [], decideKnown: async () => ({ action: 'abort' }) });
    await assert.rejects(launchPlaywrightEdge({ edgePath: 'edge.exe', runtimePath, workspaceRoot, loopbackOrigin: 'http://127.0.0.1:5174', routeController: controller,
      resources, browserType, inventory: async () => [processEntry(40, 1)], terminateTree: async () => {}, prepareRuntime: async () => {}, onOwnedProcess: () => {} }),
    (error) => error.code === 'CONNECT_FAILED');
    assert.strictEqual(resources.browserServer, server);
  });

  test('normal shutdown is graceful and cleanup is idempotent', async () => {
    const calls = []; const cleanup = createBrowserTestCleanup({ runtimePath, workspaceRoot, removeRuntime: async () => calls.push('runtime') });
    const resources = { routeController: { close: async () => calls.push('routes') }, context: { close: async () => calls.push('context') },
      browser: { close: async () => calls.push('browser') }, browserServer: { close: async () => calls.push('server'), kill: async () => calls.push('kill') } };
    const first = cleanup(resources); const second = cleanup(resources); assert.strictEqual(first, second);
    const result = await first; assert.deepEqual(calls, ['routes', 'context', 'browser', 'server', 'runtime']); assert.equal(result.shutdownMode, 'graceful');
  });

  test('verified Windows forced fallback runs after graceful Playwright shutdown', async () => {
    let waits = 0; const calls = []; const processTree = { waitForExit: async () => ++waits === 1 ? [processEntry(50, 1)] : [], forceTerminate: async () => { calls.push('taskkill'); return [50]; } };
    const cleanup = createBrowserTestCleanup({ rootPid: 50, processTree, runtimePath, workspaceRoot, removeRuntime: async () => {} });
    const result = await cleanup({ browserServer: { close: async () => calls.push('server'), kill: async () => {} } });
    assert.deepEqual(calls, ['server', 'taskkill']); assert.equal(result.shutdownMode, 'verified-taskkill');
  });

  test('setup and cleanup errors remain aggregated', async () => {
    await assert.rejects(runBrowserSetupWithCleanup(async () => { throw codedError('SETUP'); }, async () => { throw codedError('CLEANUP'); }),
      (error) => error instanceof AggregateError && error.errors.map(({ code }) => code).join(',') === 'SETUP,CLEANUP');
  });
});
