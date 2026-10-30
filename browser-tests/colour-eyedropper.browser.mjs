import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5197';
const output = process.env.INSCAPE_BROWSER_OUTPUT || 'docs/audits/2026-10-28/reception-settings-colour-library/colour';

async function setup(supported = true) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(available => {
    globalThis.nativeDrops = [];
    globalThis.EyeDropper = available ? class {
      open({ signal }) { return new Promise((resolve, reject) => globalThis.nativeDrops.push({ signal, resolve, reject })); }
    } : undefined;
  }, supported);
  await page.goto(origin + '/browser-tests/colour-eyedropper-fixture.html');
  await page.getByRole('region', { name: 'Color', exact: true }).waitFor();
  return { browser, page, errors };
}
const snapshot = page => page.evaluate(() => globalThis.colourFixture);
const resolve = (page, color, index = -1) => page.evaluate(({ color, index }) => globalThis.nativeDrops.at(index).resolve({ sRGBHex: color }), { color, index });
const reject = (page, name) => page.evaluate(name => globalThis.nativeDrops.at(-1).reject(new DOMException('fixture', name)), name);

test('screen color sampling commits once, returns focus and keeps the color panel open; cancel and failure do not save', async () => {
  const { browser, page, errors } = await setup();
  try {
    const button = page.getByRole('button', { name: 'Pick color from screen' });
    await button.click(); assert.equal(await button.isDisabled(), true);
    assert.equal((await snapshot(page)).writes.length, 0);
    await resolve(page, '#AaBBcC');
    await page.waitForFunction(() => globalThis.colourFixture.colors.first === '#aabbcc');
    assert.equal((await snapshot(page)).writes.length, 1);
    assert.equal(await button.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.getByRole('region', { name: 'Color', exact: true }).isVisible(), true);
    await button.click(); await reject(page, 'AbortError');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Pick color from screen"]').disabled);
    assert.equal((await snapshot(page)).writes.length, 1);
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.equal(await button.evaluate(node => node === document.activeElement), true);
    await button.click(); await reject(page, 'OperationError');
    await page.getByRole('alert').waitFor();
    assert.equal((await snapshot(page)).writes.length, 1);
    await button.click(); await resolve(page, '#102030');
    await page.waitForFunction(() => globalThis.colourFixture.colors.first === '#102030');
    assert.equal(await page.getByRole('alert').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('sampling is aborted on target/version/disabled/unmount changes and ignores late native results', async () => {
  const { browser, page, errors } = await setup();
  try {
    const button = page.getByRole('button', { name: 'Pick color from screen' });
    for (const action of ['Switch target', 'Advance version', 'Toggle disabled', 'Close color']) {
      await button.click();
      await page.getByRole('button', { name: action, exact: true }).click();
      assert.equal(await page.evaluate(() => globalThis.nativeDrops.at(-1).signal.aborted), true);
      await resolve(page, '#fedcba');
      assert.equal((await snapshot(page)).writes.length, 0);
      if (action === 'Toggle disabled') await page.getByRole('button', { name: action, exact: true }).click();
      if (action === 'Close color') await page.getByRole('button', { name: 'Open color', exact: true }).click();
    }
    assert.deepEqual((await snapshot(page)).colors, { first: '#112233', second: '#445566' });
    await button.click(); await resolve(page, '#abcdef');
    await page.waitForFunction(() => globalThis.colourFixture.colors.second === '#abcdef');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('unsupported screen sampling offers a native color choice plus wheel and hex without implicit saves', async () => {
  const { browser, page, errors } = await setup(false);
  try {
    assert.equal(await page.getByRole('button', { name: 'Pick color from screen' }).count(), 0);
    const input = page.getByLabel('Choose color', { exact: true });
    await input.waitFor();
    assert.equal(await page.getByRole('slider', { name: 'Colour hue' }).count(), 1);
    await input.dispatchEvent('click');
    await input.evaluate(node => { node.value = '#aabbcc'; node.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal((await snapshot(page)).writes.length, 0, 'Chooser previews do not save');
    await input.dispatchEvent('change');
    await page.waitForFunction(() => globalThis.colourFixture.colors.first === '#aabbcc');
    assert.equal((await snapshot(page)).writes.length, 1);
    await input.dispatchEvent('click');
    await page.getByRole('button', { name: 'Switch target', exact: true }).click();
    await input.evaluate(node => { node.value = '#ff0000'; node.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.equal((await snapshot(page)).writes.length, 1, 'A stale chooser cannot target the newly selected cell');
    const hex = page.getByRole('textbox', { name: 'Color colour', exact: true });
    await hex.fill('#778899'); await hex.press('Enter');
    assert.equal((await snapshot(page)).colors.second, '#778899');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('screen sampler and fallback are a single compact icon beside the wheel on wide and narrow viewports', async () => {
  await mkdir(output, { recursive: true });
  for (const supported of [true, false]) {
    const { browser, page, errors } = await setup(supported);
    try {
      const icon = page.locator(supported ? '.ds-colour-eyedropper' : '.ds-colour-native');
      assert.equal((await icon.textContent()).trim(), '', 'No visible label or full-width button');
      assert.equal(await icon.getAttribute('title'), supported ? 'Pick color from screen' : 'Choose color');
      for (const width of [1920, 390]) {
        await page.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
        const wheel = await page.locator('.ds-studio-colour-wheel').boundingBox(), button = await icon.boundingBox();
        assert.ok(button.width >= 24 && button.width <= 44 && button.height <= 44, 'Compact icon keeps a usable target');
        assert.ok(button.x >= wheel.x + wheel.width + 4, 'Icon occupies a separate column beside the wheel');
        assert.ok(Math.abs(button.y + button.height - wheel.y - wheel.height) < 1, 'Icon aligns with the lower wheel edge');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
        await page.screenshot({ path: `${output}/compact-${supported ? 'eyedropper' : 'fallback'}-${width}.png` });
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});
