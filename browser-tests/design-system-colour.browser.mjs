import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { TRIANGLE, ringPoint } from '../src/colour/colourModel.js';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5225';
const executablePath =
  process.env.INSCAPE_BROWSER_EXECUTABLE ||
  ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', chromium.executablePath()].find(
    existsSync,
  );
const output = (process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime') + '/colour';
async function mount(browser, width = 1440, theme = 'carbon') {
  const page = await browser.newPage({ viewport: { width, height: 1100 }, hasTouch: width < 520 }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/design-system.html#components');
  await page.getByLabel('Preview surface', { exact: true }).selectOption(theme);
  const studio = page.locator('.ds-studio');
  await studio.getByLabel('Workspace selection').selectOption('shape');
  await studio.getByRole('tab', { name: 'Color', exact: true }).click();
  const wheel = studio.locator('.ds-colour-controls'),
    hex = studio.getByLabel('Studio colour', { exact: true });
  await wheel.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const point = async (p) => {
    const r = await wheel.boundingBox();
    return { x: r.x + (p.x * r.width) / 200, y: r.y + (p.y * r.height) / 200 };
  };
  const move = async (p) => {
    const q = await point(p);
    await page.mouse.move(q.x, q.y);
  };
  const click = async (p) => {
    await move(p);
    await page.mouse.down();
    await page.mouse.up();
  };
  const value = async () => (await hex.inputValue()).toLowerCase();
  return { page, studio, wheel, hex, point, move, click, value, errors };
}

test(
  'one colour selector supports live ring/triangle dragging, exact hex input and neutral hue memory',
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const { page, studio, wheel, hex, move, click, value, errors } = await mount(browser);
      assert.equal(
        await studio.locator('.ds-studio-panel input[type=color]').count(),
        0,
        'native popup removed',
      );
      await hex.fill('#ff0000');
      await hex.press('Enter');
      await move(ringPoint(0));
      await page.mouse.down();
      await move(ringPoint(120));
      assert.equal(await value(), '#00ff00', 'ring changes colour before mouse release');
      await move(ringPoint(240));
      assert.equal(await value(), '#0000ff');
      await page.mouse.up();
      await move({ x: 100, y: 100 });
      await page.mouse.down();
      await move(TRIANGLE.white);
      assert.equal(await value(), '#ffffff');
      await move(TRIANGLE.black);
      assert.equal(await value(), '#000000');
      await move(TRIANGLE.hue);
      assert.equal(await value(), '#0000ff', 'triangle retains chosen hue through black and white');
      await move({ x: 220, y: 100 });
      assert.equal(await value(), '#0000ff', 'drag clamps outside triangle');
      await page.mouse.up();
      await click({ x: 100, y: 100 });
      assert.equal(await value(), '#5555aa');
      await hex.fill('0f0');
      await hex.press('Enter');
      assert.equal(await value(), '#00ff00');
      await hex.fill('#zzzzzz');
      await hex.press('Enter');
      assert.equal(await hex.getAttribute('aria-invalid'), 'true');
      assert.equal(
        await studio.locator('.ds-studio-art').evaluate((n) => getComputedStyle(n).backgroundColor),
        'rgb(0, 255, 0)',
      );
      await hex.press('Escape');
      assert.equal(await value(), '#00ff00');
      await hex.fill('#ffffff');
      await hex.press('Enter');
      await click(ringPoint(300));
      assert.equal(await value(), '#ffffff');
      await click({ x: 170, y: 100 });
      const colour = await value();
      assert.ok(
        parseInt(colour.slice(1, 3), 16) > 245 && parseInt(colour.slice(3, 5), 16) < 10 && Math.abs(parseInt(colour.slice(1, 3), 16) - parseInt(colour.slice(5, 7), 16)) <= 1,
        'hue choice while white is used by subsequent triangle selection: ' + colour,
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
    } finally {
      await browser.close();
    }
  },
);

test(
  'colour gestures cancel cleanly and keyboard/locked selections stay scoped',
  { timeout: 60000 },
  async () => {
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const { page, studio, wheel, hex, move, value, errors } = await mount(browser);
      const initial = await value();
      await move({ x: 100, y: 100 });
      await page.mouse.down();
      await move(TRIANGLE.hue);
      await page.keyboard.press('Escape');
      assert.equal(await value(), initial);
      await page.mouse.up();
      for (const reason of ['pointercancel', 'lostpointercapture', 'blur']) {
        await move({ x: 100, y: 100 });
        await page.mouse.down();
        await move(TRIANGLE.black);
        if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        else
          await wheel.evaluate(
            (node, type) =>
              node.dispatchEvent(
                new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true }),
              ),
            reason,
          );
        assert.equal(await value(), initial, reason + ' restores colour');
        await page.mouse.up();
      }
      await move({ x: 100, y: 100 });
      await page.mouse.down();
      await move(TRIANGLE.hue);
      await studio.getByLabel('Workspace selection').selectOption('foreground');
      await page.mouse.up();
      const shape = await value();
      await studio.getByLabel('Workspace selection').selectOption('shape');
      assert.equal(await value(), initial, 'retarget cancels the originating colour only');
      await studio.getByLabel('Workspace selection').selectOption('foreground');
      assert.equal(await value(), shape);
      const triangle = studio.getByRole('group', { name: 'Colour triangle', exact: true }),
        hue = studio.getByRole('slider', { name: 'Colour hue', exact: true });
      await triangle.focus();
      await page.keyboard.press('Home');
      assert.equal(await value(), '#ffffff');
      await page.keyboard.press('End');
      assert.equal(await value(), '#000000');
      await page.keyboard.press('ArrowUp');
      assert.notEqual(await value(), '#000000');
      await hex.fill('#ff0000');
      await hex.press('Enter');
      await hue.focus();
      await page.keyboard.press('ArrowRight');
      assert.notEqual(await value(), '#ff0000');
      await studio.getByRole('tab', { name: 'Layers', exact: true }).click();
      await studio.getByLabel('Layer example', { exact: true }).selectOption('readonly');
      await studio.getByLabel('Workspace selection').selectOption('artwork');
      await studio.getByRole('tab', { name: 'Color', exact: true }).click();
      assert.ok(await hex.isDisabled());
      assert.equal(await hue.getAttribute('aria-disabled'), 'true');
      const locked = await value();
      await wheel.dispatchEvent('pointerdown', {
        clientX: 80,
        clientY: 80,
        button: 0,
        isPrimary: true,
        pointerId: 7,
      });
      assert.equal(await value(), locked);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  },
);

test(
  'colour wheel stays centred and usable in both themes, at narrow widths and with touch',
  { timeout: 60000 },
  async () => {
    await mkdir(output, { recursive: true });
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      for (const width of [1440, 390, 320])
        for (const theme of ['carbon', 'mist']) {
          const { page, studio, wheel, hex, point, value, errors } = await mount(
            browser,
            width,
            theme,
          );
          const geometry = await wheel.evaluate((n) => {
            const circle = n.querySelector('.ds-colour-hue'),
              triangle = n.querySelector('.ds-colour-triangle'),
              p = [...triangle.points];
            return {
              cx: circle.cx.baseVal.value,
              cy: circle.cy.baseVal.value,
              x: p.reduce((a, v) => a + v.x, 0) / 3,
              y: p.reduce((a, v) => a + v.y, 0) / 3,
            };
          });
          assert.ok(
            Math.abs(geometry.cx - geometry.x) < 0.01 && Math.abs(geometry.cy - geometry.y) < 0.01,
          );
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            ),
            0,
          );
          if (width < 520) {
            await hex.fill('#ff0000');
            await hex.press('Enter');
            await wheel.scrollIntoViewIfNeeded();
            const cdp = await page.context().newCDPSession(page),
              start = await point(ringPoint(0)),
              end = await point(ringPoint(120));
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchStart',
              touchPoints: [start],
            });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
            assert.equal(await value(), '#00ff00');
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await cdp.detach();
          }
          await studio
            .locator('.ds-studio-inspector')
            .screenshot({ path: `${output}/${theme}-${width}.png` });
          if (width === 1440 && theme === 'mist') {
            await page.emulateMedia({ forcedColors: 'active' });
          await page.keyboard.press('Tab');
            await studio.getByRole('slider', { name: 'Colour hue' }).focus();
            assert.equal(
              await studio
                .locator('.ds-studio-colour-wheel')
                .evaluate((n) => getComputedStyle(n).outlineStyle),
              'solid',
            );
          }
          assert.deepEqual(errors, []);
          await page.close();
        }
    } finally {
      await browser.close();
    }
  },
);
