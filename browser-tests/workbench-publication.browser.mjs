import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
test('published Workbench restores new Identity content, module layout and session-only interaction', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
    await mkdir(output, { recursive: true });
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request();
        if (new URL(request.url()).origin === origin) return route.continue();
        if (request.resourceType() === 'image') return route.fulfill({ status: 200, contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><path fill="#602bc3" d="M800 0 1600 900H0Z"/><circle fill="#121313" cx="800" cy="500" r="160"/></svg>' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
      });
      await page.goto(`${origin}/browser-tests/fixture.html?workbench=1`);
      const identity = page.locator('.identity-module');
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Edit Identity', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Layers', exact: true }).count(), 0);
      assert.equal(await page.locator('[aria-label="Display Module"]').count(), 0);
      await identity.locator('.identity-module__expand').click();
      await page.getByText('The Underneath', { exact: true }).waitFor();
      await page.screenshot({ path: `${output}/published-workbench-identity-${width}.png` });
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).click();
      await page.getByRole('button', { name: 'Open Lunar Desert', exact: true }).dblclick();
      const display = page.locator('[aria-label="Display Module"]');
      await display.waitFor();
      const bounds = await display.boundingBox();
      // Workbench windows retain authored coordinates even beyond the viewport.
      assert.equal(bounds.x, 40, JSON.stringify(bounds));
      assert.equal(bounds.y, 90, JSON.stringify(bounds));
      await page.screenshot({ path: `${output}/published-workbench-display-${width}.png` });
      await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-active-grid-id]')?.dataset.activeGridId === 'grid:alpha-archive');
      await display.locator('.system-workflow__identity-strip').focus();
      const minimize = page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true });
      const readHit = node => {
        const rect = node.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { rect: rect.toJSON(), exposed: node.contains(hit), hit: hit?.getAttribute('aria-label') || hit?.className || null };
      };
      const beforeMinimize = await minimize.evaluate(readHit);
      let cameraNavigation = null;
      if (width === 390) {
        // Keep controls at 100% while the temporary Visitor camera moves.
        assert.equal(await display.getAttribute('data-workbench-scale'), '1');
        const panPoint = await page.evaluate(() => {
          for (let y = 600; y > 200; y -= 20) for (let x = 40; x < innerWidth - 40; x += 20) {
            if (document.elementFromPoint(x, y)?.matches('main.system-workflow')) return { x, y };
          }
          throw Error('No exposed Visitor canvas for temporary camera panning');
        });
        const target = await minimize.boundingBox();
        cameraNavigation = { scale: 1, panPoint, deltaX: Math.max(0, target.x + target.width - (width - 60)) };
        await page.mouse.move(panPoint.x, panPoint.y);
        await page.mouse.wheel(cameraNavigation.deltaX, 0);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      await display.locator('.system-workflow__identity-strip').focus();
      const afterMinimize = await minimize.evaluate(readHit);
      await writeFile(`${output}/publication-minimize-${width}.json`, JSON.stringify({ beforeMinimize, cameraNavigation, afterMinimize }, null, 2));
      assert.equal(afterMinimize.exposed, true, 'temporary Visitor camera exposes the real minimize button');
      await page.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).click();
      await page.getByRole('button', { name: 'Profile', exact: true }).click();
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).waitFor();
      const writes = await page.evaluate(() => window.__visitorStorageOps.filter(({ method }) => ['setItem', 'removeItem', 'clear'].includes(method)));
      assert.deepEqual(writes, []);
      await page.reload();
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).waitFor();
      assert.equal(await page.locator('[aria-label="Display Module"]').count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
