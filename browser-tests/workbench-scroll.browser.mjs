import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1.1, `${label}: ${a} != ${b}`);
const camera = page => page.locator('main.system-workflow').first().evaluate(host => {
  const css = getComputedStyle(host), rect = host.getBoundingClientRect();
  const x = parseFloat(css.getPropertyValue('--workbench-pan-x')) || 0;
  const y = parseFloat(css.getPropertyValue('--workbench-pan-y')) || 0;
  const scale = Number(host.querySelector('[data-workbench-scale]').dataset.workbenchScale);
  const centre = { x: rect.width / 2, y: (rect.height - parseFloat(css.getPropertyValue('--workflow-dock-height'))) / 2 };
  return { x, y, scale, worldX: (centre.x - x) / scale, worldY: (centre.y - y) / scale };
});
const wheelOver = async (page, target, dx, dy) => {
  await target.hover(); await page.mouse.wheel(dx, dy);
  await page.waitForTimeout(180); await settle(page);
};

for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`wheel ownership and zoom reset ${visitor ? 'Visitor' : 'owner'} at ${width}px`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, displayWidth: Math.min(600, width - 40), textModes: true });
      const host = page.locator('main.system-workflow').first();
      const board = page.locator('.system-workflow__presentation-board').first();
      const image = page.locator('[data-workbench-view-id="image:motion-0"]');
      const text = mode => page.locator(`[data-text-id="text:${mode}"]`);
      await text('pages').locator('.text-window').waitFor(); await image.waitFor();
      if (!visitor) {
        for (const mode of ['fit', 'overflow', 'pages']) {
          await text(mode).getByRole('button', { name: 'Read', exact: true }).focus(); await page.keyboard.press('Enter');
          await text(mode).getByRole('button', { name: 'Text tools', exact: true }).focus(); await page.keyboard.press('Enter');
        }
      }
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      const resetPan = async () => { await page.getByRole('button', { name: 'Reset Workbench position' }).click(); await settle(page); };
      const stage = board.locator('[data-presentation-stage]');
      const original = await board.boundingBox();
      await wheelOver(page, stage, 0, 65);
      near((await camera(page)).y, -65, 'Display passes vertical wheel to the canvas');
      near((await board.boundingBox()).width, original.width, 'wheel does not resize Display');
      await wheelOver(page, image, 0, -40);
      near((await camera(page)).y, -25, 'Image passes vertical wheel to the canvas');
      await wheelOver(page, image, 35, 0);
      near((await camera(page)).x, -35, 'Image passes horizontal wheel to the canvas');
      await resetPan();

      for (const mode of ['fit', 'overflow', 'pages']) {
        // Bring each existing window into the same screen position without
        // moving or rewriting that window (also exercises narrow viewports).
        const box = await text(mode).locator('.text-window').boundingBox();
        await host.dispatchEvent('wheel', { deltaX: box.x - 20, deltaY: box.y - 440, bubbles: true, cancelable: true });
        await settle(page);
        const region = text(mode).getByRole('region', { name: mode === 'pages' ? 'Article pages' : 'Article content', exact: true });
        const before = await camera(page);
        const pageLabel = mode === 'pages' ? await text(mode).locator('.text-page-navigation span').innerText() : null;
        await wheelOver(page, region, 0, 70);
        if (mode === 'overflow') {
          assert.ok(await region.evaluate(node => node.scrollTop > 0), 'long Text scrolls internally');
          assert.deepEqual(await camera(page), before, 'long Text retains wheel ownership');
          for (const end of ['bottom', 'top']) {
            await region.evaluate((node, end) => { node.scrollTop = end === 'bottom' ? node.scrollHeight : 0; }, end);
            await wheelOver(page, region, 0, end === 'bottom' ? 70 : -70);
            assert.deepEqual(await camera(page), before, `Text contains scroll at its ${end}`);
          }
          // Switching back to Write retains real overflow and native scrolling.
          if (!visitor) {
            await text(mode).getByRole('button', { name: 'Write', exact: true }).focus(); await page.keyboard.press('Enter');
            await text(mode).getByRole('textbox', { name: 'Article text', exact: true }).waitFor();
            await wheelOver(page, region, 0, 60);
            assert.ok(await region.evaluate(node => node.scrollTop > 0));
            assert.deepEqual(await camera(page), before, 'writing retains internal scroll');
          }
        } else {
          near((await camera(page)).y, before.y - 70, `${mode} Text passes wheel to canvas`);
          if (mode === 'fit') assert.equal(await region.evaluate(node => node.scrollTop), 0);
          if (mode === 'pages') {
            assert.equal(await text(mode).locator('.text-page-navigation span').innerText(), pageLabel, 'wheel does not turn pages');
            await text(mode).getByRole('button', { name: 'Next text page' }).click();
            assert.notEqual(await text(mode).locator('.text-page-navigation span').innerText(), pageLabel, 'page controls still turn pages');
          }
        }
        await page.screenshot({ path: `.browser-test-runtime/workbench-scroll-${visitor}-${width}-${mode}.png` });
        await resetPan();
      }

      for (const scale of [.25, 2]) {
        await setWorkbenchZoom(page, scale);
        await host.dispatchEvent('wheel', { deltaX: 480, deltaY: 730, bubbles: true, cancelable: true }); await settle(page);
        const before = await camera(page);
        if (scale === .25) await page.getByRole('button', { name: 'Reset Workbench zoom to 100%' }).click();
        else { await host.focus(); await page.keyboard.press('Control+0'); }
        await settle(page);
        const after = await camera(page);
        assert.equal(after.scale, 1);
        near(after.worldX, before.worldX, '100% retains horizontal centre');
        near(after.worldY, before.worldY, '100% retains vertical centre');
        await page.getByRole('button', { name: 'Reset Workbench zoom to 100%' }).click(); await settle(page);
        assert.deepEqual(await camera(page), after, '100% is a no-op when already at 100%');
        await resetPan();
        assert.equal((await camera(page)).x, 0); assert.equal((await camera(page)).y, 0);
      }
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'view interactions never rewrite authored content');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
