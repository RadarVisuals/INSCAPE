import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mkdir } from 'node:fs/promises';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5173';
const output = '.browser-test-runtime/reception-shared';
const scene = page => page.evaluate(() => richCellFixture.store.getSnapshot());
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
test('isolated rich cell uses shared selection, color, gestures, layer order and history; reopens without losing sources', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/public/assets/'))
        return route.fulfill({ response: await route.fetch({ url: origin + url.pathname.split('/public')[1] }) });
      return route.abort();
    });
    await page.goto(origin + '/browser-tests/reception-rich-cell-fixture.html?session=' + crypto.randomUUID());
    await page.getByRole('region', { name: 'Cell object tools' }).waitFor();
    await page.locator('.reception-artwork [data-media-state=ready]').waitFor();
    const original = await scene(page);
    // One authoritative selection changes the existing color tool's target.
    await page.getByRole('button', { name: 'Select Backdrop', exact: true }).click();
    await page.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#123456');
    await page.getByRole('textbox', { name: 'Color colour', exact: true }).press('Enter');
    assert.equal((await scene(page)).shapes[0].color.toLowerCase(), '#123456');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.deepEqual(await scene(page), original);
    await page.getByRole('button', { name: 'Select Small worlds', exact: true }).click();
    await page.getByRole('textbox', { name: 'Color colour', exact: true }).fill('#c87832');
    await page.getByRole('textbox', { name: 'Color colour', exact: true }).press('Enter');
    assert.equal((await scene(page)).texts[0].article.appearance.color.toLowerCase(), '#c87832');
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.deepEqual(await scene(page), original);
    for (const [id, name] of [['image:trial','SKULL REAPER'], ['text:trial','Small worlds'], ['shape:trial','Backdrop']]) {
      await page.getByRole('button', { name: 'Select ' + name, exact: true }).click();
      await page.getByRole('button', { name: 'Bring layers to front', exact: true }).click();
      assert.equal((await scene(page)).artworkLayers.at(-1), id);
      const before = await scene(page), box = await page.locator(`[data-object="${id}"]`).boundingBox();
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2); await page.mouse.down();
      await page.mouse.move(box.x + box.width/2 + 18, box.y + box.height/2 + 12, { steps: 5 }); await page.mouse.up(); await settle(page);
      assert.equal((await scene(page)).placements[id].left, before.placements[id].left + 18);
      await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.deepEqual(await scene(page), before);
      const resize = await page.getByRole('button', { name: `Resize ${name} se`, exact: true }).boundingBox();
      await page.mouse.move(resize.x+10, resize.y+10); await page.mouse.down(); await page.mouse.move(resize.x+30, resize.y+25, { steps: 5 }); await page.mouse.up(); await settle(page);
      assert.equal((await scene(page)).placements[id].width, before.placements[id].width + 20);
      await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert.deepEqual(await scene(page), before);
      const b = await page.locator(`[data-object="${id}"]`).boundingBox();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2); await page.mouse.down(); await page.mouse.move(b.x+b.width/2+20,b.y+b.height/2+15);
      await page.keyboard.press('Escape'); await page.mouse.up(); assert.deepEqual(await scene(page), before);
    }
    await page.getByRole('button', { name: 'Select Backdrop', exact: true }).click();
    await page.getByRole('button', { name: 'Send layers to back', exact: true }).click();
    const saved = await scene(page); assert.equal(saved.artworkLayers[0], 'shape:trial');
    assert.deepEqual(saved.imageModules, original.imageModules); assert.deepEqual(saved.texts, original.texts);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    assert.ok(keys.every(key => key.startsWith('inscape:fixture:rich-cell:')), 'No real profile/draft/preferences touched');
    await mkdir(output, { recursive: true }); await page.screenshot({ path: output + '/rich-cell-desktop.png' });
    await page.reload(); await page.getByRole('region', { name: 'Cell object tools' }).waitFor(); assert.deepEqual(await scene(page), saved);
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Tools', exact: true }).click(); await settle(page);
    const scale = await page.locator('.rich-trial-cell').evaluate(n => Number(getComputedStyle(n).transform.split(',')[0].slice(7)));
    assert.ok(scale < .5, 'Scaling alone makes desktop text much smaller');
    await page.screenshot({ path: output + '/rich-cell-mobile-scale.png' });
    await page.getByRole('combobox', { name: 'Mobile candidate' }).selectOption('flow'); await settle(page);
    assert.equal(await page.locator('.rich-trial-cell').getAttribute('data-flow'), 'true');
    assert.equal(await page.locator('.rich-trial-cell').evaluate(n => getComputedStyle(n).transform), 'none');
    await page.screenshot({ path: output + '/rich-cell-mobile-flow.png', fullPage: true });
    assert.deepEqual(await scene(page), saved, 'Neither mobile comparison changes saved placements');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
