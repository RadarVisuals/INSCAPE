import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
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
