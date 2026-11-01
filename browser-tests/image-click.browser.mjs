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

for (const visitor of [false, true]) for (const width of [1440, 390]) {
  test(`Image single click selects; double click zooms (${visitor ? 'Visitor' : 'owner'}, ${width}px)`, { timeout: 60000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 390,
        reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(8000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, count: 1, displayWidth: 320, seamReview: 'single' });
      await page.evaluate(async visitor => {
        const draft = JSON.parse(localStorage.getItem(window.__motionKey)), original = draft.imageModules[0];
        draft.displays = []; draft.grids[0].placements = []; draft.workbench.display.open = false;
        draft.imageModules = [0, 1].map(index => ({ ...original, id: `image:click-${index}`, name: `Click ${index}`, width: 200, height: 180 }));
        draft.workbench.imageModules = draft.imageModules.map((image, index) => ({ id: image.id, open: true, position: { left: 32, top: 64 + index * 250 } }));
        localStorage.setItem(window.__motionKey, JSON.stringify(draft));
        // Visitor reads its publication object, while owner remounts from draft storage.
        if (visitor) {
          const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
          Object.assign(window.__motionDocument, buildProfileDocumentV9({ systemWorkflowDraft: draft,
            profileAddress: `0x${'1'.repeat(40)}`, assetRecords: [] }));
        }
        window.__motionRemount();
      }, visitor);
      const first = page.locator('[data-image-module="image:click-0"] .image-module__window');
      const source = first.locator('.image-module__canvas');
      const back = page.getByRole('button', { name: 'Back to previous Workbench view', exact: true });
      await source.waitFor(); await page.evaluate(() => document.fonts.ready); await settled(page);
      // The owner sidebar overlays the historical fixture position.
      if (!visitor && width === 1440) { await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click(); await settled(page); }
      const initial = await camera(page), geometry = await first.boundingBox();
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      if (width === 390) await source.tap(); else await source.click();
      await settled(page);
      assert.deepEqual(await camera(page), initial, 'first click/tap leaves camera unchanged');
      assert.deepEqual(await first.boundingBox(), geometry);
      assert.equal(await back.isDisabled(), true, 'selection does not add return history');
      assert.equal(await page.locator('.image-lift').count(), 0);
      if (!visitor) {
        assert.equal(await first.getAttribute('data-active'), 'true', 'click activates the Image and bounds');
        const actions = page.locator('[data-context-action-bars] [data-context-action-target]');
        await actions.waitFor();
        assert.equal(await actions.getAttribute('data-context-action-target'), 'image:click-0');
      }
      await source.click(); await settled(page);
      assert.deepEqual(await camera(page), initial, 'another ordinary click on the active Image still does not zoom');
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/image-selected-${visitor ? 'visitor' : 'owner'}-${width}.png` });

      // A gesture carrying the second-click count still belongs to drag/cancel.
      await page.mouse.move(geometry.x + 50, geometry.y + 70);
      await page.mouse.down({ clickCount: 2 });
      await page.mouse.move(geometry.x + 90, geometry.y + 100, { steps: 5 });
      assert.notDeepEqual(await first.boundingBox(), geometry, 'actual Image drag previews movement');
      await page.keyboard.press('Escape'); await page.mouse.up({ clickCount: 2 }); await settled(page);
      assert.deepEqual(await first.boundingBox(), geometry);
      assert.deepEqual(await camera(page), initial, 'cancelled drag never zooms on release');
      assert.equal(await back.isDisabled(), true);

      await source.dblclick(); await settled(page);
      const focused = await camera(page);
      assert.notDeepEqual(focused, initial, 'native double-click zooms through Workbench Focus');
      assert.equal(await page.locator('.image-lift').count(), 0, 'camera focus is separate from artwork inspection');
      await source.click(); await settled(page);
      assert.deepEqual(await camera(page), focused, 'single click also stays put in the zoomed view');
      await back.click(); await settled(page);
      assert.deepEqual(await camera(page), initial);
      assert.equal(await back.isDisabled(), true, 'double-click created only one return context');

      await source.press('Enter'); await settled(page);
      assert.notDeepEqual(await camera(page), initial, 'Enter retains direct keyboard Focus');
      await back.click(); await settled(page); assert.deepEqual(await camera(page), initial);
      await source.press('Space'); await settled(page);
      assert.deepEqual(await camera(page), initial, 'Space keeps its existing temporary Hand behavior');
      await source.focus(); await page.keyboard.press('i');
      await page.getByRole('dialog', { name: 'Inspect Image', exact: true }).waitFor();
      assert.deepEqual(await camera(page), initial, 'I inspection does not zoom the camera');
      await page.keyboard.press('Escape'); await page.locator('.image-lift').waitFor({ state: 'detached' }); await settled(page);
      assert.equal(await source.evaluate(node => node === document.activeElement), true);
      assert.deepEqual(await first.boundingBox(), geometry);
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved, 'click, zoom, return and cancel preserve saved content');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
