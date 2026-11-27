import { undockWindow } from './fixtures/undock-window.mjs';
import { openTextToolSection } from './fixtures/text-tool-sections.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { withinDeadline } from './browser-test-lifecycle.mjs';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5197';
const executablePath = browserExecutable;
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1, `${label}: ${actual} / ${expected}`);
const hit = locator => locator.evaluate(node => {
  const r = node.getBoundingClientRect();
  return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
});
const diagnostics = async action => {
  try { await withinDeadline(action(), 5000, 'Text diagnostics exceeded their deadline'); }
  catch (error) { console.warn(`Text diagnostics unavailable: ${error.message}`); }
};
const captureTarget = async (page, target, name, extra = {}) => {
  const snapshot = await target.evaluate(node => {
    const describe = element => {
      if (!element) return null;
      const css = getComputedStyle(element);
      return { tag: element.tagName, class: element.getAttribute('class'), label: element.getAttribute('aria-label'), edge: element.dataset.edge,
        rect: element.getBoundingClientRect().toJSON(),
        scroll: [element.scrollLeft, element.scrollTop, element.clientWidth, element.clientHeight, element.scrollWidth, element.scrollHeight],
        css: Object.fromEntries(['position', 'zIndex', 'pointerEvents', 'overflowX', 'overflowY', 'transform', 'zoom', 'minHeight', 'isolation'].map(key => [key, css[key]])) };
    };
    const rect = node.getBoundingClientRect(), ancestors = [];
    for (let parent = node; parent; parent = parent.parentElement) ancestors.push(describe(parent));
    return { viewport: { width: innerWidth, height: innerHeight, coarse: matchMedia('(pointer: coarse)').matches }, ancestors,
      samples: [[.5, .5], [.1, .1], [.9, .1], [.1, .9], [.9, .9]].map(([x, y]) => {
        const point = { x: rect.left + rect.width * x, y: rect.top + rect.height * y }, stack = document.elementsFromPoint(point.x, point.y);
        return { point, hitsTarget: node.contains(stack[0]), stack: stack.map(describe) };
      }) };
  });
  await writeFile(`${output}/${name}.json`, JSON.stringify({ ...snapshot, ...extra }, null, 2));
  await page.screenshot({ path: `${output}/${name}.png`, timeout: 4000 });
};

for (const width of [1440, 390]) for (const touch of [false, true]) {
  test(`Text recovery remains visible and operable with ${touch ? 'touch' : 'pointer'} at ${width}px`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      await mkdir(output, { recursive: true });
      const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 }, hasTouch: touch });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountTextToolsFixture(page, origin);
      const tools = page.locator('.workbench-tool-dock:has([data-text-inspector])');
      const body = page.getByRole('textbox', { name: 'Article text', exact: true });
      if (width === 390) {
        // Navigator otherwise covers the recovery footer. Park it through its
        // own grip so this test reaches the actual Text recovery controls.
        const before = await page.evaluate(() => window.savedDraft());
        const grip = page.getByLabel('Move Navigator window', { exact: true });
        await grip.focus();
        for (let step = 0; step < 16; step++) await grip.press('Shift+ArrowUp');
        assert.deepEqual(await page.evaluate(() => window.savedDraft()), before, 'parking Navigator does not author content');
      }
      await page.evaluate(async () => {
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const draft = window.savedDraft(); draft.identityPresentation.alias = 'Other tab';
        localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
      });
      await body.fill('Recover this article without discarding other edits.');
      const retry = tools.getByRole('button', { name: 'Retry local save', exact: true });
      await retry.waitFor(); await settle(page);
      assert.equal(await hit(retry), true, 'the warning does not cover Retry');
      const footer = tools.locator('.text-tools-footer');
      assert.match(await footer.innerText(), /saved draft changed elsewhere/i);
      assert.equal(await hit(footer.locator('[role="alert"]')), true, 'the detailed save warning stays visible above the global notice');
      const toolBounds = await tools.boundingBox(), retryBounds = await retry.boundingBox(), footerBounds = await footer.boundingBox();
      await page.screenshot({ path: `${output}/text-recovery-${width}-${touch ? 'touch' : 'pointer'}.png` });
      assert.ok(footerBounds.y + footerBounds.height <= toolBounds.y + toolBounds.height + 0.5, 'the complete warning and recovery footer fit inside the tools');
      assert.ok(retryBounds.height >= (touch ? 43.9 : 27.9) && retryBounds.y + retryBounds.height <= toolBounds.y + toolBounds.height + 0.5, `the complete recovery target is visible: ${JSON.stringify({ retryBounds, toolBounds, style: await retry.evaluate(n => ({ minHeight: getComputedStyle(n).minHeight, zoom: getComputedStyle(n).zoom })) })}`);
      if (touch) await retry.tap(); else await retry.click();
      await page.waitForFunction(() => !document.querySelector('.system-workflow__recovery-notice'));
      assert.equal(await tools.getByRole('alert').count(), 0);
      const saved = await page.evaluate(() => window.savedDraft());
      assert.equal(saved.identityPresentation.alias, 'Other tab');
      assert.equal(saved.texts[0].article.content.content[0].content[0].text, 'Recover this article without discarding other edits.');
      // A competing edit to this same article still requires explicit replacement;
      // both recovery controls must fit even when the warning grows another row.
      await page.evaluate(async () => {
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const draft = window.savedDraft(); draft.texts[0].article.content.content[0].content[0].text = 'Saved in another tab.';
        localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
      });
      await body.fill('My explicitly chosen replacement.');
      if (touch) await retry.tap(); else await retry.click();
      const replace = tools.getByRole('button', { name: 'Replace saved Text with my edits', exact: true });
      await replace.waitFor(); await settle(page);
      await diagnostics(() => captureTarget(page, replace, `replace-${width}-${touch ? 'touch' : 'pointer'}`));
      assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.content.content[0].content[0].text), 'Saved in another tab.');
      const replacementBounds = await replace.boundingBox(), expandedBounds = await tools.boundingBox();
      assert.ok(replacementBounds.y + replacementBounds.height <= expandedBounds.y + expandedBounds.height + 1, 'explicit replacement stays fully inside the expanded footer');
      assert.equal(await hit(replace), true);
      if (touch) await replace.tap(); else await replace.click();
      await page.waitForFunction(() => !document.querySelector('.system-workflow__recovery-notice'));
      assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.content.content[0].content[0].text), 'My explicitly chosen replacement.');
      assert.equal(await page.evaluate(() => window.savedDraft().identityPresentation.alias), 'Other tab');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
