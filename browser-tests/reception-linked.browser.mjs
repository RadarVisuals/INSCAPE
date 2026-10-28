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
      return route.fulfill({ response: await route.fetch({ url: origin + url.pathname.split('/public')[1] }) });
    return route.abort();
  });
  await page.goto(`${origin}/browser-tests/reception-linked-fixture.html?session=${crypto.randomUUID()}&${query}`);
  return { browser, page, errors };
}
for (const width of [1920, 390]) for (const mode of ['local', 'public']) test(`Reception ${mode}: direct Display swipe, linked content, separate overview and camera at ${width}`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup(width, mode);
  try {
    if (mode === 'public') assert.equal(await page.getByRole('button', { name: 'Edit Reception', exact: true }).count(), 0);
    const display = page.locator('.reception-display .visitor-grid-world__viewport');
    await display.locator('.visitor-grid-world__grid-plane:not([aria-hidden]) [data-media-state=ready]').first().waitFor();
    const before = await page.evaluate(() => ({ storage: JSON.stringify(localStorage), writes: linkedFixture.writes() }));
    const bounds = await display.boundingBox(), x = bounds.x + bounds.width * .8, y = bounds.y + bounds.height * .65;
    if (width === 390) {
      const session = await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - bounds.width * .65 * step / 8, y }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
    } else {
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x - bounds.width * .35, y, { steps: 6 });
      const progress = await page.evaluate(() => ['.visitor-grid-world__grid-track', '.text-scene-track'].map(selector => {
        const node = document.querySelector(selector); return new DOMMatrix(getComputedStyle(node).transform).m41 / node.getBoundingClientRect().width;
      }));
      assert.ok(progress[0] < -.1 && Math.abs(progress[0] - progress[1]) < .025, 'Text follows the actual Display swipe');
      await page.mouse.move(x - bounds.width * .65, y, { steps: 4 }); await page.mouse.up();
    }
    await page.waitForFunction(() => document.querySelector('.reception-display [data-active-grid-id]')?.dataset.activeGridId === 'grid:second');
    await page.locator('.reception-linked-content .text-scene-page').getByRole('heading', { name: 'Dawn', exact: true }).first().waitFor();
    assert.equal(await page.locator('[data-linked-kind="image"]').getAttribute('data-linked-side'), 'side:1');
    assert.ok(await page.getByRole('heading', { name: 'Small worlds.', exact: true }).isVisible());
    await page.waitForFunction(() => ['.reception-display .visitor-grid-world__grid-track', '.reception-linked-content .text-scene-track'].every(selector =>
      { const node = document.querySelector(selector); return Math.abs(new DOMMatrix(getComputedStyle(node).transform).m41 + Number(node.dataset.railOrigin || 0) * node.getBoundingClientRect().width) < 1; }));
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
    await page.getByRole('button', { name: 'Canvases', exact: true }).click();
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
    const second = page.getByRole('dialog', { name: 'View Second canvas' }); await second.waitFor();
    await page.screenshot({ path: `${output}/${mode}-${width}-viewer.png` });
    await page.keyboard.press('Escape'); await second.waitFor({ state: 'detached' });
    assert.ok(Math.abs(await main.evaluate(node => node.scrollTop) - scroll) < 2, 'Closing a canvas restores the overview position');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open Second canvas');
    await page.getByRole('button', { name: 'Inscape menu', exact: true }).click();
    await page.getByRole('button', { name: 'About', exact: true }).click();
    await page.locator('.reception-page').waitFor();
    assert.equal(await page.locator('.reception-canvases, .canvas-gallery-section').count(), 0);
    assert.deepEqual(await page.evaluate(() => ({ storage: JSON.stringify(localStorage), writes: linkedFixture.writes() })), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('Reception link editor saves, undoes, retries and restores linked sources', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup(1920, 'edit');
  try {
    const cell = page.locator('[data-region-id="region:lower-left"]'); await cell.click({ position: { x: 30, y: 30 } });
    await page.getByRole('button', { name: 'Edit link', exact: true }).click();
    await page.getByLabel('Cell behavior', { exact: true }).selectOption('source');
    const select = page.getByLabel('Linked content', { exact: true });
    const value = await select.locator('option').evaluateAll(options => options.find(option => option.textContent === 'Second canvas / Study / Side 2').value);
    await select.selectOption(value);
    await page.evaluate(() => linkedFixture.fail(true));
    await page.getByRole('button', { name: 'Save link', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Reception could not be saved' }).waitFor();
    await page.evaluate(() => linkedFixture.fail(false));
    await page.getByRole('button', { name: 'Save link', exact: true }).click();
    assert.equal(await cell.locator('[data-linked-side]').getAttribute('data-linked-side'), 'side:1');
    await page.getByRole('button', { name: /^Undo/ }).click();
    await page.waitForFunction(() => linkedFixture.root.getSnapshot().reception.links.find(link => link.id === 'link:image').kind === 'scene');
    await page.getByRole('button', { name: /^Redo/ }).click();
    await page.reload();
    await cell.locator('[data-linked-side="side:1"]').waitFor();
    assert.equal(await page.evaluate(() => linkedFixture.publish().reception.links.length), 3);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
