import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/reception-wireframe';
const address = '0x' + '1'.repeat(40);
for (const [width, theme] of [[1440, 'carbon'], [640, 'carbon'], [390, 'carbon'], [1440, 'mist'], [390, 'mist']]) test(`Reception replacement and exploration preserve public content and keyboard focus at ${width} / ${theme}`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=1&owner=1&theme=${theme}`);
    await page.getByRole('region', { name: 'Reception wireframe' }).waitFor();
    const before = await page.evaluate(() => ({ publication: JSON.stringify(window.__overviewPublication), storage: JSON.stringify({ ...localStorage }) }));
    const canvasEntry = page.getByRole('button', { name: 'Enter Inscape', exact: true });
    assert.equal(await canvasEntry.isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Edit reception', exact: true }).count(), 0);
    assert.equal(await page.locator('.profile-overview__gallery, .bento-stage, .identity-module__clouds').count(), 0);
    await page.getByText('Illustration, stories and small worlds.', { exact: true }).waitFor();
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/reception-${width}-${theme}.png`, fullPage: true });
    const enter = page.getByRole('button', { name: /^Explore/ });
    await enter.focus(); await enter.press('Enter');
    await page.getByRole('region', { name: 'Exploration room' }).waitFor();
    assert.ok(await page.getByRole('heading', { name: 'A space to explore.' }).evaluate(node => node === document.activeElement));
    assert.equal(await page.locator('.reception-bento').count(), 0, 'Reception portrait is released in the room');
    await page.screenshot({ path: `${output}/exploration-${width}-${theme}.png`, fullPage: true });
    await page.getByRole('heading', { name: 'A space to explore.' }).press('Escape');
    assert.ok(await enter.evaluate(node => node === document.activeElement));
    await enter.click();
    await page.getByRole('button', { name: 'Back to Reception', exact: true }).click();
    assert.ok(await enter.evaluate(node => node === document.activeElement));
    assert.ok(await page.locator('.profile-overview').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    await canvasEntry.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/entry-button-${width}-${theme}.png` });
    if (width === 390) await canvasEntry.tap();
    else { await canvasEntry.focus(); await canvasEntry.press('Enter'); }
    await page.locator('.visitor-grid-world').waitFor();
    assert.match(page.url(), /[?&]canvas=1/);
    assert.match(page.url(), /[?&]reception=1/);
    assert.equal(await page.locator('main.system-workflow:not(.visitor-grid-world)').count(), 0);
    await page.screenshot({ path: `${output}/entered-canvas-${width}-${theme}.png` });
    await page.getByRole('link', { name: '← Profile overview', exact: true }).click();
    await canvasEntry.waitFor();
    assert.doesNotMatch(page.url(), /[?&]canvas=/);
    await page.goBack(); await page.locator('.visitor-grid-world').waitFor();
    await page.goBack(); await canvasEntry.waitFor();
    assert.deepEqual(await page.evaluate(() => ({ publication: JSON.stringify(window.__overviewPublication), storage: JSON.stringify({ ...localStorage }) })), before);
    assert.deepEqual(errors, []);
    await page.close();
  } finally { await browser.close(); }
});
test('existing work links use the canonical visitor canvas; missing destinations return to Reception', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&module=image%3Astudy`);
    await page.locator('.visitor-grid-world').waitFor();
    assert.equal(await page.locator('.reception-bento').count(), 0);
    await page.getByRole('link', { name: '← Profile overview', exact: true }).click();
    await page.getByRole('region', { name: 'Reception wireframe' }).waitFor();
    await page.goto(`${origin}/browser-tests/profile-overview-fixture.html?view=${address}&module=image%3Amissing`);
    await page.getByRole('status').filter({ hasText: 'That destination is no longer' }).waitFor();
  } finally { await browser.close(); }
});
