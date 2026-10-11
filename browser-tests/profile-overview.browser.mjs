import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5239';
const address = `0x${'1'.repeat(40)}`;
const url = `${origin}/browser-tests/profile-overview-fixture.html?view=${address}`;
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const arrived = async page => {
  await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
  await settle(page);
};
test('desktop overview opens public destinations, restores routes and leaves publication intact', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = [], requests = [];
    const openOnCanvas = async name => {
      await page.getByRole('link', { name: 'Open ' + name, exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await page.getByRole('link', { name: 'Open current work on canvas' }).click();
    };
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://overview.invalid/landscape.jpg', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
    await page.addInitScript(() => {
      window.__overviewWrites = [];
      for (const method of ['setItem', 'removeItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function(key, ...args) { window.__overviewWrites.push(String(key)); return original.call(this, key, ...args); };
      }
    });
    await page.goto(url);
    await page.getByRole('main', { name: 'Mara Vale overview' }).waitFor();
    await page.locator('.profile-overview__work--featured [data-media-state="ready"]').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const publication = await page.evaluate(() => JSON.stringify(window.__overviewPublication));
    assert.equal(requests.some(url => /ProfileDocumentV9Visitor|ImageWorkbench|TextWorkbench|OwnerSystemWorkflowShell/.test(url)), false, 'entrance must not load canvas module runtimes');
    assert.equal(await page.locator('[data-workbench]').count(), 0);
    await mkdir('.browser-test-runtime', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/profile-overview-wide.png', fullPage: true });
    for (const width of [2209, 800, 520]) {
      await page.setViewportSize({ width, height: 1000 }); await settle(page);
      const dimensions = await page.locator('.profile-overview').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
      assert.ok(dimensions.scroll <= dimensions.width + 1, `no horizontal overflow at ${width}`);
      await page.screenshot({ path: `.browser-test-runtime/profile-overview-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Reception owns reading; opening work must not mount a Workbench.
    const entranceScroll = await page.locator('.profile-overview').evaluate(node => node.scrollTop);
    await page.getByRole('link', { name: 'Open Landforms', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('[data-workbench]').count(), 0);
    assert.equal(new URL(page.url()).searchParams.get('canvas'), null);
    await page.getByRole('button', { name: 'Work index', exact: true }).click();
    await page.getByRole('navigation', { name: 'Published destinations' }).getByRole('button', { name: /After the rain/ }).click();
    await page.waitForFunction(() => document.querySelector('.profile-work-viewer__current')?.textContent === 'After the rain');
    await page.getByRole('button', { name: 'Work information', exact: true }).click();
    await page.getByRole('region', { name: 'Information', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.profile-overview').evaluate(node => node.scrollTop), entranceScroll);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Open Landforms');
    await page.goForward(); await page.getByRole('dialog').waitFor();
    await page.reload(); await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Close work viewer' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await openOnCanvas('After the rain');
    await page.locator('[data-active-grid-id="grid:second"]').waitFor();
    await page.waitForFunction(() => Number(document.querySelector('[data-workbench]')?.dataset.workbenchCameraScale) !== 1);
    await arrived(page);
    assert.match(page.url(), /canvas=1/); assert.match(page.url(), /grid=grid%3Asecond/);
    await page.reload(); await page.locator('[data-active-grid-id="grid:second"]').waitFor(); await arrived(page);
    await page.goBack(); await page.locator('.profile-overview').waitFor();
    await page.goForward(); await page.locator('[data-active-grid-id="grid:second"]').waitFor();
    await page.getByRole('link', { name: 'Profile overview' }).click();
    await openOnCanvas('A closer look');
    await page.locator('[data-workbench-view-id="image:study"] .image-module__artwork').waitFor();
    await page.waitForFunction(() => Math.abs(Number(document.querySelector('[data-workbench]')?.dataset.workbenchCameraX)) > 100);
    await arrived(page);
    const imageBox = await page.locator('[data-workbench-view-id="image:study"]').boundingBox();
    assert.ok(imageBox.x >= 0 && imageBox.x + imageBox.width <= 1441, 'offscreen closed image opens in view');
    await page.getByRole('link', { name: 'Profile overview' }).click();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Open A closer look', 'return restores focus to the originating tile');
    await page.getByRole('link', { name: 'Open Notes from the field' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').waitFor();
    await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Notes from the field' }) }).waitFor();
    await page.getByRole('link', { name: 'Open current work on canvas' }).click();
    await page.locator('[data-workbench-view-id="text:notes"]').waitFor(); await arrived(page);
    await page.getByRole('link', { name: 'Profile overview' }).click();
    await page.getByRole('link', { name: /Explore canvas/ }).click();
    await page.locator('[data-workbench]').first().waitFor();
    assert.equal(await page.locator('.visitor-grid-world__viewport').isVisible(), false, 'generic canvas entry retains authored closed Display');
    assert.equal(await page.evaluate(() => JSON.stringify(window.__overviewPublication)), publication);
    assert.deepEqual(await page.evaluate(() => window.__overviewWrites.filter(key => /draft|library|workbench:layout/.test(key))), []);
    await page.goto(`${url}&canvas=1&module=text:missing`);
    await page.getByRole('status').filter({ hasText: 'no longer in this publication' }).waitFor();
    await page.getByRole('button', { name: 'Discover' }).click();
    await page.getByRole('button', { name: 'Another world' }).click();
    await page.getByRole('main', { name: 'Another world overview' }).waitFor();
    assert.equal(await page.locator('.profile-overview__work').count(), 0);
    assert.equal(await page.getByRole('link', { name: /Explore canvas/ }).count(), 1);
    await page.screenshot({ path: '.browser-test-runtime/profile-overview-empty.png' });
    // Exercise the same entrance through the real App and its readiness boundary.
    await page.goto(origin);
    await page.evaluate(async published => {
      const { useWalletStore } = await import('/src/store/useWalletStore.js');
      if (useWalletStore.getState().authorityLifecycleStatus !== 'complete') await new Promise(resolve => {
        const unsubscribe = useWalletStore.subscribe(state => {
          if (state.authorityLifecycleStatus === 'complete') { unsubscribe(); resolve(); }
        });
      });
      useWalletStore.getState().disposeWallet();
      useWalletStore.setState({ authorityLifecycleStatus: 'complete', hostProfileAddress: null, isHostProfileOwner: false, isWalletConnected: false });
      const { publishedProfileResolutionStore } = await import('/src/profileDocument/state/publishedProfileResolutionStore.js');
      publishedProfileResolutionStore.clear();
      publishedProfileResolutionStore.repository = { resolve: async address => ({ status: 'RESOLVED', address, document: published }) };
      history.pushState({}, '', `/?view=${published.profile.address}`); dispatchEvent(new PopStateEvent('popstate'));
    }, JSON.parse(publication));
    await page.getByRole('main', { name: 'Mara Vale overview' }).waitFor();
    await page.locator('.startveil').waitFor({ state: 'detached', timeout: 20000 });
    await openOnCanvas('A closer look');
    await page.locator('[data-workbench-view-id="image:study"] .image-module__artwork').waitFor();
    assert.match(page.url(), /canvas=1/);
    await page.getByRole('link', { name: 'Profile overview' }).click();
    await page.getByRole('main', { name: 'Mara Vale overview' }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
