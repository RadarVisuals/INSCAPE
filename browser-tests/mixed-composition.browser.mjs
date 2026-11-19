import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const address = '0x' + '1'.repeat(40);

test('one published composition keeps free layers and Bento cells in Profile, Gallery and Writing', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=published&mixed=1`);
    const open = label => page.getByRole('button', { name: label, exact: true });
    await open('Open Mixed study').click();
    const dialog = page.getByRole('dialog', { name: 'View Mixed study' });
    const assertMixed = async host => {
      const layout = host.locator('.reception-document-canvas');
      await layout.locator('[data-layer-id="text:free-caption"]').waitFor();
      assert.equal(await layout.locator('[data-layer-id="text:free-caption"]').count(), 1);
      assert.ok(await layout.locator('[data-cell-group]').count() > 0);
      assert.equal(await layout.locator('[data-cell-group] [data-layer-id="text:free-caption"]').count(), 0);
    };
    await assertMixed(dialog);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await open('Gallery').click();
    const index = page.getByRole('navigation', { name: 'Canvases' });
    await index.getByRole('button', { name: 'Open Mixed study' }).waitFor();
    assert.equal(await index.getByRole('button', { name: 'Open Vision' }).count(), 0);
    const gallery = page.getByRole('group', { name: 'Mixed study canvas', exact: true });
    await assertMixed(gallery);
    await open('Expand canvas').click();
    await assertMixed(gallery);
    await open('Return to index').click();
    await open('Grid').click();
    await page.locator('[data-gallery-cycle="0"] [data-card-id="workbench:mixed"] [data-layer-id="text:free-caption"]').waitFor();
    await page.setViewportSize({ width: 900, height: 720 });
    await open('Writing').click();
    const writing = page.locator('.published-writing');
    await writing.locator('summary').filter({ hasText: 'Free caption' }).click();
    await writing.getByRole('heading', { name: 'Free caption' }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Studio opens the current published writing source or a new document on empty selection', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 820 }, reducedMotion: 'reduce' });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const profile = origin + '/browser-tests/profile-overview-fixture.html?view=' + address + '&reception=published&mixed=1&owner=1';
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto(profile);
    await button('Studio').click();
    await button('Create composition').waitFor();
    await page.goto(profile);
    await button('Writing').click();
    await page.locator('.published-writing summary').filter({ hasText: 'Free caption' }).click();
    await button('Studio').click();
    await page.locator('.editor-menu-bar[data-document="workbench:mixed"]').waitFor();
  } finally { await browser.close(); }
});
