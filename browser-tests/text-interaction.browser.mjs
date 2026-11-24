import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1, `${a} / ${b}`);

test('Text grip moves the frame, body preserves selection and cancels movement without saving previews', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const text = page.locator('.system-workflow__instrument-window.text-window'), body = text.getByRole('textbox', { name: 'Article text', exact: true });
    await page.getByRole('button', { name: 'Close Inspector', exact: true }).click();
    const initial = await text.boundingBox(), paragraph = await body.locator('p').boundingBox();
    await page.mouse.move(paragraph.x + 2, paragraph.y + 8); await page.mouse.down();
    await page.mouse.move(paragraph.x + 145, paragraph.y + 8, { steps: 8 }); await page.mouse.up();
    assert.ok(await page.evaluate(() => getSelection().toString().length > 3), 'writing keeps native text selection');
    assert.deepEqual(await text.boundingBox(), initial);
    const grip = page.locator('.editor-object-toolbar-label[title="Drag to move this text box"]:visible');
    const leftPadding = page.getByRole('slider', { name: 'left text padding' });
    const originalPadding = Number(await leftPadding.getAttribute('aria-valuenow'));
    await leftPadding.press('ArrowRight');
    assert.equal(Number(await leftPadding.getAttribute('aria-valuenow')), originalPadding + 1);
    const draft = await page.evaluate(() => savedDraft());
    for (const scale of [1, .5, 1.37]) {
      await setWorkbenchZoom(page, scale); await settle(page);
      const before = await text.boundingBox(), handle = await grip.boundingBox(), x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
      await page.keyboard.down('Alt');
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 3, y + 1); await settle(page);
      assert.deepEqual(await text.boundingBox(), before, 'a click/jitter does not move the window');
      await page.mouse.move(x + 80, y + 48, { steps: 5 }); await settle(page);
      const preview = await text.boundingBox(); near(preview.x, before.x + 80); near(preview.y, before.y + 48);
      await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
      assert.deepEqual(await text.boundingBox(), before, 'Escape restores the starting frame');
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 80, y + 48, { steps: 5 }); await page.mouse.up();
      await page.keyboard.up('Alt'); await settle(page);
      const moved = await text.boundingBox(); near(moved.x, before.x + 80); near(moved.y, before.y + 48);
      assert.deepEqual(await page.evaluate(() => savedDraft()), draft, 'body movement preserves authored article data');
    }
    await setWorkbenchZoom(page, 1); await settle(page);
    const committed = await text.boundingBox();
    await page.reload(); await mountTextToolsFixture(page, origin);
    assert.deepEqual(await text.boundingBox(), committed, 'body placement survives reload');
    await body.waitFor();
    assert.equal(Number(await leftPadding.getAttribute('aria-valuenow')), originalPadding + 1);
    await page.getByRole('button', { name: 'Open text inspector', exact: true }).click();
    await page.locator('.workbench-tool-dock:has([data-text-inspector])').waitFor();
    assert.deepEqual(await text.boundingBox(), committed);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
