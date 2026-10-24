import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
const source = 'https://keepers.inscape.test/user-selected-octopus.svg';
const art = await readFile(new URL('./fixtures/keeper-octopus.svg', import.meta.url), 'utf8');
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
async function mount(page, visitor = false) {
  await mountTextToolsFixture(page, origin, { visitor, beforeImports: () => page.route(source, route => route.fulfill({ contentType: 'image/svg+xml', body: art })) });
}
async function seed(page) {
  await mount(page);
  await page.evaluate(async source => {
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { resolveLibraryImageAsset } = await import('/src/library/resolveLibraryImageAsset.js');
    const asset = await resolveLibraryImageAsset({ ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], selectedMedia: { url: source, width: 2048, height: 2048 } });
    const draft = window.savedDraft();
    draft.keeperDocks = [{ id: 'keeper:octopus', name: 'Octopus', asset, faces: 'right', movement: 'swim', size: 384, visibility: 'PUBLIC' }];
    draft.workbench.keeperDocks = [{ id: 'keeper:octopus', position: { left: 520, top: 280 } }];
    localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
  }, source);
  await page.reload(); await mount(page);
  await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
  await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
}
const sample = page => page.locator('.keeper-octopus').evaluate(node => ({
  paths: [...node.querySelectorAll('[data-keeper-part^="tentacle-"]')].map(p => p.getAttribute('d')),
  eyes: [...node.querySelectorAll('clipPath path')].map(p => p.getAttribute('d')),
  gaze: [...node.querySelectorAll('[data-keeper-gaze]')].map(p => p.getAttribute('transform')),
  drops: [...node.querySelectorAll('[data-keeper-drops] > path')].filter(p => p.style.display !== 'none').length,
}));
const arrives = (page, x, y) => page.waitForFunction(({ x, y }) => {
  const r = document.querySelector('.keeper-roamer').getBoundingClientRect(); return Math.hypot(r.x - x, r.y - y) < 8;
}, { x, y });
async function clickHead(page) {
  // The idle head never becomes stationary; click its current visible centre.
  const box = await page.getByRole('button', { name: 'Talk to Octopus', exact: true }).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('Uploaded SVG supplies octopus geometry, embedded pixels and colors; hostile/oversized data is rejected', { timeout: 45000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage(); await page.goto(origin);
    const report = await page.evaluate(async art => {
      const { parseKeeperRig } = await import('/src/keeper/keeperRig.js');
      const doc = () => new DOMParser().parseFromString(art, 'image/svg+xml').documentElement;
      const rig = parseKeeperRig(doc()), failed = [];
      const changes = [
        s => s.querySelector('#body image').setAttribute('href', 'https://evil.invalid/image.webp'),
        s => s.querySelector('#body image').setAttribute('width', '99999'),
        s => s.querySelector('#tentacle-1').setAttribute('data-tip-x', 'Infinity'),
        s => s.querySelector('#tentacle-1 path').setAttribute('d', 'M0 0 L999999 3 Z'),
        s => s.querySelector('#tentacle-1 path').setAttribute('onload', 'alert(1)'),
        s => s.querySelector('#eye-1 [data-role="gaze"] path').setAttribute('fill', 'url(https://evil.invalid)'),
        s => s.querySelector('#eye-1').remove(),
        s => s.querySelector('#tentacle-1').id = 'tentacle-2',
        s => s.querySelector('stop').setAttribute('offset', '-1'),
        s => s.querySelector('stop').setAttribute('stop-color', 'url(https://evil.invalid)'),
        s => s.querySelector('#keeper').append(s.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'script')),
        s => s.querySelector('#eye-1').setAttribute('transform', 'scale(10)'),
        s => s.querySelector('#eye-1 [data-role="aperture"]').setAttribute('d', 'M0 0 L1 1 L2 0 Z'),
      ];
      changes.forEach((change, i) => { const s = doc(); change(s); try { parseKeeperRig(s); failed.push(i); } catch {} });
      const changed = doc(); changed.querySelector('#tentacle-1-gradient stop').setAttribute('stop-color', '#123456');
      return { kind: rig.kind, tentacles: rig.tentacles.length, eyes: rig.eyes.length, raster: rig.parts.length, failed,
        customColor: parseKeeperRig(changed).tentacles.find(t => t.id === 'tentacle-1').stops[0].color };
    }, art);
    assert.deepEqual(report, { kind: 'octopus', tentacles: 5, eyes: 3, raster: 1, failed: [], customColor: '#123456' });
  } finally { await browser.close(); }
});

test('Real dock animates eyes/tentacles/drops, steers, talks, recalls and preserves the selected Library asset and draft', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await seed(page);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    const saved = await page.evaluate(() => window.savedDraft());
    const before = await sample(page);
    await page.mouse.move(1300, 600); await page.waitForTimeout(250);
    const later = await sample(page);
    assert.notDeepEqual(later.paths, before.paths); assert.notDeepEqual(later.gaze, before.gaze);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-keeper-drops] > path')].some(p => p.style.display !== 'none'));
    await page.mouse.click(1100, 700); await arrives(page, 1100, 700);
    await page.mouse.move(750, 650); await page.mouse.down({ button: 'right' }); await arrives(page, 750, 650);
    await page.mouse.move(950, 650); await arrives(page, 950, 650); await page.mouse.up({ button: 'right' });
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved);
    await clickHead(page);
    await page.locator('.keeper-conversation').waitFor();
    const idle = await sample(page); await page.waitForTimeout(180);
    assert.notDeepEqual((await sample(page)).paths, idle.paths, 'chat retains gentle idle motion');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.keeper-conversation').count(), 0);
    await mkdir('.browser-test-runtime', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/keeper-octopus-wide.png' });
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.keeper-instance').dataset.keeperPhase === 'docked');
    const docked = await sample(page); await page.waitForTimeout(150);
    assert.deepEqual(await sample(page), docked, 'no docked drawing updates');
    assert.equal(docked.drops, 0, 'recall clears detached particles');
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved);
    await mount(page, true);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    assert.equal(await page.locator('[data-keeper-rig="octopus"]').count(), 1);
    await page.mouse.click(1100, 700); await arrives(page, 1100, 700);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Reduced motion and narrow viewport preserve controls; blur clears motion and droplets', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await seed(page); await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    await page.waitForTimeout(1600);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => document.querySelector('.keeper-instance').dataset.keeperPhase === 'docked');
    assert.equal((await sample(page)).drops, 0);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    const still = await sample(page); await page.mouse.move(1200, 700); await page.waitForTimeout(250);
    assert.deepEqual(await sample(page), still);
    await page.mouse.click(1350, 900);
    await page.locator('.keeper-tools').waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const box = await page.locator('.keeper-octopus').boundingBox();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844);
    assert.equal(await page.evaluate(() => window.savedDraft().keeperDocks[0].size), 384);
    await page.screenshot({ path: '.browser-test-runtime/keeper-octopus-narrow.png' });
    await clickHead(page);
    await page.locator('.keeper-conversation').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.keeper-conversation').count(), 0);
  } finally { await browser.close(); }
});

test('SVG float is the third choice: no mirrored turns, shared controls, saved selection and unchanged Layered swim', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    const release = page.getByRole('button', { name: 'Release Keeper', exact: true });
    const returning = page.getByRole('button', { name: 'Return Keeper', exact: true });
    const selector = page.getByRole('combobox', { name: 'Keeper movement', exact: true });
    const docked = () => page.waitForFunction(() => document.querySelector('.keeper-instance').dataset.keeperPhase === 'docked');
    const matrix = () => page.locator('[data-keeper-part="body"]').evaluate(node => {
      const m = node.transform.baseVal.consolidate().matrix; return { a: m.a, b: m.b, c: m.c, d: m.d };
    });
    const unmirrored = m => Math.abs(m.a * m.d - m.b * m.c - 1) < .001;
    await release.click();
    assert.deepEqual(await selector.locator('option').allTextContents(), ['Flip', 'Layered swim', 'SVG float']);
    await selector.selectOption('svg'); await docked(); await release.click();
    assert.equal(await page.getByRole('combobox', { name: 'Keeper artwork faces', exact: true }).count(), 0);
    const saved = await page.evaluate(() => window.savedDraft());
    assert.equal(saved.keeperDocks[0].movement, 'svg');
    for (const [x, y] of [[1100, 700], [700, 700], [700, 350], [700, 700]]) {
      await page.mouse.click(x, y); await arrives(page, x, y);
      const m = await matrix();
      assert.ok(unmirrored(m), 'head banks without reflecting its eye arrangement');
    }
    await page.screenshot({ path: '.browser-test-runtime/keeper-svg-left.png' });
    await clickHead(page); await page.locator('.keeper-conversation').waitFor();
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved, 'motion and dialogue do not rewrite the asset or draft');
    await returning.click(); await docked();
    await selector.selectOption('swim'); await release.click();
    await page.mouse.click(1100, 700); await arrives(page, 1100, 700);
    await page.mouse.click(700, 700); await arrives(page, 700, 700);
    assert.ok((await matrix()).d < -.95, 'Layered swim retains its original 360-degree heading');
    await returning.click(); await docked();
    await selector.selectOption('flip'); await release.click();
    assert.equal(await page.locator('.keeper-roamer > img').count(), 1);
    assert.equal(await page.locator('.keeper-octopus').count(), 0);
    await returning.click(); await docked(); await selector.selectOption('svg');
    await page.reload(); await mount(page);
    const closeText = page.getByRole('button', { name: 'Close Text tools', exact: true });
    if (await closeText.count()) await closeText.click();
    await release.click(); assert.equal(await selector.inputValue(), 'svg');
    await page.mouse.click(1100, 700); await arrives(page, 1100, 700);
    await page.mouse.click(700, 700); await arrives(page, 700, 700);
    assert.ok(unmirrored(await matrix()));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    const still = await sample(page);
    await page.setViewportSize({ width: 390, height: 844 }); await page.mouse.move(300, 200); await page.waitForTimeout(150);
    assert.deepEqual(await sample(page), still);
    assert.deepEqual(await matrix(), { a: 1, b: 0, c: 0, d: 1 });
    const box = await page.locator('.keeper-octopus').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    await page.screenshot({ path: '.browser-test-runtime/keeper-svg-narrow.png' });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
    await mount(page, true); await release.click();
    assert.equal(await page.locator('.keeper-instance').getAttribute('data-keeper-movement'), 'svg');
    await page.mouse.move(1000, 700); await page.mouse.down({ button: 'right' }); await arrives(page, 1000, 700);
    await page.mouse.move(700, 700); await arrives(page, 700, 700); await page.mouse.up({ button: 'right' });
    assert.ok(unmirrored(await matrix()));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
