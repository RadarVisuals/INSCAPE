import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';

test('Keeper chat retains selection and sends fresh selected Image/Display context only when enabled', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      const errors = [], messages = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 320, seamReview: 'single' });
      await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
      await page.evaluate(() => document.fonts.ready);
      await page.route(`${origin}/__keeper-chatgpt/**`, route => {
        if (new URL(route.request().url()).pathname.endsWith('/message')) {
          messages.push(route.request().postDataJSON());
          return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ delta: 'Selection received.' }) + '\n' + JSON.stringify({ done: true, action: { gesture: 'none', target: 'none' } }) + '\n' });
        }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'connected', models: [{ id: 'test', name: 'Test' }], history: [] }) });
      });
      // CORS-enabled fixture pixels exercise the real optional preview path.
      await page.route('**/motion-artwork.png', route => route.fulfill({ contentType: 'image/jpeg', headers: { 'Access-Control-Allow-Origin': '*' }, path: 'browser-tests/fixtures/grid-landscape.jpg' }));
      await page.evaluate(width => {
        const draft = JSON.parse(localStorage.getItem(window.__motionKey));
        draft.imageModules = draft.imageModules.slice(0, 2).map((image, i) => ({ ...image, sides: image.sides.map(side => ({ ...side, asset: { ...side.asset, name: i ? 'Far selected study' : 'Near study' } })) }));
        draft.workbench.imageModules = draft.workbench.imageModules.slice(0, 2).map((image, i) => ({ ...image, position: { left: i ? 220 : 30, top: 620 } }));
        draft.keeperDocks = [{ id: 'keeper:selection', name: 'Hex', asset: draft.imageModules[0].sides[0].asset, faces: 'right', movement: 'flip', size: 96, visibility: 'PRIVATE' }];
        draft.workbench.keeperDocks = [{ id: 'keeper:selection', position: { left: Math.min(430, width - 130), top: 330 } }];
        localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__selectionSaved = localStorage.getItem(window.__motionKey);
        window.__motionRemount();
      }, width);
      const board = page.locator('main.system-workflow').first();
      const choose = async (ids, clear = true) => {
        if (clear) { await board.focus(); await page.keyboard.press('Escape'); }
        for (const id of ids) await page.locator(`[data-workbench-view-id="${id}"]`).evaluate(node => {
          const target = node.matches('[data-workbench-selectable]') ? node : node.querySelector('[data-workbench-selectable]');
          target.focus({ preventScroll: true }); target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
        });
      };
      await choose(['image:motion-1']);
      await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
      await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Talk to Hex', exact: true }).click();
      const bubble = page.getByRole('dialog', { name: 'Hex', exact: true });
      await bubble.getByRole('button', { name: 'AI chat', exact: true }).click();
      const send = async message => {
        const before = messages.length;
        await bubble.getByRole('textbox', { name: 'Message Hex', exact: true }).fill(message);
        await bubble.getByRole('button', { name: 'Send', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('.keeper-ai__composer textarea')?.disabled);
        assert.equal(messages.length, before + 1);
        return messages.at(-1);
      };
      const off = await send('What do you think of this guy?');
      assert.deepEqual(off.scene.artworks, []); assert.equal(off.scene.selection, undefined);
      await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
      await bubble.getByRole('button', { name: 'Chat settings', exact: true }).click();
      await bubble.getByRole('checkbox', { name: 'Share artwork previews', exact: true }).check();
      await mkdir('.browser-test-runtime', { recursive: true });
      await bubble.screenshot({ path: `.browser-test-runtime/keeper-selection-settings-${width}.png` });
      const visual = await bubble.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          overflow: Math.max(...Array.from(node.querySelectorAll('.keeper-conversation__content, .keeper-ai__settings'), child => child.scrollWidth - child.clientWidth)), background: getComputedStyle(node).backgroundColor };
      });
      assert.ok(visual.left >= 0 && visual.right <= width && visual.top >= 0 && visual.bottom <= 1000);
      assert.ok(visual.overflow <= 1, JSON.stringify(visual)); assert.notEqual(visual.background, 'rgba(0, 0, 0, 0)');
      await bubble.getByRole('button', { name: 'Back to chat', exact: true }).click();
      const first = await send('What about this selected guy?');
      assert.deepEqual(first.scene.selection, { kind: 'modules', count: 1, complete: true });
      assert.equal(first.scene.artworks[0].title, 'Far selected study');
      assert.equal(first.scene.artworks[0].selected, true);
      assert.equal(first.images.length, 2); assert.equal(first.images[0].id, first.scene.artworks[0].id);
      await choose(['image:motion-0']);
      const second = await send('And now this one?');
      assert.equal(second.scene.artworks[0].title, 'Near study');
      assert.equal(second.scene.artworks.filter(item => item.selected).length, 1);
      await choose([]);
      const placement = page.locator('.system-workflow__placement[data-system-workflow-placement-id]').first();
      await placement.focus(); await placement.dispatchEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      const display = await send('Describe the selected Display artwork.');
      assert.deepEqual(display.scene.selection, { kind: 'artworks', count: 1, complete: true });
      assert.equal(display.scene.artworks[0].selected, true);
      await choose(['image:motion-0', 'image:motion-1']);
      const multi = await send('Compare these.');
      assert.deepEqual(multi.scene.selection, { kind: 'modules', count: 2, complete: true });
      assert.equal(multi.scene.artworks.filter(item => item.selected).length, 2);
      await bubble.getByRole('button', { name: 'Chat settings', exact: true }).click();
      await bubble.getByRole('checkbox', { name: 'Share artwork details', exact: true }).uncheck();
      await bubble.getByRole('button', { name: 'Back to chat', exact: true }).click();
      const disabled = await send('Selection should be private again.');
      assert.deepEqual(disabled.scene.artworks, []); assert.equal(disabled.scene.selection, undefined); assert.equal(disabled.images, undefined);
      await bubble.screenshot({ path: `.browser-test-runtime/keeper-selection-chat-${width}.png` });
      await page.keyboard.press('Escape'); await bubble.waitFor({ state: 'detached' });
      await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey) === window.__selectionSaved), true);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
