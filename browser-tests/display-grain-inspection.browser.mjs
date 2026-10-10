import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
test('Display retains its grain through inspection and returns without selection glow', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, displayWidth: Math.min(1000, width - 40), grain: .7 });
      const board = page.locator('.system-workflow__presentation-board').first();
      const placement = board.locator(visitor ? '[data-placement-id][tabindex="0"]' : '.system-workflow__placement[tabindex="0"]').filter({ has: page.locator('img') }).first();
      await placement.waitFor();
      await placement.focus();
      await page.keyboard.press('Enter');
      await board.locator('.system-workflow__lift-artwork').waitFor();
      await page.waitForTimeout(600);
      const grain = board.locator(':scope > .module-surface-grain');
      assert.equal(await grain.count(), 1);
      assert.equal(await grain.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
      const rect = await board.boundingBox();
      const clip = { x: Math.round(rect.x + rect.width * .4), y: Math.round(rect.y + rect.height * .4), width: Math.floor(rect.width * .2), height: Math.floor(rect.height * .2) };
      const withGrain = await page.screenshot({ clip });
      await grain.evaluate(el => { el.style.opacity = '0'; });
      const withoutGrain = await page.screenshot({ clip });
      const changed = await page.evaluate(async ([a, b]) => {
        const pixels = async data => {
          const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          return context.getImageData(0, 0, canvas.width, canvas.height).data;
        };
        const left = await pixels(a), right = await pixels(b);
        return left.reduce((count, value, index) => count + (Math.abs(value - right[index]) > 2 ? 1 : 0), 0) / left.length;
      }, [withGrain.toString('base64'), withoutGrain.toString('base64')]);
      assert.ok(changed > .1, `grain visibly covers inspected artwork (${visitor}, ${width}): ${changed}`);
      await grain.evaluate(el => el.style.removeProperty('opacity'));
      await page.screenshot({ path: `.browser-test-runtime/grain-inspection-${visitor}-${width}.png` });
      await page.keyboard.press('Escape');
      await board.locator('.system-workflow__lift-artwork').waitFor({ state: 'detached' });
      assert.equal(await placement.evaluate(el => document.activeElement === el), true);
      assert.equal(await placement.locator('img').first().evaluate(el => getComputedStyle(el).filter), 'none');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
