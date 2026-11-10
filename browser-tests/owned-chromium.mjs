import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { createOwnedProcessTree, listWindowsProcesses, listPosixProcesses, terminateWindowsProcess,
  terminatePosixProcess, withinDeadline, captureProcessLaunchTime, BROWSER_LIFECYCLE_TIMEOUTS } from './browser-test-lifecycle.mjs';

const delay = ms => new Promise(done => setTimeout(done, ms));
const supportedOptions = new Set(['executablePath', 'headless', 'args', 'timeout', 'env', 'slowMo', 'artifactsDir']);
const activeSessions = new Set();
// Keep rendering/interception flags aligned with the pinned Playwright 1.61.1
// Chromium launcher. Only process ownership and the CDP transport change.
const disabledFeatures = ['AvoidUnnecessaryBeforeUnloadCheckSync', 'BoundaryEventDispatchTracksNodeRemoval', 'DestroyProfileOnBrowserClose',
  'DialMediaRouteProvider', 'GlobalMediaControls', 'HttpsUpgrades', 'LensOverlay', 'MediaRouter', 'PaintHolding',
  'ThirdPartyStoragePartitioning', 'Translate', 'AutoDeElevate', 'RenderDocument', 'OptimizationHints',
  'msForceBrowserSignIn', 'msEdgeUpdateLaunchServicesPreferredVersion'];
// An abrupt worker exit cannot await OS inventory. A retained ChildProcess
// handle can stop its own root without recursively targeting any other PID.
process.once('exit', () => { for (const session of activeSessions) session.stopRoot(); });

export function ownedChromiumArguments(options, profile) {
  for (const key of Object.keys(options)) if (!supportedOptions.has(key)) throw Error(`Unsupported owned Chromium option: ${key}`);
  const args = options.args || [];
  if (args.some(arg => /^(?:--user-data-dir|--remote-debugging-port|--remote-debugging-pipe)(?:=|$)/u.test(arg)))
    throw Error('Browser profile and debugging endpoint belong to the test launcher');
  return ['--disable-field-trial-config', '--disable-background-networking', '--disable-component-update', '--no-first-run', '--no-default-browser-check',
    '--disable-default-apps', '--disable-extensions', '--disable-sync', '--disable-breakpad', '--disable-dev-shm-usage',
    '--disable-popup-blocking', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', '--enable-automation', '--no-sandbox', '--password-store=basic',
    '--disable-back-forward-cache', '--disable-client-side-phishing-detection', '--disable-component-extensions-with-background-pages',
    '--disable-edgeupdater', `--disable-features=${disabledFeatures.join(',')}`,
    ...(process.env.PLAYWRIGHT_LEGACY_SCREENSHOT ? [] : ['--enable-features=CDPScreenshotNewSurface']),
    '--allow-pre-commit-input', '--disable-hang-monitor', '--disable-ipc-flooding-protection', '--disable-prompt-on-repost',
    '--force-color-profile=srgb', '--metrics-recording-only', '--no-service-autorun', '--export-tagged-pdf',
    '--disable-search-engine-choice-screen', '--unsafely-disable-devtools-self-xss-warnings', '--edge-skip-compat-layer-relaunch',
    '--disable-infobars', '--enable-unsafe-swiftshader', '--use-mock-keychain',
    ...(options.headless === false ? [] : ['--headless', '--hide-scrollbars', '--mute-audio',
      '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4']), ...args,
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'];
}

export async function launchOwnedChromium(options, {
  profileParent,
  onSession = () => {},
  onOwnedProcess = () => {},
  spawnProcess = spawn,
  inventory = process.platform === 'win32' ? listWindowsProcesses : listPosixProcesses,
  terminateProcess = process.platform === 'win32' ? terminateWindowsProcess : terminatePosixProcess,
  connect = chromium.connectOverCDP.bind(chromium),
  readEndpoint = readFile,
  captureLaunchTime = captureProcessLaunchTime,
} = {}) {
  if (!options.executablePath) throw Error('Owned Chromium requires an explicit executable');
  const timeout = options.timeout ?? 20_000;
  if (!Number.isFinite(timeout) || timeout <= 0) throw Error('Owned Chromium requires a finite launch timeout');
  // mkdtemp proves ownership; never use or erase an existing browser profile.
  const exactParent = resolve(profileParent || tmpdir());
  if (profileParent) await mkdir(exactParent, { recursive: true });
  const profile = await mkdtemp(join(exactParent, 'inscape-owned-chromium-'));
  let child, tree, browser, disconnect, closePromise, stopped = false, timer;
  let observation = Promise.resolve(), observing = false;
  let launchError;
  const errors = [];
  const startedAt = Date.now();
  const diagnostic = stage => {
    if (process.env.INSCAPE_BROWSER_LIFECYCLE_LOG === '1') console.log(`Owned Chromium PID ${child?.pid ?? 'not-started'} +${Date.now() - startedAt}ms ${stage}`);
  };
  const alive = () => child && child.exitCode === null && child.signalCode === null;
  const stopRoot = () => { if (alive()) child.kill('SIGKILL'); };
  const observe = () => {
    observing = true;
    observation = observation.then(() => tree.observe()).finally(() => { observing = false; });
    return observation;
  };
  const close = () => closePromise ||= (async () => {
    stopped = true; clearInterval(timer);
    const attempt = async (stage, operation) => {
      diagnostic(`${stage}:start`);
      try { return await operation(); } catch (error) { errors.push(error); diagnostic(`${stage}:failed ${error.message}`); }
      finally { diagnostic(`${stage}:complete`); }
    };
    await attempt('pending-inventory', () => observation);
    if (tree) await attempt('final-inventory', () => tree.observe());
    if (browser?.isConnected()) await attempt('browser-close', async () => {
      const cdp = await withinDeadline(browser.newBrowserCDPSession(), 1000, 'Browser shutdown session deadline');
      try { await withinDeadline(cdp.send('Browser.close'), 1000, 'Browser graceful shutdown deadline'); }
      catch (error) { if (browser.isConnected()) throw error; }
      finally {
        // Browser.close may disconnect before the detach reply arrives. A dead
        // CDP session needs no acknowledgement; a live one must remain bounded.
        if (browser.isConnected()) {
          try { await withinDeadline(cdp.detach(), 1000, 'Browser shutdown session detach deadline'); }
          catch (error) { if (browser.isConnected()) throw error; }
        }
      }
    });
    if (tree) await attempt('owned-processes', async () => {
      const remaining = await tree.waitForExit(1000);
      diagnostic(`remaining-processes:${remaining.length}`);
      if (remaining.length) await tree.forceTerminate(remaining, 8000);
      const live = await tree.waitForExit(3000);
      if (live.length) throw Error(`Owned browser processes remain: ${live.map(entry => entry.pid).join(', ')}`);
    });
    // This fallback can only target the retained child handle. Unknown descendants
    // are reported, never guessed from a process name or a reused parent PID.
    if (alive()) { errors.push(Error('Browser root needed direct-handle fallback')); stopRoot(); }
    if (disconnect) await attempt('disconnect', () => withinDeadline(disconnect(), 3000, 'Browser disconnect deadline'));
    if (child) await attempt('root-exit', () => withinDeadline(exited, 3000, 'Owned browser root did not exit'));
    if (!alive()) {
      activeSessions.delete(session);
      await attempt('profile-removal', () => {
        if (dirname(resolve(profile)) !== exactParent || !/^inscape-owned-chromium-[\w-]+$/u.test(basename(profile)))
          throw Error('Refusing browser profile cleanup outside its exact owner directory');
        return withinDeadline(rm(profile, { recursive: true, force: true, maxRetries: 2 }), 4000, 'Owned browser profile removal deadline');
      });
    }
    if (errors.length) throw new AggregateError(errors,
      `Owned Chromium cleanup failed (PID ${child?.pid ?? 'not-started'}): ${errors.map(error => error.message).join('; ')}`);
  })();
  const session = { close, stopRoot, profile, process: () => child, get processTree() { return tree; } };
  let exited = Promise.resolve();
  try {
    const args = ownedChromiumArguments(options, profile);
    const rootStartedAt = await captureLaunchTime();
    child = spawnProcess(options.executablePath, args, { windowsHide: true, env: options.env || process.env,
      stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr?.resume();
    exited = new Promise(done => { child.once('exit', done); child.once('error', error => { launchError = error; done(); }); });
    activeSessions.add(session); onSession(session);
    if (!Number.isSafeInteger(child.pid) || child.pid <= 0) throw Error('Chromium did not expose an owned process ID');
    tree = createOwnedProcessTree({ rootPid: child.pid, rootStartedAt, rootParentPid: process.pid,
      isRootAlive: alive, listProcesses: inventory, terminateProcess,
      terminateWithIdentityCheck: terminateProcess === terminateWindowsProcess
        ? (entry, timeoutMs) => terminateWindowsProcess(entry, { timeoutMs }) : undefined });
    const entries = await observe();
    const root = entries.find(entry => entry.pid === child.pid);
    if (!root) throw Error('Owned Chromium creation identity could not be verified');
    onOwnedProcess({ rootPid: child.pid, processTree: tree, identity: root.identity });
    timer = setInterval(() => { if (!observing && !stopped) void observe().catch(error => errors.push(error)); }, BROWSER_LIFECYCLE_TIMEOUTS.processObservationMs);
    timer.unref();
    let endpoint;
    while (!endpoint) {
      if (stopped) throw Error('Owned Chromium launch was cancelled');
      if (launchError) throw launchError;
      if (!alive()) throw Error('Owned Chromium exited before its debugging endpoint was ready');
      if (Date.now() - startedAt >= timeout) throw Error('Owned Chromium launch deadline exceeded');
      try {
        const [port, path] = (await readEndpoint(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/u);
        if (!/^\d+$/u.test(port) || Number(port) < 1 || Number(port) > 65535 || !/^\/devtools\/browser\/[\w-]+$/u.test(path))
          throw Error('Invalid owned Chromium debugging endpoint');
        endpoint = `ws://127.0.0.1:${port}${path}`;
      } catch (error) {
        // Chromium can still hold the freshly-created port file on Windows.
        // Only these transient file states retry, under the same launch deadline.
        if (!['ENOENT', 'EBUSY', 'EPERM'].includes(error.code)) throw error;
        await delay(20);
      }
    }
    // CDP connects to our freshly-created endpoint and leaves process ownership
    // here. It cannot invoke Playwright's launchServer taskkill/process-group fallback.
    browser = await connect(endpoint, { timeout: Math.max(1, timeout - (Date.now() - startedAt)), slowMo: options.slowMo,
      artifactsDir: options.artifactsDir, isLocal: true });
    disconnect = browser.close.bind(browser);
    browser.close = close;
    if (stopped) { await disconnect(); throw Error('Owned Chromium launch was cancelled'); }
    return { browser, session, processTree: tree, rootPid: child.pid, identity: root.identity };
  } catch (error) {
    try { await close(); } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], `Owned Chromium setup and cleanup failed: ${error.message}; ${cleanupError.message}`);
    }
    throw error;
  }
}
