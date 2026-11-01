import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:24970';
const output = '.browser-test-runtime/activity-finishing';
const drawer = page => page.getByRole('complementary', { name: 'Activity notifications' });
const history = page => page.getByRole('region', { name: 'Full activity history' });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const hit = node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); };
const material = node => ({ background: getComputedStyle(node).backgroundColor, radius: getComputedStyle(node).borderRadius });
const saved = page => page.evaluate(() => window.readToolChromeDraft());
const camera = page => page.locator('main.system-workflow').evaluate(node => [node.dataset.workbenchCameraScale, node.dataset.workbenchCameraX, node.dataset.workbenchCameraY]);
async function state(page, patch) {
  return page.evaluate(async patch => {
    const { useSignalStore } = await import('/src/signals/state/useSignalStore.js');
    if (patch) useSignalStore.setState(patch);
    const { history, status, persistenceError } = useSignalStore.getState();
    return { history, status, persistenceError };
  }, patch);
}
async function destination(page, name) {
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
  await sidebar.waitFor();
  const trigger = sidebar.getByRole('button', { name, exact: true, includeHidden: true });
  if (!await trigger.isVisible()) await sidebar.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await trigger.click(); return trigger;
}
async function mount(browser, width = 1440, height = 900, theme = 'mist', motion = 'reduce') {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: motion, hasTouch: width <= 520 });
  page.setDefaultTimeout(10000); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/')) return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
    return route.abort();
  });
  await page.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=activity&persistent&theme=${theme}`);
  await page.getByRole('complementary', { name: 'Workspace sidebar' }).waitFor();
  return { page, errors };
}
for (const theme of ['carbon', 'mist']) for (const [width, height] of [[1440,900], [390,900], [320,568], [844,390]]) {
  test(`Activity and history share the window material and stay reachable (${theme} ${width}x${height})`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const { page, errors } = await mount(browser, width, height, theme), before = await saved(page), view = await camera(page);
      await destination(page, 'Settings');
      const expected = await page.getByRole('dialog', { name: 'Settings' }).evaluate(material);
      await page.getByRole('button', { name: 'Close Settings' }).click();
      const trigger = await destination(page, 'Activity'); await drawer(page).waitFor();
      const check = async panel => {
        const box = await panel.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, JSON.stringify(box));
        assert.deepEqual(await panel.evaluate(material), expected);
        assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
        for (const control of await panel.locator('header button, .activity-filters button, .activity-actions button').all()) assert.equal(await control.evaluate(hit), true);
      };
      await check(drawer(page));
      assert.equal(await drawer(page).locator('li').count(), 5);
      const assets = drawer(page).getByRole('button', { name: 'Assets', exact: true });
      await assets.click(); assert.equal(await assets.getAttribute('aria-pressed'), 'true');
      assert.equal(await assets.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      await assets.press('Tab'); await page.keyboard.press('Shift+Tab');
      assert.notEqual(await assets.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      await drawer(page).getByRole('button', { name: 'All', exact: true }).click();
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/activity-${theme}-${width}-recent.png` });
      await drawer(page).getByRole('button', { name: 'Open full activity history' }).click();
      await history(page).waitFor(); await check(history(page));
      assert.equal(await history(page).locator('li').count(), 18);
      await page.screenshot({ path: `${output}/activity-${theme}-${width}-history.png` });
      const last = history(page).locator('li').last();
      await last.scrollIntoViewIfNeeded();
      await check(history(page));
      assert.equal(await last.evaluate(hit), true);
      await history(page).getByRole('button', { name: 'Close full activity history' }).click();
      await drawer(page).waitFor(); await settle(page);
      assert.equal(await drawer(page).getByRole('button', { name: 'Open full activity history' }).evaluate(node => node === document.activeElement), true);
      await drawer(page).getByRole('button', { name: 'Close activity' }).click();
      await drawer(page).waitFor({ state: 'detached' }); await settle(page);
      const returnTarget = await trigger.isVisible() ? trigger : page.getByRole('button', { name: 'Expand sidebar', exact: true });
      assert.equal(await returnTarget.evaluate(node => node === document.activeElement), true);
      assert.deepEqual(await saved(page), before); assert.deepEqual(await camera(page), view);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('Activity searches, marks real stored read state, retains rejected writes and restores after reload', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser), before = await saved(page);
    await destination(page, 'Activity');
    const mark = drawer(page).getByRole('button', { name: 'Mark Artwork received 1 as read', exact: true });
    await page.evaluate(() => { window.blockSignalSave = true; });
    await mark.click(); await drawer(page).getByRole('alert').waitFor();
    assert.equal((await state(page)).history[0].read, false);
    assert.equal(await mark.isEnabled(), true);
    await page.evaluate(() => { window.blockSignalSave = false; });
    await mark.click();
    assert.equal((await state(page)).history[0].read, true);
    assert.equal(await drawer(page).getByRole('alert').count(), 0);
    await page.reload(); await destination(page, 'Activity');
    assert.equal(await drawer(page).getByRole('button', { name: 'Artwork received 1, read', exact: true }).isDisabled(), true);
    await drawer(page).getByRole('button', { name: 'Open full activity history' }).click();
    await history(page).getByLabel('Search activity').fill('Study 7');
    assert.equal(await history(page).locator('li').count(), 1);
    await history(page).getByLabel('Search activity').fill('no matching event');
    await history(page).getByText('No events match this view.', { exact: true }).waitFor();
    await history(page).getByLabel('Search activity').fill('');
    await history(page).getByRole('button', { name: 'Unread', exact: true }).click();
    assert.equal(await history(page).locator('li').count(), 8);
    await history(page).getByRole('button', { name: 'Mark all activity read' }).click();
    assert.equal(await history(page).getByRole('button', { name: 'Mark all activity read' }).isDisabled(), true);
    assert.equal((await state(page)).history.every(entry => entry.read), true);
    await page.keyboard.press('Escape'); await drawer(page).waitFor();
    await page.keyboard.press('Escape'); await drawer(page).waitFor({ state: 'detached' });
    await page.keyboard.press('Control+z'); assert.deepEqual(await saved(page), before, 'Activity does not author content or add Undo history');
    await page.reload(); await destination(page, 'Activity');
    assert.equal((await state(page)).history.every(entry => entry.read), true);
    assert.deepEqual(await saved(page), before); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`Activity distinguishes empty, loading, partial and retryable failure in both views (${width}px)`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser, width), original = (await state(page)).history;
    await state(page, { history: [], status: 'ready' }); await destination(page, 'Activity');
    await drawer(page).getByText('No activity yet.', { exact: true }).waitFor();
    await state(page, { status: 'loading' });
    await drawer(page).getByRole('status').filter({ hasText: 'Syncing LUKSO activity' }).waitFor();
    assert.equal(await drawer(page).getByText('No activity yet.', { exact: true }).count(), 0);
    await state(page, { status: 'error', error: 'Activity source is unavailable.' });
    await drawer(page).getByRole('button', { name: 'Retry', exact: true }).click();
    assert.equal(await page.evaluate(() => window.activityRefreshRequests), 1);
    await state(page, { status: 'partial', error: null, history: original, partialError: 'Some source metadata is unavailable.' });
    await drawer(page).getByRole('status').filter({ hasText: 'Partial on-chain data' }).waitFor();
    await drawer(page).getByRole('button', { name: 'Open full activity history' }).click();
    await history(page).getByRole('status').filter({ hasText: 'Partial on-chain data' }).waitFor();
    await history(page).getByRole('button', { name: 'Refresh activity' }).click();
    assert.equal(await history(page).getByRole('button', { name: 'Syncing activity' }).isDisabled(), true);
    assert.equal(await history(page).locator('li').count(), original.length, 'refresh retains the existing history');
    await state(page, { status: 'error', error: 'Activity source is unavailable.' });
    await history(page).getByRole('button', { name: 'Retry', exact: true }).click();
    assert.equal(await page.evaluate(() => window.activityRefreshRequests), 3);
    await state(page, { status: 'ready' }); await page.keyboard.press('Escape'); await drawer(page).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Activity history supports animated close and does not take a newer focus choice', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser, 1440, 900, 'mist', 'no-preference');
    const trigger = await destination(page, 'Activity');
    await drawer(page).getByRole('button', { name: 'Open full activity history' }).click();
    await history(page).getByLabel('Search activity').waitFor();
    const close = history(page).getByRole('button', { name: 'Close full activity history' });
    await close.evaluate((node, trigger) => { node.click(); trigger.focus(); }, await trigger.elementHandle());
    await drawer(page).waitFor(); await settle(page);
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    const open = drawer(page).getByRole('button', { name: 'Open full activity history' });
    await open.focus(); await open.press('Enter');
    await history(page).waitFor(); await settle(page);
    assert.equal(await history(page).getByLabel('Search activity').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Escape'); await drawer(page).waitFor(); await settle(page);
    assert.equal(await open.evaluate(node => node === document.activeElement), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Activity read markers and selected filters remain visible in forced colours', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const { page, errors } = await mount(browser);
    await page.emulateMedia({ forcedColors: 'active' }); await destination(page, 'Activity'); await drawer(page).waitFor();
    const filters = drawer(page).getByRole('navigation', { name: 'Activity filters' });
    const backgrounds = await filters.locator('button').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    assert.notEqual(backgrounds[0], backgrounds[1]);
    assert.equal(await drawer(page).locator('li[data-unread] i').first().evaluate(node => getComputedStyle(node).borderLeftWidth), '2px');
    await page.screenshot({ path: `${output}/activity-forced-colours.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
