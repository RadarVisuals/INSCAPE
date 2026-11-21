import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorDestination, openEditorMenu, editorMenu, receptionPreviewControls } from './fixtures/editor-menu.mjs';

const origin = process.env.INSCAPE_TEST_ROOT || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_SCREENSHOT_DIR || '.verification/reception-atmosphere';
const snapshot = page => page.evaluate(() => window.atmosphereFixture.store.getReception());
async function setup(width = 1440) {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const artwork = await readFile('public/assets/actors/skull_reaper/full.webp');
  await page.route('https://api.universalprofile.cloud/image/**', route => route.fulfill({ contentType: 'image/webp', body: artwork }));
  await mkdir(output, { recursive: true });
  return { browser, page, errors };
}
test('light controls save one gesture, undo, reload and reach public presentation without altering Bento', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(`${origin}/browser-tests/reception-atmosphere-fixture.html?session=${crypto.randomUUID()}`);
    await page.getByRole('heading', { name: 'nomad', exact: true }).waitFor();
    const before = await snapshot(page);
    await (await receptionPreviewControls(page)).getByRole('button', { name: 'Page appearance', exact: true }).click();
    const tools = page.getByRole('complementary', { name: 'Page appearance settings' });
    const strength = tools.getByRole('slider', { name: 'Light strength', exact: true });
    await strength.press('End');
    const after = await snapshot(page);
    assert.equal(after.lighting.strength, 1);
    assert.deepEqual(after.cells, before.cells); assert.deepEqual(after.workbench, before.workbench);
    await tools.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.deepEqual(await snapshot(page), before);
    await tools.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.deepEqual(await snapshot(page), after);
    await page.reload();
    await (await receptionPreviewControls(page)).getByRole('button', { name: 'Page appearance', exact: true }).click();
    assert.equal(await strength.inputValue(), '100');
    await page.evaluate(() => window.atmosphereFixture.fail(true));
    await strength.press('Home');
    await page.getByRole('alert').waitFor(); assert.deepEqual(await snapshot(page), after);
    await page.evaluate(() => window.atmosphereFixture.fail(false));
    await tools.getByRole('button', { name: 'Undo', exact: true }).click();
    await tools.getByRole('slider', { name: 'Light position', exact: true }).press('End');
    await tools.getByRole('slider', { name: 'Light spread', exact: true }).press('Home');
    const saved = await snapshot(page);
    assert.equal(saved.lighting.position, 1); assert.equal(saved.lighting.spread, 0);
    const light = tools.getByRole('checkbox', { name: 'Light', exact: true });
    await light.focus(); await light.press('Space');
    const switchedOff = await snapshot(page);
    assert.deepEqual(switchedOff, { ...saved, lighting: { ...saved.lighting, enabled: false } });
    assert.equal(await page.locator('.reception-atmosphere').count(), 0, 'preview and settings sample turn off together');
    assert.equal(await strength.isDisabled(), true);
    assert.equal(await tools.getByRole('button', { name: 'Page background color', exact: true }).isEnabled(), true);
    await tools.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.deepEqual(await snapshot(page), saved);
    await tools.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.deepEqual(await snapshot(page), switchedOff);
    await page.reload();
    await (await receptionPreviewControls(page)).getByRole('button', { name: 'Page appearance', exact: true }).click();
    assert.equal(await light.isChecked(), false);
    assert.equal(await page.locator('.reception-atmosphere').count(), 0);
    await page.evaluate(() => window.atmosphereFixture.fail(true));
    await light.click();
    await page.getByRole('alert').waitFor();
    assert.equal(await light.isChecked(), false);
    assert.deepEqual(await snapshot(page), switchedOff, 'failed save leaves the light switched off');
    await page.evaluate(() => window.atmosphereFixture.fail(false));
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    assert.equal(await page.locator('.reception-atmosphere').count(), 0, 'public presentation respects Light off');
    await page.reload();
    await (await receptionPreviewControls(page)).getByRole('button', { name: 'Page appearance', exact: true }).click();
    await light.check();
    assert.deepEqual(await snapshot(page), saved, 'switching back on restores every light setting');
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    const painted = page.locator('[data-profile-header] > .reception-atmosphere');
    assert.equal(await painted.evaluate(node => node.style.getPropertyValue('--reception-light-position')), '100%');
    assert.deepEqual(await snapshot(page), saved);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('divider light direction is undoable, persists and renders on the selected side in public', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(`${origin}/browser-tests/reception-atmosphere-fixture.html?session=${crypto.randomUUID()}`);
    await (await receptionPreviewControls(page)).getByRole('button', { name: 'Page appearance', exact: true }).click();
    const tools = page.getByRole('complementary', { name: 'Page appearance settings' });
    const before = await snapshot(page);
    const painted = page.locator('[data-profile-header] > .reception-atmosphere');
    assert.equal(await painted.getAttribute('data-light-direction'), 'down');
    for (const [label, direction, up, down] of [['Up', 'up', 1, 0], ['Both', 'both', 1, 1], ['Down', 'down', 0, 1]]) {
      await tools.getByRole('button', { name: label, exact: true }).click();
      assert.equal((await snapshot(page)).lighting.direction, direction);
      assert.equal(await painted.locator('[data-side="up"]').count(), up);
      assert.equal(await painted.locator('[data-side="down"]').count(), down);
    }
    await tools.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await painted.getAttribute('data-light-direction'), 'both');
    await tools.getByRole('button', { name: 'Redo', exact: true }).click();
    assert.equal(await painted.getAttribute('data-light-direction'), 'down');
    await page.reload();
    assert.equal(await painted.getAttribute('data-light-direction'), 'down');
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    assert.equal(await painted.locator('[data-side="up"]').count(), 0);
    const header = await page.locator('[data-profile-header]').boundingBox();
    const down = await painted.locator('[data-side="down"]').boundingBox();
    assert.ok(Math.abs(down.y - (header.y + header.height - 1)) <= 1);
    assert.deepEqual((await snapshot(page)).cells, before.cells);
    assert.deepEqual((await snapshot(page)).workbench, before.workbench);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const [width, theme] of [[1440, 'dark'], [900, 'dark'], [900, 'light']]) test(`profile and atmosphere remain bounded at ${width} / ${theme}`, { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(width);
  try {
    await page.goto(`${origin}/browser-tests/reception-atmosphere-fixture.html?public=1&theme=${theme}&session=${crypto.randomUUID()}`);
    await page.getByRole('heading', { name: 'nomad', exact: true }).waitFor();
    await page.locator('.reception-document-canvas').waitFor();
    const header = await page.locator('[data-profile-header]').boundingBox();
    const canvas = await page.locator('.reception-document-canvas').boundingBox();
    assert.ok(canvas.y >= header.y + header.height, 'profile remains above authored content');
    assert.ok(await page.locator('.reception-page').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    assert.equal(await page.locator('.reception-atmosphere').evaluate(node => getComputedStyle(node).pointerEvents), 'none');
    assert.equal(await page.locator('.reception-atmosphere-light').evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.screenshot({ path: `${output}/public-${width}-${theme}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('preview width represents the whole page, survives a narrow round trip and never saves geometry', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(2560);
  try {
    await page.goto(`${origin}/browser-tests/reception-atmosphere-fixture.html?session=${crypto.randomUUID()}`);
    await page.locator('.reception-document-canvas').waitFor();
    const before = await snapshot(page), field = (await receptionPreviewControls(page)).getByRole('spinbutton', { name: 'Preview width in pixels', exact: true });
    const original = Number(await field.inputValue()); assert.ok(original > 1920);
    for (const width of [320, original]) {
      await field.fill(String(width)); await field.press('Enter');
      // CSS sizes the page before ResizeObserver updates the displayed measurement.
      await page.waitForFunction(width => document.querySelector('.reception-preview-page').clientWidth === width
        && document.querySelector('input[aria-label="Preview width in pixels"]').valueAsNumber === width, width);
      assert.equal(Number(await field.inputValue()), width);
      assert.ok(await page.locator('.reception-preview-page').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
      const header = await page.locator('[data-profile-header]').boundingBox();
      const source = await page.locator('[data-profile-header] .reception-atmosphere-bar').boundingBox();
      assert.ok(Math.abs(source.y - (header.y + header.height - 1)) <= 1, 'source stays on the divider after the header wraps');
      await page.getByRole('button', { name: 'Studio preview controls', exact: true }).click();
      const panel = await receptionPreviewControls(page);
      assert.ok(Number(await panel.getByRole('slider', { name: 'Preview width', exact: true }).getAttribute('max')) >= original,
        'closing the dropdown retains the largest available width');
    }
    assert.deepEqual(await snapshot(page), before); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('centered preview menu stays open during sizing, dismisses accessibly and retains navigation', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup();
  try {
    await page.goto(`${origin}/browser-tests/reception-atmosphere-fixture.html?session=${crypto.randomUUID()}`);
    const trigger = page.getByRole('button', { name: 'Studio preview controls', exact: true });
    await trigger.waitFor();
    const before = await snapshot(page), header = await page.locator('[data-profile-header]').boundingBox();
    const button = await trigger.boundingBox();
    assert.ok(Math.abs(button.x + button.width / 2 - (header.x + header.width / 2)) <= 1);
    const panel = await receptionPreviewControls(page);
    const slider = panel.getByRole('slider', { name: 'Preview width', exact: true });
    await slider.press('ArrowLeft');
    assert.equal(await panel.isVisible(), true);
    await panel.getByRole('button', { name: 'Fit', exact: true }).focus();
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    await receptionPreviewControls(page);
    await page.getByRole('heading', { name: 'nomad', exact: true }).click();
    await panel.waitFor({ state: 'hidden' });
    await receptionPreviewControls(page);
    await panel.getByRole('navigation', { name: 'Preview navigation' }).getByRole('button', { name: 'Reception', exact: true }).click();
    await page.getByRole('main', { name: 'nomad reception' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Studio preview controls', exact: true }).count(), 0);
    assert.deepEqual(await snapshot(page), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const width of [1440, 900]) test(`native Bento Page controls edit the same Reception light at ${width}`, { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(width);
  try {
    await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`);
    await page.getByRole('group', { name: 'Artwork bento cell', exact: true }).waitFor();
    await openEditorMenu(page, 'Bento');
    const panel = page.getByRole('dialog', { name: 'Bento settings' });
    await panel.getByRole('button', { name: 'Page', exact: true }).click();
    await panel.getByRole('slider', { name: 'Light strength', exact: true }).press('Home');
    assert.equal(await page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception.lighting.strength), 0);
    await panel.getByRole('slider', { name: 'Light strength', exact: true }).press('End');
    const light = panel.getByRole('checkbox', { name: 'Light', exact: true });
    await light.uncheck();
    const lighting = await page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception.lighting);
    assert.equal(lighting.enabled, false); assert.equal(lighting.strength, 1);
    assert.equal(await panel.locator('.reception-atmosphere').count(), 0);
    assert.equal(await panel.getByRole('slider', { name: 'Light strength', exact: true }).isDisabled(), true);
    await page.screenshot({ path: `${output}/light-off-editor-${width}.png` });
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorDestination(page, 'Preview');
    assert.equal(await page.locator('[data-profile-header] > .reception-atmosphere').count(), 0);
    await (await receptionPreviewControls(page)).getByRole('button', { name: 'Page appearance', exact: true }).click();
    const tools = page.getByRole('complementary', { name: 'Page appearance settings' });
    await tools.getByRole('checkbox', { name: 'Light', exact: true }).check();
    assert.equal(await page.locator('[data-profile-header] > .reception-atmosphere').evaluate(node => node.style.getPropertyValue('--reception-light-strength')), '1');
    await tools.getByRole('slider', { name: 'Light strength', exact: true }).press('Home');
    assert.equal(await page.locator('[data-profile-header] > .reception-atmosphere').evaluate(node => node.style.getPropertyValue('--reception-light-strength')), '0');
    await tools.getByRole('slider', { name: 'Light strength', exact: true }).press('End');
    await page.screenshot({ path: `${output}/light-on-preview-${width}.png` });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const publicView of [false, true]) for (const [width, theme, small] of [[1920, 'dark'], [900, 'dark'], [900, 'light'], [1920, 'dark', true]])
test(`header and Bento share edges with preserved identity in ${publicView ? 'public view' : 'Preview'} at ${width} / ${theme}${small ? ' / small Bento' : ''}`, { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(width);
  try {
    await page.goto(`${origin}/browser-tests/reception-atmosphere-fixture.html?${publicView ? 'public=1&' : ''}${small ? 'small' : 'compact'}=1&theme=${theme}&longBio=1&session=${crypto.randomUUID()}`);
    await page.getByRole('heading', { name: 'nomad', exact: true }).waitFor();
    const profile = page.locator('.reception-profile');
    assert.ok((await profile.innerText()).includes('Self Expression'));
    assert.equal(await profile.getByRole('link', { name: 'VXCTXR on X' }).count(), 1);
    assert.equal((await profile.innerText()).includes('A long profile biography.'), false);
    assert.equal(await page.getByRole('group', { name: 'Preview controls', exact: true }).count(), publicView ? 0 : 1);
    if (!publicView) assert.equal(await page.getByRole('button', { name: 'Back to editing' })
      .evaluate(node => Boolean(node.closest('[data-profile-header]'))), true);
    await page.locator('.reception-document-canvas').waitFor();
    const before = await snapshot(page);
    const alignment = await page.locator(publicView ? '[data-profile-page]' : '.reception-preview-page').evaluate(node => {
      const canvas = node.querySelector('.reception-document-canvas').getBoundingClientRect();
      const avatar = node.querySelector('.reception-profile-avatar').getBoundingClientRect();
      const controls = node.querySelector('.reception-preview-back, .reception-navigation').getBoundingClientRect();
      const rails = getComputedStyle(node, '::before'), root = node.getBoundingClientRect();
      return { avatarLeft: avatar.left, controlsRight: controls.right, canvasLeft: canvas.left, canvasRight: canvas.right,
        railLeft: root.left + parseFloat(rails.left), railRight: root.right - parseFloat(rails.right) };
    });
    for (const [actual, expected] of [['avatarLeft', 'canvasLeft'], ...(!small || !publicView ? [['controlsRight', 'canvasRight']] : []), ['railLeft', 'canvasLeft'], ['railRight', 'canvasRight']])
      assert.ok(Math.abs(alignment[actual] - alignment[expected]) <= 1, `${actual} follows ${expected}: ${JSON.stringify(alignment)}`);
    assert.ok(await page.locator('[data-profile-header]').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'compact Bento keeps the header within its available width');
    await page.screenshot({ path: `${output}/aligned-${publicView ? 'public' : 'preview'}-${width}-${theme}${small ? '-small' : ''}.png` });
    await page.setViewportSize({ width, height: 600 });
    await page.reload();
    await page.locator('.reception-document-canvas').waitFor();
    const shortCanvas = await page.locator('.reception-document-canvas').boundingBox();
    const shortAvatar = await page.locator('.reception-profile-avatar').boundingBox();
    assert.ok(Math.abs(shortCanvas.x - shortAvatar.x) <= 1, 'alignment survives a shorter scrolling window');
    assert.deepEqual(await snapshot(page), before, 'presentation and viewport changes preserve the saved Reception');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
