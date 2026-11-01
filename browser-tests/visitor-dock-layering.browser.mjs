import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const output = process.env.INSCAPE_VISITOR_DOCK_OUTPUT || '.browser-test-runtime/visitor-dock';
const { mkdir } = await import('node:fs/promises');
await mkdir(output, { recursive: true });

test('Visitor and Preview dock stays visible and clickable above overlapping Text', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const preview of [false, true]) for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountTextToolsFixture(page, origin);
      await page.evaluate(async () => {
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const draft = window.savedDraft(), text = draft.texts[0];
        text.visibility = 'PUBLIC'; text.article.title = 'Overlapping article';
        text.article.content.content = Array.from({ length: 50 }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: `Visitor paragraph ${index + 1}. This article must stay behind the application dock.` }] }));
        draft.workbench.texts[0].window = { left: 0, top: 80, width: 1100, height: 1600 };
        localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
      });
      await mountTextToolsFixture(page, origin, { visitor: !preview });
      if (preview) await page.getByRole('button', { name: 'Preview', exact: true }).click();
      const visitor = page.locator('.visitor-grid-world').first();
      const article = visitor.locator('.text-window').first();
      const dock = visitor.locator('.visitor-grid-world__dock');
      await article.getByText('Overlapping article', { exact: true }).waitFor();
      await dock.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const label = `${preview ? 'preview' : 'visitor'}-${width}`;
      const geometry = await article.boundingBox(), dockGeometry = await dock.boundingBox();
      assert.ok(geometry.y + geometry.height > dockGeometry.y + dockGeometry.height, `${label}: Text extends across the dock for this regression`);
      await page.screenshot({ path: `${output}/${label}.png` });
      for (const phase of ['initial', 'selected', 'panned']) {
        if (phase === 'selected') await article.locator('p').first().click();
        if (phase === 'panned') {
          const before = await article.boundingBox();
          await visitor.focus();
          await page.keyboard.down('Space');
          await page.mouse.move(200, 240); await page.mouse.down();
          await page.mouse.move(224, 304, { steps: 8 }); await page.mouse.up();
          await page.keyboard.up('Space');
          const after = await article.boundingBox();
          assert.ok(Math.abs(after.y - before.y - 64) < 1, `${label}: actually pan the article across the dock`);
          assert.deepEqual(await dock.boundingBox(), dockGeometry, `${label}: dock remains fixed during pan`);
        }
        const hits = await dock.evaluate(node => {
          const box = node.getBoundingClientRect();
          return [4, Math.min(150, box.width / 2), box.width - 4].flatMap(x => [box.top + 6, box.bottom - 6].map(y => ({ x, y,
            hit: document.elementFromPoint(x, y)?.className, dock: node.contains(document.elementFromPoint(x, y)) })));
        });
        assert.ok(hits.every(hit => hit.dock), `${label}, ${phase}: dock must own its full visible area: ${JSON.stringify(hits)}`);
        const profile = dock.getByRole('button', { name: 'Profile', exact: true });
        const expanded = await profile.getAttribute('aria-expanded');
        await profile.click();
        assert.notEqual(await profile.getAttribute('aria-expanded'), expanded, `${label}: pointer reaches Profile`);
        await profile.click();
      }
      const scroller = article.locator('.text-module-scroll');
      await page.mouse.move(250, 400); await page.mouse.wheel(0, 300);
      await page.waitForFunction(() => document.querySelector('.visitor-grid-world .text-module-scroll').scrollTop > 0);
      assert.ok(await scroller.evaluate(node => node.scrollTop > 0), `${label}: article stays scrollable`);
      const profile = dock.getByRole('button', { name: 'Profile', exact: true });
      await profile.click(); await profile.click();
      if (preview) {
        await dock.getByRole('button', { name: 'EXIT', exact: true }).click();
        await page.getByRole('button', { name: 'Preview', exact: true }).waitFor();
      }
      assert.deepEqual(errors, [], `${label}: no browser errors`);
      await context.close();
    }
  } finally { await browser.close(); }
});
