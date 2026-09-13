import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5192';
const appOrigin = 'https://new-mini-app.test', secondOrigin = 'https://another-mini-app.test';
const radarOrigin = 'https://radar725.netlify.app';
const profile = `0x${'1'.repeat(40)}`, account = `0x${'2'.repeat(40)}`;
console.log('Bundling standard UP Provider fixture');
const bundle = await build({ entryPoints: ['browser-tests/mini-app-fixture.js'], bundle: true, write: false, format: 'iife' });
console.log('Fixture bundled');
await mkdir('output/mini-apps', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
console.log('Browser launched');
let testPage;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  console.log('Browser context created');
  for (const origin of [appOrigin, secondOrigin]) await context.grantPermissions(['microphone'], { origin });
  console.log('Fake microphone permission configured');
  const page = await context.newPage();
  testPage = page;
  console.log('Test page created');
  page.setDefaultTimeout(15000);
  const watchdog = setTimeout(async () => {
    console.error('Browser test stalled:', await page.locator('body').innerText());
    console.error('Frames:', page.frames().map(frame => frame.url()));
    await page.screenshot({ path: 'output/mini-apps/stalled.png' });
    await browser.close();
  }, 60000);
  watchdog.unref();
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
  for (const app of [appOrigin, secondOrigin]) {
    await page.route(`${app}/fixture*`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0"><script src="/fixture-client.js"></script></body></html>' }));
    await page.route(`${app}/fixture-client.js`, route => route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }));
  }
  await page.route(`${origin}/__mini_apps__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__mini_apps__`);
  await page.evaluate(async ({ profile, account }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { useWalletStore } = await import('/src/store/useWalletStore.js');
    await import('/src/index.css');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    await import('/src/lattice/rendering/latticeMenuSurface.css');
    const storage = fixture.createOwnerSystemWorkflowReviewStorage();
    window.review = { storage, root: createRoot(document.getElementById('root')), calls: [], wallet: useWalletStore,
      draft: () => JSON.parse(storage.getItem(systemWorkflowDraftKey(profile))) };
    const provider = { async request(request) {
      review.calls.push(request);
      if (review.holdWallet) return new Promise(resolve => { review.resolveWallet = resolve; });
      return `0x${'a'.repeat(130)}`;
    } };
    useWalletStore.setState({ provider, accounts: [account], chainId: '0x2a', isWalletConnected: true,
      authorityLifecycleStatus: 'complete', publicClient: { request: async () => '0x01' } });
    review.renderOwner = () => review.root.render(React.createElement(Runtime, { profileAddress: profile, reviewStorage: storage,
      reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Mini app review' } }));
    review.renderOwner();
  }, { profile, account });
  await page.locator('.system-workflow__presentation-board').waitFor();
  console.log('Owner Workbench mounted');
  const addApp = async (name, url) => {
    await page.mouse.click(15, 15, { button: 'right' });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'MINI APP', exact: true }).click();
    const settings = page.locator('.mini-app-settings');
    await settings.getByLabel('Name', { exact: true }).fill(name);
    await settings.getByLabel('App URL', { exact: true }).fill(url);
    await settings.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Connect app', exact: true }).last().waitFor({ state: 'visible' });
  };
  const clientFrame = async (suffix = 'one') => {
    const name = suffix === 'two' ? 'Second app' : 'RADAR test';
    await page.frameLocator(`iframe[title="${name} mini app host"]`).frameLocator('iframe').locator('#context').waitFor();
    const frame = page.frames().find(frame => frame.url() === `${suffix === 'two' ? secondOrigin : appOrigin}/fixture?${suffix}`);
    assert.ok(frame, `missing client frame ${suffix}`); await frame.waitForFunction(() => window.miniAppFixture?.provider);
    await frame.waitForFunction(() => miniAppFixture.provider.contextAccounts.length > 0);
    await frame.evaluate(() => miniAppFixture.render());
    return frame;
  };
  const accounts = frame => frame.evaluate(() => miniAppFixture.provider.request({ method: 'eth_accounts' }));
  await addApp('RADAR test', `${appOrigin}/fixture?one`);
  console.log('First app added');
  let first = await clientFrame();
  await first.waitForFunction(() => miniAppFixture.provider.contextAccounts[0]?.includes('111111'));
  assert.deepEqual(await accounts(first), []);
  await page.getByRole('button', { name: 'Connect app', exact: true }).click();
  await first.waitForFunction(() => document.querySelector('#account').textContent.includes('222222'));
  assert.deepEqual(await accounts(first), [account]);
  console.log('First app connected');
  await addApp('Second app', `${secondOrigin}/fixture?two`);
  let second = await clientFrame('two'); assert.deepEqual(await accounts(second), []);
  const denied = await second.evaluate(async account => {
    try { await miniAppFixture.provider.request({ method: 'personal_sign', params: ['0x1234', account] }); return 'allowed'; }
    catch (error) { return error.code; }
  }, account);
  assert.equal(denied, 4100); assert.equal(await page.evaluate(() => review.calls.length), 0);
  const signature = await first.evaluate(account => miniAppFixture.provider.request({ method: 'personal_sign', params: ['0x1234', account] }), account);
  assert.equal(signature, `0x${'a'.repeat(130)}`); assert.equal(await page.evaluate(() => review.calls.length), 1);
  console.log('Independent app grants verified');
  await page.evaluate(() => review.wallet.setState({ accounts: ['0x3333333333333333333333333333333333333333'] }));
  await first.waitForFunction(() => document.querySelector('#account').textContent.endsWith('none'));
  assert.deepEqual(await accounts(first), []); assert.deepEqual(await accounts(second), []);
  await page.evaluate(account => review.wallet.setState({ accounts: [account] }), account);
  await page.getByRole('button', { name: 'Close Second app', exact: true }).click();
  assert.equal(page.frames().some(frame => frame.url().endsWith('fixture?two')), false);
  await page.getByRole('button', { name: 'Connect app', exact: true }).click();
  await first.waitForFunction(() => document.querySelector('#account').textContent.includes('222222'));
  await page.getByRole('button', { name: 'Close RADAR test', exact: true }).click();
  assert.equal(await page.locator('.mini-app-frame').count(), 0);
  await page.getByRole('button', { name: 'RADAR test', exact: true }).click();
  first = await clientFrame(); assert.deepEqual(await accounts(first), []);
  console.log('Close/reopen verified');
  await page.getByRole('button', { name: 'Connect app', exact: true }).click();
  await first.waitForFunction(() => miniAppFixture.provider.accounts.length === 1);
  await first.goto(first.url());
  first = await clientFrame();
  await first.waitForFunction(() => miniAppFixture.provider.accounts.length === 0);
  assert.deepEqual(await accounts(first), []);

  // A nested, unregistered frame cannot acquire the connector's message port.
  assert.equal(await first.evaluate(() => new Promise(resolve => {
    const rogue = document.createElement('iframe');
    rogue.srcdoc = '<script>parent.parent.postMessage("upProvider:requestIframeProvider", "*"); window.addEventListener("message", e => { if(e.data?.type === "upProvider:windowInitialize") parent.postMessage("rogue-connected", "*") });<\/script>';
    const listener = event => { if (event.data === 'rogue-connected') { window.removeEventListener('message', listener); rogue.remove(); resolve(true); } };
    window.addEventListener('message', listener); document.body.append(rogue);
    setTimeout(() => { window.removeEventListener('message', listener); rogue.remove(); resolve(false); }, 350);
  })), false);

  await first.getByRole('button', { name: 'Start microphone' }).click();
  await first.getByText('Microphone unavailable', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Enable mini app microphone' }).click();
  first = await clientFrame();
  await first.getByRole('button', { name: 'Start microphone' }).click();
  await first.getByText('Microphone active', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Second app', exact: true }).click();
  second = await clientFrame('two');
  await second.getByRole('button', { name: 'Start microphone' }).click();
  await second.getByText('Microphone unavailable', { exact: true }).waitFor();
  assert.equal(await first.evaluate(() => miniAppFixture.stream.getAudioTracks()[0].readyState), 'live');
  await page.getByRole('button', { name: 'Close Second app', exact: true }).click();
  await page.getByRole('button', { name: 'Disable mini app microphone' }).click();
  first = await clientFrame();
  await first.getByRole('button', { name: 'Start microphone' }).click();
  await first.getByText('Microphone unavailable', { exact: true }).waitFor();
  const beforeGeometry = await page.evaluate(() => JSON.stringify(review.draft()));
  console.log('Microphone delegation verified');
  await page.getByLabel('Resize Mini app window', { exact: true }).focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => JSON.stringify(review.draft())), beforeGeometry);
  await page.screenshot({ path: 'output/mini-apps/owner-wide.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/mini-apps/owner-narrow.png' });
  const bounds = await page.locator('.mini-app-workbench .system-workflow__instrument-window').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, JSON.stringify(bounds));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Settings for RADAR test' }).click();
  await page.getByLabel('Include in publication', { exact: true }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Settings for RADAR test' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Obsolete settings');
  await page.getByLabel('Move Mini app window', { exact: true }).focus();
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => review.draft().miniApps[0].visibility === 'PRIVATE');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Changes could not be saved' }).waitFor();
  assert.equal(await page.evaluate(() => review.draft().miniApps[0].name), 'RADAR test');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Settings for RADAR test' }).click();
  await page.getByLabel('Include in publication', { exact: true }).check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const capturedBounds = await page.locator('.mini-app-workbench .system-workflow__instrument-window').boundingBox();
  let uploads = 0;
  await page.route('**/api/profile-publications', route => { uploads += 1; return route.abort(); });
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const publication = page.getByRole('complementary', { name: 'Publish profile' });
  await publication.getByRole('button', { name: 'PREPARE PUBLICATION', exact: true }).click();
  await publication.getByRole('status').filter({ hasText: 'ready to be made public' }).waitFor();
  const captured = await page.evaluate(() => review.draft().workbench.miniApps);
  assert.equal(captured.length, 2);
  assert.equal(captured[0].open, true);
  assert.equal(captured[1].open, false);
  assert.ok(Math.abs(captured[0].window.width - capturedBounds.width) < 1);
  assert.ok(Math.abs(captured[0].window.left - capturedBounds.x) < 1);
  assert.equal(uploads, 0);
  await page.screenshot({ path: 'output/mini-apps/capture-prepared-wide.png' });
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await publication.waitFor({ state: 'detached' });
  console.log('Prepare Publication captured live window geometry and closed app state without an upload');
  await page.evaluate(async () => {
    const React = (await import('/@id/react')).default;
    const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
    review.before = JSON.stringify(review.draft());
    review.document = buildProfileDocumentV9({ profileAddress: review.draft().profileAddress, systemWorkflowDraft: review.draft(), assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS });
    review.root.render(React.createElement(Visitor, { document: review.document }));
  });
  await page.locator('.visitor-grid-world .mini-app-frame').waitFor();
  first = await clientFrame(); assert.deepEqual(await accounts(first), []);
  assert.equal(await page.getByRole('button', { name: 'Settings for RADAR test' }).count(), 0);
  assert.equal(await page.evaluate(() => review.document.miniApps.length), 1);
  await page.screenshot({ path: 'output/mini-apps/visitor-wide.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/mini-apps/visitor-narrow.png' });
  await page.getByRole('button', { name: 'Close RADAR test', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.stringify(review.draft()) === review.before), true);
  assert.deepEqual(errors, []);
  if (process.env.INSCAPE_TEST_LIVE_RADAR === '1') {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => review.renderOwner());
    await page.getByRole('button', { name: 'Close Second app', exact: true }).click();
    await page.getByRole('button', { name: 'Settings for RADAR test' }).click();
    await page.getByLabel('Name', { exact: true }).fill('RADAR');
    await page.getByLabel('App URL', { exact: true }).fill(`${radarOrigin}/`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const radar = page.frameLocator('iframe[title="RADAR mini app host"]').frameLocator('iframe');
    await radar.getByText('PLAYER', { exact: true }).click({ timeout: 45000 });
    await radar.locator('.menu-dot').waitFor({ timeout: 45000 });
    await page.getByRole('button', { name: 'Connect app', exact: true }).click();
    await page.getByRole('button', { name: 'Disconnect app', exact: true }).waitFor();
    await radar.getByText('Fetching Setlist...', { exact: true }).waitFor({ state: 'hidden', timeout: 45000 });
    await page.screenshot({ path: 'output/mini-apps/radar-workbench-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await radar.locator('.menu-dot').evaluate(button => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const liveFrame = page.frames().find(frame => frame.url() === `${radarOrigin}/`);
    await liveFrame.waitForFunction(() => document.querySelector('.menu-dot').getBoundingClientRect().right <= innerWidth);
    await page.screenshot({ path: 'output/mini-apps/radar-workbench-narrow.png' });
    console.log('PASS live RADAR in the actual Workbench with a simulated connected account');
  }
  if (process.env.INSCAPE_TEST_LIVE_P1 === '1') {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => review.renderOwner());
    await page.getByRole('button', { name: 'Close Second app', exact: true }).click();
    await page.getByRole('button', { name: 'Settings for RADAR test' }).click();
    await page.getByLabel('Name', { exact: true }).fill('P1');
    await page.getByLabel('App URL', { exact: true }).fill('https://p1.upturn.live/');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => review.draft().miniApps[0].url === 'https://p1.upturn.live/');
    const p1Host = page.locator('iframe[title="P1 mini app host"]');
    assert.ok((await p1Host.getAttribute('allow')).includes("microphone 'none'"));
    const p1 = page.frameLocator('iframe[title="P1 mini app host"]').frameLocator('iframe');
    await p1.locator('.chassis-topbar').waitFor({ timeout: 30000 });
    await p1.getByRole('button', { name: 'Connect', exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: 'Connect through the app’s own controls.' }).waitFor({ timeout: 20000 });
    assert.equal(await page.getByRole('button', { name: 'Connect app', exact: true }).isDisabled(), true);
    await page.screenshot({ path: 'output/mini-apps/p1-workbench-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await p1.locator('body').evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: 'output/mini-apps/p1-workbench-narrow.png' });
    const bounds = await page.locator('.mini-app-workbench .system-workflow__instrument-window').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, JSON.stringify(bounds));
    console.log('PASS live P1: settings saved, player rendered with its own Connect control; host connection unavailable and microphone denied');
  }
  clearTimeout(watchdog);
  console.log('PASS mini apps: standard client, independent grants, denied requests, account change, close/reopen, microphone delegation, window bounds, publication and visitor isolation');
} catch (error) {
  if (testPage && !testPage.isClosed()) {
    console.error('Page:', await testPage.locator('body').innerText());
    console.error('Frames:', testPage.frames().map(frame => frame.url()));
    for (const frame of testPage.frames().filter(frame => frame.url().includes('/fixture?'))) {
      console.error('Client:', await frame.evaluate(() => ({ body: document.body.innerText,
        context: window.miniAppFixture?.provider.contextAccounts, accounts: window.miniAppFixture?.provider.accounts })));
    }
    await testPage.screenshot({ path: 'output/mini-apps/failure.png' });
  }
  throw error;
} finally { await browser.close(); }
