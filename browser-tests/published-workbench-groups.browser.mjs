import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const arrived = page => page.waitForFunction(() => !document.querySelector('[data-workbench-travelling]'));
const camera = page => page.locator('main.system-workflow').first().evaluate(node => [node.dataset.workbenchCameraScale || '1', node.dataset.workbenchCameraX || '0', node.dataset.workbenchCameraY || '0']);
const groups = [
  { id: 'workbench-group:study', name: 'Public study', memberIds: ['image:motion-0', 'text:overflow', 'image:motion-1'], visibility: 'PUBLIC', position: { left: 80, top: 300 } },
  { id: 'workbench-group:second', name: 'Second chapter', memberIds: ['display:primary', 'image:motion-2'], visibility: 'PUBLIC', position: { left: 460, top: 300 } },
  { id: 'workbench-group:private', name: 'Secret notebook', memberIds: ['image:motion-3'] },
  { id: 'workbench-group:empty', name: 'Private members only', memberIds: ['image:motion-4'], visibility: 'PUBLIC' },
];

test('published groups share browsing, reading and Back without owner tools or private membership', { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: width === 390 ? 2 : 1, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor: true, count: 1, displayWidth: 480, heavy: true, textModes: true,
        workbenchGroups: groups, privateModuleIds: ['image:motion-1', 'image:motion-4'] });
      const routes = page.getByRole('navigation', { name: 'Workbench destinations', exact: true }); await routes.waitFor();
      await page.waitForFunction(() => document.querySelectorAll('[data-workbench-group-hidden]').length === 4);
      const initial = await page.evaluate(() => ({ draft: localStorage.getItem(window.__motionKey), document: JSON.stringify(window.__motionDocument) }));
      for (const secret of ['Secret notebook', 'Private members only', 'image:motion-1', 'image:motion-4']) assert.equal(initial.document.includes(secret), false);
      assert.equal(await routes.getByRole('button', { name: 'Secret notebook', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Workbench groups', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Move Public study group', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Manage Public study group', exact: true }).count(), 0);
      assert.equal(await page.locator('[data-workbench-group-drop]').count(), 0);
      assert.equal(await page.locator('[data-workbench-stack="workbench-group:study"] .workbench-group-stack__grip span').textContent(), '2');
      const start = await camera(page);
      await page.evaluate(() => { window.publicGroupNodes = [...document.querySelectorAll('[data-workbench-view-id]')]; });
      await routes.getByRole('button', { name: 'Public study', exact: true }).click(); await arrived(page);
      assert.equal(await page.locator('[data-workbench-group-presented]').count(), 2);
      const overview = await camera(page), items = routes.getByRole('combobox', { name: 'Group item', exact: true });
      await items.selectOption('text:overflow'); await arrived(page);
      const readingView = await camera(page);
      const text = page.locator('[data-workbench-view-id="text:overflow"]');
      const overlap = await text.evaluate(node => {
        const article = node.getBoundingClientRect();
        return [...document.querySelectorAll('.workbench-group-stack[data-muted]')].flatMap(stack => {
          const other = stack.getBoundingClientRect();
          const left = Math.max(0, article.left, other.left), right = Math.min(innerWidth, article.right, other.right);
          const top = Math.max(0, article.top, other.top), bottom = Math.min(innerHeight, article.bottom, other.bottom);
          if (right - left < 4 || bottom - top < 4) return [];
          return [node.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2))];
        });
      });
      if (width === 1440) assert.ok(overlap.length > 0, 'fixture exercises a stack overlapping the reading area');
      assert.ok(overlap.every(Boolean), 'dimmed stacks stay behind the active article and cannot intercept reading');
      const scrolled = await text.evaluate(node => {
        const reader = [...node.querySelectorAll('*')].find(child => /auto|scroll/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight + 1);
        if (!reader) return false;
        reader.scrollTop = 80; reader.dispatchEvent(new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true })); return reader.scrollTop > 0;
      });
      assert.equal(scrolled, true); assert.deepEqual(await camera(page), readingView);
      await routes.getByRole('button', { name: 'Second chapter', exact: true }).click(); await arrived(page);
      assert.equal(await items.locator('option').count(), 3);
      await routes.getByRole('button', { name: 'Back', exact: true }).click(); await arrived(page);
      assert.equal(await items.inputValue(), 'text:overflow'); assert.deepEqual(await camera(page), readingView);
      await page.screenshot({ path: '.browser-test-runtime/published-group-reading-' + width + '.png' });
      await routes.getByRole('button', { name: 'Back', exact: true }).click(); await arrived(page);
      assert.deepEqual(await camera(page), overview);
      await routes.getByRole('button', { name: 'Back', exact: true }).click(); await arrived(page);
      assert.deepEqual(await camera(page), start);
      assert.equal(await page.evaluate(() => window.publicGroupNodes.every(node => node.isConnected)), true);
      assert.deepEqual(await page.evaluate(() => ({ draft: localStorage.getItem(window.__motionKey), document: JSON.stringify(window.__motionDocument) })), initial);
      await page.evaluate(() => window.__motionRemount()); await routes.waitFor();
      await page.waitForFunction(() => document.querySelectorAll('[data-workbench-group-hidden]').length === 4);
      assert.deepEqual(await camera(page), start);
      await page.screenshot({ path: '.browser-test-runtime/published-group-stacks-' + width + '.png' });
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});

test('owner group publication is explicit and undoable without changing content or window geometry', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await mountGridMotionFixture(page, { origin, count: 1, displayWidth: 400,
      workbenchGroups: [{ ...groups[0], visibility: 'PRIVATE', memberIds: ['image:motion-0'] }] });
    await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
    await page.getByRole('button', { name: 'Manage Public study group', exact: true }).click();
    const panel = page.locator('.workbench-groups'), sharing = panel.getByRole('checkbox', { name: 'Public group', exact: true });
    assert.equal(await sharing.isChecked(), false);
    const before = await page.evaluate(() => localStorage.getItem(window.__motionKey));
    await sharing.check(); assert.equal(await sharing.isChecked(), true);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)));
    assert.equal(after.workbenchGroups[0].visibility, 'PUBLIC');
    after.workbenchGroups[0].visibility = 'PRIVATE'; assert.deepEqual(after, JSON.parse(before));
    await panel.getByRole('button', { name: 'Undo', exact: true }).click(); assert.equal(await sharing.isChecked(), false);
    await panel.getByRole('button', { name: 'Redo', exact: true }).click(); assert.equal(await sharing.isChecked(), true);
    await panel.getByRole('button', { name: 'Close Workbench groups', exact: true }).click();
    await page.getByRole('button', { name: 'Open Public study group', exact: true }).click(); await arrived(page);
    await page.getByRole('button', { name: 'Workbench groups', exact: true }).click();
    await panel.getByRole('button', { name: 'Unstack', exact: true }).click();
    assert.equal(await page.locator('[data-workbench-group-presented]').count(), 0, 'Unstack resumes the authored view');
  } finally { await browser.close(); }
});
