import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mountToolDockFixture } from './fixtures/tool-docks.mjs';
import { openSharedTool, openSharedColorPicker } from './fixtures/shared-tools.mjs';

const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/colour-focus';
const focusPaint = picker => picker.locator('.ds-colour-field, .ds-colour-hue-strip').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).outlineStyle));
const noPointerOutline = ['none', 'none'];

test('Color pointer gestures have no focus box; keyboard focus and cancellation remain available', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    for (const carbon of [false, true]) {
      const page = await browser.newPage({ viewport: { width: carbon ? 760 : 1440, height: carbon ? 620 : 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountToolDockFixture(page, { carbon });
      await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
      const panel = await openSharedTool(page, 'Color');
      const picker = await openSharedColorPicker(page, 'Fill');
      const hex = picker.getByRole('textbox', { name: 'Color colour', exact: true });
      const hue = picker.getByRole('slider', { name: 'Colour hue', exact: true });
      const field = picker.getByRole('group', { name: 'Colour saturation and value', exact: true });
      const pointer = async mode => {
        const control = mode === 'hue' ? hue : field;
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * .7, box.y + box.height * .4, { steps: 4 });
      };
      // Start from an editable field, then from a keyboard-focused color target.
      await hex.focus(); await hex.press('ArrowLeft');
      for (const mode of ['field', 'hue']) {
        const before = await page.evaluate(() => window.savedDraft().shapes[0].color);
        await pointer(mode);
        await panel.screenshot({ path: `${output}/${carbon ? 'carbon-narrow' : 'mist-wide'}-${mode}.png` });
        assert.deepEqual(await focusPaint(picker), noPointerOutline, 'dragging paints no browser or keyboard focus frame');
        await page.keyboard.press('Escape'); await page.mouse.up();
        assert.equal(await page.evaluate(() => window.savedDraft().shapes[0].color), before, 'Escape still cancels the pointer color preview');
        await hex.focus(); await hex.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
        assert.equal(await hue.evaluate(node => document.activeElement === node), true);
        assert.equal((await focusPaint(picker))[1], 'solid', 'Tab reveals the hue keyboard indicator');
        if (mode === 'field') await page.keyboard.press('Shift+Tab');
        const focused = mode === 'field' ? field : hue;
        assert.equal(await focused.evaluate(node => document.activeElement === node), true);
        assert.equal((await focusPaint(picker))[mode === 'field' ? 0 : 1], 'solid', 'each color control exposes keyboard focus');
        await focused.press('ArrowRight');
        assert.notEqual(await page.evaluate(() => window.savedDraft().shapes[0].color), before, 'keyboard editing still commits');
        await pointer(mode); await page.mouse.up();
        assert.deepEqual(await focusPaint(picker), noPointerOutline, 'switching the same focused control to mouse clears keyboard paint');
      }
      await hex.focus(); await hex.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
      await page.emulateMedia({ forcedColors: 'active' });
      assert.equal((await focusPaint(picker))[1], 'solid');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
