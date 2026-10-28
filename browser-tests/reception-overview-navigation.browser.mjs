import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5197';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-overview-navigation';
for (const width of [1920, 390]) test(`Reception review Canvases opens the existing overview and returns without changing content at ${width}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width, height: width === 1920 ? 1080 : 844 }, hasTouch: width === 390, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  try {
    await page.goto(`${origin}/browser-tests/reception-editor-fixture.html?sample&session=${crypto.randomUUID()}`);
    await page.getByRole('button', { name: 'Canvases', exact: true }).waitFor();
    const before = await page.evaluate(() => receptionFixture.root.getBackupSnapshot());
    await page.getByRole('button', { name: 'Canvases', exact: true }).click();
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.equal(await page.locator('[data-reception-editor], .reception-page, .reception-canvases').count(), 0);
    const card = page.getByRole('button', { name: /^Open Workbench/ }).first();
    await card.focus(); await card.press('Enter');
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.classList.contains('workbench-overview-card-open'));
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/review-overview-${width}.png` });
    await page.getByRole('button', { name: 'Inscape menu', exact: true }).click();
    await page.getByRole('button', { name: 'About', exact: true }).click();
    await page.locator('[data-reception-editor]').waitFor();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.reception-page').waitFor();
    assert.equal(await page.locator('.reception-canvases, .canvas-gallery-section').count(), 0);
    await page.screenshot({ path: `${output}/review-reception-${width}.png` });
    await page.getByRole('button', { name: 'Canvases', exact: true }).click();
    await page.locator('.workbench-overview-gallery').waitFor();
    assert.deepEqual(await page.evaluate(() => receptionFixture.root.getBackupSnapshot()), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
