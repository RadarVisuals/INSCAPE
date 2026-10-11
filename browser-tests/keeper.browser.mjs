import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function addDock(page) {
  await page.mouse.click(600, 280, { button: 'right' });
  await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
  await page.getByRole('menuitem', { name: 'KEEPER DOCK', exact: true }).click();
  await page.locator('.keeper-dock-window').waitFor();
}
async function drop(page, name = 'ABYSSAL STUDY') {
  const card = page.getByRole('region', { name: 'Library workspace' }).getByRole('button', { name: `${name} / INSCAPE STUDIES`, exact: true });
  await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(label => document.querySelector(`[aria-label="${label}"]`)?.getAttribute('aria-disabled') !== 'true', await card.getAttribute('aria-label'));
  const from = await card.boundingBox(), to = await page.locator('.keeper-dock').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + 35); await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await settle(page); await page.mouse.up();
}

test('Keeper dock accepts Library artwork, releases/returns, persists, undoes and shares the Visitor runtime', { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await addDock(page);
    const dock = page.locator('.keeper-dock-window'), instance = page.locator('.keeper-instance'), actor = page.locator('.keeper-roamer');
    const created = await dock.boundingBox(); assert.ok(Math.abs(created.x - 600) < 1 && Math.abs(created.y - 280) < 1);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await drop(page);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
    assert.equal((await page.evaluate(() => window.savedDraft().keeperDocks)).length, 1);
    assert.equal(await page.locator('.image-module').count(), 0, 'dock consumes drop instead of creating Image');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    const sizeInput = page.getByRole('spinbutton', { name: 'Keeper size', exact: true });
    assert.equal(await sizeInput.inputValue(), '192');
    await sizeInput.fill('256'); await sizeInput.press('Enter');
    await page.waitForFunction(() => window.savedDraft().keeperDocks[0].size === 256);
    const before = await page.evaluate(() => window.savedDraft());
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    await page.mouse.move(700, 480);
    await page.waitForFunction(() => {
      const node = document.querySelector('.keeper-roamer img'), r = node?.getBoundingClientRect();
      return r && r.x > 730 && r.y > 320;
    });
    assert.equal(await instance.getAttribute('data-keeper-phase'), 'free');
    assert.equal(await actor.evaluate(node => getComputedStyle(node).pointerEvents), 'none');
    assert.equal(await actor.locator('img').evaluate(node => getComputedStyle(node).width), '256px');
    // A child that stops bubbling (including while dragging) cannot hide the pointer.
    const facing = await page.evaluate(() => {
      const actor = document.querySelector('.keeper-roamer'), host = document.querySelector('main.system-workflow');
      const child = document.createElement('div'); host.append(child);
      child.addEventListener('pointermove', event => event.stopPropagation());
      const rect = actor.getBoundingClientRect(), values = [];
      for (const x of [rect.x - 1, rect.x + 1]) {
        child.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: rect.y + 150, buttons: 1 }));
        values.push(actor.style.getPropertyValue('--keeper-facing'));
      }
      child.remove(); return values;
    });
    assert.deepEqual(facing, ['-1', '1'], 'pointer crossings change the flip target within the pointer event');
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), before, 'motion makes no authored writes');
    await sizeInput.fill('320'); await sizeInput.press('Enter');
    assert.equal(await instance.getAttribute('data-keeper-phase'), 'free', 'size edits do not recall the creature');
    assert.equal(await actor.locator('img').evaluate(node => getComputedStyle(node).width), '320px');
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.savedDraft().keeperDocks[0].size === 256);
    assert.equal(await instance.getAttribute('data-keeper-phase'), 'free');
    await page.screenshot({ path: '.browser-test-runtime/keeper-wide.png' });
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.keeper-instance')?.dataset.keeperPhase === 'docked');
    // Keyboard movement uses the existing Workbench host and its layout cache.
    const handle = dock.getByLabel('Move Keeper dock window');
    await handle.focus(); await handle.press('ArrowRight'); await settle(page);
    const moved = await dock.boundingBox(); assert.ok(moved.x > created.x);
    await page.getByLabel('Include in publication', { exact: true }).check();
    await page.reload(); await mountTextToolsFixture(page, origin); await dock.waitFor();
    assert.equal(await instance.getAttribute('data-keeper-phase'), 'docked');
    assert.ok(Math.abs((await dock.boundingBox()).x - moved.x) < 1);
    assert.equal(await page.evaluate(() => window.savedDraft().keeperDocks[0].size), 256);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    await sizeInput.fill('384'); await sizeInput.press('Enter');
    await page.setViewportSize({ width: 390, height: 844 }); await page.mouse.move(190, 430);
    await page.waitForFunction(() => { const r = document.querySelector('.keeper-roamer img')?.getBoundingClientRect(); return r && r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight; });
    await page.screenshot({ path: '.browser-test-runtime/keeper-narrow.png' });
    assert.equal(await page.evaluate(() => window.savedDraft().keeperDocks[0].size), 384, 'narrow viewport does not rewrite size');
    assert.ok(await actor.locator('img').evaluate(node => parseFloat(getComputedStyle(node).width) < 384));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.keeper-instance')?.dataset.keeperPhase === 'docked');
    await page.getByRole('button', { name: 'Delete dock', exact: true }).click();
    assert.equal(await dock.count(), 0);
    await page.keyboard.press('Control+z'); await dock.waitFor();
    assert.equal(await instance.getAttribute('data-keeper-phase'), 'docked');
    await page.reload(); await mountTextToolsFixture(page, origin, { visitor: true });
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
    assert.equal(await page.locator('.keeper-tools').count(), 0);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).waitFor();
    assert.equal(await actor.locator('img').evaluate(node => getComputedStyle(node).width), '384px');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.keeper-instance')?.dataset.keeperPhase === 'docked');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Keeper reduced motion is stationary, failed saves retain the inhabitant, and unavailable artwork retries', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    await mountTextToolsFixture(page, origin);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click(); await addDock(page);
    await page.getByRole('button', { name: 'Library', exact: true }).click(); await drop(page);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
    const before = await page.evaluate(() => window.savedDraft());
    await page.evaluate(() => { window.failSave = true; }); await drop(page, 'SKULL REAPER');
    await page.getByText('The Keeper dock was not saved. Try again.', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), before);
    await page.evaluate(() => { window.failSave = false; });
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    const release = page.getByRole('button', { name: 'Release Keeper', exact: true });
    await release.click(); await settle(page);
    const position = await page.locator('.keeper-roamer').evaluate(node => node.style.transform);
    await page.mouse.move(1200, 800, { steps: 12 }); await settle(page);
    assert.equal(await page.locator('.keeper-roamer').evaluate(node => node.style.transform), position);
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).click();
    assert.equal(await page.locator('.keeper-instance').getAttribute('data-keeper-phase'), 'docked');
    await page.getByRole('button', { name: 'Empty dock', exact: true }).click();
    assert.equal(await page.locator('.keeper-roamer').count(), 0);
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z'); await release.waitFor();
    // Persist a valid but temporarily unavailable source in this isolated browser profile.
    await page.evaluate(async () => {
      const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const draft = window.savedDraft(); draft.keeperDocks[0].asset.media.url = 'https://keepers.inscape.test/art.webp';
      localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
    });
    await page.reload(); await mountTextToolsFixture(page, origin);
    await page.getByRole('button', { name: 'Retry Keeper artwork', exact: true }).waitFor();
    await page.route('https://keepers.inscape.test/art.webp', route => route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/abyssal_eye/full.webp' }));
    await page.getByRole('button', { name: 'Retry Keeper artwork', exact: true }).click();
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.keeper-roamer img')?.naturalWidth > 0);
  } finally { await browser.close(); }
});

test('Deleting a dock cancels its delayed Library result; undo cannot revive that pending assignment', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    await mountTextToolsFixture(page, origin, { beforeImports: () => page.route('**/resolveLibraryImageAsset.js*', async route => {
      const response = await route.fetch(), body = (await response.text()).replace('const id = input',
        'if (globalThis.holdKeeperAsset) await new Promise(resolve => { globalThis.releaseKeeperAsset = resolve; });\n  const id = input');
      await route.fulfill({ response, body });
    }) });
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click(); await addDock(page);
    await page.evaluate(() => { window.holdKeeperAsset = true; });
    await page.getByRole('button', { name: 'Library', exact: true }).click(); await drop(page);
    await page.waitForFunction(() => typeof window.releaseKeeperAsset === 'function');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'Delete dock', exact: true }).click();
    await page.keyboard.press('Control+z'); await page.locator('.keeper-dock-window').waitFor();
    await page.evaluate(() => window.releaseKeeperAsset()); await settle(page);
    assert.equal(await page.evaluate(() => window.savedDraft().keeperDocks[0].asset), null);
    assert.equal(await page.locator('.keeper-roamer').count(), 0);
  } finally { await browser.close(); }
});
