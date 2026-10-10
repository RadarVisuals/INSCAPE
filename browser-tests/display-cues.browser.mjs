import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { activate, openDisplayTool } from './fixtures/display-controls.mjs';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const width of [1440, 390]) test(`Visitor metadata markers select one shared window without inspecting artwork at ${width}px`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      return route.fulfill({ contentType: route.request().resourceType() === 'image' ? 'image/svg+xml' : 'application/json',
        body: route.request().resourceType() === 'image'
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#602bc3"/></svg>' : '{"data":{}}' });
    });
    await page.goto(`${origin}/browser-tests/fixture.html`);
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    await board.waitFor();
    assert.equal(await page.locator('.display-inspection-cue').count(), 0);
    const before = await board.boundingBox();
    await openDisplayTool(page, board, 'METADATA');
    const metadata = page.locator('[data-shared-tool="metadata"]');
    const window = metadata.locator('xpath=ancestor::aside');
    const cue = board.getByRole('button', { name: 'Read metadata for Alpha Artwork 1', exact: true });
    await activate(page, cue);
    assert.match(await metadata.innerText(), /Alpha Artwork 1 public fixture description/);
    assert.match(await metadata.innerText(), /Published fixture collection/);
    assert.equal(await metadata.count(), 1);
    assert.equal(await board.getAttribute('data-inspecting'), null);
    assert.equal(await page.locator('.system-workflow__lift-artwork, .display-inspection-bubble').count(), 0);
    assert.deepEqual(await board.boundingBox(), before);
    const marker = await cue.boundingBox();
    await cue.focus(); await page.keyboard.press('ArrowLeft'); await settle(page);
    assert.deepEqual(await cue.boundingBox(), marker, 'Visitor cannot move metadata markers');
    const infoBounds = await window.boundingBox();
    assert.ok(infoBounds.x >= 0 && infoBounds.x + infoBounds.width <= width + 1);
    assert.ok(infoBounds.y >= 0 && infoBounds.y + infoBounds.height <= 900);
    await metadata.getByText('Source details', { exact: true }).click();
    assert.match(await metadata.innerText(), /TOKEN ID/);
    await page.screenshot({ path: `.browser-test-runtime/display-cue-${width}.png` });
    await page.getByRole('button', { name: 'Close Artwork info', exact: true }).click();
    assert.equal(await metadata.count(), 0);
    assert.equal(await board.locator('.display-inspection-cue').count(), 0);
    assert.deepEqual(await board.boundingBox(), before);
    assert.deepEqual(await page.evaluate(() => window.__visitorStorageOps.filter(item => ['setItem', 'removeItem', 'clear'].includes(item.method))), []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('owner marker movement and reset are temporary and independent of artwork geometry', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    const board = page.getByRole('article', { name: 'Display Module', exact: true });
    await openDisplayTool(page, board, 'METADATA');
    const cue = board.getByRole('button', { name: 'Read metadata for MOUNTAIN SIGNAL II', exact: true });
    await cue.waitFor();
    const source = board.getByRole('button', { name: 'Select MOUNTAIN SIGNAL II', exact: true });
    const artwork = await source.boundingBox(), before = await cue.boundingBox();
    await page.evaluate(() => { window.__cueWrites = 0; addEventListener('inscape:review-storage-write', event => {
      if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__cueWrites++;
    }); });
    await cue.focus(); await page.keyboard.press('ArrowLeft'); await settle(page);
    assert.ok((await cue.boundingBox()).x < before.x);
    const moved = await cue.boundingBox();
    await page.mouse.move(moved.x + 15, moved.y + 15); await page.mouse.down();
    await page.mouse.move(moved.x - 20, moved.y + 35, { steps: 5 }); await page.mouse.up(); await settle(page);
    assert.notDeepEqual(await cue.boundingBox(), moved);
    assert.deepEqual(await source.boundingBox(), artwork);
    assert.equal(await board.getAttribute('data-inspecting'), null);
    await cue.focus(); await page.keyboard.press('Home'); await settle(page);
    const reset = await cue.boundingBox();
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(reset[key] - before[key]) < 1);
    await activate(page, cue);
    assert.match(await page.locator('[data-shared-tool="metadata"]').locator('xpath=ancestor::aside').getAttribute('aria-label'), /MOUNTAIN SIGNAL II/);
    assert.equal(await board.getAttribute('data-inspecting'), null);
    assert.equal(await page.evaluate(() => window.__cueWrites), 0);
  } finally { await browser.close(); }
});
