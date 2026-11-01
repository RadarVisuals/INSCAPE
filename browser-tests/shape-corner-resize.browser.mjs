import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5180';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1.1, `${label}: ${actual} vs ${expected}`);

for (const width of [1440, 390]) test(`Shape corners stay free after first resize and reselection at ${width}px`, { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25 });
    page.setDefaultTimeout(8000);
    const errors = [], evidence = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await page.locator('.text-window').getByRole('button', { name: /^Close / }).press('Enter');
    const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
    if (await collapse.count()) await collapse.click();
    // Create through the real owner UI; the first grip is the Shape's own grip.
    await page.mouse.click(width === 390 ? 96 : 560, width === 390 ? 160 : 240, { button: 'right' });
    await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
    await page.getByRole('menuitem', { name: 'SHAPE', exact: true }).click();
    const shape = page.locator('.shape-window'); await shape.waitFor();
    const id = await shape.getAttribute('data-workbench-view-id');
    const saved = () => page.evaluate(id => window.savedDraft().workbench.shapes.find(s => s.id === id).window, id);
    const drag = async (edge, dx, dy, selected) => {
      const surface = selected ? page.locator('.workbench-selection') : shape;
      if (width === 390) {
        const rectangle = await surface.boundingBox();
        const corner = edge.includes('w') ? rectangle.x : rectangle.x + rectangle.width;
        const shift = corner < 92 ? 112 - corner : corner > width - 24 ? width - 44 - corner : 0;
        if (shift) {
          const authored = await saved();
          await page.locator('main.system-workflow').focus(); await page.keyboard.down('Space');
          await page.mouse.move(200, 750); await page.mouse.down();
          await page.mouse.move(200 + shift, 750, { steps: 5 }); await page.mouse.up();
          await page.keyboard.up('Space'); await settle(page);
          assert.deepEqual(await saved(), authored, 'pan exposes the corner without changing authored geometry');
        }
      }
      const b = await surface.boundingBox(), x = edge.includes('w') ? b.x : b.x + b.width, y = edge.includes('n') ? b.y : b.y + b.height;
      const before = await saved();
      const hit = await page.evaluate(({ x, y }) => { const n = document.elementFromPoint(x, y); return { className: n?.className, label: n?.getAttribute('aria-label'), html: n?.outerHTML.slice(0, 240) }; }, { x, y });
      if (!hit.className?.includes(`is-${edge}`)) {
        await page.screenshot({ path: `${output}/blocked-${width}-${edge}.png` });
        assert.fail(`Grip covered at ${x},${y}: ${JSON.stringify(hit)}`);
      }
      await page.keyboard.down('Alt'); await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
      const after = await saved(); evidence.push({ edge, dx, dy, selected, before, after });
      near(after.width, before.width + (edge.includes('w') ? -dx : dx), 'width follows horizontal input');
      near(after.height, before.height + (edge.includes('n') ? -dy : dy), 'height follows vertical input');
      near(after.left + (edge.includes('w') ? after.width : 0), before.left + (edge.includes('w') ? before.width : 0), 'opposite x');
      near(after.top + (edge.includes('n') ? after.height : 0), before.top + (edge.includes('n') ? before.height : 0), 'opposite y');
      return after;
    };
    const closeToolPanels = async () => {
      for (const name of ['Close Shape', 'Close Transform', 'Close Color', 'Close Info']) {
        const close = page.getByRole('button', { name, exact: true });
        if (await close.count()) await close.press('Enter');
      }
      await settle(page);
    };
    await closeToolPanels();
    await drag('se', 12, 0, false);
    // Solo handles stay module-owned. Request group handles explicitly.
    await shape.locator('header').focus(); await page.keyboard.press('Shift+Enter'); await settle(page);
    await page.locator('.workbench-selection').waitFor();
    await drag('se', 0, 12, true);
    // Repeated use and selection changes must never switch back to ratio locking.
    for (const edge of ['nw', 'ne', 'sw', 'se']) {
      await page.locator('main.system-workflow').focus(); await page.keyboard.press('Escape');
      await shape.locator('header').focus(); await page.keyboard.press('Shift+Enter');
      await settle(page);
      await drag(edge, edge.includes('w') ? -8 : 8, 0, true);
      await drag(edge, 0, edge.includes('n') ? 8 : -8, true);
    }
    const final = await saved();
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z'); await settle(page);
    assert.notDeepEqual(await saved(), final);
    await page.keyboard.press('Control+Shift+z'); await settle(page); assert.deepEqual(await saved(), final);
    await page.screenshot({ path: `${output}/shape-corners-${width}.png` });
    await mountTextToolsFixture(page, origin, { waitForText: false }); await shape.waitFor();
    assert.deepEqual(await saved(), final, 'saved geometry survives reload');
    // Grid uses the same host, but keeps complete rows/columns and its cell size.
    const gridId = await page.evaluate(async () => {
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE: profileAddress } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const { addShape } = await import('/src/shapes/shapeSession.js');
      const store = createSystemWorkflowDraftStore({ profileAddress, storage: localStorage });
      return addShape(store, profileAddress, { kind: 'grid', position: { left: 48, top: 240 }, size: { width: 192, height: 144 } });
    });
    await mountTextToolsFixture(page, origin, { waitForText: false });
    const grid = page.locator(`[data-workbench-view-id="${gridId}"]`); await grid.waitFor();
    const g = await grid.boundingBox(); await page.mouse.click(g.x + g.width / 2, g.y + 1); await settle(page);
    await closeToolPanels();
    if (!await page.locator('.workbench-selection').count()) {
      await grid.locator('header').focus(); await page.keyboard.press('Shift+Enter'); await settle(page);
    }
    for (const [dx, dy, w, h] of [[24, 0, 216, 144], [0, 24, 216, 168], [-24, 24, 192, 192]]) {
      const b = await page.locator('.workbench-selection').boundingBox();
      await page.keyboard.down('Alt'); await page.mouse.move(b.x + b.width, b.y + b.height); await page.mouse.down();
      await page.mouse.move(b.x + b.width + dx, b.y + b.height + dy, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle(page);
      const state = await page.evaluate(id => ({ window: window.savedDraft().workbench.shapes.find(s => s.id === id).window,
        spacing: window.savedDraft().shapes.find(s => s.id === id).grid.spacing }), gridId);
      near(state.window.width, w, 'Grid width'); near(state.window.height, h, 'Grid height'); assert.equal(state.spacing, 24);
    }
    await page.getByRole('button', { name: 'Scale selected modules from nw', exact: true }).focus();
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await settle(page);
    const gridFinal = await page.evaluate(id => window.savedDraft().workbench.shapes.find(s => s.id === id).window, gridId);
    near(gridFinal.width, 216, 'Grid keyboard width'); near(gridFinal.height, 216, 'Grid keyboard height');
    fs.writeFileSync(`${output}/shape-corners-${width}.json`, JSON.stringify(evidence, null, 2));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
