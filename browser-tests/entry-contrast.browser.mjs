import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';

test('entry navigation has readable text, keyboard access and no narrow-screen overflow', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 640, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.goto(origin); await page.locator('.public-entry-portal').waitFor();
      const contrast = await page.locator('.public-entry-portal__header nav button').evaluateAll(buttons => {
        const rgba = value => { const parts = value.match(/[\d.]+/g).map(Number); return [...parts.slice(0, 3), parts[3] ?? 1]; };
        const blend = (front, back) => front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3]));
        const background = node => {
          if (!node) return [255, 255, 255];
          const color = rgba(getComputedStyle(node).backgroundColor);
          return color[3] === 1 ? color.slice(0, 3) : blend(color, background(node.parentElement));
        };
        const luminance = rgb => rgb.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
          .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        return buttons.filter(node => !node.disabled && node.getClientRects().length).map(node => {
          const bg = background(node), fg = blend(rgba(getComputedStyle(node).color), bg);
          const values = [luminance(bg), luminance(fg)].sort((a, b) => b - a);
          return { text: node.textContent.trim(), ratio: (values[0] + .05) / (values[1] + .05) };
        });
      });
      assert.ok(contrast.length >= 2);
      for (const button of contrast) assert.ok(button.ratio >= 4.5, JSON.stringify({ width, ...button }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const seen = [];
      for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => document.activeElement.textContent.trim())); }
      assert.ok(seen.includes('Discover')); assert.ok(seen.includes('Connect'));
      await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/entry-${width}.png` });
      console.log(JSON.stringify({ width, contrast }));
      await page.close();
    }
  } finally { await browser.close(); }
});
