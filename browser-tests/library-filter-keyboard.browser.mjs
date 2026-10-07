import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || '.browser-test-runtime';

for (const width of [1440, 390]) test(`Library Filter consumes Escape before Library and restores focus (${width}px)`, { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
      const asset = new URL(route.request().url()).pathname.split('/public/')[1]; await route.fulfill({ path: `public/${asset}` });
    });
    await page.goto(`${origin}/development/owner/system-workflow`);
    const libraryTrigger = page.getByRole('button', { name: 'Library', exact: true });
    await libraryTrigger.click();
    const library = page.getByRole('region', { name: 'Library workspace' });
    await library.waitFor();
    await page.evaluate(() => { window.filterDraftWrites = 0; addEventListener('inscape:review-storage-write', event => { if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.filterDraftWrites++; }); });
    const filter = library.getByRole('button', { name: /^Filters:/ }), popup = page.getByRole('dialog', { name: 'Filters', exact: true });
    await filter.focus(); await page.keyboard.press('Enter'); await popup.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await popup.isVisible(), false, 'Escape closes the current Filter popup');
    assert.equal(await library.isVisible(), true, 'the containing Library remains open');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Filters:'));
    assert.equal(await filter.getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('Enter'); await popup.waitFor();
    const selected = popup.getByRole('radio', { checked: true });
    assert.equal(await selected.evaluate(node => node === document.activeElement), true, 'opening focuses the chosen collection');
    const other = popup.getByRole('radio').nth(1);
    await other.click(); const selectedName = await other.innerText();
    await page.keyboard.press('Escape'); await popup.waitFor({ state: 'detached' });
    assert.equal(await library.isVisible(), true);
    await filter.focus(); await page.keyboard.press('Enter'); await popup.waitFor();
    assert.equal(await popup.getByRole('radio', { checked: true }).innerText(), selectedName, 'the collection choice survives closing and reopening');
    assert.equal(await popup.getByRole('radio', { checked: true }).evaluate(node => node === document.activeElement), true);
    await mkdir(output, { recursive: true }); await page.screenshot({ path: join(output, `library-filter-${width}.png`) });
    await page.keyboard.press('Escape'); await popup.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Filters:'));
    await filter.click(); await popup.waitFor();
    await filter.click(); await popup.waitFor({ state: 'detached' });
    assert.equal(await library.isVisible(), true, 'the trigger still toggles its popup with pointer input');
    await page.keyboard.press('Enter'); await popup.waitFor();
    await filter.focus(); await page.keyboard.press('Escape'); await popup.waitFor({ state: 'detached' });
    assert.equal(await library.isVisible(), true, 'Escape on the popup trigger also belongs to Filters');
    await page.keyboard.press('Enter'); await popup.waitFor();
    const choices = popup.getByRole('radio');
    // Filters is non-modal: leaving its last control dismisses only the popup.
    await choices.last().focus(); await page.keyboard.press('Tab');
    assert.equal(await popup.isVisible(), false, 'tabbing out cannot leave an orphaned Filter portal');
    assert.equal(await library.isVisible(), true);
    await filter.focus();
    await page.keyboard.press('Escape'); await library.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Library');
    assert.equal(await popup.count(), 0, 'closing Library leaves no orphaned Filter portal');
    assert.equal(await page.evaluate(() => window.filterDraftWrites), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
