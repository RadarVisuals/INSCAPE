import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const draft = page => page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)));
const groups = async page => (await draft(page)).workbenchGroups || [];
const camera = page => page.locator('main.system-workflow').first().evaluate(host => ({
  scale: host.dataset.workbenchCameraScale || '1', x: host.dataset.workbenchCameraX || '0', y: host.dataset.workbenchCameraY || '0',
}));
const choose = async (page, ids) => {
  await page.locator('main.system-workflow').first().focus(); await page.keyboard.press('Escape');
  for (const id of ids) await page.locator(`[data-workbench-view-id="${id}"]`).evaluate(node => {
    const target = node.matches('[data-workbench-selectable]') ? node : node.querySelector('[data-workbench-selectable]');
    target.focus({ preventScroll: true }); target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
  });
  await settle(page);
};
const withoutGroups = value => { const { workbenchGroups, ...other } = value; return other; };

test('owner groups preserve the camera and artwork through editing, undo, movement, cancellation and reload', { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, heavy: true, count: 2, displayWidth: 600, textModes: true });
      await page.getByRole('button', { name: 'Workbench groups', exact: true }).waitFor();
      await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
      await page.evaluate(() => document.fonts.ready); await settle(page);
      await page.locator('main.system-workflow').first().dispatchEvent('wheel', { deltaX: -160, deltaY: 80, bubbles: true, cancelable: true });
      await settle(page);
      const before = await draft(page), initialCamera = await camera(page);
      await page.evaluate(() => { window.groupModuleNodes = [...document.querySelectorAll('[data-workbench-view-id]')]; });
      await choose(page, ['image:motion-0', 'image:motion-1']);
      await page.getByRole('button', { name: 'Workbench groups', exact: true }).click();
      const panel = page.locator('[data-workbench-group-tools]');
      await panel.getByRole('textbox', { name: 'Group name', exact: true }).fill('Lunar Desert');
      await panel.getByRole('button', { name: 'Create from selection', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem(window.__motionKey)).workbenchGroups?.length === 1);
      assert.deepEqual((await groups(page))[0].memberIds, ['image:motion-0', 'image:motion-1']);
      assert.deepEqual(withoutGroups(await draft(page)), before);
      assert.deepEqual(await camera(page), initialCamera);
      await panel.getByRole('textbox', { name: 'Group name', exact: true }).fill('Chapter one');
      await panel.getByRole('button', { name: 'Rename', exact: true }).click();
      await choose(page, ['image:motion-2']);
      await panel.getByRole('button', { name: 'Add selection (1)', exact: true }).click();
      const rows = panel.locator('.workbench-groups__members li');
      await rows.nth(2).locator('button').nth(0).click();
      assert.deepEqual((await groups(page))[0].memberIds, ['image:motion-0', 'image:motion-2', 'image:motion-1']);
      await rows.nth(2).locator('button').nth(2).click();
      assert.equal((await groups(page))[0].memberIds.length, 2);
      await panel.getByRole('button', { name: 'Undo', exact: true }).click();
      assert.equal((await groups(page))[0].memberIds.length, 3);
      await panel.getByRole('button', { name: 'Redo', exact: true }).click();
      assert.equal((await groups(page))[0].memberIds.length, 2);
      const authored = await draft(page);
      await panel.getByRole('button', { name: 'Ungroup', exact: true }).click();
      assert.equal((await groups(page)).length, 0);
      assert.deepEqual(withoutGroups(await draft(page)), withoutGroups(authored));
      await panel.getByRole('button', { name: 'Undo', exact: true }).click();
      await panel.locator('[data-workbench-group-drop]').first().click();
      await panel.getByRole('button', { name: 'Select members', exact: true }).click();
      const selection = page.locator('.workbench-selection');
      await selection.focus(); await selection.press('Alt+ArrowRight'); await settle(page);
      const moved = await draft(page);
      for (const id of ['image:motion-0', 'image:motion-2']) {
        const initial = authored.workbench.imageModules.find(item => item.id === id).position;
        const position = moved.workbench.imageModules.find(item => item.id === id).position;
        assert.equal(position.left, initial.left + 1);
      }
      assert.deepEqual(moved.imageModules, authored.imageModules);
      await panel.getByRole('button', { name: 'Undo', exact: true }).click(); await settle(page);
      assert.deepEqual((await draft(page)).workbench, authored.workbench);
      await panel.getByRole('button', { name: 'New group', exact: true }).click();
      await panel.getByRole('textbox', { name: 'Group name', exact: true }).fill('Another chapter');
      await panel.getByRole('button', { name: 'Create empty', exact: true }).click();
      assert.deepEqual((await groups(page))[1].memberIds, []);
      await choose(page, ['image:motion-3', 'image:motion-4']);
      if (width > 1000) {
        const bounds = await selection.boundingBox(), target = await panel.locator('[data-workbench-group-drop]').nth(1).boundingBox();
        const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
        const saved = await draft(page);
        await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 8 });
        assert.equal(await panel.locator('[data-drop-target]').count(), 1);
        await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
        assert.deepEqual(await draft(page), saved, 'cancelled drop changes neither membership nor layout');
        await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 8 }); await page.mouse.up();
        assert.deepEqual((await groups(page))[1].memberIds, ['image:motion-3', 'image:motion-4']);
        assert.deepEqual(withoutGroups(await draft(page)), withoutGroups(saved));
      } else await panel.getByRole('button', { name: 'Add selection (2)', exact: true }).click();
      assert.deepEqual(await camera(page), initialCamera);
      await page.screenshot({ path: `.browser-test-runtime/workbench-groups-${width}.png` });
      const savedGroups = await groups(page);
      assert.equal(await page.evaluate(() => window.groupModuleNodes.every(node => node.isConnected)), true, 'group editing preserves live module identity');
      await page.evaluate(() => window.__motionRemount());
      await page.getByRole('button', { name: 'Workbench groups', exact: true }).click();
      assert.deepEqual(await groups(page), savedGroups);
      await panel.locator('[data-workbench-group-drop]').first().click();
      assert.equal(await page.locator('.workbench-selection').count(), 1);
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('Visitor has no group authoring tools', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    await mountGridMotionFixture(page, { origin, visitor: true });
    await page.getByRole('button', { name: 'Focus selected Workbench modules', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Workbench groups', exact: true }).count(), 0);
  } finally { await browser.close(); }
});
