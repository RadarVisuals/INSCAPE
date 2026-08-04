import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import {
  BROWSER_LIFECYCLE_TIMEOUTS,
  createOwnedProcessTree,
  listWindowsProcesses,
  terminateWindowsProcessTree,
  validateBrowserRuntimePath,
  withinDeadline
} from './browser-test-lifecycle.mjs';

export const DEFAULT_PLAYWRIGHT_EDGE_ARGS = Object.freeze([
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-component-update',
  '--disable-background-networking',
  '--disk-cache-size=1',
  '--media-cache-size=1',
]);

function boundedText(value, limit = 256) {
  return String(value || '').replace(/[\r\n\u0000-\u001f\u007f]+/gu, ' ').replace(/https?:\/\/\S+/gu, '[url]').slice(0, limit);
}

export function createPlaywrightRouteController({
  loopbackOrigin,
  knownOrigins,
  decideKnown,
  onUnexpected = () => {},
  timeoutMs = BROWSER_LIFECYCLE_TIMEOUTS.resourceCloseMs,
  maxOutstanding = 64
}) {
  const known = new Set(knownOrigins); const handled = new WeakSet(); const active = new Set(); let closed = false; let sequence = 0;
  async function handle(route) {
    if (handled.has(route)) throw Object.assign(new Error('Playwright route was delivered more than once'), { code: 'DUPLICATE_ROUTE' });
    handled.add(route);
    if (closed) throw Object.assign(new Error('Playwright route arrived after routing closed'), { code: 'ROUTING_CLOSED' });
    if (active.size >= maxOutstanding) throw Object.assign(new Error(`Playwright route ledger exceeded ${maxOutstanding}`), { code: 'ROUTE_LEDGER_LIMIT' });
    const request = route.request(); let parsed;
    try { parsed = new URL(request.url()); } catch { parsed = null; }
    const origin = parsed?.origin || 'invalid'; const id = ++sequence;
    let decision;
    if (origin === loopbackOrigin) decision = { action: 'continue' };
    else if (known.has(origin)) decision = await decideKnown({ request, url: parsed, origin });
    else { onUnexpected(origin === 'invalid' ? 'invalid' : origin); decision = { action: 'abort', errorCode: 'blockedbyclient' }; }
    if (!decision || !['continue', 'fulfill', 'abort'].includes(decision.action)) {
      throw Object.assign(new Error(`No terminal route decision for ${origin}`), { code: 'INVALID_ROUTE_ACTION' });
    }
    const operation = decision.action === 'continue' ? route.continue()
      : decision.action === 'fulfill' ? route.fulfill(decision.options || {})
        : route.abort(decision.errorCode || 'blockedbyclient');
    const pending = withinDeadline(operation, timeoutMs, `Playwright ${decision.action} route deadline exceeded`);
    active.add(pending);
    try { await pending; return { id, origin, action: decision.action }; }
    finally { active.delete(pending); }
  }
  async function close({ cancel = async () => {} } = {}) {
    closed = true;
    if (!active.size) return { outstanding: 0 };
    try { await withinDeadline(Promise.allSettled([...active]), timeoutMs, 'Active Playwright route teardown deadline exceeded'); }
    catch (error) {
      await cancel();
      await withinDeadline(Promise.allSettled([...active]), timeoutMs, 'Cancelled Playwright routes remained active');
      if (active.size) throw Object.assign(new Error(`${active.size} Playwright route handler(s) remained active`), { code: 'UNRESOLVED_ROUTES', cause: error });
    }
    return { outstanding: active.size };
  }
  return { handle, close, outstandingCount: () => active.size, isClosed: () => closed };
}

export async function settlePlaywrightAnimationFrames(page, {
  frames = 2,
  timeoutMs = BROWSER_LIFECYCLE_TIMEOUTS.commandMs
} = {}) {
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > 4) throw new RangeError('Animation-frame settlement count must be between 1 and 4');
  const settlement = page.evaluate((count) => new Promise((resolveSettlement) => {
    let remaining = count;
    const advance = () => {
      remaining -= 1;
      if (remaining === 0) resolveSettlement();
      else requestAnimationFrame(advance);
    };
    requestAnimationFrame(advance);
  }), frames);
  await withinDeadline(settlement, timeoutMs, `Playwright animation-frame settlement exceeded ${timeoutMs}ms`);
}

export async function waitForCspFixtureReady(page, {
  fixtureOrigin,
  timeoutMs = 10_000
}) {
  await page.waitForURL((url) => url.origin === fixtureOrigin
    && url.pathname === '/browser-tests/fixture.html'
    && url.searchParams.get('csp') === '1', { timeout: timeoutMs });
  await page.locator('[data-browser-fixture]').waitFor({ state: 'attached', timeout: timeoutMs });
  const fixtureHandle = await page.waitForFunction(() => Boolean(window.__fixture?.ready
    && document.querySelector('.visitor-lattice-world,.published-home-world')), undefined, { timeout: timeoutMs, polling: 50 });
  await fixtureHandle.dispose();
}

export async function launchPlaywrightEdge({
  edgePath,
  runtimePath,
  workspaceRoot,
  loopbackOrigin,
  routeController,
  resources,
  onOwnedProcess,
  onBrowserProblem = () => {},
  diagnostic = () => {},
  browserType = chromium,
  inventory = listWindowsProcesses,
  terminateTree = terminateWindowsProcessTree,
  browserArgs = DEFAULT_PLAYWRIGHT_EDGE_ARGS,
  contextOptions = {},
  prepareRuntime = async (downloadsPath, artifactsDir) => {
    await mkdir(downloadsPath, { recursive: true }); await mkdir(artifactsDir, { recursive: true });
  }
}) {
  const exactRuntime = validateBrowserRuntimePath(runtimePath, workspaceRoot);
  const downloadsPath = join(exactRuntime, 'downloads'); const artifactsDir = join(exactRuntime, 'artifacts');
  await prepareRuntime(downloadsPath, artifactsDir);
  const previousTemp = process.env.TEMP; const previousTmp = process.env.TMP;
  let lateLaunch = false;
  process.env.TEMP = exactRuntime; process.env.TMP = exactRuntime;
  try {
    const launch = browserType.launchServer({
      executablePath: edgePath,
      headless: true,
      timeout: 20_000,
      downloadsPath,
      artifactsDir,
      env: { ...process.env, TEMP: exactRuntime, TMP: exactRuntime },
      args: [...browserArgs]
    });
    launch.then((server) => { if (lateLaunch) void server.close().catch(() => server.kill().catch(() => {})); }).catch(() => {});
    resources.browserServer = await withinDeadline(launch, 20_000, 'Playwright Edge launch deadline exceeded', () => { lateLaunch = true; });
  } finally {
    if (previousTemp === undefined) delete process.env.TEMP; else process.env.TEMP = previousTemp;
    if (previousTmp === undefined) delete process.env.TMP; else process.env.TMP = previousTmp;
  }
  const child = resources.browserServer.process(); const rootPid = child?.pid;
  if (!Number.isSafeInteger(rootPid) || rootPid <= 0) throw Object.assign(new Error('Playwright BrowserServer did not expose a valid owned Edge PID'), { code: 'EDGE_PID_MISSING' });
  const processTree = createOwnedProcessTree({ rootPid, listProcesses: inventory, terminateTree });
  const observed = await processTree.observe(); const root = observed.find((entry) => entry.pid === rootPid);
  if (!root?.identity) throw Object.assign(new Error('Owned Playwright Edge creation identity was not recorded'), { code: 'EDGE_IDENTITY_MISSING' });
  onOwnedProcess({ rootPid, processTree, identity: root.identity });
  diagnostic('setup:edge-owned', { rootPid, descendants: observed.length });

  resources.browser = await browserType.connect(resources.browserServer.wsEndpoint(), { timeout: 5_000 });
  resources.context = await resources.browser.newContext({
    viewport: { width: 1280, height: 720 },
    serviceWorkers: 'block',
    bypassCSP: false,
    acceptDownloads: false,
    ...contextOptions,
  });
  await resources.context.route('**/*', (route) => routeController.handle(route).catch((error) => onBrowserProblem(`Route handler: ${error.code || boundedText(error.message)}`)));
  resources.routeController = routeController;
  diagnostic('setup:routing-installed', { beforeNavigation: true });
  resources.page = await resources.context.newPage();
  resources.page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) onBrowserProblem(`Console ${message.type()}: ${boundedText(message.text())}`); });
  resources.page.on('pageerror', (error) => onBrowserProblem(`Page error: ${boundedText(error.name)} ${boundedText(error.message)}`));
  resources.page.on('requestfailed', (request) => {
    let origin = 'invalid'; try { origin = new URL(request.url()).origin === loopbackOrigin ? 'loopback' : new URL(request.url()).origin; } catch { /* bounded classification */ }
    const failure = request.failure()?.errorText || 'unknown';
    if (!/BLOCKED_BY_CLIENT/iu.test(failure)) onBrowserProblem(`Request failed: ${origin} ${boundedText(failure)}`);
  });
  return { rootPid, processTree, identity: root.identity, browserServer: resources.browserServer, browser: resources.browser, context: resources.context, page: resources.page };
}
