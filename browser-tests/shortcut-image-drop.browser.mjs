import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('image chooser pointer drop replaces only the shortcut icon and survives reload', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const width of [1440, 700]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ width }) => {
        const key = 'inscape:workbench:presentation-board:0x1111111111111111111111111111111111111111';
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ position: { left: width - 130, top: 180 }, visible: true, open: false }));
      }, { width });
      await page.route('https://images.inscape.test/**', route => route.request().url().endsWith('/transparent.webp')
        ? route.fulfill({ status: 404, body: '' })
        : route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/skull_reaper/full.webp' }));
      await page.goto('http://127.0.0.1:5173/browser-tests/library-images-fixture.html');
      const initial = await page.evaluate(() => JSON.stringify(window.__imageTest.draft()));
      await page.locator('.system-workflow__desktop-shortcut').dblclick();
      await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).click();
      await page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).click();
      await page.getByRole('button', { name: 'Library', exact: true }).click();
      await page.getByRole('button', { name: 'Open 3 images of ABYSSAL STUDY', exact: true }).click();
      const card = page.getByRole('button', { name: 'Image 2 of ABYSSAL STUDY', exact: true });
      await page.waitForFunction(() => document.querySelector('[aria-label="Image 2 of ABYSSAL STUDY"]')?.getAttribute('aria-disabled') === 'false');
      const source = await card.boundingBox();
      const target = await page.locator('.system-workflow__desktop-shortcut').boundingBox();
      assert.ok(target.x >= 0 && target.x + target.width <= width, 'opening Library keeps the shortcut in reach');
      await page.mouse.move(source.x + source.width / 2, source.y + 50);
      await page.mouse.down();
      await page.mouse.move(target.x + target.width / 2, target.y + 20, { steps: 10 });
      await page.getByText('Release to replace icon', { exact: true }).waitFor();
      await page.screenshot({ path: `.browser-test-runtime/shortcut-drop-feedback-${width}.png` });
      await page.mouse.up();
      const icon = page.locator('.system-workflow__desktop-shortcut-icon img');
      await icon.waitFor();
      assert.equal(await icon.getAttribute('src'), 'https://images.inscape.test/transparent-fallback.webp');
      assert.equal(await page.evaluate(() => JSON.stringify(window.__imageTest.draft())), initial);
      await page.screenshot({ path: `.browser-test-runtime/shortcut-image-${width}.png` });
      await page.reload();
      await icon.waitFor();
      assert.equal(await icon.getAttribute('src'), 'https://images.inscape.test/transparent-fallback.webp');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
