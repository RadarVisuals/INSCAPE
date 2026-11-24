import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { editorDestination, openEditorMenu, editorCommand } from './fixtures/editor-menu.mjs';

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
for (const width of [1440, 900]) test(`page settings remain editable in Studio and stay outside the composition preview at ${width}`, { timeout: 90000 }, async () => {
  const { browser, page, errors } = await setup(width);
  try {
    await page.goto(`${origin}/browser-tests/reception-native-editor-fixture.html?tiling=1&session=${crypto.randomUUID()}`);
    const read = () => page.evaluate(() => window.nativeReceptionFixture.root.getDraft().reception);
    const panel = page.getByRole('dialog', { name: 'Bento settings', exact: true });
    const openAppearance = async () => {
      await openEditorMenu(page, 'Bento');
      await panel.getByRole('button', { name: 'Page', exact: true }).click();
    };
    await openAppearance();
    const before = await read();
    const strength = panel.getByRole('slider', { name: 'Light strength', exact: true });
    await strength.press('End');
    const after = await read();
    assert.equal(after.lighting.strength, 1);
    assert.deepEqual(after.cells, before.cells);
    assert.deepEqual(after.workbench, before.workbench);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorCommand(page, 'Edit', 'Undo');
    assert.deepEqual(await read(), before);
    await editorCommand(page, 'Edit', 'Redo');
    assert.deepEqual(await read(), after);
    await openAppearance();
    const sample = panel.locator('.reception-atmosphere');
    for (const [label, direction, up, down] of [['Up', 'up', 1, 0], ['Both', 'both', 1, 1], ['Down', 'down', 0, 1]]) {
      await panel.getByRole('button', { name: label, exact: true }).click();
      assert.equal((await read()).lighting.direction, direction);
      assert.equal(await sample.locator('[data-side="up"]').count(), up);
      assert.equal(await sample.locator('[data-side="down"]').count(), down);
    }
    await panel.getByRole('slider', { name: 'Light position', exact: true }).press('End');
    await panel.getByRole('slider', { name: 'Light spread', exact: true }).press('Home');
    const enabled = await read();
    assert.equal(enabled.lighting.position, 1);
    assert.equal(enabled.lighting.spread, 0);
    const light = panel.getByRole('checkbox', { name: 'Light', exact: true });
    await light.uncheck();
    const off = await read();
    assert.deepEqual(off, { ...enabled, lighting: { ...enabled.lighting, enabled: false } });
    assert.equal(await strength.isDisabled(), true);
    assert.equal(await sample.count(), 0);
    await page.reload();
    await openAppearance();
    assert.equal(await light.isChecked(), false);
    await page.evaluate(() => window.nativeReceptionFixture.fail(true));
    await light.click();
    await panel.getByRole('alert').waitFor();
    assert.deepEqual(await read(), off);
    await page.evaluate(() => window.nativeReceptionFixture.fail(false));
    await light.check();
    assert.deepEqual(await read(), enabled);
    await panel.getByRole('button', { name: 'Close Bento', exact: true }).click();
    await editorDestination(page, 'Preview');
    const preview = page.getByRole('dialog', { name: 'Composition preview', exact: true });
    await preview.locator('.reception-document-canvas').waitFor();
    assert.equal(await preview.locator('[data-profile-header], .reception-atmosphere').count(), 0);
    assert.equal(await preview.getByRole('button', { name: 'Page appearance' }).count(), 0);
    await preview.getByRole('button', { name: 'Back to editing' }).click();
    assert.deepEqual(await read(), enabled);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
for (const [width, theme, small] of [[1920, 'dark'], [900, 'dark'], [900, 'light'], [1920, 'dark', true]])
test(`header and Bento share edges with preserved identity in public view at ${width} / ${theme}${small ? ' / small Bento' : ''}`, { timeout: 60000 }, async () => {
  const { browser, page, errors } = await setup(width);
  try {
    await page.goto(`${origin}/browser-tests/reception-atmosphere-fixture.html?public=1&${small ? 'small' : 'compact'}=1&theme=${theme}&longBio=1&session=${crypto.randomUUID()}`);
    await page.getByRole('heading', { name: 'nomad', exact: true }).waitFor();
    const profile = page.locator('.reception-profile');
    assert.ok((await profile.innerText()).includes('Self Expression'));
    assert.equal(await profile.getByRole('link', { name: 'VXCTXR on X' }).count(), 1);
    assert.equal((await profile.innerText()).includes('A long profile biography.'), false);
    assert.equal(await page.getByRole('button', { name: 'Back to editing' }).count(), 0);
    await page.locator('.reception-document-canvas').waitFor();
    const before = await snapshot(page);
    const alignment = await page.locator('[data-profile-page]').evaluate(node => {
      const canvas = node.querySelector('.reception-document-canvas').getBoundingClientRect();
      const avatar = node.querySelector('.reception-profile-avatar').getBoundingClientRect();
      const rails = getComputedStyle(node, '::before'), root = node.getBoundingClientRect();
      return { avatarLeft: avatar.left, canvasLeft: canvas.left, canvasRight: canvas.right,
        railLeft: root.left + parseFloat(rails.left), railRight: root.right - parseFloat(rails.right) };
    });
    for (const [actual, expected] of [['avatarLeft', 'canvasLeft'], ['railLeft', 'canvasLeft'], ['railRight', 'canvasRight']])
      assert.ok(Math.abs(alignment[actual] - alignment[expected]) <= 1, `${actual} follows ${expected}: ${JSON.stringify(alignment)}`);
    assert.ok(await page.locator('[data-profile-header]').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'compact Bento keeps the header within its available width');
    await page.screenshot({ path: `${output}/aligned-public-${width}-${theme}${small ? '-small' : ''}.png` });
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
