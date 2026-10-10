import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5180';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const readDraft = page => page.evaluate(() => JSON.parse(localStorage.getItem(window.__motionKey)));
const counts = draft => Object.fromEntries(draft.grids.map(grid => [grid.id, grid.placements.length]));

for (const [width, motion] of [[1440, 'reduce'], [390, 'reduce'], [1440, 'no-preference']]) {
  test('Library survives dock Grid navigation and drops into the chosen Grid (' + width + ', ' + motion + ')',
    { timeout: 90000 }, async () => {
      const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
      try {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: motion });
        page.setDefaultTimeout(12000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await mountGridMotionFixture(page, { origin, heavy: true, count: 3, displayWidth: Math.min(650, width - 40) });
        await page.evaluate(() => import('/src/lattice/rendering/latticeMenuSurface.css'));
        const libraryTrigger = page.getByRole('button', { name: 'Library', exact: true });
        const gridsTrigger = page.getByRole('button', { name: 'Grids', exact: true });
        const library = page.getByRole('region', { name: 'Library workspace' });
        const grids = page.locator('.system-workflow__grid-switcher');
        await libraryTrigger.click(); await library.waitFor(); await settle(page);
        const search = library.getByRole('searchbox', { name: 'Search', exact: true });
        await search.fill('ABYSSAL');
        await page.evaluate(() => { window.__libraryBeforeGrid = document.querySelector('.system-workflow__library'); });
        const card = library.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true });
        await card.waitFor();
        await gridsTrigger.click(); await grids.waitFor();
        assert.equal(await library.isVisible(), true, 'opening Grids leaves Library visible');
        assert.equal(await libraryTrigger.getAttribute('aria-pressed'), 'true');
        assert.equal(await gridsTrigger.getAttribute('aria-expanded'), 'true');
        const option = grids.getByRole('option', { name: /^Motion 1 / });
        await option.scrollIntoViewIfNeeded();
        const bounds = await option.boundingBox();
        assert.equal(await option.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)),
          { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }), true, 'Library does not cover Grid choices');
        await page.screenshot({ path: join(tmpdir(), 'inscape-library-grids-' + width + '-' + motion + '.png') });
        await option.click();
        assert.equal(await grids.isVisible(), true, 'choosing a Grid keeps the menu open');
        await page.waitForFunction(() => !document.documentElement.dataset.systemWorkflowGridDirection);
        assert.equal(await library.isVisible(), true);
        assert.equal(await search.inputValue(), 'ABYSSAL');
        assert.equal(await page.evaluate(() => window.__libraryBeforeGrid === document.querySelector('.system-workflow__library')), true);
        assert.equal(await page.locator('main.system-workflow').getAttribute('data-authoring-locked'), null);
        await page.waitForFunction(() => document.querySelector('[aria-label="ABYSSAL STUDY / INSCAPE STUDIES"]')?.getAttribute('aria-disabled') !== 'true');
        const before = counts(await readDraft(page));
        const board = await page.locator('[data-system-workflow-artboard]').first().boundingBox();
        const source = await card.boundingBox();
        await page.mouse.move(source.x + source.width / 2, source.y + Math.min(35, source.height / 2));
        await page.mouse.down();
        await page.mouse.move(board.x + board.width * .7, board.y + board.height * .35, { steps: 12 });
        await page.getByText('Release to add layer', { exact: true }).waitFor();
        await page.mouse.up();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem(window.__motionKey)).grids
          .find(grid => grid.id === 'grid:motion-1').placements.length === 6);
        const after = counts(await readDraft(page));
        assert.deepEqual(after, { ...before, 'grid:motion-1': before['grid:motion-1'] + 1 });
        assert.equal(await library.isVisible(), true);
        assert.equal(await grids.isVisible(), true, 'asset drops keep the Grid menu open');
        assert.equal(await search.inputValue(), 'ABYSSAL');
        await grids.getByRole('option', { name: /^Motion 2 / }).click();
        await page.waitForFunction(() => !document.documentElement.dataset.systemWorkflowGridDirection);
        const nextSource = await card.boundingBox();
        await page.mouse.move(nextSource.x + nextSource.width / 2, nextSource.y + Math.min(35, nextSource.height / 2));
        await page.mouse.down();
        await page.mouse.move(board.x + board.width * .7, board.y + board.height * .35, { steps: 12 });
        await page.getByText('Release to add layer', { exact: true }).waitFor();
        await page.mouse.up();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem(window.__motionKey)).grids
          .find(grid => grid.id === 'grid:motion-2').placements.length === 6);
        assert.deepEqual(counts(await readDraft(page)), { ...after, 'grid:motion-2': before['grid:motion-2'] + 1 });
        assert.equal(await grids.isVisible(), true);
        assert.equal(await library.isVisible(), true);
        assert.equal(await search.inputValue(), 'ABYSSAL');
        await page.screenshot({ path: join(tmpdir(), 'inscape-library-grids-after-drop-' + width + '-' + motion + '.png') });

        // Closing either dock panel never silently closes its companion.
        await libraryTrigger.click();
        await library.waitFor({ state: 'hidden' });
        assert.equal(await grids.isVisible(), true);
        await libraryTrigger.click(); await library.waitFor();
        assert.equal(await grids.isVisible(), true);
        await gridsTrigger.press('Escape');
        await grids.waitFor({ state: 'detached' });
        assert.equal(await library.isVisible(), true);
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Grids');

        // Returning to Library keeps the Grid menu ready for another selection.
        await gridsTrigger.click(); await grids.waitFor();
        await card.click();
        assert.equal(await grids.isVisible(), true);
        assert.equal(await library.isVisible(), true);

        // Other dock panels retain their existing replacement behavior.
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
        await grids.waitFor({ state: 'detached' });
        await library.waitFor({ state: 'hidden' });
        assert.equal(await libraryTrigger.getAttribute('aria-pressed'), 'false');
        assert.equal(await gridsTrigger.getAttribute('aria-expanded'), 'false');
        assert.deepEqual(errors, []);
      } finally { await browser.close(); }
    });
}
