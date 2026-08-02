import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const PORT = 4178;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 900, height: 720 },
  { width: 760, height: 720 },
  { width: 640, height: 720 },
  { width: 520, height: 720 },
  { width: 390, height: 844 },
];

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/development/owner/modul-8r`);
      if (response.ok) return;
    } catch { /* Vite is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the MODUL-8R development server');
}

test('Task 2 shell interaction, responsive containment and accepted-prototype geometry', { timeout: 120_000 }, async () => {
  assert.equal(existsSync(EDGE), true, 'Microsoft Edge is required for the focused browser check');
  const server = spawn(process.execPath, [
    'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort',
  ], { cwd: process.cwd(), stdio: 'ignore', windowsHide: true });
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ executablePath: EDGE, headless: true });
    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
    await page.goto(`${ORIGIN}/development/owner/modul-8r`, { waitUntil: 'networkidle' });

    const expectedOrder = ['LIBRARY', 'ACTIVITY', 'PEOPLE', 'LAYERS'];
    assert.deepEqual(await page.locator('.modul8r-module__toggle strong').allTextContents(), expectedOrder);
    assert.deepEqual(await page.locator('.modul8r-module__faceplate').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height)), [60, 38, 38, 38]);
    assert.equal(await page.locator('.modul8r-module[data-expanded]').count(), 1);

    const prototype = await browser.newPage({ viewport: VIEWPORTS[0] });
    await prototype.goto(`${ORIGIN}/prototype/modul-8r`, { waitUntil: 'networkidle' });
    for (const viewport of VIEWPORTS) {
      await prototype.setViewportSize(viewport);
      assert.deepEqual(await prototype.locator('.m8-faceplate__identity strong').allTextContents(), expectedOrder);
      assert.deepEqual(await prototype.locator('.m8-faceplate').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height)), [38, 38, 38, 38]);
      assert.equal(await prototype.locator('.m8-master').evaluate((node) => node.getBoundingClientRect().height), 38);
      assert.equal(await prototype.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
    }
    await page.setViewportSize(VIEWPORTS[0]);
    assert.equal(await page.locator('.modul8r-master').evaluate((node) => node.getBoundingClientRect().height), 38);
    await prototype.close();

    const masterTitlePresentation = await page.getByRole('button', { name: 'MODUL-8R' }).evaluate((button) => {
      const title = button.querySelector('span');
      const style = getComputedStyle(title);
      const rectangle = title.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(title);
      const textRectangle = range.getBoundingClientRect();
      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        opacity: style.opacity,
        rectangle: { height: rectangle.height, left: rectangle.left, top: rectangle.top, width: rectangle.width },
        text: title.textContent,
        textRectangle: { height: textRectangle.height, left: textRectangle.left, top: textRectangle.top, width: textRectangle.width },
        visibility: style.visibility,
      };
    });
    assert.equal(masterTitlePresentation.text, 'MODUL-8R');
    assert.equal(masterTitlePresentation.color, 'rgb(216, 215, 210)');
    assert.equal(masterTitlePresentation.fontSize, '12px');
    assert.match(masterTitlePresentation.fontFamily, /Inscape IBM Plex Mono/);
    assert.equal(masterTitlePresentation.opacity, '1');
    assert.equal(masterTitlePresentation.visibility, 'visible');
    assert.ok(masterTitlePresentation.textRectangle.width > 60 && masterTitlePresentation.textRectangle.height > 8);
    const moduleLabelLeft = (await page.locator('.modul8r-module__toggle strong').first().boundingBox()).x;
    assert.ok(Math.abs(masterTitlePresentation.textRectangle.left - moduleLabelLeft) < 0.5, 'master title must share the module-label text column');

    const activity = page.getByRole('button', { name: 'ACTIVITY' });
    const activityBox = await activity.boundingBox();
    await page.mouse.click(activityBox.x + activityBox.width - 12, activityBox.y + 19);
    assert.equal(await page.locator('.modul8r-modules').evaluate((node) => getComputedStyle(node).overflow), 'hidden');
    await page.waitForTimeout(280);
    assert.equal(await page.locator('.modul8r-module[data-expanded]').getAttribute('data-module'), 'activity');
    await activity.click();
    await page.waitForTimeout(280);
    assert.equal(await page.locator('.modul8r-module[data-expanded]').count(), 0);
    await page.getByRole('button', { name: 'PEOPLE' }).click();
    await page.waitForTimeout(280);

    await page.getByRole('button', { name: 'MODUL-8R' }).click();
    await page.waitForTimeout(220);
    assert.ok((await page.locator('.modul8r-shell').boundingBox()).height <= 40);
    assert.equal(await page.locator('.modul8r-module[data-expanded]').getAttribute('data-module'), 'people');
    await page.getByRole('button', { name: 'MODUL-8R' }).click();
    await page.waitForTimeout(220);
    assert.equal(await page.locator('.modul8r-module[data-expanded]').getAttribute('data-module'), 'people');

    const masterTitle = page.getByRole('button', { name: 'MODUL-8R' });
    const shellBeforeTitleDrag = await page.locator('.modul8r-shell').boundingBox();
    const masterTitleBox = await masterTitle.boundingBox();
    await page.mouse.move(masterTitleBox.x + 56, masterTitleBox.y + 19);
    await page.mouse.down();
    await page.mouse.move(masterTitleBox.x + 84, masterTitleBox.y + 31);
    await page.mouse.up();
    const shellAfterTitleDrag = await page.locator('.modul8r-shell').boundingBox();
    assert.ok(shellAfterTitleDrag.x > shellBeforeTitleDrag.x && shellAfterTitleDrag.y > shellBeforeTitleDrag.y);
    assert.equal(await page.locator('.modul8r-shell').getAttribute('data-collapsed'), null);
    assert.equal(await page.locator('.modul8r-module[data-expanded]').getAttribute('data-module'), 'people');

    await masterTitle.click();
    await page.waitForTimeout(220);
    assert.ok((await page.locator('.modul8r-shell').boundingBox()).height <= 40, 'the first ordinary click after title drag must collapse');
    await masterTitle.click();
    await page.waitForTimeout(220);

    const interruptTitleGesture = async (eventType, pointerId) => {
      await masterTitle.evaluate((button, parameters) => {
        button.setPointerCapture = () => {};
        button.hasPointerCapture = () => true;
        button.releasePointerCapture = () => {};
        const rectangle = button.getBoundingClientRect();
        const event = (type, x, y) => button.dispatchEvent(new PointerEvent(type, {
          bubbles: true, button: 0, clientX: x, clientY: y, pointerId: parameters.pointerId,
        }));
        event('pointerdown', rectangle.left + 48, rectangle.top + 19);
        event('pointermove', rectangle.left + 72, rectangle.top + 31);
        event(parameters.eventType, rectangle.left + 72, rectangle.top + 31);
      }, { eventType, pointerId });
      const positionAfterInterrupt = await page.locator('.modul8r-shell').boundingBox();
      await masterTitle.evaluate((button, parameters) => {
        const rectangle = button.getBoundingClientRect();
        button.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, button: 0, clientX: rectangle.left + 140, clientY: rectangle.top + 35,
          pointerId: parameters.pointerId,
        }));
      }, { pointerId });
      const positionAfterStrayMove = await page.locator('.modul8r-shell').boundingBox();
      assert.equal(Math.round(positionAfterStrayMove.x), Math.round(positionAfterInterrupt.x), `${eventType} left a stale move gesture`);
      assert.equal(Math.round(positionAfterStrayMove.y), Math.round(positionAfterInterrupt.y), `${eventType} left a stale move gesture`);
      await masterTitle.evaluate((button) => button.click());
      await page.waitForTimeout(220);
      assert.ok((await page.locator('.modul8r-shell').boundingBox()).height <= 40, `${eventType} left stale click suppression`);
      await masterTitle.click();
      await page.waitForTimeout(220);
    };
    await interruptTitleGesture('pointercancel', 71);
    await interruptTitleGesture('lostpointercapture', 72);

    await page.getByRole('button', { name: 'Close Modulator' }).click();
    const closeReopen = page.getByRole('button', { name: 'OPEN MODUL-8R' });
    await closeReopen.waitFor();
    assert.equal(await page.locator('.modul8r-shell').count(), 0);
    await closeReopen.click();
    await page.locator('.modul8r-shell').waitFor();

    const resize = page.getByRole('separator', { name: 'Resize Modulator width' });
    const widthBeforeKey = (await page.locator('.modul8r-shell').boundingBox()).width;
    await resize.focus();
    await resize.press('ArrowLeft');
    const widthAfterKey = (await page.locator('.modul8r-shell').boundingBox()).width;
    assert.equal(Math.round(widthBeforeKey - widthAfterKey), 24);
    const resizeBox = await resize.boundingBox();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 48, resizeBox.y + resizeBox.height / 2);
    await page.mouse.up();
    assert.equal(Math.round((await page.locator('.modul8r-shell').boundingBox()).width - widthAfterKey), 48);

    const shellBeforeMove = await page.locator('.modul8r-shell').boundingBox();
    await page.mouse.move(shellBeforeMove.x + Math.min(shellBeforeMove.width - 70, 360), shellBeforeMove.y + 19);
    await page.mouse.down();
    await page.mouse.move(shellBeforeMove.x + Math.min(shellBeforeMove.width - 70, 360) + 18, shellBeforeMove.y + 31);
    await page.mouse.up();
    const shellAfterMove = await page.locator('.modul8r-shell').boundingBox();
    assert.ok(shellAfterMove.x >= 10 && shellAfterMove.y >= 10);

    const themeColors = new Set();
    for (const theme of ['carbon', 'graphite', 'slate', 'ash', 'mist', 'paper']) {
      await page.getByLabel('THEME').selectOption(theme);
      themeColors.add(await page.locator('.modul8r-shell').evaluate((node) => getComputedStyle(node).backgroundColor));
    }
    assert.equal(themeColors.size, 6);
    await page.getByLabel('REDUCED MOTION').check();
    assert.equal(await page.locator('.modul8r-module__reveal').first().evaluate((node) => getComputedStyle(node).transitionDuration), '0.001s');

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(50);
      const box = await page.locator('.modul8r-shell').boundingBox();
      assert.ok(box.x >= 9.5 && box.y >= 9.5, `shell origin escaped ${viewport.width}x${viewport.height}`);
      assert.ok(box.x + box.width <= viewport.width - 9.5, `shell width escaped ${viewport.width}x${viewport.height}`);
      assert.ok(box.y + box.height <= viewport.height - 9.5, `shell height escaped ${viewport.width}x${viewport.height}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight), true);
    }

    if (process.env.MODUL8R_REVIEW_DIR) {
      const reviewDirectory = resolve(process.env.MODUL8R_REVIEW_DIR);
      await mkdir(reviewDirectory, { recursive: true });
      await page.setViewportSize(VIEWPORTS[0]);
      await page.goto(`${ORIGIN}/development/owner/modul-8r`, { waitUntil: 'networkidle' });
      for (const theme of ['carbon', 'graphite', 'slate', 'ash', 'mist', 'paper']) {
        await page.getByLabel('THEME').selectOption(theme);
        await page.screenshot({ path: resolve(reviewDirectory, `shell-theme-${theme}.png`) });
      }
      await page.getByLabel('THEME').selectOption('carbon');
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.screenshot({ path: resolve(reviewDirectory, `shell-${viewport.width}x${viewport.height}.png`) });
      }
    }

    await page.getByRole('button', { name: 'PEOPLE' }).focus();
    await page.keyboard.press('Escape');
    const reopen = page.getByRole('button', { name: 'OPEN MODUL-8R' });
    await reopen.waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent === 'OPEN MODUL-8R');
    assert.equal(await reopen.evaluate((node) => document.activeElement === node), true);
  } finally {
    await browser?.close();
    server.kill();
  }
});
