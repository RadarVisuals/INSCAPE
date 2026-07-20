import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

const TRANSIENT_PROFILE_ERRORS = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY']);
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

function withinDeadline(promise, timeoutMs, timeoutError) {
  return new Promise((resolveResult, reject) => {
    const timer = setTimeout(() => timeoutError ? reject(new Error(timeoutError)) : resolveResult(undefined), timeoutMs);
    Promise.resolve(promise).then(
      (result) => { clearTimeout(timer); resolveResult(result); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

function validPid(pid) {
  return Number.isSafeInteger(pid) && pid > 0;
}

function within(parent, child) {
  const pathFromParent = relative(parent, child);
  return pathFromParent !== '' && !pathFromParent.startsWith('..') && !isAbsolute(pathFromParent);
}

export function validateBrowserProfilePath(profilePath, workspaceRoot) {
  if (typeof profilePath !== 'string' || typeof workspaceRoot !== 'string') {
    throw new Error('Browser profile cleanup requires resolved string paths');
  }
  const exactWorkspace = resolve(workspaceRoot);
  const exactProfile = resolve(profilePath);
  const expectedProfile = resolve(exactWorkspace, '.browser-test-profile');
  const driveRoot = resolve(exactProfile, dirname(exactProfile) === exactProfile ? '.' : '..');
  if (!isAbsolute(exactProfile) || exactProfile !== expectedProfile || !within(exactWorkspace, exactProfile)
      || exactProfile === exactWorkspace || exactProfile === driveRoot || basename(exactProfile) !== '.browser-test-profile') {
    throw new Error(`Refusing browser profile cleanup outside the exact test artifact path: ${exactProfile}`);
  }
  return exactProfile;
}

export async function removeBrowserProfile({
  profilePath,
  workspaceRoot,
  remove = rm,
  timeoutMs = 5_000,
  retryDelayMs = 100,
  now = Date.now,
  wait = delay
}) {
  const exactProfile = validateBrowserProfilePath(profilePath, workspaceRoot);
  const started = now();
  let lastError; let attempts = 0;
  do {
    try {
      attempts += 1;
      await remove(exactProfile, { recursive: true, force: true });
      return { profilePath: exactProfile, elapsedMs: now() - started, attempts };
    } catch (error) {
      if (error?.code === 'ENOENT') return { profilePath: exactProfile, elapsedMs: now() - started, absent: true };
      if (!TRANSIENT_PROFILE_ERRORS.has(error?.code)) throw error;
      lastError = error;
      const remaining = timeoutMs - (now() - started);
      if (remaining <= 0) break;
      await wait(Math.min(retryDelayMs, remaining));
    }
  } while (now() - started < timeoutMs);
  const error = new Error(`Browser profile remained locked after ${now() - started}ms: ${exactProfile} (${lastError?.code || 'UNKNOWN'})`, { cause: lastError });
  error.code = lastError?.code;
  error.profilePath = exactProfile;
  throw error;
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const { timeoutMs = 3_000, ...spawnOptions } = options;
    const child = spawn(command, args, { windowsHide: true, ...spawnOptions });
    let stdout = ''; let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${command} exceeded its ${timeoutMs}ms cleanup deadline`)); }, timeoutMs);
    timer.unref?.();
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => { clearTimeout(timer); resolveRun({ code, stdout, stderr }); });
  });
}

export async function listWindowsProcesses() {
  const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate | ConvertTo-Json -Compress';
  const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: ['ignore', 'pipe', 'pipe'] });
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
  return run('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: ['ignore', 'pipe', 'pipe'] });
}

export function createOwnedProcessTree({ rootPid, listProcesses, terminateTree }) {
  if (!validPid(rootPid)) throw new Error(`Cannot track browser with invalid root PID: ${rootPid}`);
  const owned = new Map();

  async function observe() {
    const processes = await listProcesses();
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
      if (!validPid(pid) || owned.get(pid)?.identity !== remaining.find((entry) => entry.pid === pid)?.identity) {
        throw new Error(`Refusing unverified browser process target: ${pid}`);
      }
      await terminateTree(pid);
    }
    return targets;
  }

  return { rootPid, observe, waitForExit, forceTerminate, ownedPids: () => [...owned.keys()] };
}

export function createBrowserTestCleanup({
  rootPid,
  processTree,
  profilePath,
  workspaceRoot,
  gracefulTimeoutMs = 5_000,
  forcedTimeoutMs = 5_000,
  profileTimeoutMs = 5_000,
  resourceCloseTimeoutMs = 5_000,
  removeProfile = removeBrowserProfile
}) {
  let cleanupPromise;
  return function cleanup({ cdp, vite } = {}) {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const started = Date.now();
      let remaining = []; let profileError; let processError; let viteError; let cdpError; let forcedPids = []; let profileResult;
      try {
        if (processTree) await processTree.observe();
        if (cdp) await withinDeadline(cdp.send('Browser.close', {}, gracefulTimeoutMs).catch(() => {}), gracefulTimeoutMs);
      } catch (error) { processError = error; }
      try {
        if (cdp?.close) await withinDeadline(cdp.close(), resourceCloseTimeoutMs, 'CDP close deadline exceeded');
      } catch (error) { cdpError = error; }
      if (processTree && !processError) {
        try {
          remaining = await processTree.waitForExit(gracefulTimeoutMs);
          if (remaining.length) {
            forcedPids = await processTree.forceTerminate(remaining);
            remaining = await processTree.waitForExit(forcedTimeoutMs);
            if (remaining.length) processError = new Error('Owned browser process tree did not exit');
          }
        } catch (error) { processError = error; }
      } else if (processTree) {
        try { remaining = await processTree.observe(); } catch { /* retain the first inventory failure */ }
      }
      try {
        vite?.httpServer?.closeAllConnections?.();
        if (vite?.close) {
          await withinDeadline(vite.close(), resourceCloseTimeoutMs, 'Test-owned Vite close deadline exceeded');
        }
      } catch (error) { viteError = error; }
      try {
        profileResult = await removeProfile({ profilePath, workspaceRoot, timeoutMs: profileTimeoutMs });
      } catch (error) { profileError = error; }
      if (processError || cdpError || viteError || profileError) {
        const elapsed = Date.now() - started;
        const remainingPids = remaining.map((entry) => entry.pid);
        const finalCode = profileError?.code || 'none';
        throw new AggregateError([processError, cdpError, viteError, profileError].filter(Boolean),
          `Browser cleanup failed: root PID ${rootPid ?? 'not-started'}; remaining owned PIDs ${remainingPids.length ? remainingPids.join(',') : 'none'}; profile ${profilePath}; filesystem ${finalCode}; elapsed ${elapsed}ms`);
      }
      return { rootPid, forcedPids, remainingPids: [], profilePath, profileAttempts: profileResult?.attempts, elapsedMs: Date.now() - started };
    })();
    return cleanupPromise;
  };
}

export { TRANSIENT_PROFILE_ERRORS };
