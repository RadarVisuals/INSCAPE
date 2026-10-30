import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createOwnedProcessTree, listWindowsProcesses, listPosixProcesses, terminateWindowsProcessTree,
  terminatePosixProcessTree, withinDeadline, resolveWindowsProcessRuntime } from '../browser-tests/browser-test-lifecycle.mjs';

// Reuse the browser lifecycle's PID + creation-identity checks. Never kill by
// process name, port, or an unverified PID, including on Windows.
export async function runOwnedCommand({ args, cwd, env, stdio, timeoutMs, signal, createTree = createOwnedProcessTree }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw Error('A command requires a positive watchdog deadline');
  const windowsRuntime = await resolveWindowsProcessRuntime(env);
  const nonce = randomUUID();
  const descriptors = Array.isArray(stdio) ? stdio : [stdio || 'ignore', stdio || 'ignore', stdio || 'ignore'];
  const command = args.includes('--test') ? [fileURLToPath(new URL('./runVerificationTests.mjs', import.meta.url)), ...args] : args;
  const childEnvironment = { ...env, INSCAPE_VERIFY_GATE_NONCE: nonce, INSCAPE_VERIFY_PARENT_PID: String(process.pid) };
  if (windowsRuntime) childEnvironment.INSCAPE_PROCESS_POWERSHELL = windowsRuntime.executable;
  // A verification command is its own coordinator, even when unit tests invoke
  // this helper from inside another Node test worker.
  delete childEnvironment.NODE_TEST_CONTEXT; delete childEnvironment.NODE_TEST_WORKER_ID;
  const child = spawn(process.execPath, ['--import', new URL('./verificationProcessGate.mjs', import.meta.url).href, ...command], {
    cwd, env: childEnvironment,
    stdio: [...descriptors, 'ipc'], windowsHide: true });
  const outcome = new Promise(resolve => {
    child.once('error', error => resolve({ code: null, signal: null, error: error.message }));
    child.once('close', (code, childSignal) => resolve({ code, signal: childSignal }));
  });
  if (!child.pid) return { ...await outcome, cleanup: { status: 'not-started', remainingPids: [], errors: [] } };
  const tree = createTree({ rootPid: child.pid,
    listProcesses: windowsRuntime ? () => listWindowsProcesses({ runtime: windowsRuntime }) : listPosixProcesses,
    terminateTree: process.platform === 'win32' ? terminateWindowsProcessTree : terminatePosixProcessTree });
  const errors = [];
  let observation = Promise.resolve(), pendingObservations = 0, timer, watchdog, stopped = null, stopPromise, cleanupCompleted = false, commandError;
  let started = false, completed = false, completionPending = false, completionObservation = Promise.resolve();
  let receiveStart;
  const ready = new Promise(resolve => { receiveStart = message => {
    if (message?.type === 'inscape-verification-gate' && message.nonce === nonce && message.phase === 'start') resolve(true);
  }; child.on('message', receiveStart); });
  const observe = () => {
    pendingObservations++;
    observation = observation.then(() => tree.observe()).catch(error => { errors.push(error.message); return []; })
      .finally(() => { pendingObservations--; });
    return observation;
  };
  const stop = reason => {
    if (stopPromise) return stopPromise;
    stopped = reason;
    stopPromise = (async () => {
      const current = await observe();
      if (!current.length && child.exitCode === null && child.signalCode === null) {
        errors.push('Owned root identity unavailable; descendant cleanup is unknown'); child.kill('SIGTERM');
      }
      if (process.platform !== 'win32' && child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      const remaining = process.platform === 'win32' ? current : await tree.waitForExit(3000);
      if (remaining.length) await tree.forceTerminate(remaining);
    })().catch(error => {
      errors.push(error.message);
      // The live ChildProcess handle is ours even if OS inventory failed. Only
      // stop that direct child; descendant cleanup remains explicitly unknown.
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    });
    return stopPromise;
  };
  const onAbort = () => { void stop('interrupted'); };
  const acknowledge = phase => new Promise((resolve, reject) => child.send({ type: 'inscape-verification-ack', nonce, phase }, error => error ? reject(error) : resolve()));
  const onComplete = message => {
    if (message?.type !== 'inscape-verification-gate' || message.nonce !== nonce || message.phase !== 'complete') return;
    if (!started || completionPending || completed) { errors.push('Unexpected command completion handshake'); return; }
    completionPending = true;
    completionObservation = observe().then(async () => { completed = true; await acknowledge('complete'); })
      .catch(error => { errors.push(error.message); });
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal?.aborted) onAbort();
    const hasStart = await withinDeadline(Promise.race([ready, outcome.then(() => false)]), 30_000, 'Owned command did not reach its startup handshake');
    if (hasStart) {
      await observe();
      if (!tree.ownedPids().includes(child.pid)) throw Error('Owned root creation identity was not observed; command not released');
      started = true; child.on('message', onComplete); await acknowledge('start');
      // Slow inventories must not build a periodic backlog. Explicit checkpoints
      // still queue fresh observations, including completion behind a pending poll.
      timer = setInterval(() => { if (!pendingObservations) void observe(); }, 1000);
      watchdog = setTimeout(() => { void stop('timeout'); }, timeoutMs);
    }
    const result = await withinDeadline(outcome, timeoutMs + 35_000, 'Owned command did not close after watchdog cleanup', () => { void stop('timeout'); });
    clearTimeout(watchdog); clearInterval(timer);
    await observation; await completionObservation; await stopPromise;
    if (!started || !completed) errors.push('Command exited without the startup and normal-completion inventory checkpoints');
    let remaining = await tree.waitForExit(1000);
    const leaked = remaining.map(entry => entry.pid);
    if (remaining.length) {
      await tree.forceTerminate(remaining);
      remaining = await tree.waitForExit(3000);
      errors.push(`Command left owned subprocesses running: ${leaked.join(', ')}`);
    }
    if (remaining.length) errors.push(`Owned subprocesses remain: ${remaining.map(entry => entry.pid).join(', ')}`);
    cleanupCompleted = true;
    return { ...result, rootPid: child.pid, ...(stopped ? { [stopped]: true } : {}), cleanup: { status: errors.length ? 'unknown' : 'verified',
      checkpoints: { start: started, complete: completed }, coverage: 'observed-process-identities', ownedPids: tree.ownedPids(), remainingPids: remaining.map(entry => entry.pid), errors } };
  } catch (error) { commandError = error; throw error;
  } finally {
    clearTimeout(watchdog); clearInterval(timer);
    signal?.removeEventListener('abort', onAbort);
    child.off('message', receiveStart); child.off('message', onComplete);
    if (!cleanupCompleted) {
      try {
        await stop('interrupted');
        const remaining = await tree.observe();
        if (remaining.length) await tree.forceTerminate(remaining);
        const live = await tree.waitForExit(3000);
        if (live.length) throw Error(`Owned subprocesses remain after failed command: ${live.map(entry => entry.pid).join(', ')}`);
      } catch (error) {
        if (commandError) throw new AggregateError([commandError, error], `${commandError.message}; cleanup failed: ${error.message}`);
        throw error;
      } finally {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        try { await withinDeadline(outcome, 3000, 'Direct owned child did not close after fallback termination'); }
        catch {
          child.kill('SIGKILL');
          await withinDeadline(outcome, 3000, 'Direct owned child remained live after forced fallback termination');
        } finally { child.unref(); }
      }
    }
  }
}

export function requireSuccessfulCommand(outcome, label) {
  if (outcome.code !== 0 || outcome.signal || outcome.error || outcome.timeout || outcome.interrupted
    || !Array.isArray(outcome.cleanup?.errors) || !Array.isArray(outcome.cleanup?.remainingPids)
    || outcome.cleanup.status !== 'verified'
    || outcome.cleanup.checkpoints?.start !== true || outcome.cleanup.checkpoints?.complete !== true
    || outcome.cleanup.coverage !== 'observed-process-identities'
    || outcome.cleanup.errors.length || outcome.cleanup.remainingPids.length)
    throw Error(`${label} failed: ${JSON.stringify(outcome)}`);
}
