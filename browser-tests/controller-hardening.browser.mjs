import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('controller scopes selection, failures and retained callbacks to the active editor', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/browser-tests/controller-hardening-fixture.html');
    await page.waitForFunction(() => window.hardening?.controller);
    await page.evaluate(() => {
      const c = window.hardening.controller;
      window.hardening.old = c;
      c.selectPlacement(c.selectedGrid.placements[0].id);
      c.run(() => { throw new Error('profile A failure'); });
    });
    await page.waitForFunction(() => window.hardening.controller.selectedPlacementIds.length === 1);
    assert.equal(await page.evaluate(() => window.hardening.controller.error), 'profile A failure');
    await page.evaluate(() => window.hardening.setAddress(window.hardening.other));
    await page.waitForFunction(() => window.hardening.controller.draft.profileAddress === window.hardening.other);
    assert.deepEqual(await page.evaluate(() => window.hardening.controller.selectedPlacementIds), []);
    assert.equal(await page.evaluate(() => window.hardening.controller.error), null);
    assert.equal(await page.evaluate(() => window.hardening.old.run(() => { throw new Error('old action executed'); })), false);
    await page.evaluate(() => {
      const c = window.hardening.controller;
      c.selectPlacement(c.selectedGrid.placements[0].id);
    });
    await page.waitForFunction(() => window.hardening.controller.selectedPlacementIds.length === 1);
    await page.evaluate(() => window.hardening.old.replaceSelection([]));
    assert.equal(await page.evaluate(() => window.hardening.controller.selectedPlacementIds.length), 1);
    await page.evaluate(() => {
      const c = window.hardening.controller;
      window.hardening.gridOld = c;
      const next = c.draft.grids.find(({ id }) => id !== c.selectedGridId);
      // Even navigation through the lower-level operation boundary must scope selection.
      c.run(session => session.selectGrid(next.id));
    });
    await page.waitForFunction(() => window.hardening.controller.selectedGridId !== window.hardening.gridOld.selectedGridId);
    assert.deepEqual(await page.evaluate(() => window.hardening.controller.selectedPlacementIds), []);
    await page.evaluate(() => window.hardening.gridOld.selectPlacement(window.hardening.gridOld.selectedGrid.placements[0].id));
    assert.deepEqual(await page.evaluate(() => window.hardening.controller.selectedPlacementIds), []);
    await page.evaluate(() => {
      window.hardening.last = window.hardening.controller;
      window.hardening.unmount();
    });
    assert.equal(await page.evaluate(() => window.hardening.last.run(() => { throw new Error('unmounted action executed'); })), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
