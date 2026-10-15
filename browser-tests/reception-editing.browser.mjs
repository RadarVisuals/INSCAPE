import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_SCREENSHOT_DIR || 'output/reception-refinements';
const browserPath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const url = origin + '/browser-tests/profile-overview-fixture.html?view=0x' + '1'.repeat(40) + '&card=1&owner=1';
const key = 'inscape.system-workflow-draft.v1:0x' + '1'.repeat(40);
const launch = () => chromium.launch({ executablePath: browserPath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const routeFixture = route => new URL(route.request().url()).origin === origin ? route.continue()
  : route.request().url() === 'https://reception-card.invalid/portrait.webp' ? route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/skull_reaper/full.webp' }) : route.abort();
const readDraft = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);

for (const width of [1440, 390]) test(`reception is bounded and its sliding sheet never resizes the artwork at ${width}`, { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }); await page.route('**/*', routeFixture);
    await page.goto(url); await page.locator('.identity-module__clouds[data-shader="ready"]').waitFor();
    assert.equal(await page.locator('.profile-overview').evaluate(n => n.getBoundingClientRect().top), 0);
    await page.getByRole('button', { name: 'Expand INSCAPE details', exact: true }).click();
    await page.waitForTimeout(500);
    const profile = await page.evaluate(() => {
      const identity = document.querySelector('.profile-overview__identity'), intro = document.querySelector('.identity-module__intro').getBoundingClientRect();
      const portrait = document.querySelector('.identity-module__portrait').getBoundingClientRect(), fields = document.querySelector('.identity-module__extension').getBoundingClientRect();
      return { scroll: identity.scrollHeight - identity.clientHeight, gap: intro.bottom - portrait.bottom, fieldsHeight: fields.height, identity: identity.clientHeight };
    });
    assert.ok(profile.scroll <= 1, JSON.stringify(profile));
    if (width > 640) assert.ok(Math.abs(profile.gap) < 1, 'portrait is grounded at intro edge');
    assert.ok(profile.fieldsHeight < profile.identity * .3, 'short fields use their content height');
    await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/refined-${width}-profile.png` });
    await page.getByRole('button', { name: 'Collapse INSCAPE details', exact: true }).click(); await page.waitForTimeout(500);
    const motion = page.evaluate(async () => {
      const sheet = document.querySelector('.profile-overview__gallery'), tile = document.querySelector('.profile-overview__work--image'), source = tile.querySelector('[data-image-source]');
      const samples = [], start = performance.now();
      document.querySelector('[aria-label="Expand artwork"]').click();
      while (performance.now() - start < 650) {
        await new Promise(requestAnimationFrame);
        const rect = tile.getBoundingClientRect(), media = source.getBoundingClientRect();
        samples.push({ top: sheet.getBoundingClientRect().top, width: rect.width, height: rect.height, mediaWidth: media.width, mediaHeight: media.height });
      }
      return samples;
    });
    await page.waitForTimeout(120); await page.screenshot({ path: `${output}/refined-${width}-slide.png` });
    const samples = await motion;
    assert.ok(samples.length > 2); assert.ok(samples[0].top - samples.at(-1).top > 40, 'sheet travels upward');
    for (const dimension of ['width', 'height', 'mediaWidth', 'mediaHeight']) assert.ok(Math.max(...samples.map(v => v[dimension])) - Math.min(...samples.map(v => v[dimension])) < 1, `${dimension} must not grow`);
    assert.equal(await page.locator('.profile-overview__gallery').evaluate(n => Math.abs(n.getBoundingClientRect().top - n.closest('.bento-stage').getBoundingClientRect().top) < 1), true);
    assert.match(await page.locator('.profile-overview__gallery').evaluate(n => getComputedStyle(n, '::before').backdropFilter), /blur/);
    await page.screenshot({ path: `${output}/refined-${width}-artwork.png` });
  } finally { await browser.close(); }
});

test('verified owner crops, selects, reloads and cancels without changing published or canvas artwork', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); await page.route('**/*', routeFixture);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(url); await page.getByRole('button', { name: 'Edit reception', exact: true }).waitFor();
    const before = await readDraft(page), published = await page.evaluate(() => JSON.stringify(window.__overviewPublication));
    await page.getByRole('button', { name: 'Edit reception', exact: true }).click();
    await page.getByRole('link', { name: 'Edit reception crop for Artwork 1', exact: true }).click();
    await page.getByRole('dialog', { name: 'Reception crop', exact: true }).waitFor();
    await page.getByRole('slider', { name: 'Reception crop zoom' }).fill('2');
    await page.locator('.reception-crop__preview [data-media-state="ready"]').waitFor();
    const frame = page.locator('.reception-crop__preview');
    assert.ok(await frame.evaluate(n => n.querySelector('svg').getBoundingClientRect().width > n.clientWidth * .95), 'the artwork renderer fills its crop frame');
    const box = await frame.boundingBox();
    const oldX = await page.getByRole('slider', { name: 'Reception crop horizontal position' }).inputValue();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, { steps: 4 }); await page.mouse.up();
    assert.notEqual(await page.getByRole('slider', { name: 'Reception crop horizontal position' }).inputValue(), oldX, 'dragging pans the crop');
    await page.getByRole('slider', { name: 'Reception crop horizontal position' }).fill('0.65');
    await page.screenshot({ path: `${output}/crop-editor.png` });
    await page.getByRole('button', { name: 'Save crop', exact: true }).click();
    await page.getByRole('dialog', { name: 'Reception crop' }).waitFor({ state: 'detached' });
    const cropped = await readDraft(page);
    assert.equal(cropped.imageModules[0].sides[0].receptionCrop.zoom, 2);
    assert.deepEqual(cropped.imageModules[0].sides[0].crop, before.imageModules[0].sides[0].crop);
    assert.deepEqual(cropped.imageModules[0].sides[0].asset, before.imageModules[0].sides[0].asset);
    await page.getByRole('link', { name: 'Edit reception crop for Artwork 1', exact: true }).click();
    await page.getByRole('slider', { name: 'Reception crop zoom' }).fill('3'); await page.keyboard.press('Escape');
    assert.deepEqual(await readDraft(page), cropped, 'Escape discards unsaved crop');
    await page.getByRole('button', { name: 'Choose artwork', exact: true }).click();
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Artwork 1 image', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Artwork 5 image', exact: true }).check();
    await page.getByRole('button', { name: 'Save selection', exact: true }).click();
    assert.deepEqual((await readDraft(page)).reception.items, ['image:card-0', 'image:card-4']);
    assert.equal(await page.getByRole('link', { name: /Edit reception crop for/ }).count(), 2);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__overviewPublication)), published);
    await page.getByRole('button', { name: 'Done editing', exact: true }).click();
    assert.equal(await page.getByRole('link', { name: /Open Artwork/ }).count(), 16, 'public reception still uses verified publication');
    await page.reload(); await page.getByRole('button', { name: 'Edit reception', exact: true }).click();
    await page.getByRole('link', { name: 'Edit reception crop for Artwork 1', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Edit reception crop for/ }).count(), 2);
    await page.getByRole('link', { name: 'Edit reception crop for Artwork 1', exact: true }).click();
    assert.equal(await page.getByRole('slider', { name: 'Reception crop zoom' }).inputValue(), '2');
    await page.setViewportSize({ width: 390, height: 844 });
    const dialogBounds = await page.getByRole('dialog', { name: 'Reception crop' }).boundingBox();
    assert.ok(dialogBounds.x >= 0 && dialogBounds.x + dialogBounds.width <= 390 && dialogBounds.y >= 0 && dialogBounds.y + dialogBounds.height <= 844);
    await page.screenshot({ path: `${output}/crop-editor-phone.png` });
    assert.deepEqual(errors, []);
    const visitor = await browser.newPage(); await visitor.route('**/*', routeFixture); await visitor.goto(url.replace('&owner=1', ''));
    await visitor.locator('.profile-overview').waitFor(); assert.equal(await visitor.getByRole('button', { name: 'Edit reception', exact: true }).count(), 0);
    assert.equal(await visitor.evaluate(key => localStorage.getItem(key), key), null, 'public reception never opens draft storage');
  } finally { await browser.close(); }
});

test('curation keeps explicit public Image links and missing owner drafts recover without writes', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); await page.route('**/*', routeFixture);
    await page.goto(url.replace('&owner=1', '&curated=1&module=image%3Acard-4'));
    await page.getByRole('dialog', { name: 'Expanded work' }).waitFor();
    await page.waitForFunction(() => Number(document.querySelector('.bento-stage__expansion')?.style.getPropertyValue('--inspection-lift-progress')) === 1);
    await page.getByRole('button', { name: 'Return to card', exact: true }).click();
    await page.getByRole('dialog', { name: 'Expanded work' }).waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('link', { name: 'Open Artwork 5', exact: true }).count(), 1);
    await page.goto(url + '&missing-draft=1');
    await page.getByRole('button', { name: 'Edit reception', exact: true }).click();
    await page.getByRole('alert').getByText('Open this profile in Workbench first to load its published content before editing reception.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null);
    assert.equal(await page.getByRole('button', { name: 'Choose artwork', exact: true }).count(), 0);
  } finally { await browser.close(); }
});
