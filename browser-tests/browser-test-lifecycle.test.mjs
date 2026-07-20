import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolve } from 'node:path';
import {
  createBrowserTestCleanup,
  createOwnedProcessTree,
  removeBrowserProfile,
  validateBrowserProfilePath
} from './browser-test-lifecycle.mjs';

const workspaceRoot = resolve('browser-lifecycle-fixture');
const profilePath = resolve(workspaceRoot, '.browser-test-profile');
const codedError = (code) => Object.assign(new Error(code), { code });

describe('browser test lifecycle', () => {
  test('profile deletion succeeds immediately', async () => {
    const calls = [];
    await removeBrowserProfile({ profilePath, workspaceRoot, remove: async (...args) => calls.push(args) });
    assert.deepEqual(calls, [[profilePath, { recursive: true, force: true }]]);
  });

  test('profile deletion retries EBUSY and then succeeds', async () => {
    let attempts = 0; let time = 0;
    await removeBrowserProfile({ profilePath, workspaceRoot, timeoutMs: 20, retryDelayMs: 5,
      now: () => time, wait: async (ms) => { time += ms; },
      remove: async () => { if (++attempts === 1) throw codedError('EBUSY'); } });
    assert.equal(attempts, 2);
  });

  test('EPERM and ENOTEMPTY remain transient within the deadline', async () => {
    let attempts = 0; let time = 0;
    await removeBrowserProfile({ profilePath, workspaceRoot, timeoutMs: 30, retryDelayMs: 5,
      now: () => time, wait: async (ms) => { time += ms; },
      remove: async () => { attempts += 1; if (attempts === 1) throw codedError('EPERM'); if (attempts === 2) throw codedError('ENOTEMPTY'); } });
    assert.equal(attempts, 3);
  });

  test('permanent EBUSY reaches its deadline with actionable diagnostics', async () => {
    let time = 0;
    await assert.rejects(removeBrowserProfile({ profilePath, workspaceRoot, timeoutMs: 20, retryDelayMs: 5,
      now: () => time, wait: async (ms) => { time += ms; }, remove: async () => { throw codedError('EBUSY'); } }),
    (error) => error.code === 'EBUSY' && error.message.includes(profilePath) && error.message.includes('20ms'));
    const cleanup = createBrowserTestCleanup({ rootPid: 41, profilePath, workspaceRoot,
      processTree: { observe: async () => [], waitForExit: async () => [], forceTerminate: async () => [] },
      removeProfile: async () => { throw codedError('EBUSY'); } });
    await assert.rejects(cleanup(), (error) => error.message.includes('root PID 41')
      && error.message.includes('remaining owned PIDs none') && error.message.includes(profilePath)
      && error.message.includes('filesystem EBUSY') && /elapsed \d+ms/u.test(error.message));
  });

  test('invalid and broad profile paths are rejected before deletion', async () => {
    for (const unsafe of [workspaceRoot, resolve(workspaceRoot, '..'), resolve(workspaceRoot, 'other-profile')]) {
      let removed = false;
      await assert.rejects(removeBrowserProfile({ profilePath: unsafe, workspaceRoot, remove: async () => { removed = true; } }), /browser profile cleanup/iu);
      assert.equal(removed, false);
    }
    assert.equal(validateBrowserProfilePath(profilePath, workspaceRoot), profilePath);
  });

  test('an already absent profile succeeds', async () => {
    const result = await removeBrowserProfile({ profilePath, workspaceRoot, remove: async () => { throw codedError('ENOENT'); } });
    assert.equal(result.absent, true);
  });

  test('graceful Edge exit avoids forced termination', async () => {
    let forced = 0; let closes = 0; let removed = 0;
    const cleanup = createBrowserTestCleanup({ rootPid: 41, profilePath, workspaceRoot,
      processTree: { observe: async () => [], waitForExit: async () => [], forceTerminate: async () => { forced += 1; } },
      removeProfile: async () => { removed += 1; } });
    await cleanup({ cdp: { send: async () => {}, close: async () => { closes += 1; } } });
    assert.deepEqual({ forced, closes, removed }, { forced: 0, closes: 1, removed: 1 });
  });

  test('graceful timeout forces only the owned Edge tree', async () => {
    const forced = []; let waits = 0;
    const owned = [{ pid: 41, identity: 'a' }, { pid: 42, identity: 'b' }];
    const cleanup = createBrowserTestCleanup({ rootPid: 41, profilePath, workspaceRoot,
      processTree: { observe: async () => owned, waitForExit: async () => (++waits === 1 ? owned : []), forceTerminate: async (remaining) => { forced.push(...remaining.map(({ pid }) => pid)); return forced; } },
      removeProfile: async () => {} });
    await cleanup({ cdp: { send: async () => {}, close: async () => {} } });
    assert.deepEqual(forced, [41, 42]);
  });

  test('unrelated and pre-existing PIDs are never targeted', async () => {
    const targets = [];
    const processes = [
      { pid: 41, parentPid: 7, identity: 'root' },
      { pid: 42, parentPid: 41, identity: 'child' },
      { pid: 43, parentPid: 42, identity: 'grandchild' },
      { pid: 99, parentPid: 7, identity: 'interactive-edge' },
      { pid: 100, parentPid: 99, identity: 'interactive-child' }
    ];
    const tree = createOwnedProcessTree({ rootPid: 41, listProcesses: async () => processes, terminateTree: async (pid) => targets.push(pid) });
    const remaining = await tree.observe(); await tree.forceTerminate(remaining);
    assert.deepEqual(tree.ownedPids().sort(), [41, 42, 43]);
    assert.deepEqual(targets, [41]);
  });

  test('repeated cleanup is idempotent', async () => {
    let browserCloses = 0; let profileRemovals = 0;
    const cleanup = createBrowserTestCleanup({ rootPid: 41, profilePath, workspaceRoot,
      processTree: { observe: async () => [], waitForExit: async () => [], forceTerminate: async () => {} },
      removeProfile: async () => { profileRemovals += 1; } });
    const resources = { cdp: { send: async () => { browserCloses += 1; }, close: async () => {} } };
    await cleanup(resources); await cleanup(resources);
    assert.deepEqual({ browserCloses, profileRemovals }, { browserCloses: 1, profileRemovals: 1 });
  });

  test('partial setup failure still cleans every owned resource', async () => {
    let viteConnections = 0; let viteCloses = 0; let profileRemovals = 0;
    const cleanup = createBrowserTestCleanup({ profilePath, workspaceRoot, removeProfile: async () => { profileRemovals += 1; } });
    await cleanup({ vite: { httpServer: { closeAllConnections: () => { viteConnections += 1; } }, close: async () => { viteCloses += 1; } } });
    assert.deepEqual({ viteConnections, viteCloses, profileRemovals }, { viteConnections: 1, viteCloses: 1, profileRemovals: 1 });
  });

  test('only the test-owned Vite instance is stopped', async () => {
    let ownedCloses = 0; let interactiveCloses = 0;
    const interactiveVite = { close: async () => { interactiveCloses += 1; } };
    const cleanup = createBrowserTestCleanup({ profilePath, workspaceRoot, removeProfile: async () => {} });
    await cleanup({ vite: { close: async () => { ownedCloses += 1; } } });
    assert.ok(interactiveVite);
    assert.deepEqual({ ownedCloses, interactiveCloses }, { ownedCloses: 1, interactiveCloses: 0 });
  });
});
