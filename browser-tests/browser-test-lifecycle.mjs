import { spawn } from 'node:child_process';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

export const BROWSER_LIFECYCLE_TIMEOUTS = Object.freeze({
  setupOverallMs: 60_000,
  commandMs: 3_000,
  processInventoryMs: 3_000,
  processTerminationMs: 4_000,
  browserCloseMs: 3_000,
  resourceCloseMs: 2_000,
  gracefulExitMs: 3_000,
  forcedExitMs: 3_000,
  profileRemovalMs: 4_000,
  runtimeRemovalMs: 4_000,
  cleanupOverallMs: 35_000
});

export function createLifecycleDiagnostics(write = (message) => console.log(message), now = () => Number(process.hrtime.bigint() / 1_000_000n)) {
  const started = now();
  return (stage, details = {}) => {
    const suffix = Object.entries(details).map(([key, value]) => `${key}=${String(value)}`).join(' ');
    write(`Browser lifecycle +${Math.max(0, now() - started)}ms ${stage}${suffix ? ` ${suffix}` : ''}`);
  };
}

export function withinDeadline(promise, timeoutMs, timeoutError, onTimeout) {
  return new Promise((resolveResult, reject) => {
    let settled = false;
    const finish = (action, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action(value);
    };
    const timer = setTimeout(() => {
      try { onTimeout?.(); } catch { /* preserve the deadline failure */ }
      finish(reject, Object.assign(new Error(timeoutError || `Operation exceeded its ${timeoutMs}ms deadline`), { code: 'ETIMEDOUT' }));
    }, timeoutMs);
    Promise.resolve(promise).then(
      (result) => finish(resolveResult, result),
      (error) => finish(reject, error)
    );
  });
}

export async function closeViteWithinDeadline(vite, timeoutMs = BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs) {
  if (!vite) return;
  const started = Date.now();
  const server = vite.httpServer;
  const serverProvenClosed = () => server && server.listening === false && (!server.address || server.address() === null);
  if (serverProvenClosed()) return { mode: 'already-closed', component: 'none' };
  let watcherClosed = !vite.watcher?.close;
  if (!watcherClosed) {
    const watcherBudget = Math.min(500, Math.max(1, timeoutMs - (Date.now() - started)));
    await withinDeadline(Promise.resolve(vite.watcher.close()), watcherBudget, 'Test-owned Vite file-watcher close deadline exceeded');
    watcherClosed = true;
  }
  const terminateHandles = () => {
    try { vite.httpServer?.closeAllConnections?.(); } catch { /* continue closing other owned handles */ }
    try { vite.httpServer?.closeIdleConnections?.(); } catch { /* continue closing other owned handles */ }
    try { vite.httpServer?.close?.(); } catch { /* already closed */ }
  };
  try { server?.closeAllConnections?.(); } catch { /* continue with the owned close */ }
  try { server?.closeIdleConnections?.(); } catch { /* continue with the owned close */ }
  try {
    const remaining = Math.max(1, timeoutMs - (Date.now() - started));
    await withinDeadline(vite.close?.(), remaining, 'Test-owned Vite aggregate close deadline exceeded', terminateHandles);
    return { mode: 'graceful', component: 'none', watcherClosed };
  } catch (error) {
    if (serverProvenClosed() && /server is not running/iu.test(error.message)) return;
    if (error.code === 'ETIMEDOUT' && serverProvenClosed() && watcherClosed) {
      return { mode: 'forced-handles', component: 'vite-plugin-or-websocket-aggregate', watcherClosed, listenerClosed: true };
    }
    if (error.code === 'ETIMEDOUT' && !serverProvenClosed()) {
      throw Object.assign(new Error('Test-owned Vite HTTP listener remained live after its close deadline'), { code: 'VITE_HTTP_LISTENER_LIVE', cause: error });
    }
    throw error;
  }
}

function validPid(pid) {
  return Number.isSafeInteger(pid) && pid > 0;
}

function within(parent, child) {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== '' && !pathFromParent.startsWith('..') && !isAbsolute(pathFromParent);
}

export function validateBrowserRuntimePath(runtimePath, workspaceRoot) {
  if (typeof runtimePath !== 'string' || typeof workspaceRoot !== 'string') throw new Error('Browser runtime cleanup requires resolved string paths');
  const exactWorkspace = resolve(workspaceRoot); const exactRuntime = resolve(runtimePath);
  const expectedRuntime = resolve(exactWorkspace, '.browser-test-runtime');
  const driveRoot = resolve(exactRuntime, dirname(exactRuntime) === exactRuntime ? '.' : '..');
  if (!isAbsolute(exactRuntime) || exactRuntime !== expectedRuntime || !within(exactWorkspace, exactRuntime)
      || exactRuntime === exactWorkspace || exactRuntime === driveRoot || basename(exactRuntime) !== '.browser-test-runtime') {
    throw new Error(`Refusing browser runtime cleanup outside the exact test artifact path: ${exactRuntime}`);
  }
  return exactRuntime;
}

export function runBoundedCommand(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const { timeoutMs = 3_000, ...spawnOptions } = options;
    const child = spawn(command, args, { windowsHide: true, ...spawnOptions });
    let stdout = ''; let stderr = '';
    let settled = false;
    const finish = (action, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action(value);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* preserve the command deadline failure */ }
      finish(reject, Object.assign(new Error(`${command} exceeded its ${timeoutMs}ms cleanup deadline`), { code: 'ETIMEDOUT', childPid: child.pid }));
    }, timeoutMs);
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => finish(reject, error));
    child.once('exit', (code) => finish(resolveRun, { code, stdout, stderr }));
  });
}

export async function removeBrowserRuntime({ runtimePath, workspaceRoot, timeoutMs = BROWSER_LIFECYCLE_TIMEOUTS.runtimeRemovalMs, run = runBoundedCommand }) {
  const exactRuntime = validateBrowserRuntimePath(runtimePath, workspaceRoot);
  const script = "const {rmSync}=require('node:fs');try{rmSync(process.argv[1],{recursive:true,force:true,maxRetries:0})}catch(e){console.error(e.code||'ERROR');process.exitCode=1}";
  const result = await run(process.execPath, ['-e', script, exactRuntime], { stdio: ['ignore', 'pipe', 'pipe'], timeoutMs });
  if (result.code !== 0) throw Object.assign(new Error(`Browser runtime removal failed: ${result.stderr.trim() || `exit ${result.code}`}`), { code: 'RUNTIME_REMOVE_FAILED' });
  return { runtimePath: exactRuntime };
}

export async function listWindowsProcesses() {
  const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate | ConvertTo-Json -Compress';
  const result = await runBoundedCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.code !== 0) throw new Error(`Unable to inspect Windows process ownership: ${result.stderr.trim() || `exit ${result.code}`}`);
  const parsed = result.stdout.trim() ? JSON.parse(result.stdout) : [];
  return (Array.isArray(parsed) ? parsed : [parsed]).map((entry) => ({
    pid: Number(entry.ProcessId),
    parentPid: Number(entry.ParentProcessId),
    identity: String(entry.CreationDate || '')
  })).filter((entry) => validPid(entry.pid));
}

export async function terminateWindowsProcessTree(pid) {
  if (!validPid(pid)) throw new Error(`Refusing ambiguous browser process target: ${pid}`);
  return runBoundedCommand('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: ['ignore', 'pipe', 'pipe'], timeoutMs: BROWSER_LIFECYCLE_TIMEOUTS.processTerminationMs });
}

export function createOwnedProcessTree({
  rootPid,
  listProcesses,
  terminateTree,
  inventoryTimeoutMs = BROWSER_LIFECYCLE_TIMEOUTS.processInventoryMs,
  terminationTimeoutMs = BROWSER_LIFECYCLE_TIMEOUTS.processTerminationMs
}) {
  if (!validPid(rootPid)) throw new Error(`Cannot track browser with invalid root PID: ${rootPid}`);
  const owned = new Map();

  async function inventory() {
    return withinDeadline(listProcesses(), inventoryTimeoutMs, `Process inventory exceeded its ${inventoryTimeoutMs}ms deadline`);
  }

  function record(processes) {
    const byPid = new Map(processes.map((entry) => [entry.pid, entry]));
    const root = byPid.get(rootPid);
    if (root && !owned.has(rootPid)) owned.set(rootPid, { identity: root.identity, parentPid: root.parentPid });
    let changed = true;
    while (changed) {
      changed = false;
      for (const process of processes) {
        const parent = owned.get(process.parentPid);
        if (parent && byPid.get(process.parentPid)?.identity === parent.identity && !owned.has(process.pid)) {
          owned.set(process.pid, { identity: process.identity, parentPid: process.parentPid }); changed = true;
        }
      }
    }
    return processes.filter((process) => owned.get(process.pid)?.identity === process.identity);
  }

  async function observe() {
    return record(await inventory());
  }

  async function waitForExit(timeoutMs, pollMs = 100) {
    const started = Date.now();
    let remaining = await observe();
    while (remaining.length && Date.now() - started < timeoutMs) {
      await delay(Math.min(pollMs, timeoutMs - (Date.now() - started)));
      remaining = await observe();
    }
    return remaining;
  }

  async function forceTerminate(remaining) {
    const remainingIds = new Set(remaining.map((entry) => entry.pid));
    const targets = remaining.filter((entry) => !remainingIds.has(owned.get(entry.pid)?.parentPid)).map((entry) => entry.pid);
    for (const pid of targets) {
      const expected = owned.get(pid);
      if (!validPid(pid) || expected?.identity !== remaining.find((entry) => entry.pid === pid)?.identity) {
        throw new Error(`Refusing unverified browser process target: ${pid}`);
      }
      const current = (await inventory()).find((entry) => entry.pid === pid);
      if (!current) continue;
      if (current.identity !== expected.identity) {
        throw new Error(`Refusing reused browser process target: PID ${pid} changed creation identity`);
      }
      await withinDeadline(terminateTree(pid), terminationTimeoutMs, `Termination of owned browser PID ${pid} exceeded its ${terminationTimeoutMs}ms deadline`);
    }
    return targets;
  }

  return { rootPid, observe, waitForExit, forceTerminate, ownedPids: () => [...owned.keys()] };
}

export function createBrowserTestCleanup({ rootPid, processTree, runtimePath, workspaceRoot, diagnostic = () => {}, removeRuntime = removeBrowserRuntime }) {
  let cleanupPromise;
  return function cleanup(resources = {}) {
    if (cleanupPromise) return cleanupPromise;
    const perform = async () => {
      const started = Date.now(); const failures = []; let remaining = []; let forcedPids = []; let shutdownMode = processTree ? 'unknown' : 'not-started';
      diagnostic('cleanup:start', { rootPid: rootPid ?? 'not-started', deadlineMs: BROWSER_LIFECYCLE_TIMEOUTS.cleanupOverallMs });
      const attempt = async (stage, action) => {
        try { diagnostic(`${stage}:start`); const value = await action(); diagnostic(`${stage}:complete`); return value; }
        catch (error) { failures.push(error); diagnostic(`${stage}:failed`, { code: error.code || 'ERROR' }); return undefined; }
      };
      await attempt('cleanup:routes', async () => resources.routeController?.close?.({ cancel: async () => resources.context?.close?.() }));
      await attempt('cleanup:page-cdp', async () => resources.pageCdp?.detach?.());
      await attempt('cleanup:context', async () => resources.context && withinDeadline(resources.context.close(), BROWSER_LIFECYCLE_TIMEOUTS.browserCloseMs, 'Playwright context close deadline exceeded'));
      await attempt('cleanup:browser', async () => resources.browser && withinDeadline(resources.browser.close(), BROWSER_LIFECYCLE_TIMEOUTS.browserCloseMs, 'Playwright browser close deadline exceeded'));
      await attempt('cleanup:browser-server', async () => {
        if (!resources.browserServer) return;
        try {
          await withinDeadline(resources.browserServer.close(), BROWSER_LIFECYCLE_TIMEOUTS.browserCloseMs, 'Playwright browser server close deadline exceeded');
          shutdownMode = 'graceful';
        } catch (closeError) {
          await withinDeadline(resources.browserServer.kill(), BROWSER_LIFECYCLE_TIMEOUTS.browserCloseMs, 'Playwright browser server kill deadline exceeded');
          shutdownMode = 'playwright-kill';
          if (closeError.code !== 'ETIMEDOUT') throw closeError;
        }
      });
      if (processTree) await attempt('cleanup:edge-exit', async () => {
        remaining = await processTree.waitForExit(BROWSER_LIFECYCLE_TIMEOUTS.gracefulExitMs);
        if (remaining.length) {
          forcedPids = await processTree.forceTerminate(remaining); shutdownMode = 'verified-taskkill';
          remaining = await processTree.waitForExit(BROWSER_LIFECYCLE_TIMEOUTS.forcedExitMs);
        }
        if (remaining.length) throw new Error(`Owned Edge tree remained alive: ${remaining.map((entry) => entry.pid).join(',')}`);
      });
      await attempt('cleanup:vite', async () => closeViteWithinDeadline(resources.vite, BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs));
      await attempt('cleanup:runtime', async () => runtimePath && removeRuntime({ runtimePath, workspaceRoot }));
      const elapsedMs = Date.now() - started;
      diagnostic('cleanup:complete', { shutdownMode, elapsedMs, forced: forcedPids.length });
      if (failures.length) throw new AggregateError(failures, `Browser cleanup failed after ${elapsedMs}ms`);
      return { rootPid, shutdownMode, forcedPids, remainingPids: [], elapsedMs };
    };
    cleanupPromise = withinDeadline(perform(), BROWSER_LIFECYCLE_TIMEOUTS.cleanupOverallMs, 'Browser cleanup overall deadline exceeded');
    return cleanupPromise;
  };
}

export async function runBrowserSetupWithCleanup(setup, cleanup, {
  timeoutMs = BROWSER_LIFECYCLE_TIMEOUTS.setupOverallMs,
  cancelSetup,
  diagnostic = () => {}
} = {}) {
  try {
    diagnostic('setup:start', { deadlineMs: timeoutMs });
    const result = await withinDeadline(setup(), timeoutMs, `Browser setup exceeded its ${timeoutMs}ms overall deadline`, () => {
      diagnostic('setup:deadline');
      cancelSetup?.();
    });
    diagnostic('setup:complete');
    return result;
  } catch (setupError) {
    diagnostic('setup:failed', { code: setupError.code || 'ERROR' });
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError([setupError, cleanupError], 'Browser setup failed and cleanup also failed');
    }
    throw setupError;
  }
}
