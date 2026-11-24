import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('controller scopes failures and retained callbacks to the active editor', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173'}/browser-tests/controller-hardening-fixture.html`);
    await page.waitForFunction(() => window.hardening?.controller);
    await page.evaluate(() => {
      const c = window.hardening.controller;
      window.hardening.old = c;
      c.run(() => { throw new Error('profile A failure'); });
    });
    await page.waitForFunction(() => window.hardening.controller.error === 'profile A failure');
    await page.evaluate(() => window.hardening.setAddress(window.hardening.other));
    await page.waitForFunction(() => window.hardening.controller.draft.profileAddress === window.hardening.other);
    assert.equal(await page.evaluate(() => window.hardening.controller.error), null);
    assert.equal(await page.evaluate(() => window.hardening.old.run(() => true)), false);
    await page.evaluate(() => {
      window.hardening.last = window.hardening.controller;
      window.hardening.unmount();
    });
    assert.equal(await page.evaluate(() => window.hardening.last.run(() => true)), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
