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
      const tools = page.locator('.text-tools-window');
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
      assert.ok(footerBounds.y + footerBounds.height <= toolBounds.y + toolBounds.height, 'the complete warning and recovery footer fit inside the tools');
      assert.ok(retryBounds.height >= 29.9 && retryBounds.y + retryBounds.height < toolBounds.y + toolBounds.height, `the complete recovery target is visible: ${JSON.stringify({ retryBounds, toolBounds, style: await retry.evaluate(n => ({ minHeight: getComputedStyle(n).minHeight, zoom: getComputedStyle(n).zoom })) })}`);
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
      assert.ok(replacementBounds.y + replacementBounds.height < expandedBounds.y + expandedBounds.height, 'explicit replacement stays fully inside the expanded footer');
      assert.equal(await hit(replace), true);
      if (touch) await replace.tap(); else await replace.click();
      await page.waitForFunction(() => !document.querySelector('.system-workflow__recovery-notice'));
      assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.content.content[0].content[0].text), 'My explicitly chosen replacement.');
      assert.equal(await page.evaluate(() => window.savedDraft().identityPresentation.alias), 'Other tab');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

for (const [width, scale, method] of [[1600, 1, 'keyboard'], [1600, .5, 'drag'], [1600, 1.37, 'keyboard'], [390, .5, 'keyboard']]) {
  test(`Text ${method} detachment removes camera pan at ${scale * 100}% / ${width}px and survives reload`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    let page;
    try {
      await mkdir(output, { recursive: true });
      page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountTextToolsFixture(page, origin, { displayTextCount: 1 });
      if (method === 'drag') {
        // The pan setup below puts the Display beneath the expanded sidebar.
        // Collapse that independent surface before exercising the drag handle.
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        // The parked Text window must also remain reachable after detachment.
        const info = page.getByRole('button', { name: 'Close Info', exact: true });
        if (await info.count()) await info.click();
      }
      await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
      const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
      if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
      await setWorkbenchZoom(page, scale);
      const stage = page.locator('[data-system-workflow-artboard]').first();
      const initialStage = await stage.boundingBox();
      const empty = await page.evaluate(() => {
        for (let y = innerHeight - 150; y > 100; y -= 20) for (let x = innerWidth - 30; x > 10; x -= 20) {
          if (document.elementFromPoint(x, y)?.matches('.system-workflow, .system-workflow__workbench, .system-workflow__display-instance')) return { x, y };
        }
        throw Error('No exposed Workbench background');
      });
      await page.mouse.move(empty.x, empty.y);
      await page.mouse.wheel(initialStage.x - 80, initialStage.y - 100); await settle(page);
      const camera = await page.locator('main.system-workflow').first().evaluate(node => ({
        x: parseFloat(node.style.getPropertyValue('--workbench-pan-x')), y: parseFloat(node.style.getPropertyValue('--workbench-pan-y')),
      }));
      assert.ok(Math.abs(camera.x) > 100 && Math.abs(camera.y) > 10, 'test has both horizontal and vertical camera pan');
      const select = page.getByRole('button', { name: 'Select Display article 1', exact: true });
      await select.focus(); await page.keyboard.press('Enter');
      const editor = stage.getByRole('textbox', { name: 'Article text', exact: true });
      await editor.fill('Attached rich text stays with its new window.');
      await editor.press('Control+A');
      await page.locator('.text-tools-window').getByRole('button', { name: 'Bold', exact: true }).click();
      const before = await page.evaluate(() => window.savedDraft());
      const original = before.grids.flatMap(grid => grid.placements).find(item => item.text?.article.title === 'Display article 1');
      let expectedScreen;
      if (method === 'keyboard') {
        const bounds = await stage.boundingBox();
        expectedScreen = { left: bounds.x + bounds.width + 12, top: bounds.y };
        await openTextToolSection(page.locator('.text-tools-window'), 'Display connection');
        await page.getByRole('button', { name: 'Move onto Workbench', exact: true }).focus();
        await page.keyboard.press('Enter');
      } else {
        // Move the companion window away using its own keyboard grip.
        const grip = page.getByLabel('Move Text tools window', { exact: true });
        await grip.focus();
        for (let step = 0; step < 25; step++) await page.keyboard.press('Shift+ArrowRight');
        const handle = stage.getByRole('button', { name: 'Drag Text out of Display', exact: true });
        const from = await handle.boundingBox(), source = await editor.locator('xpath=ancestor::*[@data-system-workflow-placement-id]').boundingBox();
        const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }, end = { x: 700, y: 650 };
        expectedScreen = { left: source.x + end.x - start.x, top: source.y + end.y - start.y };
        const canvas = await stage.boundingBox();
        const extra = { start, end, source, camera, scale, canvas, tools: await page.locator('.text-tools-window').boundingBox(),
          outside: end.x < canvas.x || end.x > canvas.x + canvas.width || end.y < canvas.y || end.y > canvas.y + canvas.height };
        await diagnostics(() => captureTarget(page, handle, 'detach-before', extra));
        assert.equal(await hit(handle), true, 'the Text detach handle receives the pointer start');
        assert.equal(extra.outside, true, 'the drag destination is outside the Display');
        await page.evaluate(() => {
          window.textTransferTrace = [];
          for (const type of ['pointerdown', 'gotpointercapture', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
            document.addEventListener(type, event => {
              const target = event.target;
              const entry = { type, time: performance.now(), x: event.clientX, y: event.clientY, pointerId: event.pointerId, buttons: event.buttons,
                target: { tag: target.tagName, class: target.getAttribute?.('class'), label: target.getAttribute?.('aria-label') } };
              window.textTransferTrace.push(entry);
              queueMicrotask(() => {
                entry.capturedAfterDispatch = target.hasPointerCapture?.(event.pointerId) || false;
                entry.preview = document.querySelector('.text-transfer-preview')?.textContent || null;
              });
            }, true);
          }
        });
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 12 });
        await diagnostics(async () => captureTarget(page, handle, 'detach-preview', { ...extra,
          preview: await page.locator('.text-transfer-preview').allTextContents() }));
        await page.mouse.up();
        // Reload below replaces the page globals; preserve the completed gesture now.
        await diagnostics(async () => writeFile(`${output}/detach-events.json`,
          JSON.stringify(await page.evaluate(() => window.textTransferTrace), null, 2)));
      }
      await page.waitForFunction(() => window.savedDraft().texts.length === 2);
      const after = await page.evaluate(() => window.savedDraft());
      const record = after.texts.find(item => item.article.title === 'Display article 1');
      const frame = after.workbench.texts.find(item => item.id === record.id).window;
      const text = page.locator(`[data-text-id="${record.id}"] .text-window`);
      await text.waitFor(); await settle(page);
      const actual = await text.boundingBox();
      const expectedLeft = Math.max(8, Math.min(2000 - 8 - frame.width, (expectedScreen.left - camera.x) / scale));
      const expectedTop = Math.max(8, Math.min(4000 - 8 - frame.height, (expectedScreen.top - camera.y) / scale));
      near(frame.left, expectedLeft, 'saved Workbench x stays inside the current canvas');
      near(frame.top, expectedTop, 'saved Workbench y stays inside the current canvas');
      near(actual.x, expectedLeft * scale + camera.x, 'visible x');
      near(actual.y, expectedTop * scale + camera.y, 'visible y');
      assert.deepEqual(record.article.content, original.text.article.content);
      assert.equal(after.grids.flatMap(grid => grid.placements).some(item => item.id === original.id), false, 'Text has one owner after moving');
      if (method === 'drag') await diagnostics(() => captureTarget(page,
        page.getByRole('button', { name: 'Close Text tools', exact: true }), 'detach-close-tools'));
      await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
      await page.screenshot({ path: `${output}/text-detached-pan-${width}-${scale}.png` });
      await page.reload(); await mountTextToolsFixture(page, origin);
      await text.waitFor(); await settle(page);
      const restored = await text.boundingBox();
      near(restored.x, frame.left, 'reload x without temporary camera'); near(restored.y, frame.top, 'reload y without temporary camera');
      assert.deepEqual(await page.evaluate(id => window.savedDraft().texts.find(item => item.id === id), record.id), record, 'reload preserves article and formatting');
      assert.deepEqual(errors, []);
    } finally {
      try {
        if (method === 'drag' && page) await diagnostics(async () => {
          const result = await page.evaluate(() => ({ trace: window.textTransferTrace, draft: window.readDraft?.(), saved: window.savedDraft?.(),
            alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent) }));
          await writeFile(`${output}/detach-result.json`, JSON.stringify(result, null, 2));
          await page.screenshot({ path: `${output}/detach-result.png`, timeout: 4000 });
        });
      } finally { await browser.close(); }
    }
  });
}
