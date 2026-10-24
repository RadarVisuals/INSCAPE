import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { holdFrames } from './fixtures/deferred-focus.mjs';
import { pointerAction, r12Cases } from './fixtures/r12-pointer.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
async function mount(page) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route(`${origin}/__support_recovery__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__support_recovery__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    window.React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    window.testRoot = createRoot(document.getElementById('root'));
    await import('/src/index.css');
  });
}

for (const { theme, width, height } of r12Cases) {
  test(`R12 real Discover returns to its workspace and trigger (${theme} ${width}x${height})`, { timeout: 45000 }, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mount(page);
      await page.evaluate(async theme => {
        const useNavigation = (await import('/src/profileDiscovery/useApplicationNavigation.js')).default;
        const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
        const Portal = (await import('/src/startveil/PublicEntryPortal.jsx')).default;
        const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const profileAddress = `0x${'1'.repeat(40)}`, values = new Map();
        const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
        const store = createSystemWorkflowDraftStore({ profileAddress, storage });
        const draft = store.getDraft(); draft.appearance.menuSurfaceId = theme;
        if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Fixture save failed');
        window.readR12Draft = () => createSystemWorkflowDraftStore({ profileAddress, storage }).getDraft();
        const authority = { status: 'complete', ownershipVerified: true, profileAddress };
        const profiles = [{ address: `0x${'2'.repeat(40)}`, name: 'R12 public world' }];
        const repository = { list: async () => profiles }, snapshot = { status: 'RESOLVED', document: null, busy: false };
        const resolutionStore = { get: () => snapshot, subscribe: () => () => {}, resolve: async () => snapshot };
        await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
        function DiscoveryFixture() {
          const navigation = useNavigation(authority), discover = navigation.route.kind === 'discover';
          window.readR12Route = () => navigation.route;
          return React.createElement(React.Fragment, null,
            React.createElement('div', { hidden: discover, inert: discover ? '' : undefined }, React.createElement(Runtime, {
              profileAddress, reviewStorage: storage, reviewAssets: [], reviewCategories: [], reviewActivity: [],
              reviewProfile: { name: 'R12 owner' }, onOpenDiscover: navigation.openDiscover })),
            discover && React.createElement(Portal, { embedded: true, mode: 'explore', menuSurface: theme,
              discoveryRepository: repository, resolutionStore, onClose: navigation.closeDiscover, onHome: navigation.closeDiscover }));
        }
        testRoot.render(React.createElement(DiscoveryFixture));
      }, theme);
      const trigger = page.getByRole('button', { name: 'Discover', exact: true });
      const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar', exact: true });
      await sidebar.waitFor();
      if (!await trigger.isVisible()) await pointerAction(page, page.getByRole('button', { name: 'Expand sidebar', exact: true }));
      await trigger.waitFor();
      const returnFocus = await page.locator('main.system-workflow').getAttribute('data-sidebar-menu') === 'true'
        ? sidebar.locator('.workspace-navigation-collapse') : trigger;
      const before = await page.evaluate(() => ({ draft: readR12Draft(), route: readR12Route(), url: location.href }));
      await pointerAction(page, trigger);
      const portal = page.locator('.public-entry-portal');
      await portal.waitFor();
      await portal.getByText('R12 public world', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => readR12Route().kind), 'discover');
      assert.deepEqual(await page.evaluate(() => readR12Route().returnTo), before.route);
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/r12-discover-${theme}-${width}x${height}.png` });
      await pointerAction(page, page.getByRole('button', { name: 'Return to workspace', exact: true }));
      await portal.waitFor({ state: 'detached' });
      await page.waitForFunction(node => node === document.activeElement, await returnFocus.elementHandle());
      assert.deepEqual(await page.evaluate(() => readR12Route()), before.route);
      assert.equal(page.url(), before.url);
      assert.deepEqual(await page.evaluate(() => readR12Draft()), before.draft);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('Discover navigation restores focus without overriding a later control or reopened destination', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' }); await mount(page);
    await page.evaluate(async () => {
      const useNavigation = (await import('/src/profileDiscovery/useApplicationNavigation.js')).default;
      const authority = { status: 'complete', profileAddress: null };
      function NavigationProbe() {
        const navigation = useNavigation(authority);
        return React.createElement('main', null,
          React.createElement('button', { onClick: event => navigation.openDiscover(event.currentTarget) }, 'Open Discover'),
          React.createElement('input', { 'aria-label': 'Another control' }),
          navigation.route.kind === 'discover' && React.createElement('section', { role: 'dialog', 'aria-label': 'Discover navigation probe' },
            React.createElement('button', { onClick: navigation.closeDiscover }, 'Back'),
            React.createElement('input', { 'aria-label': 'New Discover search' })));
      }
      testRoot.render(React.createElement(NavigationProbe));
    });
    const open = page.getByRole('button', { name: 'Open Discover', exact: true });
    const close = page.getByRole('button', { name: 'Back', exact: true });
    const panel = page.getByRole('dialog', { name: 'Discover navigation probe', exact: true });
    await open.click(); await close.click(); await panel.waitFor({ state: 'detached' });
    await page.waitForFunction(node => node === document.activeElement, await open.elementHandle());
    await open.click(); await holdFrames(page); await close.click(); await panel.waitFor({ state: 'detached' });
    const other = page.getByRole('textbox', { name: 'Another control', exact: true }); await other.focus();
    await page.evaluate(() => window.releaseHeldFrames());
    assert.equal(await other.evaluate(n => n === document.activeElement), true, 'a late Discover close cannot replace newer focus');
    await open.click(); await holdFrames(page); await close.click(); await panel.waitFor({ state: 'detached' });
    await open.click(); await panel.waitFor();
    const search = page.getByRole('textbox', { name: 'New Discover search', exact: true }); await search.focus();
    await page.evaluate(() => window.releaseHeldFrames());
    assert.equal(await search.evaluate(n => n === document.activeElement), true, 'reopening cancels the previous destination return');
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) {
  test(`Discover exposes all results with bounded batches, search reset and keyboard focus (${width}px)`, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await mount(page);
      await page.evaluate(async () => (await import('/browser-tests/support-recovery-fixture.jsx')).renderDiscovery(testRoot));
      const cards = page.locator('.public-entry-portal__world-card');
      await page.getByRole('status').filter({ hasText: '12 of 25 worlds' }).waitFor();
      assert.equal(await cards.count(), 12);
      const more = page.getByRole('button', { name: 'Show more worlds' });
      const buttonBounds = await more.boundingBox();
      assert.ok(buttonBounds.y >= 52 && buttonBounds.y + buttonBounds.height <= 872, JSON.stringify(buttonBounds));
      await more.click();
      await page.getByRole('status').filter({ hasText: '24 of 25 worlds' }).waitFor();
      assert.equal(await cards.count(), 24);
      assert.equal(await more.evaluate(node => node === document.activeElement), true);
      await page.keyboard.press('Enter');
      await page.getByRole('status').filter({ hasText: '25 of 25 worlds' }).waitFor();
      assert.equal(await cards.count(), 25);
      assert.equal(await more.isDisabled(), true);
      await page.getByLabel('Search published worlds').fill('World 25');
      await page.waitForFunction(() => document.querySelectorAll('.public-entry-portal__world-card').length === 1);
      assert.equal(await page.locator('.public-entry-portal__publisher strong').innerText(), 'World 25');
      await page.getByLabel('Search published worlds').fill('');
      await page.getByRole('status').filter({ hasText: '12 of 25 worlds' }).waitFor();
      assert.equal(await cards.count(), 12);
      await more.scrollIntoViewIfNeeded();
      const headerBounds = await page.locator('.public-entry-portal__header').boundingBox();
      assert.equal(headerBounds.y, 0, 'Pagination must not scroll the outer portal or hide its header');
      const overflow = await page.locator('.public-entry-portal__explore').evaluate(node => node.scrollWidth - node.clientWidth);
      assert.ok(overflow <= 1, `horizontal overflow: ${overflow}`);
      await mkdir('.browser-test-runtime', { recursive: true });
      await page.screenshot({ path: `.browser-test-runtime/repairs-discover-${width}.png` });
    } finally { await browser.close(); }
  });

  test(`Signals rejected writes remain visible and retry persists; partial Activity appears in both views (${width}px)`, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const mountSettings = async () => {
        await mount(page);
        await page.evaluate(async () => (await import('/browser-tests/support-recovery-fixture.jsx')).renderSettings(testRoot));
        await page.getByRole('dialog', { name: 'Settings' }).waitFor();
      };
      await mountSettings();
      const audio = page.getByLabel('Audio notifications', { exact: true });
      assert.equal(await audio.isChecked(), false);
      await page.evaluate(() => { window.blockSignalSave = true; });
      await audio.click();
      await page.getByRole('alert').filter({ hasText: 'Change not saved' }).waitFor();
      assert.equal(await audio.isChecked(), false);
      await page.screenshot({ path: `.browser-test-runtime/repairs-signals-error-${width}.png` });
      await page.evaluate(() => { window.blockSignalSave = false; });
      await audio.click();
      assert.equal(await audio.isChecked(), true);
      assert.equal(await page.getByRole('alert').count(), 0);
      await page.reload(); await mountSettings();
      assert.equal(await audio.isChecked(), true);
      await page.evaluate(async () => (await import('/browser-tests/support-recovery-fixture.jsx')).renderActivity(testRoot));
      await page.getByRole('status').filter({ hasText: 'Partial on-chain data' }).waitFor();
      await page.screenshot({ path: `.browser-test-runtime/repairs-activity-partial-${width}.png` });
      await page.getByRole('button', { name: 'Open full activity history' }).click();
      await page.getByRole('region', { name: 'Full activity history' }).waitFor();
      assert.equal(await page.getByRole('status').filter({ hasText: 'Partial on-chain data' }).count(), 1);
      await page.keyboard.press('Escape');
      await page.getByRole('complementary', { name: 'Activity notifications' }).waitFor();
      assert.equal(await page.getByRole('status').filter({ hasText: 'Partial on-chain data' }).count(), 1);
    } finally { await browser.close(); }
  });
}
