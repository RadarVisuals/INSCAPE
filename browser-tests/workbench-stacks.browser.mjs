import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const saved = page => page.evaluate(() => localStorage.getItem(window.__motionKey));
const settle = page => page.waitForFunction(() => !document.querySelector('main.system-workflow').hasAttribute('data-workbench-travelling'));
const camera = page => page.locator('main.system-workflow').first().evaluate(node => [node.dataset.workbenchCameraScale || '1', node.dataset.workbenchCameraX || '0', node.dataset.workbenchCameraY || '0']);

test('compact groups move and cancel independently, open live members, return, undo and reload at wide/narrow sizes', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  await mkdir('.browser-test-runtime', { recursive: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 320, seamReview: 'single' });
      await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
      await page.evaluate(() => {
        const draft = JSON.parse(localStorage.getItem(window.__motionKey));
        draft.workbench.imageModules[0].position = { left: 48, top: 240 };
        draft.workbench.imageModules[1].position = { left: 220, top: 400 };
        draft.workbenchGroups = [{ id: 'workbench-group:chapter', name: 'Chapter one', memberIds: ['image:motion-0', 'image:motion-1'] }];
        localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__motionRemount();
      });
      await page.getByRole('button', { name: 'Workbench groups', exact: true }).click();
      const panel = page.locator('.workbench-groups');
      await panel.locator('[data-workbench-group-drop]').click();
      const before = JSON.parse(await saved(page)), originalCamera = await camera(page);
      await page.evaluate(() => { window.stackNodes = [...document.querySelectorAll('[data-workbench-view-id]')]; });
      await panel.getByRole('button', { name: 'Stack', exact: true }).click();
      const stack = page.locator('[data-workbench-stack]'); await stack.waitFor();
      assert.equal(await page.locator('[data-workbench-group-hidden]').count(), 2);
      const stacked = JSON.parse(await saved(page));
      assert.deepEqual(stacked.workbench, before.workbench); assert.deepEqual(stacked.imageModules, before.imageModules);
      assert.deepEqual(await camera(page), originalCamera);
      await panel.getByRole('button', { name: 'Close Workbench groups', exact: true }).click();
      const grip = stack.getByRole('button', { name: 'Move Chapter one group', exact: true });
      await grip.focus(); await grip.press('Shift+ArrowRight');
      assert.equal(JSON.parse(await saved(page)).workbenchGroups[0].position.left, stacked.workbenchGroups[0].position.left + 10);
      const moved = await saved(page);
      const box = await grip.boundingBox();
      await page.mouse.move(box.x + 12, box.y + 12); await page.mouse.down(); await page.mouse.move(box.x + 70, box.y + 65, { steps: 6 });
      await page.keyboard.press('Escape'); await page.mouse.up(); assert.equal(await saved(page), moved);
      await stack.getByRole('button', { name: 'Open Chapter one group', exact: true }).click(); await settle(page);
      assert.equal(await page.locator('[data-workbench-group-hidden]').count(), 0);
      assert.ok(await page.locator('[data-workbench-group-muted]').count() > 0);
      assert.equal(await saved(page), moved);
      await page.screenshot({ path: '.browser-test-runtime/workbench-stack-open-' + width + '.png' });
      await page.getByRole('group', { name: 'Workbench zoom', exact: true }).getByRole('button', { name: 'Back to previous Workbench view', exact: true }).click(); await settle(page);
      await stack.waitFor(); assert.deepEqual(await camera(page), originalCamera);
      assert.equal(await page.locator('[data-workbench-group-hidden]').count(), 2);
      assert.equal(await page.evaluate(() => window.stackNodes.every(node => node.isConnected)), true);
      await page.getByRole('button', { name: 'Workbench groups', exact: true }).click();
      await panel.getByRole('button', { name: 'Undo', exact: true }).click();
      assert.deepEqual(JSON.parse(await saved(page)).workbenchGroups, stacked.workbenchGroups);
      await panel.getByRole('button', { name: 'Redo', exact: true }).click();
      assert.equal(await saved(page), moved);
      await page.evaluate(() => window.__motionRemount()); await stack.waitFor();
      assert.equal(await page.locator('[data-workbench-group-hidden]').count(), 2);
      assert.equal(await saved(page), moved);
      await page.screenshot({ path: '.browser-test-runtime/workbench-stack-compact-' + width + '.png' });
      await stack.getByRole('button', { name: 'Manage Chapter one group', exact: true }).click();
      await panel.getByRole('button', { name: 'Unstack', exact: true }).click();
      assert.equal(await page.locator('[data-workbench-group-hidden]').count(), 0);
      assert.deepEqual(JSON.parse(await saved(page)).workbench, before.workbench);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('mixed groups preserve live editors and saved geometry through reading, inspection, interruption and reset', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: width === 390 ? 2 : 1 });
      page.setDefaultTimeout(15000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 480, textModes: true, heavy: true });
      await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
      await page.evaluate(() => {
        const draft = JSON.parse(localStorage.getItem(window.__motionKey));
        draft.workbenchGroups = [{ id: 'workbench-group:mixed', name: 'Mixed study', memberIds: ['image:motion-0', 'text:overflow', 'display:primary'], position: { left: 80, top: 300 } }];
        localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__motionRemount();
      });
      const stack = page.locator('[data-workbench-stack]'); await stack.waitFor();
      await page.waitForFunction(() => document.querySelector('[data-workbench-view-id="text:overflow"] .tiptap'));
      const initial = await saved(page);
      await page.evaluate(() => { window.mixedNodes = [...document.querySelectorAll('[data-workbench-view-id], .tiptap')]; });
      const closeTools = page.getByRole('button', { name: 'Close Text tools', exact: true });
      if (await closeTools.isVisible()) await closeTools.click();
      const open = async () => { await stack.getByRole('button', { name: 'Open Mixed study group', exact: true }).click(); await settle(page); };
      await open();
      const nav = page.getByRole('group', { name: 'Open Workbench group', exact: true });
      const select = nav.getByRole('combobox', { name: 'Group item', exact: true });
      const reading = page.locator('[data-workbench-view-id="text:overflow"]');
      assert.equal(await reading.locator('.tiptap').getAttribute('contenteditable'), 'false');
      await select.selectOption('text:overflow'); await settle(page);
      assert.equal(await saved(page), initial);
      const reader = reading.locator('.text-viewport').first();
      const scrollable = await reading.evaluate(node => [...node.querySelectorAll('*')].find(child => /auto|scroll/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight + 1)?.className);
      assert.ok(scrollable, 'long articles retain a native scroll container');
      const beforeScroll = await camera(page);
      await reading.evaluate(node => {
        const child = [...node.querySelectorAll('*')].find(child => /auto|scroll/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight + 1);
        child.scrollTop = 80; child.dispatchEvent(new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true }));
      });
      assert.deepEqual(await camera(page), beforeScroll);
      // Presented hosts cannot turn movement keys or drags into authored edits.
      const header = reading.locator('header').first(); await header.focus(); await header.press('ArrowRight');
      assert.equal(await saved(page), initial);
      const image = page.locator('[data-workbench-view-id="image:motion-0"]');
      await select.selectOption('image:motion-0'); await settle(page);
      const imageBox = await image.boundingBox();
      await page.mouse.move(imageBox.x + 15, imageBox.y + 15); await page.mouse.down(); await page.mouse.move(imageBox.x + 70, imageBox.y + 60, { steps: 5 }); await page.mouse.up();
      // A click may inspect; close the module-owned inspector before Back.
      const closeInspection = page.getByRole('button', { name: /Close inspection|Close image|Close viewer|Return Image/i }).first();
      if (await closeInspection.isVisible()) await closeInspection.click();
      await page.keyboard.press('Escape'); await settle(page);
      assert.equal(await saved(page), initial);
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page); await stack.waitFor();
      assert.equal(await page.locator('[data-workbench-group-presented]').count(), 0);
      assert.equal(await page.evaluate(() => window.mixedNodes.every(node => node.isConnected)), true);
      assert.equal(await reading.locator('.tiptap').getAttribute('contenteditable'), 'true');
      // Manual input interrupts travel without abandoning the open group.
      await stack.getByRole('button', { name: 'Open Mixed study group', exact: true }).click();
      await page.waitForTimeout(80);
      await page.locator('main.system-workflow').first().dispatchEvent('wheel', { deltaX: 20, deltaY: 10, bubbles: true, cancelable: true }); await settle(page);
      assert.equal(await page.locator('[data-workbench-group-presented]').count(), 3);
      await nav.getByRole('button', { name: 'Back', exact: true }).click(); await settle(page); await stack.waitFor();
      assert.equal(await saved(page), initial);
      await open(); await select.selectOption('display:primary'); await settle(page);
      await page.screenshot({ path: '.browser-test-runtime/workbench-group-mixed-' + width + '.png' });
      await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click(); await settle(page); await stack.waitFor();
      assert.equal(await saved(page), initial);
      assert.equal(await page.evaluate(() => window.mixedNodes.every(node => node.isConnected)), true);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('spatial stack drops clear hidden selection and named routes restore item and overview context', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 320 });
    await page.evaluate(() => {
      const draft = JSON.parse(localStorage.getItem(window.__motionKey));
      draft.workbench.imageModules[0].position = { left: 80, top: 240 };
      draft.workbenchGroups = [
        { id: 'workbench-group:a', name: 'First route', memberIds: ['image:motion-1'], position: { left: 500, top: 240 } },
        { id: 'workbench-group:b', name: 'Second route', memberIds: ['image:motion-2'], position: { left: 800, top: 240 } },
      ];
      localStorage.setItem(window.__motionKey, JSON.stringify(draft)); window.__motionRemount();
    });
    const stack = page.locator('[data-workbench-stack="workbench-group:a"]'); await stack.waitFor();
    const initial = JSON.parse(await saved(page));
    await page.locator('[data-workbench-view-id="image:motion-0"]').evaluate(node => {
      const target = node.matches('[data-workbench-selectable]') ? node : node.querySelector('[data-workbench-selectable]');
      target.focus({ preventScroll: true }); target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
    });
    const selection = page.locator('.workbench-selection'); await selection.waitFor();
    const from = await selection.boundingBox(), to = await stack.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    assert.equal(await stack.getAttribute('data-drop-target'), 'true');
    await page.mouse.up();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem(window.__motionKey)).workbenchGroups[0].memberIds.length === 2);
    const dropped = JSON.parse(await saved(page));
    assert.deepEqual(dropped.workbench, initial.workbench);
    assert.equal(await selection.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).isDisabled(), true);
    const routes = page.getByRole('navigation', { name: 'Workbench destinations', exact: true });
    await routes.getByRole('button', { name: 'First route', exact: true }).click(); await settle(page);
    const overview = await camera(page);
    const items = routes.getByRole('combobox', { name: 'Group item', exact: true });
    await routes.getByRole('button', { name: 'Next group item', exact: true }).click(); await settle(page);
    assert.equal(await items.inputValue(), 'image:motion-1');
    assert.equal(await routes.getByRole('button', { name: 'Previous group item', exact: true }).isDisabled(), true);
    await routes.getByRole('button', { name: 'Next group item', exact: true }).click(); await settle(page);
    assert.equal(await items.inputValue(), 'image:motion-0');
    assert.equal(await routes.getByRole('button', { name: 'Next group item', exact: true }).isDisabled(), true);
    const itemCamera = await camera(page);
    await routes.getByRole('button', { name: 'Second route', exact: true }).click(); await settle(page);
    await routes.getByRole('button', { name: 'Back', exact: true }).click(); await settle(page);
    assert.equal(await items.inputValue(), 'image:motion-0'); assert.deepEqual(await camera(page), itemCamera);
    await routes.getByRole('button', { name: 'Back', exact: true }).click(); await settle(page);
    assert.equal(await items.inputValue(), ''); assert.deepEqual(await camera(page), overview);
    await routes.getByRole('button', { name: 'Back', exact: true }).click(); await settle(page); await stack.waitFor();
    assert.deepEqual(JSON.parse(await saved(page)), dropped);
  } finally { await browser.close(); }
});
