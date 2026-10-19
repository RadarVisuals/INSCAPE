import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settled = async page => {
  await page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
const camera = page => page.locator('main.system-workflow').first().evaluate(node => ({
  scale: Number(node.dataset.workbenchCameraScale || 1), x: Number(node.dataset.workbenchCameraX || 0), y: Number(node.dataset.workbenchCameraY || 0),
}));

async function fixture(page, visitor) {
  await mountGridMotionFixture(page, { origin, visitor, count: 1, displayWidth: 320, seamReview: 'single' });
  await page.evaluate(async visitor => {
    const draft = JSON.parse(localStorage.getItem(window.__motionKey)), original = draft.imageModules[0];
    draft.displays = []; draft.grids[0].placements = []; draft.workbench.display.open = false;
    draft.imageModules = [0, 1].map(index => ({ ...original, id: `image:toggle-${index}`, name: `Toggle ${index}`, width: 200, height: 180 }));
    draft.workbench.imageModules = draft.imageModules.map((image, index) => ({ id: image.id, open: true, position: { left: 32, top: 64 + index * 250 } }));
    localStorage.setItem(window.__motionKey, JSON.stringify(draft));
    if (visitor) {
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      Object.assign(window.__motionDocument, buildProfileDocumentV9({ systemWorkflowDraft: draft,
        profileAddress: `0x${'1'.repeat(40)}`, assetRecords: [] }));
    }
    window.__motionRemount();
  }, visitor);
  await page.locator('[data-image-module="image:toggle-0"] .image-module__artwork[data-media-state="ready"]').waitFor();
  await page.evaluate(() => document.fonts.ready); await settled(page);
}

for (const visitor of [false, true]) for (const width of [1440, 390]) for (const entry of ['click', 'double-click']) {
  test(`F focuses and returns after ${entry} (${visitor ? 'Visitor' : 'owner'}, ${width}px)`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 390,
        reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(8000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await fixture(page, visitor);
      const first = page.locator('[data-image-module="image:toggle-0"] .image-module__window');
      const source = first.locator('.image-module__canvas');
      const host = page.locator('main.system-workflow').first();
      const back = page.getByRole('button', { name: 'Back to previous Workbench view', exact: true });
      const initial = await camera(page), geometry = await first.boundingBox();
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      if (entry === 'click') {
        if (width === 390) await source.tap(); else await source.click();
        await settled(page);
        assert.deepEqual(await camera(page), initial, 'single click selects without camera travel');
        assert.equal(await page.locator('.workbench-selection').count(), 0, 'no marquee or group selection needed');
        await page.keyboard.press('f'); await settled(page);
        assert.notDeepEqual(await camera(page), initial, 'F uses the ordinarily clicked Image');
      } else {
        await source.dblclick(); await settled(page);
        assert.notDeepEqual(await camera(page), initial);
      }
      let focused = await camera(page);
      await host.dispatchEvent('keydown', { key: 'f', repeat: true }); await settled(page);
      assert.deepEqual(await camera(page), focused, 'holding F does not toggle');
      await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), initial, 'F returns to the exact prior camera');
      assert.equal(await back.isDisabled(), true, 'F consumes the existing return context');
      assert.equal(await first.evaluate(node => node.contains(document.activeElement)), true, 'Back restores module keyboard focus');
      await page.keyboard.press('f'); await settled(page);
      assert.notDeepEqual(await camera(page), initial, 'F can focus the same Image again after returning');
      // First activation may finish mounting the owner tools after a fast
      // double-click. Each destination fits the controls present at its request.
      focused = await camera(page);

      // Reclicking the same destination must still return; a new target must focus.
      await source.click(); await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), initial, 'F on the same clicked destination returns');
      await source.click(); await page.keyboard.press('f'); await settled(page);
      const second = page.locator('[data-image-module="image:toggle-1"] .image-module__canvas');
      await second.focus(); await page.keyboard.press('f'); await settled(page);
      assert.notDeepEqual(await camera(page), focused, 'another module creates its own destination');
      await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), focused, 'nested F returns one level');
      await host.focus(); await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), initial, 'second return reaches the original overview');
      assert.equal(await back.isDisabled(), true);

      // A deliberate second press during travel reverses it; key repeats do not.
      await source.click(); await page.keyboard.press('f');
      if (width === 1440) assert.equal(await host.evaluate(node => node.hasAttribute('data-workbench-travelling')), true);
      await host.dispatchEvent('keydown', { key: 'f', repeat: true });
      await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), initial);
      assert.equal(await back.isDisabled(), true, 'interrupted arrival does not duplicate history');

      await source.click(); await page.keyboard.press('f'); await settled(page);
      const guardedCamera = await camera(page);
      await page.evaluate(() => {
        const field = document.createElement('input'); field.id = 'toggle-input';
        document.querySelector('main.system-workflow').append(field); field.focus();
      });
      await page.keyboard.press('f'); await settled(page);
      assert.equal(await page.locator('#toggle-input').inputValue(), 'f');
      assert.deepEqual(await camera(page), guardedCamera, 'typing does not return');
      await host.focus();
      for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
        await host.dispatchEvent('keydown', { key: 'f', ...extra }); await settled(page);
        assert.deepEqual(await camera(page), guardedCamera);
      }
      await page.evaluate(() => {
        document.getElementById('toggle-input').remove();
        const dialog = document.createElement('div'); dialog.id = 'toggle-dialog'; dialog.setAttribute('role', 'dialog'); dialog.tabIndex = 0;
        document.querySelector('main.system-workflow').append(dialog); dialog.focus();
      });
      await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), guardedCamera, 'dialogs keep their own keys');
      await page.locator('#toggle-dialog').evaluate(node => node.setAttribute('role', 'menu'));
      await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), guardedCamera, 'menus keep their own keys');
      await page.evaluate(() => document.getElementById('toggle-dialog').remove());
      await host.focus(); await page.keyboard.press('Escape'); await settled(page);
      assert.deepEqual(await camera(page), initial, 'Escape remains available');

      await source.press('Enter'); await settled(page);
      const inspectedCamera = await camera(page);
      await source.focus(); await page.keyboard.press('i');
      await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor();
      await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), inspectedCamera, 'F cannot escape an inspection lock');
      await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' });
      await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), initial, 'F returns after Enter and after inspection closes');

      // Group selection still frames both modules, with the same F return.
      for (const index of [0, 1]) {
        const window = page.locator(`[data-image-module="image:toggle-${index}"] .image-module__window`);
        await window.focus(); await page.keyboard.press('Shift+Enter');
      }
      assert.match(await page.locator('.workbench-view-controls__selection-count').innerText(), /2 selected/);
      await page.keyboard.press('f'); await settled(page);
      const groupCamera = await camera(page);
      assert.notDeepEqual(groupCamera, initial); assert.notDeepEqual(groupCamera, focused);
      await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), initial);
      assert.match(await page.locator('.workbench-view-controls__selection-count').innerText(), /2 selected/, 'return restores multi-selection');
      await page.keyboard.press('Escape'); await settled(page);
      // F cannot consume Back while a move owns the pointer.
      await source.dblclick(); await settled(page);
      const box = await first.boundingBox(), beforeDrag = await camera(page);
      await page.mouse.move(box.x + 50, box.y + 70); await page.mouse.down();
      await page.mouse.move(box.x + 85, box.y + 95, { steps: 4 });
      await page.keyboard.press('f');
      assert.deepEqual(await camera(page), beforeDrag, 'active drag owns F');
      await page.keyboard.press('Escape'); await page.mouse.up(); await settled(page);
      await host.focus(); await page.keyboard.press('f'); await settled(page);
      assert.deepEqual(await camera(page), initial);
      assert.deepEqual(await first.boundingBox(), geometry);
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'camera round-trips never save content');
      assert.deepEqual(errors, []);
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/focus-return-${entry}-${visitor ? 'visitor' : 'owner'}-${width}.png` });
    } finally { await browser.close(); }
  });
}
