import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mkdir } from 'node:fs/promises';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5197';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-linked';
async function setup(width, query) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width, height: width === 1920 ? 1080 : 844 }, hasTouch: width === 390, isMobile: width === 390 });
  const errors = [];
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/assets/'))
      return route.fulfill({ path: 'public/' + url.pathname.split('/public/')[1] });
    return route.abort();
  });
  await page.goto(`${origin}/browser-tests/reception-linked-fixture.html?session=${crypto.randomUUID()}&${query}`);
  return { browser, page, errors };
}
for (const width of [1920, 390]) for (const mode of ['local', 'public']) test(`Reception ${mode}: linked text and image, separate overview and camera at ${width}`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup(width, mode);
  try {
    const before = await page.evaluate(() => ({ storage: JSON.stringify(localStorage), writes: linkedFixture.writes() }));
    await page.locator('[data-linked-kind="text"]').getByText('A quiet world, held in the dark.', { exact: true }).waitFor();
    await page.locator('[data-linked-kind="image"] [data-media-state="ready"]').waitFor();
    assert.equal(await page.locator('[data-linked-kind="image"] .reception-artwork').getAttribute('aria-label'), 'Study 2');
    assert.ok(await page.getByRole('heading', { name: 'Small worlds.', exact: true }).isVisible());
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${mode}-${width}-reception.png` });
    const open = page.getByRole('button', { name: 'Open canvas', exact: true });
    assert.equal(await open.evaluate(node => {
      const button = node.getBoundingClientRect(), cell = node.closest('.reception-region').getBoundingClientRect();
      return button.left >= cell.left && button.right <= cell.right && button.bottom <= cell.bottom;
    }), true, 'the destination control stays inside its linked cell');
    await open.scrollIntoViewIfNeeded(); await open.click();
    const dialog = page.getByRole('dialog', { name: 'View Night / Dawn' }); await dialog.waitFor(); await dialog.press('Tab');
    assert.equal(await dialog.getByRole('button', { name: 'View Artwork detail' }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.textContent === 'Open canvas');
    await page.getByRole('navigation', { name: 'Profile navigation' }).getByRole('button', { name: 'Gallery' }).click();
    await page.locator('.workbench-overview').waitFor();
    if (await page.locator('.composition-index').count()) {
      await page.getByRole('button', { name: 'Grid', exact: true }).click();
    }
    const main = page.locator('.workbench-overview-gallery');
    await main.waitFor();
    assert.equal(await page.locator('.reception-page, .reception-canvases, .canvas-gallery-section').count(), 0, 'Canvases leaves Reception for its overview');
    if (mode === 'public') assert.equal(await page.getByRole('button', { name: /^(Edit|Crop|New Workbench)/ }).count(), 0, 'Public overview stays read-only');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    const card = page.getByRole('button', { name: 'Open Second canvas', exact: true });
    await card.scrollIntoViewIfNeeded();
    const scroll = await main.evaluate(node => node.scrollTop);
    await page.screenshot({ path: `${output}/${mode}-${width}-gallery.png` });
    if (width === 390) { await card.tap({ position: { x: 20, y: 20 } }); await card.tap({ position: { x: 20, y: 20 } }); }
    else { await card.focus(); await card.press('Enter'); }
    const selected = page.locator('.composition-index [aria-current="page"]').getByText('Second canvas', { exact: true }); await selected.waitFor();
    await page.screenshot({ path: `${output}/${mode}-${width}-viewer.png` });
    await page.keyboard.press('Escape'); await main.waitFor();
    assert.ok(Math.abs(await main.evaluate(node => node.scrollTop) - scroll) < 2, 'Closing a canvas restores the overview position');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open Second canvas');
    await page.getByRole('navigation', { name: 'Profile navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('.reception-page').waitFor();
    assert.equal(await page.locator('.reception-canvases, .canvas-gallery-section').count(), 0);
    assert.deepEqual(await page.evaluate(() => ({ storage: JSON.stringify(localStorage), writes: linkedFixture.writes() })), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
