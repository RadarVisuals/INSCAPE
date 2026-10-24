import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { mountToolDockFixture } from './fixtures/tool-docks.mjs';
import { openSharedTool } from './fixtures/shared-tools.mjs';

const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/colour-focus';
const focusPaint = wheel => wheel.evaluate(node => ({
  wheel: getComputedStyle(node).outlineStyle,
  controls: [...node.querySelectorAll('[tabindex]')].map(control => getComputedStyle(control).outlineStyle),
}));
const noPointerOutline = { wheel: 'none', controls: ['none', 'none'] };

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
      const wheel = panel.locator('.ds-studio-colour-wheel');
      const hex = panel.getByRole('textbox', { name: 'Color colour', exact: true });
      const hue = panel.getByRole('slider', { name: 'Colour hue', exact: true });
      const triangle = panel.getByRole('group', { name: 'Colour triangle', exact: true });
      const pointer = async mode => {
        await wheel.scrollIntoViewIfNeeded();
        const box = await wheel.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + (mode === 'hue' ? 6 : box.height / 2));
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * .7, box.y + box.height * .4, { steps: 4 });
      };
      // Start from an editable field, then from a keyboard-focused SVG target.
      await hex.focus(); await hex.press('ArrowLeft');
      for (const mode of ['triangle', 'hue']) {
        const before = await page.evaluate(() => window.savedDraft().shapes[0].color);
        await pointer(mode);
        await panel.screenshot({ path: `${output}/${carbon ? 'carbon-narrow' : 'mist-wide'}-${mode}.png` });
        assert.deepEqual(await focusPaint(wheel), noPointerOutline, 'dragging paints no browser or keyboard focus frame');
        await page.keyboard.press('Escape'); await page.mouse.up();
        assert.equal(await page.evaluate(() => window.savedDraft().shapes[0].color), before, 'Escape still cancels the pointer color preview');
        await hex.focus(); await hex.press('Tab');
        assert.equal(await hue.evaluate(node => document.activeElement === node), true);
        assert.equal((await focusPaint(wheel)).wheel, 'solid', 'Tab reveals the keyboard indicator');
        if (mode === 'triangle') await page.keyboard.press('Tab');
        const focused = mode === 'triangle' ? triangle : hue;
        await focused.press('ArrowRight');
        assert.notEqual(await page.evaluate(() => window.savedDraft().shapes[0].color), before, 'keyboard editing still commits');
        await pointer(mode); await page.mouse.up();
        assert.deepEqual(await focusPaint(wheel), noPointerOutline, 'switching the same focused control to mouse clears keyboard paint');
      }
      await hex.focus(); await hex.press('Tab');
      await page.emulateMedia({ forcedColors: 'active' });
      assert.equal((await focusPaint(wheel)).wheel, 'solid');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
