import { chromium } from 'playwright-core';
import { browserExecutable } from '../../scripts/browserEnvironment.mjs';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
try {
  for (const [width, theme] of [[1440, 'mist'], [390, 'carbon']]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:24970' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:24970/design-system.html#components');
    await page.getByLabel('Preview surface').selectOption(theme);
    const studio = page.locator('.ds-studio');
    await studio.getByLabel('Workspace selection').selectOption('text');
    await studio.getByRole('button', { name: 'Text tools', exact: true }).click();
    const tools = studio.locator('.text-tools-window');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await tools.getByLabel('Selected text font', { exact: true }).inputValue(), 'Inscape Sora');
    await tools.screenshot({ path: `.browser-test-runtime/text-font-clarity/reference-format-${theme}-${width}.png` });
    await tools.getByRole('tab', { name: 'Article settings', exact: true }).click();
    assert.equal(await tools.getByLabel('Default font', { exact: true }).isVisible(), false);
    await tools.screenshot({ path: `.browser-test-runtime/text-font-clarity/reference-article-${theme}-${width}.png` });
    await tools.locator('summary').filter({ hasText: /^Change default style$/ }).click();
    await tools.screenshot({ path: `.browser-test-runtime/text-font-clarity/reference-defaults-${theme}-${width}.png` });
    assert.ok(await tools.locator('.text-tools-content').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
    await page.close();
    console.log(`Reference ${theme} ${width}px passed`);
  }
} finally { await browser.close(); }
