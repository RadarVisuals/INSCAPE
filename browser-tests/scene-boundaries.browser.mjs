import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mkdir } from 'node:fs/promises';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5197';
const output = '.browser-test-runtime/scene-boundaries';
for (const width of [1920, 390]) test(`scene lifetime, linked cells, isolation and finite gallery at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: width === 1920 ? 1080 : 844 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: 'reduce' });
    const errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /Cannot update|Maximum update|snapshot should|unique.*key/i.test(message.text())) errors.push(message.text()); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/assets/'))
        return route.fulfill({ response: await route.fetch({ url: origin + url.pathname.split('/public')[1] }) });
      return route.abort();
    });
    await page.goto(origin + '/browser-tests/scene-boundaries-fixture.html');
    const a = page.getByRole('region', { name: 'Workbench 1', exact: true }), b = page.getByRole('region', { name: 'Second canvas', exact: true });
    await a.locator('.reception-artwork [data-media-state=ready]').waitFor();
    assert.equal(await page.locator('vite-error-overlay').count(), 0, await page.locator('vite-error-overlay').allTextContents());
    const before = await page.evaluate(() => JSON.stringify(localStorage));
    const first = await a.locator('[data-scene]').textContent();
    await a.getByRole('button', { name: 'Next Grid', exact: true }).click();
    await a.locator('[data-linked-text]').getByText('Second passage', { exact: true }).waitFor();
    assert.equal(await a.locator('[data-side]').getAttribute('data-side'), 'side:1');
    assert.equal(await b.locator('[data-scene]').textContent(), first);
    assert.ok(await a.locator('[data-static]').getByText('Always here', { exact: true }).isVisible());
    await a.getByRole('button', { name: 'Hide Display', exact: true }).click();
    assert.ok(await a.locator('[data-linked-text]').getByText('Second passage', { exact: true }).isVisible());
    await a.getByRole('button', { name: 'Unmount Display', exact: true }).click();
    await a.getByRole('button', { name: 'Previous scene', exact: true }).click();
    assert.equal(await a.locator('[data-scene]').textContent(), first);
    await a.getByRole('button', { name: 'Next scene', exact: true }).click();
    await a.getByRole('button', { name: 'Mount Display', exact: true }).click();
    await a.getByRole('button', { name: 'Show Display', exact: true }).click();
    assert.equal(await a.locator('[data-active-grid-id]').getAttribute('data-active-grid-id'), 'grid:two');
    await a.getByRole('button', { name: 'Remove source', exact: true }).click();
    assert.ok(await a.getByRole('status').getByText('Source unavailable').isVisible());
    await a.getByRole('button', { name: 'Restore source', exact: true }).click();
    await a.locator('.reception-artwork [data-media-state=ready]').waitFor();
    await page.getByRole('button', { name: 'New presentation session', exact: true }).click();
    assert.equal(await a.locator('[data-scene]').textContent(), first);
    const card = page.getByRole('button', { name: 'Open Workbench 1', exact: true });
    await card.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    assert.ok(scroll > 0);
    assert.equal(await page.locator('.canvas-gallery-section').evaluate(node => getComputedStyle(node).overflowY), 'visible');
    assert.equal(await page.locator('.canvas-gallery-section .workbench-overview-card').count(), 2);
    assert.equal(await card.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    await page.locator('.canvas-gallery-section [data-navigator-object="image:study"] svg image').first().waitFor();
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${width}-gallery.png` });
    if (width === 390) {
      await card.tap({ position: { x: 20, y: 20 } });
      assert.equal(await page.getByRole('dialog').count(), 0, 'first touch reveals the card');
      await card.tap({ position: { x: 20, y: 20 } });
    } else { await card.focus(); await card.press('Enter'); }
    await page.getByRole('dialog', { name: 'View Workbench 1' }).waitFor();
    await page.screenshot({ path: `${output}/${width}-viewer.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open Workbench 1');
    assert.ok(await card.evaluate(node => document.activeElement === node));
    assert.ok(Math.abs(await page.evaluate(() => scrollY) - scroll) < 2);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), before);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => scrollTo(0, 0));
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${width}.png`, fullPage: false });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
