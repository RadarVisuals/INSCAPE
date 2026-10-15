import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  chromium.executablePath(),
].find(path => existsSync(path));
const output = `${process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime'}/design-system`;
const sections = ['overview', 'foundations', 'components', 'patterns', 'tokens', 'coverage', 'guidance'];
async function mount(page, section = 'overview') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(`${origin}/design-system.html#${section}`);
  await page.locator('main h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (section === 'components') await page.locator('.ds-studio-baseline > summary').click();
  return errors;
}

for (const [width, height, touch] of [[1440, 1000, false], [390, 844, true], [320, 720, true]]) {
  test(`design-system reference is readable and navigable at ${width}px`, { timeout: 90000 }, async () => {
    await mkdir(output, { recursive: true });
    const browser = await chromium.launch({ executablePath, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch });
      const errors = await mount(page);
      for (const section of sections) {
        await page.locator(`nav a[href="#${section}"]`).click();
        await page.waitForFunction(id => document.querySelector(`nav a[href="#${id}"]`)?.getAttribute('aria-current') === 'page', section);
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(overflow.scroll <= overflow.width + 1, `${section} has no page overflow: ${JSON.stringify(overflow)}`);
        const focus = await page.locator('.ds-reference').evaluate(node => getComputedStyle(node).getPropertyValue('--color-focus').trim());
        assert.equal(focus, '#ebece7', `${section} uses neutral focus`);
        if (section === 'overview') assert.equal(await page.locator('.ds-card, .ds-note, .ds-stats').count(), 0, 'overview stays focused on the toolbar and themes');
        if (section === 'guidance') assert.equal(await page.locator('.ds-principles dt').count(), 6, 'principles remain available in implementation guidance');
        if (section !== 'overview') assert.equal(await page.locator('main').evaluate(node => document.activeElement === node), true, 'navigation places focus at content');
        if (['overview', 'foundations', 'components'].includes(section)) await page.screenshot({ path: `${output}/${section}-${width}.png`, fullPage: true });
      }
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), [], 'reference never creates a draft or preference');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('live examples retain real control states, theme separation, field access and popup focus return', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = await mount(page, 'components');
    await page.getByRole('link', { name: 'Skip to content' }).focus();
    await page.keyboard.press('Enter');
    assert.ok(page.url().endsWith('#components'), 'skip link preserves the selected section');
    assert.equal(await page.locator('main').evaluate(node => document.activeElement === node), true);
    const toggle = page.getByRole('button', { name: 'Toggle selection', exact: true });
    await toggle.scrollIntoViewIfNeeded();
    const box = await toggle.boundingBox();
    const resting = await toggle.evaluate(node => getComputedStyle(node).backgroundColor);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.notEqual(await toggle.evaluate(node => getComputedStyle(node).backgroundColor), resting);
    assert.equal(await toggle.evaluate(node => getComputedStyle(node).boxShadow), 'none');
    assert.deepEqual(await toggle.boundingBox(), box, 'selection preserves geometry');
    const disabled = page.getByRole('button', { name: 'Unavailable', exact: true });
    const disabledStyle = await disabled.evaluate(node => getComputedStyle(node).background);
    await disabled.hover();
    assert.equal(await disabled.evaluate(node => getComputedStyle(node).background), disabledStyle);
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    const search = page.getByRole('textbox', { name: 'Search actions' });
    assert.equal(await search.evaluate(node => document.activeElement === node), true);
    await search.fill('Horizontal');
    const command = page.getByRole('button', { name: 'Horizontal centre', exact: true });
    await page.keyboard.press('ArrowDown');
    assert.equal(await command.evaluate(node => document.activeElement === node), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Actions', exact: true }).evaluate(node => document.activeElement === node), true);
    const material = page.locator('.ds-live-controls');
    const light = await material.evaluate(node => getComputedStyle(node).background);
    await page.getByLabel('Preview surface').selectOption('mist');
    assert.notEqual(await material.evaluate(node => getComputedStyle(node).background), light, 'reference instruments invert between Carbon and Mist');
    await page.getByRole('complementary', { name: 'Properties preview', exact: true }).getByRole('button', { name: 'Rotate', exact: true }).click();
    await page.locator('.ds-properties-feedback').filter({ hasText: 'ROTATE' }).waitFor();
    await page.getByLabel('Image drop action').selectOption('replace');
    assert.equal(await page.getByLabel('Image drop action').inputValue(), 'replace');
    await page.getByRole('button', { name: 'Close example Properties' }).click();
    assert.equal(await page.getByRole('button', { name: 'Reopen example Properties' }).evaluate(node => document.activeElement === node), true);
    await page.getByRole('button', { name: 'Reopen example Properties' }).click();
    await page.getByLabel('Image drop action').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Inspect Image', exact: true }).evaluate(node => document.activeElement === node), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await toggle.evaluate(node => getComputedStyle(node).transitionDuration), '0s');
    await page.emulateMedia({ forcedColors: 'active' });
    await page.keyboard.press('Tab');
    await toggle.focus();
    const outline = await toggle.evaluate(node => ({ width: getComputedStyle(node).outlineWidth, style: getComputedStyle(node).outlineStyle }));
    assert.equal(outline.width, '2px'); assert.equal(outline.style, 'solid');
    await page.screenshot({ path: `${output}/components-forced-colours.png`, fullPage: true });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('token explorer finds aliases, preserves scoped overrides and recovers from empty search', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = await mount(page, 'tokens');
    const search = page.getByRole('searchbox', { name: 'Search tokens' });
    await search.fill('--tactile-surface');
    const rows = page.locator('.ds-token-list article');
    assert.ok(await rows.count() >= 2, 'normal and forced-colour definitions remain visible');
    assert.ok((await rows.allTextContents()).some(text => text.includes('var(--color-surface-subtle)')));
    assert.ok((await rows.allTextContents()).some(text => text.includes('Canvas')));
    await search.fill('--ds-shell-radius');
    assert.ok((await rows.allTextContents()).some(text => text.includes('var(--ds-control-radius)') && text.includes('Reference')), 'preview geometry is discoverable as a scoped reference token');
    await search.fill('no-such-inscape-token');
    await page.getByText('No tokens match.', { exact: false }).waitFor();
    await search.fill('--font-creation-toolbar');
    await page.getByText('"Inter Variable", Arial, sans-serif', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('overview and component minimal popups preserve dismissal, nested navigation and an integrated Add control', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    await mkdir(output, { recursive: true });
    for (const section of ['overview', 'components']) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width < 520 });
      try {
        const errors = await mount(page, section);
        await page.getByLabel('Preview surface').selectOption('mist');
        const toolbar = page.getByRole('toolbar', { name: 'Creation tools' });
        const edges = await toolbar.evaluate(node => {
          const bar = node.getBoundingClientRect(), buttons = [...node.querySelectorAll('button')].map(button => button.getBoundingClientRect());
          return { left: Math.min(...buttons.map(button => button.left)) - bar.left,
            right: bar.right - Math.max(...buttons.map(button => button.right)), shellRight: getComputedStyle(node, '::before').right };
        });
        assert.deepEqual(edges, { left: 4, right: 4, shellRight: '0px' }, 'all nine controls sit inside the same evenly padded shell');
        const shapes = page.getByRole('button', { name: 'Shapes', exact: true });
        await shapes.click();
        let popup = page.getByRole('dialog', { name: 'Shapes', exact: true });
        assert.equal(await popup.locator('header').count(), 0);
        assert.equal(await popup.getByRole('button').count(), 1, 'Shapes contains only its choice');
        await shapes.click();
        assert.equal(await page.getByRole('dialog').count(), 0, 'trigger toggles closed');
        await shapes.click();
        await page.locator('main h1').click();
        assert.equal(await page.getByRole('dialog').count(), 0, 'outside click closes');
        await shapes.click();
        await popup.screenshot({ path: `${output}/${section}-minimal-shapes-${width}.png` });
        await page.keyboard.press('Escape');
        assert.equal(await shapes.evaluate(node => node === document.activeElement), true);
        const add = page.getByRole('button', { name: 'Add module', exact: true });
        await add.click();
        popup = page.getByRole('dialog', { name: 'Add module', exact: true });
        assert.equal(await popup.locator('header').count(), 0);
        assert.equal(await popup.getByRole('button', { name: /Close/ }).count(), 0);
        await popup.getByRole('button', { name: 'Image', exact: true }).click();
        assert.match(await page.locator('.ds-overview-feedback, .ds-example-status').textContent(), /Add Image/);
        assert.equal(await add.evaluate(node => node === document.activeElement), true);
        const actions = page.getByRole('button', { name: 'Actions', exact: true });
        await actions.click();
        const search = page.getByRole('textbox', { name: 'Search actions' });
        const searchGeometry = await search.evaluate(node => {
          const field = node.getBoundingClientRect(), popup = node.closest('[role="dialog"]').getBoundingClientRect();
          return { left: field.left - popup.left, right: popup.right - field.right, divider: getComputedStyle(node.parentElement).borderBottomWidth };
        });
        assert.deepEqual(searchGeometry, { left: 4, right: 4, divider: '0px' }, 'search fills its row with balanced insets and no divider');
        assert.equal(await page.getByRole('button', { name: 'Close Actions', exact: true }).count(), 0);
        await page.getByRole('dialog', { name: 'Actions', exact: true }).screenshot({ path: `${output}/${section}-minimal-actions-${width}.png` });
        await page.getByRole('button', { name: 'Align', exact: true }).click();
        await page.getByRole('dialog', { name: 'Align', exact: true }).waitFor();
        const back = page.getByRole('button', { name: 'Back to Actions', exact: true });
        await back.click();
        await page.getByRole('button', { name: 'Align', exact: true }).click();
        await page.getByRole('dialog', { name: 'Align', exact: true }).screenshot({ path: `${output}/${section}-minimal-align-${width}.png` });
        await page.keyboard.press('ArrowDown');
        assert.equal(await back.evaluate(node => node === document.activeElement), true);
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.getByRole('button', { name: 'Horizontal centre' }).evaluate(node => node === document.activeElement), true);
        await page.keyboard.press('Enter');
        assert.match(await page.locator('.ds-overview-feedback, .ds-example-status').textContent(), /Horizontal centre/);
        assert.equal(await actions.evaluate(node => node === document.activeElement), true);
        assert.deepEqual(errors, []);
        assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});


test('review fixes preserve contrast, enlarged labels and readable source links', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = await mount(page, 'overview');
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('body *')].map(node => [node, parseFloat(getComputedStyle(node).fontSize)]);
      for (const [node, size] of sizes) node.style.fontSize = `${size * 2}px`;
    });
    const select = page.getByRole('button', { name: 'Select tool', exact: true });
    assert.ok(await select.evaluate(node => {
      const button = node.getBoundingClientRect(), label = node.querySelector('span').getBoundingClientRect();
      return label.left >= button.left && label.right <= button.right;
    }), 'enlarged label stays inside its selected background');
    await page.goto(`${origin}/design-system.html#foundations`); await page.reload();
    const contrast = await page.locator('.ds-themes [data-menu-surface="mist"] > small').evaluate(node => {
      const parse = value => value.match(/[\d.]+/g).map(Number);
      const blend = (front, back) => front.slice(0, 3).map((value, i) => value * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
      let bg = [255, 255, 255]; const chain = [];
      for (let p = node; p; p = p.parentElement) chain.unshift(p);
      for (const p of chain) bg = blend(parse(getComputedStyle(p).backgroundColor), bg);
      const fg = blend(parse(getComputedStyle(node).color), bg);
      const luminance = rgb => rgb.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
      return (Math.max(luminance(fg), luminance(bg)) + .05) / (Math.min(luminance(fg), luminance(bg)) + .05);
    });
    assert.ok(contrast >= 4.5, `Mist supporting text contrast: ${contrast}`);
    await page.goto(`${origin}/design-system.html#coverage`);
    const sources = page.locator('.ds-component-list > article > .ds-source');
    assert.equal(await sources.count(), 27);
    assert.ok(await sources.evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 24)), 'source links have a usable target');
    for (const file of ['module-surfaces.browser.mjs', 'workbench-index.browser.mjs', 'image-module.browser.mjs']) {
      const source = await browser.newPage();
      try {
        const href = await page.locator('a.ds-source').filter({ hasText: `browser-tests/${file}` }).first().getAttribute('href');
        await source.goto(new URL(href, origin).href);
        await source.getByLabel('Source code').waitFor();
        const code = await source.getByLabel('Source code').textContent();
        assert.match(code, /node:test/);
        assert.ok(!code.startsWith('export default "'), 'viewer shows the source itself, not an encoded JavaScript module');
      } finally { await source.close(); }
    }
    const retry = await browser.newPage();
    let fail = true;
    let rejectedRequests = 0;
    await retry.route(url => url.pathname.endsWith('/module-surfaces.browser.mjs') && url.searchParams.has('raw'), route => {
      if (fail) { rejectedRequests += 1; return route.abort(); }
      return route.continue();
    });
    await retry.goto(`${origin}/design-system.html?source=browser-tests%2Fmodule-surfaces.browser.mjs`);
    await retry.getByRole('button', { name: 'Try again' }).waitFor();
    assert.ok(rejectedRequests > 0, 'source failure is actually exercised regardless of Vite cache query ordering');
    fail = false;
    await retry.getByRole('button', { name: 'Try again' }).click();
    await retry.getByLabel('Source code').waitFor();
    await retry.goto(`${origin}/design-system.html?source=unregistered-file.js`);
    await retry.getByText('This file is not in the reference.', { exact: true }).waitFor();
    await retry.close();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('complete Properties examples preserve Image actions, fields, crop and local state', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    for (const width of [1440, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width < 520 });
      const errors = await mount(page, 'components');
      const panel = page.getByRole('complementary', { name: 'Properties preview', exact: true });
      const feedback = page.locator('.ds-properties-feedback');
      const state = page.getByLabel('Properties example state');
      assert.equal(await panel.getByRole('navigation', { name: 'Image actions' }).getByRole('button').count(), 6);
      await panel.getByRole('button', { name: 'Fit inside', exact: true }).click();
      await page.getByLabel('Image drop action').selectOption('replace');
      await page.getByLabel('Include Image in publication').uncheck();
      await panel.getByText('Dimensions…', { exact: true }).click();
      const size = panel.getByLabel('Image width');
      await size.fill('16');
      assert.equal(await size.evaluate(node => node.validity.valid), false);
      await size.fill('512'); await panel.getByRole('button', { name: 'Set size', exact: true }).click();
      assert.match(await feedback.innerText(), /512 × 192/);
      await page.getByLabel('Preview surface').selectOption('mist');
      await page.getByRole('button', { name: 'Close example Properties' }).click();
      const reopen = page.getByRole('button', { name: 'Reopen example Properties' });
      assert.ok(await reopen.evaluate(node => document.activeElement === node)); await reopen.click();
      assert.ok(await panel.getByRole('button', { name: 'Inspect Image', exact: true }).evaluate(node => document.activeElement === node));
      assert.equal(await size.inputValue(), '512');
      assert.equal(await page.getByLabel('Image drop action').inputValue(), 'replace');
      assert.equal(await page.getByLabel('Include Image in publication').isChecked(), false);
      assert.equal(await panel.getByRole('button', { name: 'Fit inside', exact: true }).getAttribute('aria-pressed'), 'true');
      await panel.getByRole('button', { name: 'Crop', exact: true }).click();
      const zoom = page.getByRole('slider', { name: 'Crop zoom' });
      assert.ok(await zoom.evaluate(node => document.activeElement === node));
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
      assert.ok(await panel.getByRole('button', { name: 'Crop', exact: true }).evaluate(node => document.activeElement === node));
      assert.equal(await panel.getByRole('button', { name: 'Fit inside', exact: true }).getAttribute('aria-pressed'), 'true', 'cancel preserves the previous fit');
      await panel.getByRole('button', { name: 'Crop', exact: true }).click(); await page.keyboard.press('ArrowRight');
      await panel.getByRole('button', { name: 'Done', exact: true }).click();
      assert.match(await feedback.innerText(), /105%/);
      assert.equal(await panel.getByRole('button', { name: 'Fill canvas', exact: true }).getAttribute('aria-pressed'), 'true');
      await panel.getByRole('button', { name: 'Remove Image side' }).click();
      assert.equal(await panel.getByRole('button', { name: 'Inspect Image', exact: true }).isDisabled(), true);
      assert.equal(await panel.getByRole('button', { name: 'Duplicate', exact: true }).isEnabled(), true, 'an empty module can still be duplicated');
      await state.selectOption('limit'); assert.equal(await panel.getByRole('button', { name: 'Duplicate', exact: true }).isDisabled(), true);
      await state.selectOption('busy'); assert.equal(await panel.getByRole('button', { name: 'Crop', exact: true }).isDisabled(), true);
      await state.selectOption('empty'); assert.equal(await page.getByLabel('Include Image in publication').isChecked(), false);
      await state.selectOption('artwork'); await page.getByRole('button', { name: 'Reset example', exact: true }).click();
      assert.equal(await page.getByLabel('Image drop action').inputValue(), 'append');
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []); assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('Display Properties covers single, multiple, grouped, locked, text and empty selection', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, hasTouch: true });
    const errors = await mount(page, 'components');
    await page.getByLabel('Properties for', { exact: true }).selectOption('display');
    const panel = page.getByRole('complementary', { name: 'Properties preview', exact: true });
    const state = page.getByLabel('Properties example state');
    assert.equal(await panel.getByRole('navigation', { name: 'Selection actions' }).getByRole('button').count(), 10);
    await panel.getByText('Dimensions…', { exact: true }).click();
    const width = panel.getByRole('spinbutton', { name: 'Width', exact: true });
    await width.fill('0'); await width.press('Enter');
    await panel.getByRole('alert').filter({ hasText: 'Use a size' }).waitFor();
    await width.press('Escape'); assert.equal(await width.inputValue(), '12');
    await width.fill('18'); await width.press('Enter'); assert.equal(await width.inputValue(), '18');
    await panel.getByRole('button', { name: 'Lift', exact: true }).click();
    assert.equal(await panel.getByRole('button', { name: 'Lift', exact: true }).getAttribute('aria-pressed'), 'true');
    await panel.getByRole('button', { name: 'Send to back', exact: true }).click();
    assert.equal(await panel.getByRole('button', { name: 'Move backward', exact: true }).isDisabled(), true);
    await panel.getByRole('button', { name: 'Crop', exact: true }).click();
    await panel.getByRole('button', { name: 'Native fit', exact: true }).click();
    await state.selectOption('multiple');
    assert.equal(await panel.getByRole('button', { name: 'Crop', exact: true }).isDisabled(), true);
    await panel.getByRole('button', { name: 'Group layers', exact: true }).click();
    await panel.getByRole('button', { name: 'Ungroup', exact: true }).click();
    await state.selectOption('group'); await panel.getByRole('button', { name: 'Ungroup', exact: true }).waitFor();
    await state.selectOption('locked');
    assert.equal(await panel.getByRole('button', { name: 'Rotate', exact: true }).isDisabled(), true);
    await panel.getByText('Dimensions…', { exact: true }).click(); assert.equal(await width.isDisabled(), true);
    await state.selectOption('text');
    assert.equal(await panel.getByRole('navigation', { name: 'Selection actions' }).getByRole('button').count(), 5);
    await panel.getByRole('button', { name: 'Edit Text', exact: true }).click();
    await state.selectOption('empty'); await panel.getByText('Select a layer to edit its properties.', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('navigation').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
  } finally { await browser.close(); }
});

test('Shape Properties retains rectangle, grid and legacy texture controls and disposable editing', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 1000 }, hasTouch: true });
    const errors = await mount(page, 'components');
    await page.getByLabel('Properties for', { exact: true }).selectOption('shape');
    const panel = page.getByRole('complementary', { name: 'Properties preview', exact: true });
    assert.equal(await panel.getByRole('navigation', { name: 'Shape actions' }).getByRole('button').count(), 6);
    await page.getByLabel('Shape name', { exact: true }).fill('Reference rectangle'); await page.getByLabel('Shape name', { exact: true }).press('Tab');
    await page.getByLabel('Preview surface').selectOption('mist');
    assert.equal(await page.getByLabel('Shape name', { exact: true }).inputValue(), 'Reference rectangle');
    await panel.getByRole('checkbox', { name: 'Show shape', exact: true }).uncheck();
    await panel.getByRole('checkbox', { name: 'Include in publication', exact: true }).uncheck();
    await panel.getByRole('slider', { name: 'Grain strength' }).focus(); await page.keyboard.press('ArrowRight');
    await panel.getByRole('button', { name: 'Duplicate shape', exact: true }).click();
    assert.equal(await panel.getByLabel('Choose shape').locator('option').count(), 4);
    assert.match(await page.getByLabel('Shape name', { exact: true }).inputValue(), /copy/);
    await panel.getByRole('button', { name: 'Delete shape', exact: true }).click();
    assert.equal(await panel.getByLabel('Choose shape').locator('option').count(), 3);
    await panel.getByLabel('Choose shape').selectOption('grid');
    await panel.getByLabel('Snap to this grid').uncheck();
    await panel.getByLabel('Grid spacing', { exact: true }).fill('32'); await panel.getByLabel('Grid spacing', { exact: true }).press('Tab');
    await panel.getByLabel('Line width', { exact: true }).fill('2'); await panel.getByLabel('Line width', { exact: true }).press('Enter');
    await panel.getByText('Dimensions…', { exact: true }).click();
    await panel.getByLabel('Shape width').fill('300'); await panel.getByLabel('Shape height').fill('200');
    await panel.getByRole('button', { name: 'Apply size', exact: true }).click();
    assert.equal(await panel.getByLabel('Shape width').inputValue(), '320');
    assert.equal(await panel.getByLabel('Shape height').inputValue(), '224');
    await panel.getByRole('button', { name: 'Make square', exact: true }).click();
    assert.equal(await panel.getByLabel('Shape height').inputValue(), '320');
    await panel.getByLabel('Choose shape').selectOption('texture');
    await panel.getByLabel('Noise scale', { exact: true }).fill('2'); await panel.getByLabel('Noise scale', { exact: true }).press('Enter');
    await panel.getByLabel('Noise strength', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('slider', { name: 'Grain strength' }).count(), 0);
    for (let index = 0; index < 3; index++) await panel.getByRole('button', { name: 'Delete shape', exact: true }).click();
    await panel.getByText('No shapes remain in this example. Reset to restore them.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset example', exact: true }).click();
    assert.equal(await panel.getByLabel('Choose shape').locator('option').count(), 3);
    await page.getByLabel('Properties example state').selectOption('limit');
    assert.equal(await panel.getByRole('button', { name: 'Duplicate shape', exact: true }).isDisabled(), true);
    const geometry = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(geometry.scroll <= geometry.client + 1);
    assert.deepEqual(errors, []); assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
  } finally { await browser.close(); }
});

test('Properties preview control inventory matches the running Image, Display and Shape panels', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const inventory = scope => scope.locator('button, input, select').evaluateAll(nodes => nodes.map(node => ({
    control: node.tagName === 'INPUT' ? node.type : node.tagName.toLowerCase(),
    name: node.getAttribute('aria-label') || (node.tagName === 'BUTTON' ? node.textContent : [...(node.labels || [])].map(label => label.textContent).join(' ')).replace(/\s+/g, ' ').trim(),
    min: node.getAttribute('min'), max: node.getAttribute('max'),
    step: node.type === 'number' || node.type === 'range' ? node.getAttribute('step') || '1' : null,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  try {
    const preview = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await mount(preview, 'components');
    for (const [variant, sample] of [['image', 'image'], ['display', 'layers'], ['shape', 'shape']]) {
      const actual = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      await actual.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await actual.goto(`${origin}/browser-tests/tool-chrome-fixture.html?sample=${sample}`);
      await actual.locator('.workbench-toolbar').waitFor();
      if (variant === 'image') await actual.getByRole('button', { name: 'Drop Library artwork into Image', exact: true }).focus();
      if (variant === 'shape') {
        await actual.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).first().focus();
        await actual.keyboard.press('Enter'); await actual.locator('.shape-fill').first().click();
      }
      if (variant === 'display') {
        await actual.getByRole('button', { name: 'Layers', exact: true }).click();
        await actual.locator('.system-workflow__layer-select').first().click();
      }
      const live = actual.locator('[data-context-tools] [data-workbench-inspection-target]');
      await live.getByText('Dimensions…', { exact: true }).click();
      await preview.getByLabel('Properties for', { exact: true }).selectOption(variant);
      if (variant === 'image') await preview.getByLabel('Properties example state').selectOption('empty');
      const example = preview.locator('.ds-properties-window > .system-workflow__detached-window-surface');
      await example.getByText('Dimensions…', { exact: true }).click();
      assert.deepEqual(await inventory(example), await inventory(live), `${variant} retains every control, field and size range`);
      if (variant === 'image') {
        const disabled = scope => scope.locator('button:disabled').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label') || node.textContent.trim()).sort());
        assert.deepEqual(await disabled(example), await disabled(live), 'empty Image availability matches the app');
      }
      await actual.close();
    }
  } finally { await browser.close(); }
});
