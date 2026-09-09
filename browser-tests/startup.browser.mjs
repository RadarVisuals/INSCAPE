import assert from 'node:assert/strict';
import { mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createServer } from 'vite';
import { createBrowserTestCleanup } from './browser-test-lifecycle.mjs';
import { createPlaywrightRouteController, launchPlaywrightEdge } from './playwright-browser-adapter.mjs';
import { FEATURED_WORLD_PROFILE_ADDRESS as featured } from '../src/startveil/featuredWorld.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const other = '0x1111111111111111111111111111111111111111';
const screenshotDir = process.env.INSCAPE_STARTUP_SCREENSHOT_DIR;

test('automatic startup and the editorial landing world through the real App', { timeout: 120_000 }, async (t) => {
  const resources = {};
  const runtimePath = resolve(root, `.browser-test-runtime-owner-routing-${process.pid}-${Date.now()}-${randomUUID()}`);
  let cleanup = createBrowserTestCleanup({ runtimePath, workspaceRoot: root });
  const problems = [];
  let testError;
  try {
    resources.vite = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
    await resources.vite.listen();
    const origin = `http://127.0.0.1:${resources.vite.httpServer.address().port}`;
    let edgePath;
    for (const path of [process.env.BROWSER_PATH,
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
      try { await access(path); edgePath = path; break; } catch { /* Try the next installed browser. */ }
    }
    assert.ok(edgePath, 'Set BROWSER_PATH to an installed Chromium browser');
    const routeController = createPlaywrightRouteController({ loopbackOrigin: origin,
      knownOrigins: [], decideKnown: async () => ({ action: 'abort' }) });
    await launchPlaywrightEdge({ edgePath, runtimePath, workspaceRoot: root, loopbackOrigin: origin,
      routeController, resources, onBrowserProblem: (problem) => problems.push(problem),
      onOwnedProcess: ({ rootPid, processTree }) => {
        cleanup = createBrowserTestCleanup({ rootPid, processTree, runtimePath, workspaceRoot: root });
      } });
    // Keep navigation real while replacing the wallet connection boundary. No
    // external provider, prompt, signature or transaction participates in this test.
    await resources.context.route('**/src/wallet/standaloneWalletSession.js', (route) => route.fulfill({
      contentType: 'text/javascript', body: `export function acquireStandaloneWalletSession() {
        return { release() {}, session: { showSignIn() { window.__startup.signIns += 1; }, disconnect() {} } };
      }`,
    }));
    const page = resources.page;
    page.setDefaultTimeout(12_000);
    const open = async (query = '', motion = 'reduce') => {
      await page.emulateMedia({ reducedMotion: motion });
      await page.goto(`${origin}/browser-tests/startup-fixture.html${query}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForFunction(() => Boolean(window.__startup), undefined, { timeout: 30_000 });
    };
    const entered = async () => {
      await page.locator('.startveil').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.application-interface').getAttribute('data-visible'), 'true');
      assert.equal(await page.getByRole('button', { name: 'ENTER INSCAPE', exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => window.__startup.signIns), 0);
      assert.equal(await page.evaluate(() => document.querySelector('.application-interface')
        .contains(document.activeElement)), true, 'Entry gives keyboard focus to the destination');
    };
    const capture = async (name) => {
      if (!screenshotDir) return;
      await mkdir(resolve(screenshotDir), { recursive: true });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.allSettled(document.getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
          .map((animation) => animation.finished));
      });
      await page.screenshot({ path: resolve(screenshotDir, `${name}.png`) });
    };

    await t.test('a slow direct link waits, ignores entry keys, then reveals without a click', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(`?view=${other}&delay=1`, 'no-preference');
      await page.waitForFunction((address) => window.__startup.requests.includes(address), other);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('.startveil').getAttribute('data-state'), 'loading');
      assert.equal(await page.locator('.application-interface').getAttribute('inert'), '');
      await capture('direct-loading-wide');
      await page.evaluate((address) => window.__startup.resolve(address), other);
      await entered();
      await page.getByRole('group', { name: 'Published Grid navigation' }).waitFor();
      await capture('direct-world-wide');
    });

    await t.test('returning visits and reduced motion enter directly at smaller desktop widths', async () => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await open(`?view=${other}`);
      await entered();
      await page.getByRole('group', { name: 'Published Grid navigation' }).waitFor();
      await capture('direct-world-small-desktop');
    });

    await t.test('a failed direct link reveals recovery and retry without replaying entry', async () => {
      await open(`?view=${other}&delay=1`);
      await page.waitForFunction((address) => window.__startup.requests.includes(address), other);
      await page.evaluate((address) => window.__startup.resolve(address, 'ERROR'), other);
      await entered();
      await page.getByRole('button', { name: 'RETRY', exact: true }).click();
      await page.waitForFunction(() => window.__startup.requests.length === 2);
      await page.evaluate((address) => window.__startup.resolve(address), other);
      await page.getByRole('group', { name: 'Published Grid navigation' }).waitFor();
      assert.equal(await page.locator('.startveil').count(), 0);
    });

    await t.test('the landing portal features the chosen world independent of directory order and search', async () => {
      await open();
      const feature = page.locator('[data-variant="feature"]');
      await feature.getByRole('button', { name: 'Enter Featured artist', exact: true }).waitFor();
      await page.getByRole('button', { name: 'CONNECT PROFILE', exact: true }).waitFor();
      await capture('landing-small-desktop');
      await page.setViewportSize({ width: 1440, height: 900 });
      await capture('landing-wide');
      await page.getByRole('button', { name: 'DISCOVER', exact: true }).first().click();
      await page.getByRole('searchbox', { name: 'Search published worlds' }).fill('Other artist');
      await page.getByRole('button', { name: 'Return to INSCAPE landing' }).click();
      await feature.getByRole('button', { name: 'Enter Featured artist', exact: true }).click();
      await entered();
      assert.equal(new URL(page.url()).searchParams.get('view'), featured);
      await page.getByRole('group', { name: 'Published Grid navigation' }).waitFor();
    });

    await t.test('directory failure does not replace or prevent resolving the featured world', async () => {
      await open('?directoryError=1');
      await page.locator('[data-variant="feature"]').getByRole('button', { name: 'Enter Featured artist' }).waitFor();
      assert.equal(await page.locator('.startveil[data-portal]').count(), 1);
      assert.equal(await page.evaluate(() => window.__startup.signIns), 0);
    });

    await t.test('an unavailable featured publication stays disabled without substituting another world', async () => {
      await open('?delay=1');
      await page.waitForFunction((address) => window.__startup.requests.includes(address), featured);
      await page.evaluate((address) => window.__startup.resolve(address, 'UNAVAILABLE'), featured);
      const feature = page.locator('[data-variant="feature"]');
      assert.equal(await feature.getByRole('button', { name: 'Published world unavailable' }).isDisabled(), true);
      assert.match(await feature.innerText(), /Featured artist/);
      assert.equal(await page.locator('.startveil[data-portal]').count(), 1);
    });

    await t.test('a connected owner automatically reaches their Workbench', async () => {
      await open(`?owner=${other}`);
      await entered();
      await page.locator('.system-workflow__presentation-board').waitFor();
      assert.equal(await page.locator('.visitor-grid-world').count(), 0);
    });

    for (const mode of ['visitor', 'owner']) {
      await t.test(`${mode} keeps Startveil until delayed destination code mounts`, async () => {
        const pattern = mode === 'visitor' ? '**/src/profileDocument/components/VisitorGridWorld.jsx'
          : '**/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
        let release;
        let requested;
        const gate = new Promise((resolveGate) => { release = resolveGate; });
        const request = new Promise((resolveRequest) => { requested = resolveRequest; });
        await resources.context.route(pattern, async (route) => { requested(); await gate; await route.continue(); });
        try {
          await page.setViewportSize({ width: mode === 'visitor' ? 1440 : 1024, height: 900 });
          await open(`?${mode === 'visitor' ? 'view' : 'owner'}=${other}`, 'no-preference');
          await request;
          // Exceed the previous complete first-visit reveal, not just its intro.
          await page.waitForTimeout(4200);
          assert.equal(await page.locator('.startveil').getAttribute('data-state'), 'loading');
          assert.equal(await page.locator('.application-interface').getAttribute('inert'), '');
          await capture(`${mode}-waiting-for-code`);
          release();
          await entered();
          await page.locator(mode === 'visitor' ? '.visitor-grid-world' : '.system-workflow__presentation-board').waitFor();
          await capture(`${mode}-handoff-complete`);
        } finally { release(); await resources.context.unroute(pattern); }
      });
    }

    for (const mode of ['visitor', 'owner']) await t.test(`a failed ${mode} renderer reveals a reload action instead of trapping startup`, async () => {
      const pattern = mode === 'visitor' ? '**/src/profileDocument/components/VisitorGridWorld.jsx'
        : '**/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx';
      await resources.context.route(pattern, (route) => route.fulfill({ contentType: 'text/javascript',
        body: "throw new Error('Fixture renderer unavailable');" }));
      try {
        await open(`?${mode === 'visitor' ? 'view' : 'owner'}=${other}`);
        await entered();
        await page.getByRole('button', { name: 'RELOAD', exact: true }).waitFor();
        await page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'RELOAD', exact: true }) }).waitFor();
        await capture(`${mode}-renderer-error`);
      } finally { await resources.context.unroute(pattern); }
    });
    assert.deepEqual(problems.filter((problem) => problem.startsWith('Page error:')
      && !problem.includes('Fixture renderer unavailable')), []);
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    try { await cleanup(resources); } catch (error) {
      if (testError) throw new AggregateError([testError, error], 'Startup test and cleanup failed');
      throw error;
    }
  }
});
