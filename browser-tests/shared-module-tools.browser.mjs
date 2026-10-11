import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5198';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('one Text tool follows selection, retains its position, scopes edits and preserves unsaved recovery', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin, { textCount: 2 });
    const display = page.locator('[data-display-instance="display:primary"]').first();
    await display.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).focus();
    await page.keyboard.press('Enter');
    const tools = page.locator('.text-tools-window'), texts = page.locator('.text-window');
    const first = texts.nth(0), second = texts.nth(1);
    const body = module => module.getByRole('textbox', { name: 'Article text', exact: true });
    await body(first).focus(); await tools.waitFor(); assert.equal(await tools.count(), 1);
    await page.mouse.click(1540, 30);
    for (const module of [first, second]) {
      await module.hover();
      assert.equal(await module.locator('.text-window-bounds').evaluate(node => getComputedStyle(node).opacity), '0', 'hover never selects Text');
      assert.equal(await module.locator('.is-se').evaluate(node => getComputedStyle(node, '::after').opacity), '0', 'hover never reveals resize handles');
    }
    await body(first).click();
    assert.equal(await first.locator('.text-window-bounds').evaluate(node => getComputedStyle(node).opacity), '1');
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Text', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Document', exact: true }).click();
    await tools.getByRole('spinbutton', { name: 'Text size', exact: true }).fill('18');
    const grip = tools.getByLabel('Move Text tools window', { exact: true }), start = await grip.boundingBox();
    await page.mouse.move(start.x + 80, start.y + 15); await page.mouse.down();
    await page.mouse.move(1240, 90, { steps: 8 }); await page.mouse.up(); await settle(page);
    const beforeSwitch = await tools.boundingBox();
    await body(second).click(); await settle(page);
    assert.equal(await tools.count(), 1);
    assert.match(await tools.getAttribute('aria-label'), /Article 2/);
    await first.hover();
    assert.equal(await first.locator('.text-window-bounds').evaluate(node => getComputedStyle(node).opacity), '0');
    assert.equal(await second.locator('.text-window-bounds').evaluate(node => getComputedStyle(node).opacity), '1');
    const afterSwitch = await tools.boundingBox();
    assert.equal(afterSwitch.x, beforeSwitch.x); assert.equal(afterSwitch.y, beforeSwitch.y);
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Text', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Document', exact: true }).click();
    assert.equal(await tools.getByRole('spinbutton', { name: 'Text size', exact: true }).inputValue(), '16');
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Text', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Document', exact: true }).click();
    await tools.getByRole('spinbutton', { name: 'Text size', exact: true }).fill('22');
    await body(second).fill('Second article stays independent.'); await page.keyboard.press('Control+A');
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Text', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Selection', exact: true }).click();
    await tools.getByRole('button', { name: 'Bold', exact: true }).click();
    assert.equal(await body(second).locator('strong').innerText(), 'Second article stays independent.');
    assert.equal(await body(first).locator('strong').count(), 0);
    const saved = await page.evaluate(() => savedDraft().texts);
    assert.equal(saved[0].article.appearance.fontSize, 18); assert.equal(saved[1].article.appearance.fontSize, 22);

    await body(first).click(); await page.evaluate(() => { window.failSave = true; });
    await body(first).fill('Unsaved first article survives switching.');
    await tools.getByRole('button', { name: 'Retry local save', exact: true }).waitFor();
    await body(second).click(); await settle(page);
    assert.equal(await tools.getByRole('button', { name: 'Retry local save', exact: true }).count(), 0);
    await body(first).click(); await settle(page);
    assert.equal(await body(first).innerText(), 'Unsaved first article survives switching.');
    await page.evaluate(() => { window.failSave = false; });
    await tools.getByRole('button', { name: 'Retry local save', exact: true }).click();
    assert.equal(await tools.getByRole('alert').count(), 0);
    assert.equal((await page.evaluate(() => savedDraft().texts))[1].article.content.content[0].content[0].text, 'Second article stays independent.');

    await tools.getByRole('button', { name: 'Close Text tools', exact: true }).click();
    await body(second).click(); assert.equal(await tools.count(), 0, 'explicitly closed stays closed');
    await second.getByRole('button', { name: 'Text tools', exact: true }).click(); await tools.waitFor();
    await first.hover(); await first.getByRole('button', { name: 'Read', exact: true }).click();
    await first.getByRole('button', { name: 'Write', exact: true }).click(); await tools.waitFor();
    await body(second).click();
    await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('inscape:workbench:layout:'));
      const view = key && JSON.parse(localStorage.getItem(key)).views;
      return view?.['workbench:tools']?.targetId === savedDraft().texts[1].id && view?.['workbench:text-tools']?.open;
    });
    await page.screenshot({ path: '.browser-test-runtime/shared-text-tools-wide.png' });
    await page.reload(); await mountTextToolsFixture(page, origin, { textCount: 2 }); await tools.waitFor();
    assert.equal(await tools.count(), 1); assert.match(await tools.getAttribute('aria-label'), /Article 2/);
    await body(first).focus(); await page.setViewportSize({ width: 390, height: 900 }); await settle(page);
    const narrow = await tools.boundingBox(); assert.ok(narrow.x >= 0 && narrow.x + narrow.width <= 390);
    assert.equal(await tools.getByRole('separator').count(), 0);
    await page.screenshot({ path: '.browser-test-runtime/shared-text-tools-narrow.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Text tools switch between standalone articles and selected Text layers in Display', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin, { displayTextCount: 2 });
    const tools = page.locator('.text-tools-window'), standalone = page.locator('.text-window');
    const unlock = page.getByRole('button', { name: 'Unlock Display Module composition', exact: true });
    if (await unlock.count()) { await unlock.focus(); await page.keyboard.press('Enter'); }
    const first = page.getByRole('button', { name: 'Select Display article 1', exact: true });
    const second = page.getByRole('button', { name: 'Select Display article 2', exact: true });
    await first.focus(); await page.keyboard.press('Enter'); await tools.waitFor();
    assert.equal(await tools.count(), 1); assert.match(await tools.getAttribute('aria-label'), /Display article 1/);
    await first.getByRole('textbox', { name: 'Article text', exact: true }).fill('First embedded article.');
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Text', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Document', exact: true }).click();
    await tools.getByRole('spinbutton', { name: 'Text size', exact: true }).fill('19');
    await second.click();
    await second.getByRole('textbox', { name: 'Article text', exact: true }).waitFor();
    assert.equal(await tools.count(), 1); assert.match(await tools.getAttribute('aria-label'), /Display article 2/);
    await page.locator('.text-tools-window').getByRole('tab', { name: 'Text', exact: true }).click();
    await page.locator('.text-tools-window').getByRole('group', { name: 'Formatting target' }).getByRole('button', { name: 'Document', exact: true }).click();
    assert.equal(await tools.getByRole('spinbutton', { name: 'Text size', exact: true }).inputValue(), '16');
    await second.getByRole('textbox', { name: 'Article text', exact: true }).fill('Second embedded article.');
    await standalone.getByRole('textbox', { name: 'Article text', exact: true }).click();
    assert.equal(await tools.count(), 1); assert.match(await tools.getAttribute('aria-label'), /Titel kan rechtstreeks/);
    const saved = await page.evaluate(() => savedDraft());
    const placements = saved.grids.flatMap(grid => grid.placements).filter(item => item.kind === 'text');
    assert.equal(placements[0].text.article.appearance.fontSize, 19);
    assert.equal(placements[0].text.article.content.content[0].content[0].text, 'First embedded article.');
    assert.equal(placements[1].text.article.content.content[0].content[0].text, 'Second embedded article.');
    assert.equal(saved.texts[0].article.appearance.fontSize, 16);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Image, Text and Shape bounds follow activation rather than hover, including keyboard and touch', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const hasTouch of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, hasTouch });
      page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountTextToolsFixture(page, origin, { surfaces: true });
      await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
      const text = page.locator('.text-window'), image = page.locator('.image-module__window'), shape = page.locator('.shape-window');
      const visible = async () => ({
        text: await text.locator('.text-window-bounds').evaluate(node => getComputedStyle(node).opacity),
        image: await image.locator('.image-module__bounds').evaluate(node => getComputedStyle(node).opacity),
        shape: await shape.evaluate(node => { const style = getComputedStyle(node); return style.outlineStyle === 'none' ? '0px' : style.outlineWidth; }),
      });
      await page.mouse.click(1540, 30);
      for (const surface of [text, image, shape]) {
        await surface.hover();
        assert.deepEqual(await visible(), { text: '0', image: '0', shape: '0px' });
      }
      await image.click();
      assert.deepEqual(await visible(), { text: '0', image: '1', shape: '0px' });
      await shape.hover(); assert.equal((await visible()).shape, '0px');
      if (hasTouch) { const box = await shape.boundingBox(); await page.touchscreen.tap(box.x + 100, box.y + 100); }
      else await shape.click();
      assert.deepEqual(await visible(), { text: '0', image: '0', shape: '1px' });
      await text.getByRole('textbox', { name: 'Article text', exact: true }).focus();
      assert.deepEqual(await visible(), { text: '1', image: '0', shape: '0px' });
      await image.locator('.is-e').focus();
      assert.deepEqual(await visible(), { text: '0', image: '1', shape: '0px' });
      const before = await page.evaluate(() => savedDraft().imageModules[0].width);
      await page.keyboard.press('ArrowRight');
      assert.ok(await page.evaluate(() => savedDraft().imageModules[0].width) > before, 'keyboard resizing still works');
      await page.mouse.click(1540, 30);
      assert.deepEqual(await visible(), { text: '0', image: '0', shape: '0px' });
      assert.deepEqual(errors, []); await page.close();
    }
  } finally { await browser.close(); }
});
