import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

test('Docs tabs explain the current modules and remain usable at wide and narrow widths', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174'}/development/owner/system-workflow`);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 780 });
      await page.getByRole('button', { name: 'Docs', exact: true }).click();
      const docs = page.getByRole('dialog', { name: 'Docs' });
      await docs.getByRole('tab', { name: 'Workbench', exact: true }).click();
      await page.keyboard.press('ArrowRight');
      assert.equal(await docs.getByRole('tab', { name: 'Display', exact: true }).getAttribute('aria-selected'), 'true');
      await page.keyboard.press('End');
      assert.match(await docs.getByRole('tabpanel').innerText(), /Preparing does not upload/);
      const bounds = await docs.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0);
      await page.screenshot({ path: `.browser-test-runtime/workbench-docs-${width}.png` });
      await docs.getByRole('tabpanel').evaluate(node => { node.scrollTop = node.scrollHeight; });
      await docs.getByRole('tab', { name: 'Identity', exact: true }).click();
      assert.equal(await docs.getByRole('tabpanel').evaluate(node => node.scrollTop), 0);
      assert.match(await docs.getByRole('tabpanel').innerText(), /does not rename your Universal Profile/);
      await page.keyboard.press('Escape');
      await docs.waitFor({ state: 'detached' });
      assert.equal(await page.getByRole('button', { name: 'Docs', exact: true }).evaluate(node => node === document.activeElement), true);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
